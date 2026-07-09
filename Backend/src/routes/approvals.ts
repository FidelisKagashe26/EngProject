import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync } from "./utils";
import {
  getPendingApprovals,
  getApprovalHistory,
  isApprovalModule,
  type ApprovalModule,
} from "../services/approval";
import { checkProjectSpendCapacity, spendGuardResponse } from "../services/spendingGuard";

const router = Router();

const approveSchema = z.object({
  approvedBy: z.string().min(2),
});

const rejectSchema = z.object({
  rejectedBy: z.string().min(2),
  rejectionReason: z.string().min(5),
});

type ApprovalTargetRow = {
  approval_status: string;
  amount: string;
  balance: string | null;
  description: string;
  project_id: string;
  worker_id: string | null;
};

const getApprovalTarget = async (
  module: ApprovalModule,
  companyId: number,
  recordId: string,
) => {
  const queries: Record<ApprovalModule, string> = {
    expenses: `
      SELECT approval_status, amount::text AS amount, NULL::text AS balance,
        description::text AS description, project_id, NULL::text AS worker_id
      FROM engicost.expenses
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
    `,
    material_purchases: `
      SELECT approval_status, total_cost::text AS amount, NULL::text AS balance,
        material_name::text AS description, project_id, NULL::text AS worker_id
      FROM engicost.material_purchases
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
    `,
    equipment_usage: `
      SELECT approval_status, total_cost::text AS amount, NULL::text AS balance,
        equipment_name::text AS description, project_id, NULL::text AS worker_id
      FROM engicost.equipment_usage
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
    `,
    labor_payments: `
      SELECT lp.approval_status, lp.amount_paid::text AS amount, lp.balance::text AS balance,
        COALESCE(w.full_name, lp.worker_id)::text AS description, lp.project_id, lp.worker_id
      FROM engicost.labor_payments lp
      LEFT JOIN engicost.workers w ON w.id = lp.worker_id
      WHERE lp.company_id = $1 AND lp.id = $2 AND lp.is_deleted = FALSE
      LIMIT 1
    `,
    client_payments: `
      SELECT approval_status, amount_received::text AS amount, NULL::text AS balance,
        client_name::text AS description, project_id, NULL::text AS worker_id
      FROM engicost.client_payments
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
    `,
  };

  const result = await db.query<ApprovalTargetRow>(queries[module], [companyId, recordId]);
  return result.rows[0] ?? null;
};

// Get all pending approvals
router.get(
  "/pending",
  handleAsync(async (req, res) => {
    const module = (req.query.module as ApprovalModule) || undefined;
    const pending = await getPendingApprovals(module);

    res.json({
      count: pending.length,
      pending: pending.map((row) => ({
        id: row.id,
        module: row.module,
        amount: Number(row.amount),
        description: row.description,
        requestedBy: row.approval_requested_by,
        requestedAt: row.approval_requested_at,
        status: row.approval_status,
      })),
    });
  }),
);

// Get approval history
router.get(
  "/history",
  handleAsync(async (req, res) => {
    const module = (req.query.module as ApprovalModule) || undefined;
    const history = await getApprovalHistory(module);

    res.json({
      count: history.length,
      history: history.map((row) => ({
        id: row.id,
        module: row.module,
        amount: Number(row.amount),
        description: row.description,
        status: row.approval_status,
        requestedBy: row.approval_requested_by,
        requestedAt: row.approval_requested_at,
        approvedBy: row.approved_by || null,
        approvedAt: row.approved_at || null,
        rejectedBy: row.rejected_by || null,
        rejectionReason: row.rejection_reason || null,
        rejectedAt: row.rejected_at || null,
      })),
    });
  }),
);

