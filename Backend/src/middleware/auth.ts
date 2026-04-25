import type { NextFunction, Request, Response } from "express";
import jwt, { TokenExpiredError, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthTokenPayload } from "../types/auth";

const unauthorized = (res: Response, message: string): void => {
  res.status(401).json({ message });
};

export const signAuthToken = (payload: AuthTokenPayload): string => {
  const signOptions: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(payload, env.jwtSecret, {
    ...signOptions,
  });
};

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const rawAuthHeader = req.headers.authorization;
  if (!rawAuthHeader) {
    unauthorized(res, "Authorization token is missing.");
    return;
  }

  const [type, token] = rawAuthHeader.split(" ");
  if (type !== "Bearer" || !token) {
    unauthorized(res, "Invalid authorization header format.");
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    req.authUser = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      unauthorized(res, "Session expired. Please sign in again.");
      return;
    }

    unauthorized(res, "Invalid token.");
  }
};
