import { createHash } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { UserAvatar, UserProfile } from "../../domain/models/profile.js";
import { getPool } from "../../infrastructure/database/pool.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import { ProfileRepository } from "../../infrastructure/repositories/profile-repository.js";
import type { UpdateProfileInput } from "../validators/profile-schemas.js";

function detectImageType(content: Buffer): UserAvatar["contentType"] | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    content.length >= 8 &&
    content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    content.length >= 12 &&
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export class ProfileService {
  static async get(userId: string): Promise<UserProfile> {
    const profile = await ProfileRepository.get(getPool(), userId);
    if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Khong tim thay ho so");
    return profile;
  }

  static async update(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    await withTransaction(async (client) => {
      await ProfileRepository.updateUser(client, userId, input);
      await ProfileRepository.updateSettings(client, userId, input);
    });
    return this.get(userId);
  }

  static async updateAvatar(userId: string, content: Buffer, declaredType: string): Promise<void> {
    if (content.length === 0 || content.length > 2_097_152) {
      throw new AppError(400, "AVATAR_SIZE_INVALID", "Anh dai dien phai nho hon hoac bang 2 MB");
    }
    const detectedType = detectImageType(content);
    const normalizedDeclaredType = declaredType === "image/jpg" ? "image/jpeg" : declaredType;
    if (!detectedType || detectedType !== normalizedDeclaredType) {
      throw new AppError(400, "AVATAR_TYPE_INVALID", "Chi chap nhan JPEG, PNG hoac WebP hop le");
    }
    await ProfileRepository.upsertAvatar(getPool(), userId, {
      contentType: detectedType,
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
    });
  }

  static async getAvatar(userId: string): Promise<UserAvatar> {
    const avatar = await ProfileRepository.getAvatar(getPool(), userId);
    if (!avatar) throw new AppError(404, "AVATAR_NOT_FOUND", "Chua co anh dai dien");
    return avatar;
  }
}
