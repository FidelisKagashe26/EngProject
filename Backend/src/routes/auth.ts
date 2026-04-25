import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt, { TokenExpiredError, type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { authenticateToken, signAuthToken } from "../middleware/auth";
import {
  getSmtpStatus,
  sendOtpTestEmail,
  sendPasswordResetOtpEmail,
  SmtpConfigurationError,
  SmtpDeliveryError,
} from "../services/mailer";
import type { AuthTokenPayload } from "../types/auth";
import { handleAsync } from "./utils";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8),
});

const requestPasswordResetOtpSchema = z.object({
  email: z.string().email(),
});

const verifyPasswordResetOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
});

const resetPasswordByOtpSchema = z.object({
  resetToken: z.string().min(12),
  newPassword: z.string().min(8),
});

const smtpTestSchema = z.object({
  to: z.string().email().optional(),
});

type UserRow = {
  id: number;
  company_id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  password_hash: string | null;
};

type PasswordResetOtpRow = {
  id: string;
  company_id: number;
  user_id: number;
  email: string;
  otp_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
};

type PasswordResetTokenPayload = {
  purpose: "password_reset";
  userId: number;
  companyId: number;
  email: string;
};

const mapUser = (row: UserRow) => ({
  id: row.id,
  companyId: row.company_id,
  fullName: row.full_name,
  email: row.email,
  role: row.role,
  status: row.status,
});

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const mapSmtpError = (
  error: unknown,
): {
  status: number;
  body: { message: string; code: string };
} | null => {
  if (error instanceof SmtpConfigurationError) {
    return {
      status: 503,
      body: {
        message:
          "Email service is not configured. Contact your administrator.",
        code: error.code,
      },
    };
  }

  if (error instanceof SmtpDeliveryError) {
    return {
      status: 502,
      body: {
        message: error.message,
        code: error.code,
      },
    };
  }

  return null;
};

const generateSixDigitOtp = (): string => {
  const value = Math.floor(Math.random() * 1_000_000);
  return String(value).padStart(6, "0");
};

const signPasswordResetToken = (payload: PasswordResetTokenPayload): string => {
  const signOptions: SignOptions = {
    expiresIn: env.otpResetTokenExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret, signOptions);
};

const verifyPasswordResetToken = (
  token: string,
): PasswordResetTokenPayload => {
  const payload = jwt.verify(token, env.jwtSecret) as PasswordResetTokenPayload;
  if (payload.purpose !== "password_reset") {
    throw new Error("Invalid password reset token.");
  }
  return payload;
};

