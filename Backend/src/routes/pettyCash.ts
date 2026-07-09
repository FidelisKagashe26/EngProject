import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";

const router = Router();

const pettyCashSchema = z.object({
  projectId: z.string().optional().default(""),
  transactionDate: z.string().date(),
  transactionType: z.enum(["Cash In", "Cash Out"]),
  description: z.string().min(3),
  amount: z.number().positive(),
  recordedBy: z.string().min(2),
  receiptRef: z.string().optional().default(""),
  status: z.enum(["Pending", "Reconciled"]).optional().default("Pending"),
  notes: z.string().optional().default(""),
});

// GET /petty-cash
router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const result = await db.query<{
      id: string;
      project_id: string | null;
      project_name: string | null;
      transaction_date: string;
      transaction_type: string;
      description: string;
      amount: string;
      recorded_by: string;
      receipt_ref: string | null;
      status: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        pc.id,
        pc.project_id,
        p.name AS project_name,
        pc.transaction_date::text,
        pc.transaction_type,
        pc.description,
        pc.amount::text,
        pc.recorded_by,
        pc.receipt_ref,
        pc.status,
        pc.notes,
        pc.created_at::text,
        pc.updated_at::text
      FROM engicost.petty_cash_transactions pc
      LEFT JOIN engicost.projects p ON p.id = pc.project_id
      WHERE pc.company_id = $1 AND pc.is_deleted = FALSE
      ORDER BY pc.transaction_date DESC, pc.created_at DESC
      `,
      [companyId],
    );

    const rows = result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name ?? "Main Office",
      transactionDate: row.transaction_date,
      transactionType: row.transaction_type,
      description: row.description,
      amount: Number(row.amount),
      recordedBy: row.recorded_by,
      receiptRef: row.receipt_ref ?? "",
      status: row.status,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Compute running summary
    const totalCashIn = rows
      .filter((r) => r.transactionType === "Cash In")
      .reduce((sum, r) => sum + r.amount, 0);
    const totalCashOut = rows
      .filter((r) => r.transactionType === "Cash Out")
      .reduce((sum, r) => sum + r.amount, 0);
    const pendingCount = rows.filter((r) => r.status === "Pending").length;

    res.json({
      summary: {
        totalCashIn,
        totalCashOut,
        pendingCount,
      },
      rows,
    });
  }),
);

// POST /petty-cash
router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const parsed = pettyCashSchema.parse({
      ...req.body,
      amount: toMoney(req.body.amount),
    });

    // Validate project if provided
    let projectName = "Main Office";
    if (parsed.projectId.trim().length > 0) {
      const projectResult = await db.query<{ name: string }>(
        "SELECT name FROM engicost.projects WHERE company_id = $1 AND id = $2 LIMIT 1",
        [companyId, parsed.projectId],
      );
      if (projectResult.rowCount === 0) {
        res.status(400).json({ message: "Selected project does not exist." });
        return;
      }
      projectName = projectResult.rows[0].name;
    }

    const inserted = await db.query<{
      id: string;
      project_id: string | null;
      transaction_date: string;
      transaction_type: string;
      description: string;
      amount: string;
      recorded_by: string;
      receipt_ref: string | null;
      status: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO engicost.petty_cash_transactions (
        id, company_id, project_id, transaction_date, transaction_type,
        description, amount, recorded_by, receipt_ref, status, notes
      ) VALUES (
        $1, $2, NULLIF($3, ''), $4, $5,
        $6, $7, $8, NULLIF($9, ''), $10, $11
      )
      RETURNING
        id,
        project_id,
        transaction_date::text,
        transaction_type,
        description,
        amount::text,
        recorded_by,
        receipt_ref,
        status,
        notes,
        created_at::text,
        updated_at::text
      `,
      [
        makeId("PC"),
        companyId,
        parsed.projectId,
        parsed.transactionDate,
        parsed.transactionType,
        parsed.description,
        parsed.amount,
        parsed.recordedBy,
        parsed.receiptRef,
        parsed.status,
        parsed.notes,
      ],
    );

    const row = inserted.rows[0];

    // Log activity
    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Recorded Petty Cash', 'Petty Cash', NULLIF($4, ''), $5, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        parsed.recordedBy,
        parsed.projectId,
        `${parsed.transactionType} of TZS ${parsed.amount.toLocaleString("en-TZ")} — ${parsed.description}`,
      ],
    );

    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      projectName,
      transactionDate: row.transaction_date,
      transactionType: row.transaction_type,
      description: row.description,
      amount: Number(row.amount),
      recordedBy: row.recorded_by,
      receiptRef: row.receipt_ref ?? "",
      status: row.status,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }),
);

