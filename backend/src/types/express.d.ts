import type { AuthenticatedUser } from "../domain/models/user.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
