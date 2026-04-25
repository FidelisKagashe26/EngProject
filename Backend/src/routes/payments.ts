import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toMoney } from "./utils";

const router = Router();

const paymentSchema = z.object({
  projectId: z.string().min(3),
  clientName: z.string().min(2),
  paymentType: z.enum(["Advance", "Milestone", "Stage", "Final", "Other"]),
  milestone: z.string().optional().default(""),
  amountExpected: z.number().nonnegative(),
  amountReceived: z.number().nonnegative(),
  paymentDate: z.string().date(),
  paymentMethod: z.string().min(2),
  referenceNumber: z.string().optional().default(""),
  status: z.string().optional().default("Pending"),
  notes: z.string().optional().default(""),
});

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [rowsResult, summaryResult, projectBalances] = await Promise.all([
      db.query<{
        id: string;
        project_id: string;
        project_name: string;
        client_name: string;
        payment_type: string;
        milestone: string | null;
        amount_expected: string;
        amount_received: string;
        payment_date: string;
        payment_method: string;
        reference_number: string | null;
        status: string;
        notes: string | null;
      }>(
        `
        SELECT
          cp.id,
          cp.project_id,
          p.name AS project_name,
          cp.client_name,
          cp.payment_type,
          cp.milestone,
          cp.amount_expected::text,
          cp.amount_received::text,
          cp.payment_date::text,
          cp.payment_method,
          cp.reference_number,
          cp.status,
          cp.notes
        FROM engicost.client_payments cp
        JOIN engicost.projects p ON p.id = cp.project_id
        WHERE cp.company_id = $1
        ORDER BY cp.payment_date DESC, cp.created_at DESC
        `,
        [companyId],
      ),
      db.query<{
        total_received: string;
        pending_receivables: string;
        total_outflow: string;
      }>(
        `
        SELECT
          COALESCE(SUM(cp.amount_received), 0)::text AS total_received,
          COALESCE(SUM(cp.amount_expected - cp.amount_received), 0)::text AS pending_receivables,
          COALESCE((SELECT SUM(amount) FROM engicost.expenses WHERE company_id = $1), 0)::text AS total_outflow
        FROM engicost.client_payments cp
        WHERE cp.company_id = $1
        `,
        [companyId],
      ),
      db.query<{ project_name: string; balance: string }>(
        `
        SELECT
          p.name AS project_name,
          (p.contract_value - p.total_spent)::text AS balance
        FROM engicost.projects p
        WHERE p.company_id = $1
        ORDER BY (p.contract_value - p.total_spent) DESC
        `,
        [companyId],
      ),
    ]);

    const summary = summaryResult.rows[0];
    const totalReceived = Number(summary?.total_received ?? 0);
    const pendingReceivables = Number(summary?.pending_receivables ?? 0);
    const totalOutflow = Number(summary?.total_outflow ?? 0);

    res.json({
      topCards: {
        totalReceived,
        pendingReceivables,
        totalCashOutflow: totalOutflow,
        netCashPosition: totalReceived - totalOutflow,
        nextExpectedPayment:
          rowsResult.rows.find((row) => Number(row.amount_expected) > Number(row.amount_received)) ??
          null,
      },
      rows: rowsResult.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        client: row.client_name,
        paymentType: row.payment_type,
        milestone: row.milestone ?? "",
        amountExpected: Number(row.amount_expected),
        amountReceived: Number(row.amount_received),
        balance: Number(row.amount_expected) - Number(row.amount_received),
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number ?? "",
        status: row.status,
        notes: row.notes ?? "",
      })),
      cashFlow: {
        incomeVsOutflow: {
          income: totalReceived,
          outflow: totalOutflow,
        },
        projectBalances: projectBalances.rows.map((row) => ({
          projectName: row.project_name,
          balance: Number(row.balance),
        })),
      },
    });
  }),
);

router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = paymentSchema.parse({
      ...req.body,
      amountExpected: toMoney(req.body.amountExpected),
      amountReceived: toMoney(req.body.amountReceived),
    });

    const inserted = await db.query(
      `
      INSERT INTO engicost.client_payments (
        id, company_id, project_id, client_name, payment_type, milestone, amount_expected,
        amount_received, payment_date, payment_method, reference_number, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13
      )
      RETURNING
        id,
        project_id,
        client_name,
        payment_type,
        milestone,
        amount_expected::text,
        amount_received::text,
        payment_date::text,
        payment_method,
        reference_number,
        status,
        notes
      `,
      [
        makeId("PAY"),
        companyId,
        parsed.projectId,
        parsed.clientName,
        parsed.paymentType,
        parsed.milestone,
        parsed.amountExpected,
        parsed.amountReceived,
        parsed.paymentDate,
        parsed.paymentMethod,
        parsed.referenceNumber,
        parsed.status,
        parsed.notes,
      ],
    );

    await db.query(
      `
      UPDATE engicost.projects
      SET
        amount_received = amount_received + $3,
        pending_client_payments = GREATEST(pending_client_payments - $3, 0),
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      `,
      [companyId, parsed.projectId, parsed.amountReceived],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Rehema Sululu', 'Recorded Client Payment', 'Payments', $3, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        parsed.projectId,
        `${parsed.paymentType} payment received: TZS ${parsed.amountReceived.toLocaleString("en-TZ")}`,
      ],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      clientName: row.client_name,
      paymentType: row.payment_type,
      milestone: row.milestone ?? "",
      amountExpected: Number(row.amount_expected),
      amountReceived: Number(row.amount_received),
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number ?? "",
      status: row.status,
      notes: row.notes ?? "",
    });
  }),
);

export default router;

