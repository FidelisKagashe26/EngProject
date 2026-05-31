import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { db } from "../db/pool";

const RESET_CONFIRMATION = "CONFIRM_RESET_PRODUCTION_DATA";

const quoteIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const cleanUploadDirectory = async (directoryName: "documents" | "gallery"): Promise<void> => {
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  const target = path.resolve(uploadRoot, directoryName);

  if (!target.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new Error(`Refusing to clean unexpected upload path: ${target}`);
  }

  await fs.rm(target, { force: true, recursive: true });
  await fs.mkdir(target, { recursive: true });
};

const resetProductionData = async (): Promise<void> => {
  if (process.env.RESET_PRODUCTION_DATA !== RESET_CONFIRMATION) {
    throw new Error(
      `Refusing to reset data. Set RESET_PRODUCTION_DATA=${RESET_CONFIRMATION} to continue.`,
    );
  }

  const adminEmail = (process.env.RESET_ADMIN_EMAIL ?? env.adminSeedEmail).trim().toLowerCase();
  const adminPassword = process.env.RESET_ADMIN_PASSWORD ?? env.adminSeedPassword;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("RESET_ADMIN_EMAIL must be a valid email address.");
  }

  if (adminPassword.length < 8) {
    throw new Error("RESET_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const tablesResult = await client.query<{ table_name: string }>(
      `
      SELECT tablename AS table_name
      FROM pg_tables
      WHERE schemaname = 'engicost'
      ORDER BY tablename
      `,
    );

    const tableNames = tablesResult.rows.map((row) => row.table_name);
    if (tableNames.length > 0) {
      const qualifiedTables = tableNames
        .map((tableName) => `engicost.${quoteIdentifier(tableName)}`)
        .join(", ");

      await client.query(`TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`);
    }

    const companyResult = await client.query<{ id: number }>(
      `
      INSERT INTO engicost.companies (name, email, phone, location, currency)
      VALUES ('DREGGAM Company Limited', 'info@dreggam.co.tz', '+255 754 000 100', 'Dar es Salaam, Tanzania', 'TZS')
      RETURNING id
      `,
    );

    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    await client.query(
      `
      INSERT INTO engicost.users (company_id, full_name, email, phone, role, status, password_hash, last_login)
      VALUES ($1, 'System Admin', $2, '+255 754 111 992', 'Admin', 'Active', $3, NULL)
      `,
      [companyResult.rows[0].id, adminEmail, adminPasswordHash],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await cleanUploadDirectory("documents");
  await cleanUploadDirectory("gallery");

  console.log(`Production data reset complete. Admin login email: ${adminEmail}`);
};

resetProductionData()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
