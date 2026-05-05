import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "../config/env";

type PasswordResetEmailInput = {
  to: string;
  fullName: string;
  otpCode: string;
  expiryMinutes: number;
};

type QuoteNotificationInput = {
  to: string;
  fullName: string;
  email: string;
  phone: string;
  service: string;
  message: string;
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

// ── Dynamic transporter — reads env at call time, not at module load ──
const isSmtpConfigured = (): boolean =>
  env.emailHost.trim().length > 0 &&
  env.emailHostUser.trim().length > 0 &&
  env.emailHostPassword.trim().length > 0;

const createTransporter = () => {
  if (!isSmtpConfigured()) return null;

  return nodemailer.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    requireTLS: env.emailUseTls && !env.emailSecure,
    auth: {
      user: env.emailHostUser,
      pass: env.emailHostPassword,
    },
    tls: {
      // Allow self-signed certs in dev; remove in production if needed
      rejectUnauthorized: env.nodeEnv === "production",
    },
  });
};

const getFromEmail = (): string => {
  const from = env.defaultFromEmail.trim().length > 0
    ? env.defaultFromEmail
    : env.emailHostUser;
  return from.trim();
};

export const getSmtpStatus = () => ({
  configured: isSmtpConfigured(),
  host: env.emailHost,
  port: env.emailPort,
  secure: env.emailSecure,
  useTls: env.emailUseTls,
  hostUser: env.emailHostUser,
  fromEmail: getFromEmail(),
});

export const ensureSmtpConfigured = (): void => {
  if (!isSmtpConfigured()) {
    throw new SmtpConfigurationError();
  }
};

const sendEmail = async (mail: Mail.Options): Promise<void> => {
  ensureSmtpConfigured();

  const transporter = createTransporter();
  if (!transporter) throw new SmtpConfigurationError();

  try {
    await transporter.sendMail(mail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown SMTP error";
    throw new SmtpDeliveryError(`Failed to send email: ${message}`);
  }
};

export const verifySmtpConnection = async (): Promise<void> => {
  ensureSmtpConfigured();

  const transporter = createTransporter();
  if (!transporter) throw new SmtpConfigurationError();

  try {
    await transporter.verify();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new SmtpDeliveryError(
      `SMTP connection test failed: ${message}`,
    );
  }
};

export const sendPasswordResetOtpEmail = async ({
  to,
  fullName,
  otpCode,
  expiryMinutes,
}: PasswordResetEmailInput): Promise<void> => {
  const subject = "DREGGAM — Password Reset OTP";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <div style="background:#0b2a53;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;">Password Reset</h2>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin-top:0;">Hello <strong>${fullName}</strong>,</p>
        <p>Use the OTP below to reset your password:</p>
        <div style="background:#ffffff;border:2px solid #f28c28;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;letter-spacing:10px;font-weight:700;color:#0b2a53;">${otpCode}</span>
        </div>
        <p>This OTP expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <p style="color:#64748b;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">DREGGAM Engineering — Precision in every detail.</p>
      </div>
    </div>
  `;

  const text = [
    `Hello ${fullName},`,
    "",
    `Your OTP is: ${otpCode}`,
    `Expires in: ${expiryMinutes} minutes`,
    "",
    "If you did not request this, ignore this email.",
    "",
    "DREGGAM Engineering",
  ].join("\n");

  await sendEmail({ from: getFromEmail(), to, subject, text, html });
};

export const sendOtpTestEmail = async (to: string): Promise<void> => {
  await verifySmtpConnection();

  await sendEmail({
    from: getFromEmail(),
    to,
    subject: "DREGGAM — SMTP Test",
    text: "SMTP test successful. Email service is configured correctly.",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a;">
        <div style="background:#0b2a53;padding:20px 28px;border-radius:10px 10px 0 0;">
          <h2 style="color:#fff;margin:0;font-size:18px;">SMTP Test</h2>
        </div>
        <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
          <p style="margin-top:0;">✅ SMTP is configured and working correctly.</p>
          <p style="color:#64748b;font-size:13px;">This is a test email from DREGGAM Manager.</p>
        </div>
      </div>
    `,
  });
};

export const sendQuoteNotificationEmail = async ({
  to,
  fullName,
  email,
  phone,
  service,
  message,
}: QuoteNotificationInput): Promise<void> => {
  if (!isSmtpConfigured()) return; // silently skip if SMTP not set up

  const subject = `New Quote Request from ${fullName}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <div style="background:#0b2a53;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;">New Quote Request</h2>
        <p style="color:#adc7f9;margin:4px 0 0;font-size:14px;">Received from your website contact form</p>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;width:140px;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Full Name</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <strong>${fullName}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Email</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <a href="mailto:${email}" style="color:#0b2a53;">${email}</a>
            </td>
          </tr>
          ${phone ? `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Phone</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <a href="tel:${phone}" style="color:#0b2a53;">${phone}</a>
            </td>
          </tr>` : ""}
          ${service ? `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Service</span>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">${service}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 0;vertical-align:top;">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;">Message</span>
            </td>
            <td style="padding:10px 0;">
              <p style="margin:0;white-space:pre-wrap;">${message}</p>
            </td>
          </tr>
        </table>
        <div style="margin-top:28px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#9a3412;">
            💡 Reply directly to this email to respond to the client, or log in to your admin panel to update the request status.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">DREGGAM Engineering — Precision in every detail.</p>
      </div>
    </div>
  `;

  const text = [
    `New Quote Request from ${fullName}`,
    "─────────────────────────────",
    `Email:   ${email}`,
    phone   ? `Phone:   ${phone}` : "",
    service ? `Service: ${service}` : "",
    "",
    `Message:\n${message}`,
    "",
    "Log in to your admin panel to manage this request.",
  ].filter(Boolean).join("\n");

  await sendEmail({
    from: getFromEmail(),
    to,
    replyTo: email,
    subject,
    text,
    html,
  });
};
