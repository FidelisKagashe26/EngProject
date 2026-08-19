import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";
import {
  APPLIED_APPROVAL_STATUS_SQL,
  APPROVAL_THRESHOLDS,
  getApprovalStatusForAmount,
  isAppliedApprovalStatus,
  requiresApproval,
} from "../services/approval";

const router = Router();

/**
 * A payment's status is simply how much of the expected amount has arrived, so
 * it is computed rather than picked. Letting a user set it independently meant
 * a record could say "Received" while its own figures showed a shortfall.
 */
const paymentStatus = (expected: number, received: number): string => {
  if (received <= 0) return "Pending";
  if (received >= expected) return "Received";
  return "Partial";
};

const paymentSchema = z.object({
  projectId: z.string().min(3),
  clientName: z.string().min(2),
  paymentType: z.enum(["Advance", "Milestone", "Stage", "Final", "Other"]),
  milestone: z.string().optional().default(""),
  // Optional: settle a specific invoice with this payment. Linking makes the
  // invoice read as paid without touching amount_received twice (the invoice's
  // paid figure is a SUM of its linked payments, computed on read).
  invoiceId: z.string().optional().default(""),
  // amountExpected is legacy; the page is now a received-money transaction log.
  // When omitted it defaults to the received amount (see POST handler).
  amountExpected: z.number().nonnegative().optional(),
  amountReceived: z.number().nonnegative(),
  paymentDate: z.string().date(),
  paymentMethod: z.string().min(2),
  referenceNumber: z.string().optional().default(""),
  // Not accepted from the client — see paymentStatus below.
  status: z.string().optional(),
  notes: z.string().optional().default(""),
  attachmentUrl: z.string().optional().default(""),
  attachmentName: z.string().optional().default(""),
  attachmentType: z.string().optional().default(""),
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
        invoice_id: string | null;
        invoice_number: string | null;
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
        attachment_url: string | null;
        attachment_name: string | null;
        attachment_type: string | null;
      }>(
        `
        SELECT
          cp.id,
          cp.project_id,
          p.name AS project_name,
          cp.invoice_id,
          iv.number AS invoice_number,
          cp.client_name,
          cp.payment_type,
          cp.milestone,
          cp.amount_expected::text,
          cp.amount_received::text,
          cp.payment_date::text,
          cp.payment_method,
          cp.reference_number,
          cp.status,
          cp.notes,
          cp.attachment_url,
          cp.attachment_name,
          cp.attachment_type
        FROM engicost.client_payments cp
        JOIN engicost.projects p ON p.id = cp.project_id
        LEFT JOIN engicost.invoices iv ON iv.id = cp.invoice_id
        WHERE cp.company_id = $1 AND cp.is_deleted = FALSE
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
          COALESCE((
            -- Total cash outflow = all project execution spending (labour,
            -- materials, equipment AND other expenses), which is already
            -- aggregated into projects.total_spent — not just the expenses table.
            SELECT SUM(total_spent)
            FROM engicost.projects
            WHERE company_id = $1
          ), 0)::text AS total_outflow
        FROM engicost.client_payments cp
        WHERE cp.company_id = $1
          AND cp.is_deleted = FALSE
          AND cp.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
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
        invoiceId: row.invoice_id ?? "",
        invoiceNumber: row.invoice_number ?? "",
        client: row.client_name,
        paymentType: row.payment_type,
        milestone: row.milestone ?? "",
        amountExpected: Number(row.amount_expected),
        amountReceived: Number(row.amount_received),
        balance: Number(row.amount_expected) - Number(row.amount_received),
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        referenceNumber: row.reference_number ?? "",
        status: paymentStatus(Number(row.amount_expected), Number(row.amount_received)),
        notes: row.notes ?? "",
        attachmentUrl: row.attachment_url ?? "",
        attachmentName: row.attachment_name ?? "",
        attachmentType: row.attachment_type ?? "",
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
      amountExpected:
        req.body.amountExpected !== undefined ? toMoney(req.body.amountExpected) : undefined,
      amountReceived: toMoney(req.body.amountReceived),
    });
    // Transactions-only model: expected mirrors received when not supplied.
    const amountExpected = parsed.amountExpected ?? parsed.amountReceived;
    const needsApproval = requiresApproval("client_payments", parsed.amountReceived);
    const approvalStatus = getApprovalStatusForAmount("client_payments", parsed.amountReceived);
    const requestedBy = req.body.requestedBy || req.authUser?.fullName || "System";

    // Optional invoice link: keep it only if it really is this project's invoice,
    // otherwise ignore it rather than failing the payment.
    let effectiveInvoiceId = parsed.invoiceId.trim();
    if (effectiveInvoiceId) {
      const inv = await db.query(
        "SELECT id FROM engicost.invoices WHERE company_id = $1 AND id = $2 AND project_id = $3 AND is_deleted = FALSE",
        [companyId, effectiveInvoiceId, parsed.projectId],
      );
      if (inv.rowCount === 0) effectiveInvoiceId = "";
    }

    const inserted = await db.query(
      `
      INSERT INTO engicost.client_payments (
        id, company_id, project_id, invoice_id, client_name, payment_type, milestone, amount_expected,
        amount_received, payment_date, payment_method, reference_number, status, notes,
        attachment_url, attachment_name, attachment_type,
        approval_status, approval_requested_by, approval_requested_at
      ) VALUES (
        $1, $2, $3, NULLIF($19, ''), $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        NULLIF($14, ''), NULLIF($15, ''), NULLIF($16, ''),
        $17, $18, NOW()
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
        notes,
        attachment_url,
        attachment_name,
        attachment_type,
        approval_status
      `,
      [
        makeId("PAY"),
        companyId,
        parsed.projectId,
        parsed.clientName,
        parsed.paymentType,
        parsed.milestone,
        amountExpected,
        parsed.amountReceived,
        parsed.paymentDate,
        parsed.paymentMethod,
        parsed.referenceNumber,
        paymentStatus(amountExpected, parsed.amountReceived),
        parsed.notes,
        parsed.attachmentUrl,
        parsed.attachmentName,
        parsed.attachmentType,
        approvalStatus,
        requestedBy,
        effectiveInvoiceId,
      ],
    );

    if (!needsApproval) {
      await db.query(
        `
        UPDATE engicost.projects
        SET
          amount_received = amount_received + $3,
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.projectId, parsed.amountReceived],
      );
    }

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Recorded Client Payment', 'Payments', $4, $5, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        requestedBy,
        parsed.projectId,
        needsApproval
          ? `${parsed.paymentType} payment pending approval: TZS ${parsed.amountReceived.toLocaleString("en-TZ")}`
          : `${parsed.paymentType} payment received: TZS ${parsed.amountReceived.toLocaleString("en-TZ")}`,
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
      status: paymentStatus(Number(row.amount_expected), Number(row.amount_received)),
      notes: row.notes ?? "",
      attachmentUrl: row.attachment_url ?? "",
      attachmentName: row.attachment_name ?? "",
      attachmentType: row.attachment_type ?? "",
      approvalStatus: row.approval_status,
      requiresApproval: needsApproval,
      threshold: APPROVAL_THRESHOLDS.client_payments,
    });
  }),
);

