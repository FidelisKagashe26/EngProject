import { Pool } from "pg";
import { env } from "../config/env";

export const db = new Pool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
});
