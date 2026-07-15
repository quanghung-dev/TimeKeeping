import type { Request, Response } from "express";
import type { UpdateProfileInput } from "../application/validators/profile-schemas.js";
import { ProfileService } from "../application/services/profile-service.js";
import { AppError } from "../common/errors/app-error.js";
import { requireUserId } from "../common/middleware/auth.js";
import { sendSuccess } from "../common/responses/api-response.js";

export class ProfileController {
  static async get(request: Request, response: Response): Promise<void> {
    sendSuccess(response, await ProfileService.get(requireUserId(request)), "Lay ho so thanh cong");
  }

  static async update(request: Request, response: Response): Promise<void> {
    const profile = await ProfileService.update(
      requireUserId(request),
      request.body as UpdateProfileInput,
    );
    sendSuccess(response, profile, "Cap nhat ho so thanh cong");
  }

  static async updateAvatar(request: Request, response: Response): Promise<void> {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(400, "AVATAR_BODY_INVALID", "Noi dung anh khong hop le");
    }
    const contentType = request.get("content-type")?.split(";")[0]?.trim() ?? "";
    await ProfileService.updateAvatar(requireUserId(request), request.body, contentType);
    sendSuccess(response, {}, "Cap nhat anh dai dien thanh cong");
  }

  static async avatar(request: Request, response: Response): Promise<void> {
    const avatar = await ProfileService.getAvatar(requireUserId(request));
    response.set({
      "Content-Type": avatar.contentType,
      "Cache-Control": "private, max-age=300",
      ETag: `\"${avatar.contentHash}\"`,
    });
    response.send(avatar.content);
  }
}
