import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { initializeDatabase } from "./db/init";
import { db } from "./db/pool";
import { errorHandler } from "./middleware/errorHandler";
import apiRouter from "./routes";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  }),
);
app.use(express.json());

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
    console.log(
      `Configured database: ${env.dbHost}:${env.dbPort}/${env.dbName} (single-tenant mode)`,
    );
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap server:", error);
  process.exit(1);
});
