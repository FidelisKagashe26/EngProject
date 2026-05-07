import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { initializeDatabase } from "./db/init";
import { db } from "./db/pool";
import { errorHandler } from "./middleware/errorHandler";
import apiRouter from "./routes";

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow /uploads images
}));

// ── Trust proxy (needed for correct IP behind nginx/reverse proxy) ────────────
app.set("trust proxy", 1);

// ── Global rate limit: 200 requests per 15 min per IP ────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
app.use(globalLimiter);

// ── Login rate limit: max 5 attempts per 15 min per IP ───────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
  message: { message: "Too many failed login attempts. Please try again in 15 minutes." },
});

const configuredOrigins = env.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (!env.isProduction) {
        // development mode — allow all origins
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" })); // limit request body size

// Serve uploaded files as static assets
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.status(200).json({
      message: "Backend is running",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      message: "Backend is running, database connection failed",
      db: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api", apiRouter);
app.use(errorHandler);

const bootstrap = async (): Promise<void> => {
  await initializeDatabase();
  app.listen(env.appPort, () => {
    console.log(`Server running at http://localhost:${env.appPort}`);
    console.log(`Mode: ${env.nodeEnv} | CORS origins: ${env.corsOrigin}`);
    console.log(
      `Configured database: ${env.dbHost}:${env.dbPort}/${env.dbName} (single-tenant mode)`,
    );
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server:", error);
  process.exit(1);
});
