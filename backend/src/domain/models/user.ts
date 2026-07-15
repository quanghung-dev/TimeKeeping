export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface UserRecord extends AuthenticatedUser {
  passwordHash: string | null;
  displayName: string;
  timezone: string;
  company: string | null;
  jobTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  company: string | null;
  jobTitle: string | null;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timezone: user.timezone,
    company: user.company,
    jobTitle: user.jobTitle,
  };
}
