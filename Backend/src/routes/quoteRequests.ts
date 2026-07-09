import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { sendQuoteNotificationEmail } from "../services/mailer";
import { handleAsync } from "./utils";

const router = Router();

// GET /quote-requests — list all (admin only)
router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{
      id: string;
      full_name: string;
      email: string;
      phone: string;
      service: string;
      message: string;
      status: string;
      created_at: string;
    }>(
      `
      SELECT id, full_name, email, phone, service, message, status, created_at::text
      FROM engicost.quote_requests
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      ORDER BY created_at DESC
      `,
      [companyId],
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        service: row.service,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
      })),
    );
  }),
);

// PATCH /quote-requests/:id/status — mark as Read or Replied
router.patch(
  "/:id/status",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);
    const { status } = req.body as { status?: string };

    const allowed = ["New", "Read", "Replied"];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ message: "Status must be one of: New, Read, Replied." });
      return;
    }

    const updated = await db.query<{ id: string }>(
      `
      UPDATE engicost.quote_requests
      SET status = $3
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      RETURNING id
      `,
      [companyId, id, status],
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ message: "Quote request not found." });
      return;
    }

    res.json({ message: "Status updated.", id });
  }),
);

// DELETE /quote-requests/:id — delete a request
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);

    const deleted = await db.query<{ id: string }>(
      'UPDATE engicost.quote_requests SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE RETURNING id',
      [companyId, id, req.authUser?.fullName ?? 'System Admin'],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: "Quote request not found." });
      return;
    }

    res.json({ message: "Quote request deleted." });
  }),
);


router.patch(
  '/:id/restore',
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);
    const restored = await db.query<{ id: string }>(
      'UPDATE engicost.quote_requests SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id',
      [companyId, id],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted quote request not found.' });
      return;
    }

    res.json({ message: 'Quote request restored successfully.' });
  }),
);
export default router;
