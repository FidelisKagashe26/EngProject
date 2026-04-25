import type { AuthTokenPayload } from "./auth";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthTokenPayload;
    }
  }
}

export {};
