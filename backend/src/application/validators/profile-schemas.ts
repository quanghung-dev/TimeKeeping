import { z } from "zod";

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  company: z.string().trim().max(150).nullable(),
  jobTitle: z.string().trim().max(100).nullable(),
  timezone: z.string().trim().min(1).max(100).refine(isTimezone, "Mui gio khong hop le"),
  timeFormat: z.enum(["12h", "24h"]),
  language: z.enum(["vi", "en"]),
  weekStartsOn: z.number().int().min(1).max(7),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  themeMode: z.enum(["light", "dark", "system"]),
  accentColor: z.string().trim().min(1).max(30),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
