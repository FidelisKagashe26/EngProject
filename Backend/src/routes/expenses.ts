import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";
import { isAppliedApprovalStatus, requiresApproval, APPROVAL_THRESHOLDS } from "../services/approval";

const router = Router();

const expenseSchema = z.object({
  projectId: z.string().min(3),
  date: z.string().date(),
  category: z.string().min(2),
  description: z.string().min(3),
  amount: z.number().nonnegative(),
  paidBy: z.string().min(2),
  paymentMethod: z.string().min(2),
  receiptRef: z.string().optional().default(""),
  status: z.string().optional().default("Pending"),
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

    const [byCategory, byProject, monthlyTrend] = await Promise.all([
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
    ]);

    res.json({
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
        status: row.status,
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

    const inserted = await db.query(
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
        parsed.status,
        parsed.notes,
        approvalStatus,
        requestedBy,
      ],
    );

    // Only update project totals if auto-approved (below threshold)
    if (!needsApproval) {
      await db.query(
        `
        UPDATE engicost.projects
        SET total_spent = total_spent + $3, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.projectId, parsed.amount],
      );
    }

    await db.query(
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

    const row = inserted.rows[0];
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
      status: row.status,
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

    const client = await db.connect();
    try {
      await client.query("BEGIN");

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
        parsed.status ||
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
        if (parsed.status) {
          setClauses.push(`status = $${paramIndex++}`);
          params.push(parsed.status);
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

      if (isAppliedApprovalStatus(oldExpense.approval_status)) {
        if (newProjectId !== oldExpense.project_id) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldExpense.project_id, oldAmount],
          );
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = total_spent + $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, newProjectId, newAmount],
          );
        } else if (amountDifference !== 0) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent + $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldExpense.project_id, amountDifference],
          );
        }
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
        status: string;
        notes: string | null;
      }>(
        `
        SELECT id, project_id, expense_date::text, category, description, amount::text, paid_by, payment_method, receipt_ref, status, notes
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
        status: row.status,
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

      if (isAppliedApprovalStatus(expense.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, expense.project_id, expenseAmount],
        );
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

      if (isAppliedApprovalStatus(expense.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, expense.project_id, expenseAmount],
        );
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