router.patch(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);

    const updateSchema = paymentSchema.partial();
    const parsed = updateSchema.parse({
      ...req.body,
      amountExpected: req.body.amountExpected !== undefined ? toMoney(req.body.amountExpected) : undefined,
      amountReceived: req.body.amountReceived !== undefined ? toMoney(req.body.amountReceived) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      amount_received: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount_received::text, approval_status
      FROM engicost.client_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ code: "NOT_FOUND", message: "Payment not found." });
      return;
    }

    const oldPayment = result.rows[0];
    const oldAmountReceived = Number(oldPayment.amount_received);
    const newAmountReceived = parsed.amountReceived ?? oldAmountReceived;
    const newProjectId = parsed.projectId ?? oldPayment.project_id;
    const amountDifference = newAmountReceived - oldAmountReceived;

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

      const setClauses: string[] = [];
      const params: unknown[] = [companyId, paymentId];
      let paramIndex = 3;

      if (parsed.projectId) {
        setClauses.push(`project_id = $${paramIndex++}`);
        params.push(parsed.projectId);
      }
      if (parsed.amountReceived !== undefined) {
        setClauses.push(`amount_received = $${paramIndex++}`);
        params.push(parsed.amountReceived);
      }
      if (parsed.amountExpected !== undefined) {
        setClauses.push(`amount_expected = $${paramIndex++}`);
        params.push(parsed.amountExpected);
      }
      if (parsed.clientName) {
        setClauses.push(`client_name = $${paramIndex++}`);
        params.push(parsed.clientName);
      }
      if (parsed.paymentType) {
        setClauses.push(`payment_type = $${paramIndex++}`);
        params.push(parsed.paymentType);
      }
      if (parsed.milestone !== undefined) {
        setClauses.push(`milestone = $${paramIndex++}`);
        params.push(parsed.milestone);
      }
      if (parsed.paymentDate) {
        setClauses.push(`payment_date = $${paramIndex++}`);
        params.push(parsed.paymentDate);
      }
      if (parsed.paymentMethod) {
        setClauses.push(`payment_method = $${paramIndex++}`);
        params.push(parsed.paymentMethod);
      }
      if (parsed.referenceNumber !== undefined) {
        setClauses.push(`reference_number = $${paramIndex++}`);
        params.push(parsed.referenceNumber);
      }
      if (parsed.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        params.push(parsed.notes);
      }
      if (parsed.attachmentUrl !== undefined) {
        setClauses.push(`attachment_url = NULLIF($${paramIndex++}, '')`);
        params.push(parsed.attachmentUrl);
      }
      if (parsed.attachmentName !== undefined) {
        setClauses.push(`attachment_name = NULLIF($${paramIndex++}, '')`);
        params.push(parsed.attachmentName);
      }
      if (parsed.attachmentType !== undefined) {
        setClauses.push(`attachment_type = NULLIF($${paramIndex++}, '')`);
        params.push(parsed.attachmentType);
      }

      if (setClauses.length > 0) {
        await client.query(
          `UPDATE engicost.client_payments SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
          params,
        );
      }

      if (isAppliedApprovalStatus(oldPayment.approval_status)) {
        if (newProjectId !== oldPayment.project_id) {
          await client.query(
            `
            UPDATE engicost.projects
            SET
              amount_received = GREATEST(amount_received - $3, 0),
              updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldPayment.project_id, oldAmountReceived],
          );
          await client.query(
            `
            UPDATE engicost.projects
            SET
              amount_received = amount_received + $3,
              updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, newProjectId, newAmountReceived],
          );
        } else if (amountDifference !== 0) {
          await client.query(
            `
            UPDATE engicost.projects
            SET 
              amount_received = amount_received + $3,
              updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldPayment.project_id, amountDifference],
          );
        }
      }

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Updated Payment', 'Payments', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          "Rehema Sululu",
          newProjectId,
          `Updated payment - Amount change: ${amountDifference > 0 ? "+" : ""}TZS ${amountDifference.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        code: "SUCCESS",
        message: "Payment updated successfully.",
        amountDifference,
        newAmountReceived,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Delete (soft delete) a client payment
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);
    const deletedBy = req.body?.deletedBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      amount_received: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount_received::text, approval_status
      FROM engicost.client_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Payment not found." });
      return;
    }

    const payment = result.rows[0];
    const amountReceived = Number(payment.amount_received);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Soft delete: mark as deleted instead of hard delete
      await client.query(
        `
        UPDATE engicost.client_payments
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, paymentId, deletedBy],
      );

      if (isAppliedApprovalStatus(payment.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET
            amount_received = GREATEST(amount_received - $3, 0),
            updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, payment.project_id, amountReceived],
        );
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Deleted Payment', 'Payments', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          deletedBy,
          payment.project_id,
          `Soft deleted client payment - Reversed amount: TZS ${amountReceived.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Payment deleted (soft delete) and project totals reversed.",
        reversedAmount: amountReceived,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Restore a soft-deleted client payment
router.patch(
  "/:id/restore",
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const paymentId = String(req.params.id);
    const restoredBy = req.body?.restoredBy || "System Admin";

    const result = await db.query<{
      project_id: string;
      amount_received: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, amount_received::text, approval_status
      FROM engicost.client_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      LIMIT 1
      `,
      [companyId, paymentId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Deleted payment not found." });
      return;
    }

    const payment = result.rows[0];
    const amountReceived = Number(payment.amount_received);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Restore: mark as not deleted
      await client.query(
        `
        UPDATE engicost.client_payments
        SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, paymentId],
      );

      if (isAppliedApprovalStatus(payment.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET
            amount_received = amount_received + $3,
            updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, payment.project_id, amountReceived],
        );
      }

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Restored Payment', 'Payments', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          restoredBy,
          payment.project_id,
          `Restored soft-deleted client payment - Amount re-added: TZS ${amountReceived.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Payment restored successfully.",
        restoredAmount: amountReceived,
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
