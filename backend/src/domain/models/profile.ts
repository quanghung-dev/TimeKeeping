export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  company: string | null;
  jobTitle: string | null;
  timezone: string;
  timeFormat: "12h" | "24h";
  language: "vi" | "en";
  weekStartsOn: number;
  currency: string;
  themeMode: "light" | "dark" | "system";
  accentColor: string;
  hasAvatar: boolean;
}

export interface UserAvatar {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  content: Buffer;
  contentHash: string;
}
