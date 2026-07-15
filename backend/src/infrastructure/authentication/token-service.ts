import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

interface AccessPayload {
  userId: string;
  email: string;
}

interface RefreshPayload {
  userId: string;
  familyId: string;
  tokenId: string;
}

function secret(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function issueAccessToken(payload: AccessPayload): Promise<string> {
  const env = getEnv();
  return new SignJWT({ email: payload.email, tokenType: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secret(env.JWT_ACCESS_SECRET));
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  try {
    const { payload } = await jwtVerify(token, secret(getEnv().JWT_ACCESS_SECRET));
    if (
      payload.tokenType !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new Error("Invalid access token payload");
    }
    return { userId: payload.sub, email: payload.email };
  } catch {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "Phien dang nhap khong hop le");
  }
}

export async function issueRefreshToken(
  userId: string,
  familyId: string = randomUUID(),
): Promise<{ token: string; tokenId: string; familyId: string; expiresAt: Date }> {
  const env = getEnv();
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const token = await new SignJWT({ familyId, tokenType: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret(env.JWT_REFRESH_SECRET));

  return { token, tokenId, familyId, expiresAt };
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload> {
  try {
    const { payload } = await jwtVerify(token, secret(getEnv().JWT_REFRESH_SECRET));
    if (
      payload.tokenType !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.familyId !== "string"
    ) {
      throw new Error("Invalid refresh token payload");
    }
    return { userId: payload.sub, tokenId: payload.jti, familyId: payload.familyId };
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token khong hop le");
  }
}

export function hashToken(value: string): string {
  return createHmac("sha256", getEnv().TOKEN_HASH_SECRET).update(value).digest("hex");
}

export function hashMetadata(value: string): string {
  return hashToken(value.trim().toLowerCase());
}
