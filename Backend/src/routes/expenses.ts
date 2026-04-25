import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toMoney } from "./utils";

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
        e.created_at::text
      FROM engicost.expenses e
      JOIN engicost.projects p ON p.id = e.project_id
      WHERE e.company_id = $1
      ORDER BY e.expense_date DESC, e.created_at DESC
      `,
      [companyId],
    );

    const [byCategory, byProject, monthlyTrend] = await Promise.all([
      db.query<{ category: string; total: string }>(
        `
        SELECT category, COALESCE(SUM(amount), 0)::text AS total
        FROM engicost.expenses
        WHERE company_id = $1
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
        WHERE e.company_id = $1
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
        WHERE company_id = $1
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

    const inserted = await db.query(
      `
      INSERT INTO engicost.expenses (
        id, company_id, project_id, expense_date, category, description,
        amount, paid_by, payment_method, receipt_ref, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
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
        created_at::text
      `,
      [
        makeId("EXP"),
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
      ],
    );

    await db.query(
      `
      UPDATE engicost.projects
      SET total_spent = total_spent + $3, updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      `,
      [companyId, parsed.projectId, parsed.amount],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Faraja Nyerere', 'Added Expense', 'Expenses', $3, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        parsed.projectId,
        `${parsed.category} expense recorded: TZS ${parsed.amount.toLocaleString("en-TZ")}`,
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
      createdAt: row.created_at,
    });
  }),
);

export default router;

