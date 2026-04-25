import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "../config/env";

type PasswordResetEmailInput = {
  to: string;
  fullName: string;
  otpCode: string;
  expiryMinutes: number;
};

export class SmtpConfigurationError extends Error {
  readonly code = "SMTP_NOT_CONFIGURED";

  constructor(
    message = "SMTP email configuration is missing. Set EMAIL_HOST, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD.",
  ) {
    super(message);
    this.name = "SmtpConfigurationError";
  }
}

export class SmtpDeliveryError extends Error {
  readonly code = "SMTP_DELIVERY_FAILED";

  constructor(message = "Unable to send email right now. Please try again.") {
    super(message);
    this.name = "SmtpDeliveryError";
  }
}

const smtpConfigured =
  env.emailHost.trim().length > 0 &&
  env.emailHostUser.trim().length > 0 &&
  env.emailHostPassword.trim().length > 0;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.emailHost,
      port: env.emailPort,
      secure: env.emailSecure,
      requireTLS: env.emailUseTls && !env.emailSecure,
      auth: {
        user: env.emailHostUser,
        pass: env.emailHostPassword,
      },
    })
  : null;

const getFromEmail = (): string => {
  const from = env.defaultFromEmail.trim().length > 0 ? env.defaultFromEmail : env.emailHostUser;
  return from.trim();
};

export const getSmtpStatus = () => ({
  configured: smtpConfigured,
  host: env.emailHost,
  port: env.emailPort,
  secure: env.emailSecure,
  useTls: env.emailUseTls,
  hostUser: env.emailHostUser,
  fromEmail: getFromEmail(),
});

export const ensureSmtpConfigured = (): void => {
  if (!smtpConfigured || !transporter) {
    throw new SmtpConfigurationError();
  }
};

const sendEmail = async (mail: Mail.Options): Promise<void> => {
  ensureSmtpConfigured();

  try {
    await transporter!.sendMail(mail);
  } catch {
    throw new SmtpDeliveryError();
  }
};

export const verifySmtpConnection = async (): Promise<void> => {
  ensureSmtpConfigured();

  try {
    await transporter!.verify();
  } catch {
    throw new SmtpDeliveryError(
      "SMTP connection test failed. Check host, port, credentials, and TLS settings.",
    );
  }
};

export const sendPasswordResetOtpEmail = async ({
  to,
  fullName,
  otpCode,
  expiryMinutes,
}: PasswordResetEmailInput): Promise<void> => {
  ensureSmtpConfigured();

  const subject = "EngiCost OTP for password reset";
  const text = [
    `Hello ${fullName},`,
    "",
    `Your one-time password (OTP) is: ${otpCode}`,
    `This OTP will expire in ${expiryMinutes} minutes.`,
    "",
    "If you did not request this reset, you can ignore this email.",
    "",
    "EngiCost Manager",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin-bottom: 8px;">Password Reset OTP</h2>
      <p style="margin-top: 0;">Hello ${fullName},</p>
      <p>Use the OTP below to continue resetting your password:</p>
      <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #0b2a53; margin: 16px 0;">${otpCode}</p>
      <p>This OTP expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p style="margin-top: 24px; color: #475569;">If you did not request this reset, you can ignore this email.</p>
      <p style="color: #475569;">EngiCost Manager</p>
    </div>
  `;

  await sendEmail({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
  });
};

export const sendOtpTestEmail = async (to: string): Promise<void> => {
  await verifySmtpConnection();

  await sendEmail({
    from: getFromEmail(),
    to,
    subject: "EngiCost SMTP test",
    text: "SMTP test success. OTP email service is configured correctly.",
    html: "<p>SMTP test success. OTP email service is configured correctly.</p>",
  });
};
