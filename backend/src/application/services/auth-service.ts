import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { getEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { toPublicUser, type PublicUser, type UserRecord } from "../../domain/models/user.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { AuthRepository } from "../../infrastructure/repositories/auth-repository.js";
import { UserRepository } from "../../infrastructure/repositories/user-repository.js";
import {
  hashMetadata,
  hashToken,
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from "../../infrastructure/authentication/token-service.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from "../validators/auth-schemas.js";
import type { ForgotPasswordInput, ResetPasswordInput } from "../validators/auth-schemas.js";
import { getEmailProvider } from "../../infrastructure/notifications/email-provider.js";

export interface AuthRequestContext {
  ip: string;
  userAgent: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function contextHashes(context: AuthRequestContext): { ipHash: string; userAgent: string } {
  return {
    ipHash: hashMetadata(context.ip || "unknown"),
    userAgent: context.userAgent.slice(0, 500),
  };
}

async function createSession(
  user: UserRecord,
  context: AuthRequestContext,
  familyId?: string,
): Promise<AuthResult> {
  const refresh = await issueRefreshToken(user.id, familyId);
  const metadata = contextHashes(context);
  await AuthRepository.insertRefreshToken(getPool(), {
    id: refresh.tokenId,
    userId: user.id,
    familyId: refresh.familyId,
    tokenHash: hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
    ...metadata,
  });
  return {
    user: toPublicUser(user),
    accessToken: await issueAccessToken({ userId: user.id, email: user.email }),
    refreshToken: refresh.token,
  };
}

export class AuthService {
  static async register(input: RegisterInput, context: AuthRequestContext): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await UserRepository.findByEmail(getPool(), normalizedEmail);
    if (existing) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email da duoc su dung");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await withTransaction(async (client) => {
      const created = await UserRepository.create(
        client,
        { ...input, email: normalizedEmail },
        passwordHash,
      );
      await UserRepository.createDefaults(client, created.id);
      return created;
    });
    return createSession(user, context);
  }

  static async login(input: LoginInput, context: AuthRequestContext): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const emailHash = hashMetadata(normalizedEmail);
    const ipHash = hashMetadata(context.ip || "unknown");
    const failures = await AuthRepository.countRecentFailures(getPool(), emailHash, ipHash);
    if (failures >= 5) {
      throw new AppError(429, "LOGIN_RATE_LIMITED", "Qua nhieu lan dang nhap that bai, vui long thu lai sau");
    }

    const user = await UserRepository.findByEmail(getPool(), normalizedEmail);
    const valid = Boolean(user?.passwordHash) && (await bcrypt.compare(input.password, user!.passwordHash!));
    await AuthRepository.recordLoginAttempt(getPool(), emailHash, ipHash, valid);
    if (!user || !valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email hoac mat khau khong dung");
    }

    return createSession(user, context);
  }

  static async refresh(token: string, context: AuthRequestContext): Promise<AuthResult> {
    const payload = await verifyRefreshToken(token);
    const tokenHash = hashToken(token);
    const nextRefresh = await issueRefreshToken(payload.userId, payload.familyId);
    const metadata = contextHashes(context);

    const rotation = await withTransaction(async (client) => {
      const stored = await AuthRepository.findRefreshTokenForUpdate(client, tokenHash);
      if (!stored) return { kind: "invalid" as const };
      if (
        stored.userId !== payload.userId ||
        stored.id !== payload.tokenId ||
        stored.familyId !== payload.familyId
      ) {
        return { kind: "invalid" as const };
      }
      if (stored.revokedAt) {
        await AuthRepository.revokeFamily(client, stored.familyId);
        return { kind: "reuse" as const };
      }
      if (stored.expiresAt.getTime() <= Date.now()) {
        await AuthRepository.revokeByHash(client, tokenHash);
        return { kind: "expired" as const };
      }

      await AuthRepository.insertRefreshToken(client, {
        id: nextRefresh.tokenId,
        userId: payload.userId,
        familyId: payload.familyId,
        tokenHash: hashToken(nextRefresh.token),
        expiresAt: nextRefresh.expiresAt,
        ...metadata,
      });
      await AuthRepository.rotateRefreshToken(client, stored.id, nextRefresh.tokenId);
      const user = await UserRepository.findById(client, payload.userId);
      return user ? { kind: "success" as const, user } : { kind: "invalid" as const };
    });

    if (rotation.kind === "reuse") {
      throw new AppError(401, "REFRESH_TOKEN_REUSED", "Phien dang nhap da bi thu hoi vi token duoc tai su dung");
    }
    if (rotation.kind !== "success") {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token khong hop le hoac da het han");
    }

    return {
      user: toPublicUser(rotation.user),
      accessToken: await issueAccessToken({
        userId: rotation.user.id,
        email: rotation.user.email,
      }),
      refreshToken: nextRefresh.token,
    };
  }

  static async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await AuthRepository.revokeByHash(getPool(), hashToken(token));
  }

  static async me(userId: string): Promise<PublicUser> {
    const user = await UserRepository.findById(getPool(), userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Khong tim thay nguoi dung");
    return toPublicUser(user);
  }

  static async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await UserRepository.findById(getPool(), userId);
    if (!user?.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Mat khau hien tai khong dung");
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      throw new AppError(400, "PASSWORD_UNCHANGED", "Mat khau moi phai khac mat khau hien tai");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await withTransaction(async (client) => {
      await UserRepository.updatePassword(client, userId, passwordHash);
      await AuthRepository.revokeAllForUser(client, userId);
    });
  }

  static async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const provider = getEmailProvider();
    const user = await UserRepository.findByEmail(getPool(), input.email.trim().toLowerCase());
    if (!user) return;
    const token = randomBytes(32).toString("base64url");
    await AuthRepository.insertPasswordResetToken(getPool(), user.id, hashToken(token), new Date(Date.now() + 30 * 60_000));
    const resetUrl = `${getEnv().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
    await provider.sendPasswordReset(user.email, resetUrl);
  }

  static async resetPassword(input: ResetPasswordInput): Promise<void> {
    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const updated = await withTransaction(async (client) => {
      const userId = await AuthRepository.consumePasswordResetToken(client, hashToken(input.token));
      if (!userId) return false;
      await UserRepository.updatePassword(client, userId, passwordHash);
      await AuthRepository.revokeAllForUser(client, userId);
      return true;
    });
    if (!updated) throw new AppError(400, "PASSWORD_RESET_TOKEN_INVALID", "Lien ket dat lai mat khau khong hop le hoac da het han");
  }
}
