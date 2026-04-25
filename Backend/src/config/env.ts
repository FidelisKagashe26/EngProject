import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  return value.trim().toLowerCase() === "true";
};

const parsedEmailPort = toNumber(process.env.EMAIL_PORT, 587);
const parsedEmailSecure =
  process.env.EMAIL_SECURE !== undefined
    ? toBoolean(process.env.EMAIL_SECURE, false)
    : parsedEmailPort === 465;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appPort: toNumber(process.env.PORT ?? process.env.APP_PORT, 5050),
  dbHost: process.env.DB_HOST ?? "127.0.0.1",
  dbPort: toNumber(process.env.DB_PORT, 5432),
  dbUser: process.env.DB_USER ?? "postgres",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME ?? "engicost_manager",
  dbSsl: process.env.DB_SSL === "true",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  jwtSecret:
    process.env.JWT_SECRET ??
    "engicost_dev_secret_change_this_for_production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  adminSeedEmail: process.env.ADMIN_EMAIL ?? "faraja.n@engicost.co.tz",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD ?? "Admin@12345",
  emailHost: process.env.EMAIL_HOST ?? "",
  emailPort: parsedEmailPort,
  emailSecure: parsedEmailSecure,
  emailUseTls: toBoolean(process.env.EMAIL_USE_TLS, true),
  emailHostUser: process.env.EMAIL_HOST_USER ?? "",
  emailHostPassword: process.env.EMAIL_HOST_PASSWORD ?? "",
  defaultFromEmail: process.env.DEFAULT_FROM_EMAIL ?? process.env.EMAIL_HOST_USER ?? "",
  otpExpiryMinutes: toNumber(process.env.OTP_EXPIRY_MINUTES, 10),
  otpResetTokenExpiresIn: process.env.OTP_RESET_TOKEN_EXPIRES_IN ?? "20m",
};