router.patch(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const { id } = req.params;
    const parsed = pettyCashSchema.parse({
      ...req.body,
      amount: toMoney(req.body.amount),
    });

    let projectName = "Main Office";
    if (parsed.projectId.trim().length > 0) {
      const projectResult = await db.query<{ name: string }>(
        "SELECT name FROM engicost.projects WHERE company_id = $1 AND id = $2 LIMIT 1",
        [companyId, parsed.projectId],
      );
      if (projectResult.rowCount === 0) {
        res.status(400).json({ message: "Selected project does not exist." });
        return;
      }
      projectName = projectResult.rows[0].name;
    }

    const updated = await db.query<{
      id: string;
      project_id: string | null;
      transaction_date: string;
      transaction_type: string;
      description: string;
      amount: string;
      recorded_by: string;
      receipt_ref: string | null;
      status: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      UPDATE engicost.petty_cash_transactions
      SET
        project_id = NULLIF($3, ''),
        transaction_date = $4,
        transaction_type = $5,
        description = $6,
        amount = $7,
        recorded_by = $8,
        receipt_ref = NULLIF($9, ''),
        status = $10,
        notes = $11,
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      RETURNING id, project_id, transaction_date::text, transaction_type, description,
        amount::text, recorded_by, receipt_ref, status, notes, created_at::text, updated_at::text
      `,
      [
        companyId,
        id,
        parsed.projectId,
        parsed.transactionDate,
        parsed.transactionType,
        parsed.description,
        parsed.amount,
        parsed.recordedBy,
        parsed.receiptRef,
        parsed.status,
        parsed.notes,
      ],
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ message: "Petty cash entry not found." });
      return;
    }

    const row = updated.rows[0];
    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Updated Petty Cash', 'Petty Cash', NULLIF($4, ''), $5, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, parsed.recordedBy, parsed.projectId, "Updated petty cash entry " + id],
    );

    res.json({
      id: row.id,
      projectId: row.project_id,
      projectName,
      transactionDate: row.transaction_date,
      transactionType: row.transaction_type,
      description: row.description,
      amount: Number(row.amount),
      recordedBy: row.recorded_by,
      receiptRef: row.receipt_ref ?? "",
      status: row.status,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }),
);

// DELETE /petty-cash/:id (soft delete)
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const { id } = req.params;
    const deletedBy = req.body?.deletedBy || "System Admin";

    const existing = await db.query<{ project_id: string | null; amount: string }>(
      "SELECT project_id, amount::text FROM engicost.petty_cash_transactions WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE LIMIT 1",
      [companyId, id],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "Petty cash entry not found." });
      return;
    }

    await db.query(
      `
      UPDATE engicost.petty_cash_transactions
      SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      `,
      [companyId, id, deletedBy],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Deleted Petty Cash', 'Petty Cash', $4, $5, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, deletedBy, existing.rows[0].project_id, "Soft deleted petty cash entry " + id],
    );

    res.json({ message: "Petty cash entry deleted (soft delete)." });
  }),
);

router.patch(
  "/:id/restore",
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const { id } = req.params;
    const restoredBy = req.body?.restoredBy || "System Admin";

    const restored = await db.query<{ project_id: string | null }>(
      `
      UPDATE engicost.petty_cash_transactions
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      RETURNING project_id
      `,
      [companyId, id],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: "Deleted petty cash entry not found." });
      return;
    }

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Restored Petty Cash', 'Petty Cash', $4, $5, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, restoredBy, restored.rows[0].project_id, "Restored petty cash entry " + id],
    );

    res.json({ message: "Petty cash entry restored." });
  }),
);
export default router;
