import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";
import { withTransaction } from "../db/transaction";
import { applyProjectSpend, type LedgerFailure } from "../services/projectLedger";

type PettyCashRow = {
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
};

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

    const outcome = await withTransaction<{
      failure: LedgerFailure | null;
      row: PettyCashRow | null;
    }>(async (client) => {
      // A project-linked Cash Out spends project money, so it books against the
      // project's operational budget exactly like an expense would. Cash In
      // tops the float back up and is not a project cost.
      if (parsed.transactionType === "Cash Out" && parsed.projectId.trim().length > 0) {
        // Hard cap: a project's petty-cash spending may never exceed its own
        // petty-cash float (allocation + top-ups − what has already been spent).
        const balResult = await client.query<{ petty_cash: string; spent: string; topped: string }>(
          `
          SELECT
            p.petty_cash::text AS petty_cash,
            COALESCE((SELECT SUM(amount) FROM engicost.petty_cash_transactions
                      WHERE company_id = $1 AND project_id = $2 AND transaction_type = 'Cash Out' AND is_deleted = FALSE), 0)::text AS spent,
            COALESCE((SELECT SUM(amount) FROM engicost.petty_cash_transactions
                      WHERE company_id = $1 AND project_id = $2 AND transaction_type = 'Cash In' AND is_deleted = FALSE), 0)::text AS topped
          FROM engicost.projects p
          WHERE p.company_id = $1 AND p.id = $2
          `,
          [companyId, parsed.projectId],
        );
        const bal = balResult.rows[0];
        const availablePettyCash =
          Number(bal?.petty_cash ?? 0) + Number(bal?.topped ?? 0) - Number(bal?.spent ?? 0);
        if (parsed.amount > availablePettyCash + 0.001) {
          return {
            failure: {
              message: `Cash out exceeds this project's available petty cash (${availablePettyCash.toLocaleString("en-TZ")}). Raise the project's petty cash or lower the amount.`,
              projectName,
              availableCash: availablePettyCash,
              remainingBudget: availablePettyCash,
              requestedAmount: parsed.amount,
            },
            row: null,
          };
        }

        const failure = await applyProjectSpend(client, {
          companyId,
          projectId: parsed.projectId,
          category: "operational",
          delta: parsed.amount,
          context: "petty cash cash out",
        });
        if (failure) {
          return { failure, row: null };
        }
      }

      const inserted = await client.query<PettyCashRow>(
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

      await client.query(
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

      return { failure: null, row: inserted.rows[0] };
    });

    if (outcome.failure || !outcome.row) {
      res.status(400).json(outcome.failure);
      return;
    }

    const row = outcome.row;

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

    const outcome = await withTransaction<{
      failure: LedgerFailure | null;
      row: PettyCashRow | null;
      notFound?: boolean;
    }>(async (client) => {
      const existing = await client.query<{
        project_id: string | null;
        transaction_type: string;
        amount: string;
      }>(
        `
        SELECT project_id, transaction_type, amount::text
        FROM engicost.petty_cash_transactions
        WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
        `,
        [companyId, id],
      );

      if (existing.rowCount === 0) {
        return { failure: null, row: null, notFound: true };
      }

      const before = existing.rows[0];

      // Unbook whatever the entry used to contribute, then book what it now
      // contributes. Doing both explicitly covers a changed amount, a switch
      // between Cash In and Cash Out, and a move to a different project.
      if (before.transaction_type === "Cash Out" && before.project_id) {
        const reversal = await applyProjectSpend(client, {
          companyId,
          projectId: before.project_id,
          category: "operational",
          delta: -Number(before.amount),
          context: "petty cash update",
        });
        if (reversal) {
          return { failure: reversal, row: null };
        }
      }

      if (parsed.transactionType === "Cash Out" && parsed.projectId.trim().length > 0) {
        const booking = await applyProjectSpend(client, {
          companyId,
          projectId: parsed.projectId,
          category: "operational",
          delta: parsed.amount,
          context: "petty cash cash out update",
        });
        if (booking) {
          return { failure: booking, row: null };
        }
      }

      const updated = await client.query<PettyCashRow>(
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

      await client.query(
        `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Updated Petty Cash', 'Petty Cash', NULLIF($4, ''), $5, '127.0.0.1 / Local Dev')
      `,
        [makeId("ACT"), companyId, parsed.recordedBy, parsed.projectId, "Updated petty cash entry " + id],
      );

      return { failure: null, row: updated.rows[0] };
    });

    if (outcome.notFound) {
      res.status(404).json({ message: "Petty cash entry not found." });
      return;
    }

    if (outcome.failure || !outcome.row) {
      res.status(400).json(outcome.failure);
      return;
    }

    const row = outcome.row;

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

    const deleted = await withTransaction(async (client) => {
      const existing = await client.query<{
        project_id: string | null;
        transaction_type: string;
        amount: string;
      }>(
        `
        SELECT project_id, transaction_type, amount::text
        FROM engicost.petty_cash_transactions
        WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
        `,
        [companyId, id],
      );

      if (existing.rowCount === 0) {
        return false;
      }

      const before = existing.rows[0];

      if (before.transaction_type === "Cash Out" && before.project_id) {
        await applyProjectSpend(client, {
          companyId,
          projectId: before.project_id,
          category: "operational",
          delta: -Number(before.amount),
          context: "petty cash deletion",
        });
      }

      await client.query(
        `
      UPDATE engicost.petty_cash_transactions
      SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      `,
        [companyId, id, deletedBy],
      );

      await client.query(
        `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Deleted Petty Cash', 'Petty Cash', $4, $5, '127.0.0.1 / Local Dev')
      `,
        [makeId("ACT"), companyId, deletedBy, before.project_id, "Soft deleted petty cash entry " + id],
      );

      return true;
    });

    if (!deleted) {
      res.status(404).json({ message: "Petty cash entry not found." });
      return;
    }

    res.json({ message: "Petty cash entry deleted (soft delete) and project spend reversed." });
  }),
);

router.patch(
  "/:id/restore",
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const { id } = req.params;
    const restoredBy = req.body?.restoredBy || "System Admin";

    const outcome = await withTransaction<{
      failure: LedgerFailure | null;
      notFound: boolean;
    }>(async (client) => {
      const restored = await client.query<{
        project_id: string | null;
        transaction_type: string;
        amount: string;
      }>(
        `
      UPDATE engicost.petty_cash_transactions
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      RETURNING project_id, transaction_type, amount::text
      `,
        [companyId, id],
      );

      if (restored.rowCount === 0) {
        return { failure: null, notFound: true };
      }

      const entry = restored.rows[0];

      // Restoring puts the spend back on the project, so it has to clear the
      // same capacity checks a fresh entry would.
      if (entry.transaction_type === "Cash Out" && entry.project_id) {
        const failure = await applyProjectSpend(client, {
          companyId,
          projectId: entry.project_id,
          category: "operational",
          delta: Number(entry.amount),
          context: "petty cash restore",
        });
        if (failure) {
          return { failure, notFound: false };
        }
      }

      await client.query(
        `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Restored Petty Cash', 'Petty Cash', $4, $5, '127.0.0.1 / Local Dev')
      `,
        [makeId("ACT"), companyId, restoredBy, entry.project_id, "Restored petty cash entry " + id],
      );

      return { failure: null, notFound: false };
    });

    if (outcome.notFound) {
      res.status(404).json({ message: "Deleted petty cash entry not found." });
      return;
    }

    if (outcome.failure) {
      res.status(400).json(outcome.failure);
      return;
    }

    res.json({ message: "Petty cash entry restored." });
  }),
);
export default router;