router.post(
  "/login",
  handleAsync(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(parsed.email);

    const result = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, role, status, password_hash
      FROM engicost.users
      WHERE lower(email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (result.rowCount === 0) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const user = result.rows[0];
    if (user.status !== "Active") {
      res.status(403).json({ message: "Account is not active." });
      return;
    }

    const passwordHash = user.password_hash ?? "";
    if (passwordHash.length === 0) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }
    const isPasswordValid = await bcrypt.compare(parsed.password, passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const tokenPayload: AuthTokenPayload = {
      userId: user.id,
      companyId: user.company_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    const token = signAuthToken(tokenPayload);

    await db.query(
      `
      UPDATE engicost.users
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [user.id],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Login', 'Auth', NULL, 'User signed in successfully', $4)
      `,
      [
        makeId("ACT"),
        user.company_id,
        user.full_name,
        req.ip || "unknown",
      ],
    );

    res.json({
      token,
      user: mapUser(user),
    });
  }),
);

router.get(
  "/smtp/status",
  authenticateToken,
  handleAsync(async (_req, res) => {
    res.json(getSmtpStatus());
  }),
);

router.post(
  "/smtp/test",
  authenticateToken,
  handleAsync(async (req, res) => {
    const parsed = smtpTestSchema.parse(req.body ?? {});
    const fallbackEmail = req.authUser?.email ?? "";
    const recipient = normalizeEmail(parsed.to ?? fallbackEmail);

    if (recipient.length === 0) {
      res.status(400).json({ message: "A valid recipient email is required." });
      return;
    }

    try {
      await sendOtpTestEmail(recipient);
    } catch (error) {
      const smtpError = mapSmtpError(error);
      if (smtpError) {
        res.status(smtpError.status).json(smtpError.body);
        return;
      }

      res
        .status(500)
        .json({ message: "Failed to send SMTP test email.", code: "SMTP_UNKNOWN_ERROR" });
      return;
    }

    res.json({
      message: `SMTP test email sent to ${recipient}.`,
      recipient,
    });
  }),
);

router.post(
  "/forgot-password/request-otp",
  handleAsync(async (req, res) => {
    const parsed = requestPasswordResetOtpSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(parsed.email);

    const userResult = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, role, status, password_hash
      FROM engicost.users
      WHERE lower(email) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (userResult.rowCount === 0 || userResult.rows[0].status !== "Active") {
      res.json({
        message:
          "If an active account exists for that email, a 6-digit OTP has been sent.",
      });
      return;
    }

    const user = userResult.rows[0];
    const otpCode = generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiryMinutes = Math.max(env.otpExpiryMinutes, 1);

    await db.query(
      `
      DELETE FROM engicost.password_reset_otps
      WHERE company_id = $1 AND user_id = $2 AND consumed_at IS NULL
      `,
      [user.company_id, user.id],
    );

    await db.query(
      `
      INSERT INTO engicost.password_reset_otps (
        id, company_id, user_id, email, otp_hash, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW() + ($6::text || ' minutes')::interval
      )
      `,
      [makeId("OTP"), user.company_id, user.id, normalizedEmail, otpHash, String(expiryMinutes)],
    );

    try {
      await sendPasswordResetOtpEmail({
        to: user.email,
        fullName: user.full_name,
        otpCode,
        expiryMinutes,
      });
    } catch (error) {
      await db.query(
        `
        DELETE FROM engicost.password_reset_otps
        WHERE company_id = $1 AND user_id = $2 AND consumed_at IS NULL
        `,
        [user.company_id, user.id],
      );

      const smtpError = mapSmtpError(error);
      if (smtpError) {
        res.status(smtpError.status).json(smtpError.body);
        return;
      }

      res.status(500).json({
        message: "Failed to send OTP email. Please try again.",
        code: "SMTP_UNKNOWN_ERROR",
      });
      return;
    }

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Requested Password Reset OTP', 'Auth', NULL, 'User requested password reset OTP', $4)
      `,
      [makeId("ACT"), user.company_id, user.full_name, req.ip || "unknown"],
    );

    res.json({
      message: "OTP sent successfully.",
      expiresInMinutes: expiryMinutes,
    });
  }),
);

router.post(
  "/forgot-password/verify-otp",
  handleAsync(async (req, res) => {
    const parsed = verifyPasswordResetOtpSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(parsed.email);

    const otpResult = await db.query<PasswordResetOtpRow>(
      `
      SELECT id, company_id, user_id, email, otp_hash, expires_at::text, consumed_at::text, attempts
      FROM engicost.password_reset_otps
      WHERE lower(email) = $1
        AND consumed_at IS NULL
        AND expires_at >= NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (otpResult.rowCount === 0) {
      res.status(400).json({ message: "OTP is invalid or expired." });
      return;
    }

    const otpRow = otpResult.rows[0];
    if (otpRow.attempts >= 5) {
      res.status(429).json({
        message: "Too many invalid OTP attempts. Please request a new OTP.",
      });
      return;
    }

    const isValidOtp = await bcrypt.compare(parsed.otp, otpRow.otp_hash);
    if (!isValidOtp) {
      await db.query(
        `
        UPDATE engicost.password_reset_otps
        SET attempts = attempts + 1
        WHERE id = $1
        `,
        [otpRow.id],
      );

      res.status(400).json({ message: "OTP is invalid or expired." });
      return;
    }

    await db.query(
      `
      UPDATE engicost.password_reset_otps
      SET consumed_at = NOW()
      WHERE id = $1
      `,
      [otpRow.id],
    );

    const resetToken = signPasswordResetToken({
      purpose: "password_reset",
      userId: otpRow.user_id,
      companyId: otpRow.company_id,
      email: normalizedEmail,
    });

    res.json({
      message: "OTP verified successfully.",
      resetToken,
    });
  }),
);

router.post(
  "/forgot-password/reset",
  handleAsync(async (req, res) => {
    const parsed = resetPasswordByOtpSchema.parse(req.body);

    let tokenPayload: PasswordResetTokenPayload;
    try {
      tokenPayload = verifyPasswordResetToken(parsed.resetToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        res.status(401).json({ message: "Reset token expired. Request OTP again." });
        return;
      }

      res.status(401).json({ message: "Invalid reset token." });
      return;
    }

    const userResult = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, role, status, password_hash
      FROM engicost.users
      WHERE id = $1 AND company_id = $2 AND lower(email) = $3
      LIMIT 1
      `,
      [
        tokenPayload.userId,
        tokenPayload.companyId,
        normalizeEmail(tokenPayload.email),
      ],
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const user = userResult.rows[0];
    const nextPasswordHash = await bcrypt.hash(parsed.newPassword, 12);

    await db.query(
      `
      UPDATE engicost.users
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [user.id, nextPasswordHash],
    );

    await db.query(
      `
      DELETE FROM engicost.password_reset_otps
      WHERE company_id = $1 AND user_id = $2
      `,
      [user.company_id, user.id],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Reset Password via OTP', 'Auth', NULL, 'User reset account password using OTP', $4)
      `,
      [makeId("ACT"), user.company_id, user.full_name, req.ip || "unknown"],
    );

    res.json({ message: "Password reset successfully." });
  }),
);

router.get(
  "/me",
  authenticateToken,
  handleAsync(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const result = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, role, status, password_hash
      FROM engicost.users
      WHERE id = $1
      LIMIT 1
      `,
      [authUser.userId],
    );

    if (result.rowCount === 0) {
      res.status(401).json({ message: "User not found." });
      return;
    }

    const user = result.rows[0];
    if (user.status !== "Active") {
      res.status(403).json({ message: "Account is not active." });
      return;
    }

    res.json({ user: mapUser(user) });
  }),
);