// Approve a transaction
router.patch(
  "/:module/:id/approve",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const moduleParam = String(req.params.module);
    const recordId = String(req.params.id);
    const parsed = approveSchema.parse(req.body);

    if (!isApprovalModule(moduleParam)) {
      res.status(400).json({ message: "Invalid module." });
      return;
    }
    const module = moduleParam;

    const record = await getApprovalTarget(module, companyId, recordId);
    if (!record) {
      res.status(404).json({ message: `${module} record not found.` });
      return;
    }

    if (record.approval_status !== "PENDING") {
      res.status(400).json({
        message: `Cannot approve a record with status: ${record.approval_status}`,
      });
      return;
    }

    const amount = Number(record.amount);
    const balance = Number(record.balance ?? 0);
    const projectId = record.project_id;

    if (module !== "client_payments") {
      const spendCheck = await checkProjectSpendCapacity(
        db,
        companyId,
        projectId,
        amount,
        "approved transaction",
      );
      const spendFailure = spendGuardResponse(spendCheck);
      if (spendFailure) {
        res.status(400).json(spendFailure);
        return;
      }
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Update approval status
      await client.query(
        `
        UPDATE engicost.${module}
        SET 
          approval_status = 'APPROVED',
          approved_by = $3,
          approved_at = NOW(),
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, recordId, parsed.approvedBy],
      );

      // Update project totals based on module
      if (module === "expenses" || module === "material_purchases" || module === "equipment_usage") {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, projectId, amount],
        );
      } else if (module === "client_payments") {
        await client.query(
          `
          UPDATE engicost.projects
          SET 
            amount_received = amount_received + $3,
            pending_client_payments = GREATEST(pending_client_payments - $3, 0),
            updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, projectId, amount],
        );
      } else if (module === "labor_payments" && record.worker_id) {
        await client.query(
          `
          UPDATE engicost.workers
          SET
            total_paid = total_paid + $3,
            outstanding_amount = GREATEST(outstanding_amount - $3, 0) + $4,
            status = CASE WHEN GREATEST(outstanding_amount - $3, 0) + $4 > 0 THEN 'Pending' ELSE 'Active' END,
            updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, record.worker_id, amount, balance],
        );

        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, projectId, amount],
        );
      }

      // Log approval activity
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Approved Transaction', $4, $5, $6, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          parsed.approvedBy,
          module,
          projectId,
          `Approved ${module} transaction of TZS ${amount.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: `${module} transaction approved successfully.`,
        recordId,
        module,
        approvalStatus: "APPROVED",
        approvedBy: parsed.approvedBy,
        approvedAt: new Date().toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Reject a transaction
router.patch(
  "/:module/:id/reject",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const moduleParam = String(req.params.module);
    const recordId = String(req.params.id);
    const parsed = rejectSchema.parse(req.body);

    if (!isApprovalModule(moduleParam)) {
      res.status(400).json({ message: "Invalid module." });
      return;
    }
    const module = moduleParam;

    const record = await getApprovalTarget(module, companyId, recordId);
    if (!record) {
      res.status(404).json({ message: `${module} record not found.` });
      return;
    }

    if (record.approval_status !== "PENDING") {
      res.status(400).json({
        message: `Cannot reject a record with status: ${record.approval_status}`,
      });
      return;
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Update approval status
      await client.query(
        `
        UPDATE engicost.${module}
        SET 
          approval_status = 'REJECTED',
          rejected_by = $3,
          rejection_reason = $4,
          rejected_at = NOW(),
          updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, recordId, parsed.rejectedBy, parsed.rejectionReason],
      );

      // Log rejection activity
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, description, ip_device)
        VALUES ($1, $2, $3, 'Rejected Transaction', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          parsed.rejectedBy,
          module,
          `Rejected ${module}: ${record.description} - Reason: ${parsed.rejectionReason}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: `${module} transaction rejected successfully.`,
        recordId,
        module,
        approvalStatus: "REJECTED",
        rejectionReason: parsed.rejectionReason,
        rejectedBy: parsed.rejectedBy,
        rejectedAt: new Date().toISOString(),
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
