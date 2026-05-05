import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();

// GET /website-settings — get all settings
router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM engicost.website_settings WHERE company_id = $1`,
      [companyId],
    );

    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json(settings);
  }),
);

// PUT /website-settings — upsert all settings
router.put(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const body = req.body as Record<string, string>;

    const allowedKeys = [
      "phone_main",
      "phone_whatsapp",
      "email_main",
      "location",
      "hours",
      "social_facebook",
      "social_instagram",
      "social_linkedin",
      "social_twitter",
    ];

    for (const key of allowedKeys) {
      if (key in body) {
        await db.query(
          `
          INSERT INTO engicost.website_settings (company_id, key, value)
          VALUES ($1, $2, $3)
          ON CONFLICT (company_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `,
          [companyId, key, (body[key] ?? "").trim()],
        );
      }
    }

    // Return updated settings
    const result = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM engicost.website_settings WHERE company_id = $1`,
      [companyId],
    );

    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json(settings);
  }),
);

export default router;
