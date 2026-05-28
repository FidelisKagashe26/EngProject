import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
    return;
  }

  if (error instanceof Error) {
    // Check for common database/business logic errors
    const message = error.message || "Unexpected server error";
    
    if (message.includes("duplicate key value")) {
      res.status(409).json({
        code: "DUPLICATE_RECORD",
        message: "A record with this data already exists",
      });
      return;
    }
    
    if (message.includes("foreign key constraint")) {
      res.status(400).json({
        code: "INVALID_REFERENCE",
        message: "Invalid reference to related record",
      });
      return;
    }

    res.status(500).json({
      code: "INTERNAL_SERVER_ERROR",
      message,
    });
    return;
  }

  res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error",
  });
};
