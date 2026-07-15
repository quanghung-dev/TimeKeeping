import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileService } from "../src/application/services/profile-service.js";
import { ProfileRepository } from "../src/infrastructure/repositories/profile-repository.js";
import { AppError } from "../src/common/errors/app-error.js";

import { resetEnvForTests } from "../src/config/env.js";

const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webpHeader = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4),
  Buffer.from("WEBP"),
]);

describe("ProfileService.updateAvatar validations", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_SSL = "false";
    process.env.JWT_ACCESS_SECRET = "access-secret-that-is-at-least-32-characters";
    process.env.JWT_REFRESH_SECRET = "refresh-secret-that-is-at-least-32-characters";
    process.env.TOKEN_HASH_SECRET = "hash-secret-that-is-at-least-32-characters";
    resetEnvForTests();
    vi.spyOn(ProfileRepository, "upsertAvatar").mockResolvedValue(undefined as any);
  });

  it("1. JPEG với image/jpeg - Thành công", async () => {
    await expect(
      ProfileService.updateAvatar("user-1", jpegHeader, "image/jpeg")
    ).resolves.not.toThrow();
    expect(ProfileRepository.upsertAvatar).toHaveBeenCalled();
  });

  it("2. JPEG với image/jpg - Thành công nhờ cơ chế chuẩn hóa", async () => {
    await expect(
      ProfileService.updateAvatar("user-1", jpegHeader, "image/jpg")
    ).resolves.not.toThrow();
    expect(ProfileRepository.upsertAvatar).toHaveBeenCalled();
  });

  it("3. PNG hợp lệ - Thành công", async () => {
    await expect(
      ProfileService.updateAvatar("user-1", pngHeader, "image/png")
    ).resolves.not.toThrow();
    expect(ProfileRepository.upsertAvatar).toHaveBeenCalled();
  });

  it("4. WebP hợp lệ - Thành công", async () => {
    await expect(
      ProfileService.updateAvatar("user-1", webpHeader, "image/webp")
    ).resolves.not.toThrow();
    expect(ProfileRepository.upsertAvatar).toHaveBeenCalled();
  });

  it("5. File giả mạo JPEG (Buffer không có signature đúng) - Thất bại", async () => {
    const fakeJpeg = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    await expect(
      ProfileService.updateAvatar("user-1", fakeJpeg, "image/jpeg")
    ).rejects.toThrowError(
      new AppError(400, "AVATAR_TYPE_INVALID", "Chi chap nhan JPEG, PNG hoac WebP hop le")
    );
  });

  it("6. MIME type và signature không khớp (MIME png nhưng signature jpeg) - Thất bại", async () => {
    await expect(
      ProfileService.updateAvatar("user-1", jpegHeader, "image/png")
    ).rejects.toThrowError(
      new AppError(400, "AVATAR_TYPE_INVALID", "Chi chap nhan JPEG, PNG hoac WebP hop le")
    );
  });

  it("7. File vượt giới hạn 2 MB - Thất bại", async () => {
    const hugeBuffer = Buffer.alloc(2_097_153);
    await expect(
      ProfileService.updateAvatar("user-1", hugeBuffer, "image/jpeg")
    ).rejects.toThrowError(
      new AppError(400, "AVATAR_SIZE_INVALID", "Anh dai dien phai nho hon hoac bang 2 MB")
    );
  });

  it("8. Body rỗng - Thất bại", async () => {
    const emptyBuffer = Buffer.alloc(0);
    await expect(
      ProfileService.updateAvatar("user-1", emptyBuffer, "image/jpeg")
    ).rejects.toThrowError(
      new AppError(400, "AVATAR_SIZE_INVALID", "Anh dai dien phai nho hon hoac bang 2 MB")
    );
  });
});
