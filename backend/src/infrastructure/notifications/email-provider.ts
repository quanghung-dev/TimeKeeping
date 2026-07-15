import { getEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

export interface EmailProvider { sendPasswordReset(email: string, resetUrl: string): Promise<void>; }

class ResendEmailProvider implements EmailProvider {
  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const env = getEnv();
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new AppError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Thieu RESEND_API_KEY hoac EMAIL_FROM");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: "Dat lai mat khau cham cong", html: `<p>Ban da yeu cau dat lai mat khau.</p><p><a href="${resetUrl}">Dat lai mat khau</a></p><p>Lien ket het han sau 30 phut.</p>` }),
    });
    if (!response.ok) throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Khong gui duoc email dat lai mat khau");
  }
}

export function getEmailProvider(): EmailProvider {
  if (getEnv().EMAIL_PROVIDER === "resend") return new ResendEmailProvider();
  throw new AppError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Chuc nang email chua duoc cau hinh");
}
