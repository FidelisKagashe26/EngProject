import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";
import { isAppliedApprovalStatus, requiresApproval, APPROVAL_THRESHOLDS } from "../services/approval";
import { withTransaction } from "../db/transaction";
import { applyProjectSpend, moveProjectSpend, type LedgerFailure } from "../services/projectLedger";

const router = Router();

/**
 * The single user-facing status for an expense, read off the approval state so
 * the two can never disagree.
 */
const displayStatus = (approvalStatus: string | null): string => {
  if (approvalStatus === "PENDING") return "Pending";
  if (approvalStatus === "REJECTED") return "Rejected";
  return "Approved";
};

type ExpenseRow = {
  id: string;
  project_id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  paid_by: string;
  payment_method: string;
  receipt_ref: string | null;
  status: string;
  notes: string | null;
  approval_status: string;
  created_at: string;
};

const expenseCategorySchema = z.object({
  name: z.string().min(2).max(100),
});

const expenseSchema = z.object({
  projectId: z.string().min(3),
  date: z.string().date(),
  category: z.string().min(2),
  description: z.string().min(3),
  amount: z.number().nonnegative(),
  paidBy: z.string().min(2),
  paymentMethod: z.string().min(2),
  receiptRef: z.string().optional().default(""),
  // Not accepted from the client. An expense's status is its approval state,
  // and having a second hand-picked field using the same words (Approved /
  // Pending / Rejected) meant a record could read "Approved" while the approval
  // system still held it as pending. It is now derived on read.
  status: z.string().optional(),
  notes: z.string().optional().default(""),
});

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{
      id: string;
      project_id: string;
      project_name: string;
      expense_date: string;
      category: string;
      description: string;
      amount: string;
      paid_by: string;
      payment_method: string;
      receipt_ref: string | null;
      status: string;
      notes: string | null;
      approval_status: string;
      created_at: string;
    }>(
      `
      SELECT
        e.id,
        e.project_id,
        p.name AS project_name,
        e.expense_date::text,
        e.category,
        e.description,
        e.amount::text,
        e.paid_by,
        e.payment_method,
        e.receipt_ref,
        e.status,
        e.notes,
        e.approval_status,
        e.created_at::text
      FROM engicost.expenses e
      JOIN engicost.projects p ON p.id = e.project_id
      WHERE e.company_id = $1 AND e.is_deleted = FALSE
      ORDER BY e.expense_date DESC, e.created_at DESC
      `,
      [companyId],
    );

    const [byCategory, byProject, monthlyTrend, categories] = await Promise.all([
      db.query<{ category: string; total: string }>(
        `
        SELECT category, COALESCE(SUM(amount), 0)::text AS total
        FROM engicost.expenses
        WHERE company_id = $1 AND is_deleted = FALSE
        GROUP BY category
        ORDER BY SUM(amount) DESC
        `,
        [companyId],
      ),
      db.query<{ project_name: string; total: string }>(
        `
        SELECT p.name AS project_name, COALESCE(SUM(e.amount), 0)::text AS total
        FROM engicost.expenses e
        JOIN engicost.projects p ON p.id = e.project_id
        WHERE e.company_id = $1 AND e.is_deleted = FALSE
        GROUP BY p.name
        ORDER BY SUM(e.amount) DESC
        `,
        [companyId],
      ),
      db.query<{ month_label: string; total: string }>(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('month', expense_date), 'Mon YYYY') AS month_label,
          COALESCE(SUM(amount), 0)::text AS total
        FROM engicost.expenses
        WHERE company_id = $1 AND is_deleted = FALSE
        GROUP BY DATE_TRUNC('month', expense_date)
        ORDER BY DATE_TRUNC('month', expense_date)
        `,
        [companyId],
      ),
      db.query<{ name: string }>(
        `
        SELECT name
        FROM engicost.expense_categories
        WHERE company_id = $1
        ORDER BY name
        `,
        [companyId],
      ),
    ]);

    res.json({
      categories: categories.rows.map((row) => row.name),
      rows: result.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        date: row.expense_date,
        category: row.category,
        description: row.description,
        amount: Number(row.amount),
        paidBy: row.paid_by,
        paymentMethod: row.payment_method,
        receiptRef: row.receipt_ref ?? "",
        status: displayStatus(row.approval_status),
        notes: row.notes ?? "",
        approvalStatus: row.approval_status,
        createdAt: row.created_at,
      })),
      charts: {
        byCategory: byCategory.rows.map((row) => ({
          label: row.category,
          total: Number(row.total),
        })),
        byProject: byProject.rows.map((row) => ({
          label: row.project_name,
          total: Number(row.total),
        })),
        monthlyTrend: monthlyTrend.rows.map((row) => ({
          month: row.month_label,
          total: Number(row.total),
        })),
      },
    });
  }),
);

router.post(
  "/categories",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = expenseCategorySchema.parse(req.body);
    const name = parsed.name.trim().replace(/\s+/g, " ");

    const existing = await db.query<{ id: string; name: string; created_at: string }>(
      `
      SELECT id, name, created_at::text
      FROM engicost.expense_categories
      WHERE company_id = $1 AND lower(name) = lower($2)
      LIMIT 1
      `,
      [companyId, name],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const row = existing.rows[0];
      res.json({ id: row.id, name: row.name, createdAt: row.created_at });
      return;
    }

    const inserted = await db.query<{ id: string; name: string; created_at: string }>(
      `
      INSERT INTO engicost.expense_categories (id, company_id, name)
      VALUES ($1, $2, $3)
      RETURNING id, name, created_at::text
      `,
      [makeId("EXCAT"), companyId, name],
    );

    const row = inserted.rows[0];
    res.status(201).json({ id: row.id, name: row.name, createdAt: row.created_at });
  }),
);

router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = expenseSchema.parse({
      ...req.body,
      amount: toMoney(req.body.amount),
    });

    // Check if approval required
    const needsApproval = requiresApproval("expenses", parsed.amount);
    const approvalStatus = needsApproval ? "PENDING" : "AUTO_APPROVED";
    const requestedBy = req.body.requestedBy || "System";

    const insertedExpenseId = makeId("EXP");

    const outcome = await withTransaction<{
      failure: LedgerFailure | null;
      row: ExpenseRow | null;
    }>(async (client) => {
      // Only approved spend moves project totals; a pending record is booked
      // later by the approvals route.
      if (!needsApproval) {
        const failure = await applyProjectSpend(client, {
          companyId,
          projectId: parsed.projectId,
          category: "operational",
          delta: parsed.amount,
          context: "expense",
        });
        if (failure) {
          return { failure, row: null };
        }
      }

      const inserted = await client.query<ExpenseRow>(
      `
      INSERT INTO engicost.expenses (
        id, company_id, project_id, expense_date, category, description,
        amount, paid_by, payment_method, receipt_ref, status, notes,
        approval_status, approval_requested_by, approval_requested_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, NOW()
      )
      RETURNING
        id,
        project_id,
        expense_date::text,
        category,
        description,
        amount::text,
        paid_by,
        payment_method,
        receipt_ref,
        status,
        notes,
        approval_status,
        created_at::text
      `,
        [
          insertedExpenseId,
          companyId,
          parsed.projectId,
          parsed.date,
          parsed.category,
          parsed.description,
          parsed.amount,
          parsed.paidBy,
          parsed.paymentMethod,
          parsed.receiptRef,
          displayStatus(approvalStatus),
          parsed.notes,
          approvalStatus,
          requestedBy,
        ],
      );

      await client.query(
        `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Added Expense', 'Expenses', $4, $5, '127.0.0.1 / Local Dev')
      `,
        [
          makeId("ACT"),
          companyId,
          requestedBy,
          parsed.projectId,
          needsApproval
            ? `Expense pending approval: TZS ${parsed.amount.toLocaleString("en-TZ")} (${parsed.category})`
            : `${parsed.category} expense recorded: TZS ${parsed.amount.toLocaleString("en-TZ")}`,
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
      date: row.expense_date,
      category: row.category,
      description: row.description,
      amount: Number(row.amount),
      paidBy: row.paid_by,
      paymentMethod: row.payment_method,
      receiptRef: row.receipt_ref ?? "",
      status: displayStatus(row.approval_status),
      notes: row.notes ?? "",
      approvalStatus: row.approval_status,
      requiresApproval: needsApproval,
      threshold: APPROVAL_THRESHOLDS.expenses,
      createdAt: row.created_at,
    });
  }),
);

router.patch(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const expenseId = String(req.params.id);

    const updateSchema = expenseSchema.partial();
    const parsed = updateSchema.parse({
      ...req.body,
      amount: req.body.amount !== undefined ? toMoney(req.body.amount) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      amount: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount::text, approval_status
      FROM engicost.expenses
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, expenseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Expense not found." });
      return;
    }

    const oldExpense = result.rows[0];
    const oldAmount = Number(oldExpense.amount);
    const newAmount = parsed.amount ?? oldAmount;
    const newProjectId = parsed.projectId ?? oldExpense.project_id;
    const amountDifference = newAmount - oldAmount;

    if (parsed.projectId) {
      const projectResult = await db.query<{ id: string }>(
        `
        SELECT id
        FROM engicost.projects
        WHERE company_id = $1 AND id = $2
        LIMIT 1
        `,
        [companyId, parsed.projectId],
      );
      if (projectResult.rowCount === 0) {
        res.status(400).json({ message: "Selected project/site does not exist." });
        return;
      }
    }

    const isAppliedExpense = isAppliedApprovalStatus(oldExpense.approval_status);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Rebook the spend before writing the row: if the new amount or project
      // cannot take it, we bail out before anything is persisted.
      if (isAppliedExpense) {
        const ledgerFailure = await moveProjectSpend(client, {
          companyId,
          fromProjectId: oldExpense.project_id,
          toProjectId: newProjectId,
          category: "operational",
          previousAmount: oldAmount,
          nextAmount: newAmount,
          context: "expense update",
        });

        if (ledgerFailure) {
          await client.query("ROLLBACK");
          res.status(400).json(ledgerFailure);
          return;
        }
      }

      const updates: Array<[string, Array<unknown>]> = [];

      if (parsed.amount !== undefined) {
        updates.push([
          `
          UPDATE engicost.expenses
          SET amount = $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, expenseId, newAmount],
        ]);
      }

      if (
        parsed.projectId ||
        parsed.date ||
        parsed.category ||
        parsed.description ||
        parsed.paidBy ||
        parsed.paymentMethod ||
        parsed.receiptRef !== undefined ||
        parsed.notes !== undefined
      ) {
        const setClauses: string[] = [];
        const params: unknown[] = [companyId, expenseId];
        let paramIndex = 3;

        if (parsed.projectId) {
          setClauses.push(`project_id = $${paramIndex++}`);
          params.push(parsed.projectId);
        }
        if (parsed.date) {
          setClauses.push(`expense_date = $${paramIndex++}`);
          params.push(parsed.date);
        }
        if (parsed.category) {
          setClauses.push(`category = $${paramIndex++}`);
          params.push(parsed.category);
        }
        if (parsed.description) {
          setClauses.push(`description = $${paramIndex++}`);
          params.push(parsed.description);
        }
        if (parsed.paidBy) {
          setClauses.push(`paid_by = $${paramIndex++}`);
          params.push(parsed.paidBy);
        }
        if (parsed.paymentMethod) {
          setClauses.push(`payment_method = $${paramIndex++}`);
          params.push(parsed.paymentMethod);
        }
        if (parsed.receiptRef !== undefined) {
          setClauses.push(`receipt_ref = $${paramIndex++}`);
          params.push(parsed.receiptRef);
        }
        if (parsed.notes !== undefined) {
          setClauses.push(`notes = $${paramIndex++}`);
          params.push(parsed.notes);
        }

        if (setClauses.length > 0) {
          updates.push([
            `UPDATE engicost.expenses SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
            params,
          ]);
        }
      }

      for (const [query, params] of updates) {
        await client.query(query, params);
      }

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Updated Expense', 'Expenses', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          "System Admin",
          newProjectId,
          `Updated expense - Amount change: ${amountDifference > 0 ? "+" : ""}TZS ${amountDifference.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      const updatedResult = await db.query<{
        id: string;
        project_id: string;
        expense_date: string;
        category: string;
        description: string;
        amount: string;
        paid_by: string;
        payment_method: string;
        receipt_ref: string | null;
        approval_status: string;
        notes: string | null;
      }>(
        `
        SELECT id, project_id, expense_date::text, category, description, amount::text, paid_by, payment_method, receipt_ref, approval_status, notes
        FROM engicost.expenses
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, expenseId],
      );

      const row = updatedResult.rows[0];
      res.json({
        id: row.id,
        projectId: row.project_id,
        date: row.expense_date,
        category: row.category,
        description: row.description,
        amount: Number(row.amount),
        paidBy: row.paid_by,
        paymentMethod: row.payment_method,
        receiptRef: row.receipt_ref ?? "",
        status: displayStatus(row.approval_status),
        notes: row.notes ?? "",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const expenseId = String(req.params.id);
    const deletedBy = req.body?.deletedBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      amount: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount::text, approval_status
      FROM engicost.expenses
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, expenseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Expense not found." });
      return;
    }

    const expense = result.rows[0];
    const expenseAmount = Number(expense.amount);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Soft delete: mark as deleted instead of hard delete
      await client.query(
        `
        UPDATE engicost.expenses
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, expenseId, deletedBy],
      );

      // Deleting frees capacity, so this reversal is never capacity-checked.
      if (isAppliedApprovalStatus(expense.approval_status)) {
        await applyProjectSpend(client, {
          companyId,
          projectId: expense.project_id,
          category: "operational",
          delta: -expenseAmount,
          context: "expense deletion",
        });
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Deleted Expense', 'Expenses', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          deletedBy,
          expense.project_id,
          `Soft deleted expense - Reversed amount: TZS ${expenseAmount.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Expense deleted (soft delete) and total_spent reversed.",
        reversedAmount: expenseAmount,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Restore a soft-deleted expense
router.patch(
  "/:id/restore",
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const expenseId = String(req.params.id);
    const restoredBy = req.body?.restoredBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      amount: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount::text, approval_status
      FROM engicost.expenses
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      LIMIT 1
      `,
      [companyId, expenseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Deleted expense not found." });
      return;
    }

    const expense = result.rows[0];
    const expenseAmount = Number(expense.amount);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Restore: mark as not deleted
      await client.query(
        `
        UPDATE engicost.expenses
        SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, expenseId],
      );

      // Restoring re-applies the spend, so it must clear the same capacity
      // checks a fresh expense would.
      if (isAppliedApprovalStatus(expense.approval_status)) {
        const ledgerFailure = await applyProjectSpend(client, {
          companyId,
          projectId: expense.project_id,
          category: "operational",
          delta: expenseAmount,
          context: "expense restore",
        });

        if (ledgerFailure) {
          await client.query("ROLLBACK");
          res.status(400).json(ledgerFailure);
          return;
        }
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Restored Expense', 'Expenses', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          restoredBy,
          expense.project_id,
          `Restored soft-deleted expense - Amount re-added: TZS ${expenseAmount.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Expense restored successfully.",
        restoredAmount: expenseAmount,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
