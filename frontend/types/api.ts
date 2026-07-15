export type ErrorDetails = Record<string, string[]>;

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: ErrorDetails | null;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  company: string | null;
  jobTitle: string | null;
}

export interface AuthPayload {
  user: UserProfile;
}