router.post(
  "/change-password",
  authenticateToken,
  handleAsync(async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const parsed = changePasswordSchema.parse(req.body);

    const result = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, role, status, password_hash
      FROM engicost.users
      WHERE id = $1
      LIMIT 1
      `,
      [authUser.userId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const user = result.rows[0];
    const passwordHash = user.password_hash ?? "";
    if (passwordHash.length === 0) {
      res.status(401).json({ message: "Current password is incorrect." });
      return;
    }
    const oldPasswordValid = await bcrypt.compare(parsed.oldPassword, passwordHash);

    if (!oldPasswordValid) {
      res.status(401).json({ message: "Current password is incorrect." });
      return;
    }

    const newPasswordHash = await bcrypt.hash(parsed.newPassword, 12);
    await db.query(
      `
      UPDATE engicost.users
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [user.id, newPasswordHash],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Change Password', 'Auth', NULL, 'User changed account password', $4)
      `,
      [makeId("ACT"), user.company_id, user.full_name, req.ip || "unknown"],
    );

    res.json({ message: "Password updated successfully." });
  }),
);

router.post(
  "/logout",
  authenticateToken,
  handleAsync(async (req, res) => {
    const authUser = req.authUser;
    if (authUser) {
      await db.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Logout', 'Auth', NULL, 'User signed out', $4)
        `,
        [makeId("ACT"), authUser.companyId, authUser.fullName, req.ip || "unknown"],
      );
    }

    res.json({ message: "Logged out successfully." });
  }),
);

export default router;
