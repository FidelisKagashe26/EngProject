import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();

type TenderRow = {
  project_id: string;
  project_name: string;
  site_location: string;
  client_name: string;
  contract_number: string;
  start_date: string;
  expected_completion_date: string;
  contract_value: string;
  amount_received: string;
  total_spent: string;
  pending_client_payments: string;
  status: string;
  progress: number;
  worker_count: number;
  worker_paid: string;
  labor_paid: string;
  requirement_count: number;
  purchase_count: number;
  material_spent: string;
  document_count: number;
  variation_orders: number;
};

const buildPaymentTerms = (
  contractValue: number,
  amountReceived: number,
  pendingClientPayments: number,
): string => {
  if (amountReceived <= 0) {
    return "No advance received yet.";
  }

  if (pendingClientPayments <= 0) {
    return "Client payment schedule fully settled.";
  }

  const receivedRatio = contractValue > 0 ? amountReceived / contractValue : 0;
  if (receivedRatio < 0.3) {
    return "Advance collection in progress, milestone billing pending.";
  }

  if (receivedRatio < 0.8) {
    return "Milestone billing active against certified works.";
  }

  return "Final retention and closeout payment pending.";
};

const buildMilestoneSummary = (progress: number, status: string): string => {
  if (status === "Completed" || progress >= 100) {
    return "Project handover and final closeout completed.";
  }

  if (progress >= 75) {
    return "Finishing works and completion checks underway.";
  }

  if (progress >= 40) {
    return "Core execution works in progress across major tasks.";
  }

  if (progress > 0) {
    return "Mobilization and initial site setup ongoing.";
  }

  return "Pre-mobilization planning stage.";
};

router.get(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const search = String(req.query.search ?? "").trim();
    const projectId = String(req.query.projectId ?? "").trim();
    const status = String(req.query.status ?? "").trim();

    const params: Array<string | number> = [companyId];
    const filters: string[] = ["p.company_id = $1"];

    if (search.length > 0) {
      params.push(`%${search}%`);
      filters.push(
        `(p.name ILIKE $${params.length} OR p.client_name ILIKE $${params.length} OR p.site_location ILIKE $${params.length} OR p.contract_number ILIKE $${params.length})`,
      );
    }

    if (projectId.length > 0 && projectId !== "All") {
      params.push(projectId);
      filters.push(`p.id = $${params.length}`);
    }

    if (
      status.length > 0 &&
      status !== "All" &&
      status !== "All Status"
    ) {
      params.push(status);
      filters.push(`p.status = $${params.length}`);
    }

    const result = await db.query<TenderRow>(
      `
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        p.site_location,
        p.client_name,
        p.contract_number,
        p.start_date::text,
        p.expected_completion_date::text,
        p.contract_value::text,
        p.amount_received::text,
        p.total_spent::text,
        p.pending_client_payments::text,
        p.status,
        p.progress,
        COALESCE(worker_stats.worker_count, 0)::int AS worker_count,
        COALESCE(worker_stats.worker_paid, 0)::text AS worker_paid,
        COALESCE(labor_stats.labor_paid, 0)::text AS labor_paid,
        COALESCE(req_stats.requirement_count, 0)::int AS requirement_count,
        COALESCE(purchase_stats.purchase_count, 0)::int AS purchase_count,
        COALESCE(purchase_stats.material_spent, 0)::text AS material_spent,
        COALESCE(document_stats.document_count, 0)::int AS document_count,
        COALESCE(expense_stats.variation_orders, 0)::int AS variation_orders
      FROM engicost.projects p
      LEFT JOIN (
        SELECT
          assigned_project_id AS project_id,
          COUNT(*)::int AS worker_count,
          COALESCE(SUM(total_paid), 0)::numeric AS worker_paid
        FROM engicost.workers
        WHERE company_id = $1
        GROUP BY assigned_project_id
      ) AS worker_stats ON worker_stats.project_id = p.id
      LEFT JOIN (
        SELECT
          project_id,
          COALESCE(SUM(amount_paid), 0)::numeric AS labor_paid
        FROM engicost.labor_payments
        WHERE company_id = $1
        GROUP BY project_id
      ) AS labor_stats ON labor_stats.project_id = p.id
      LEFT JOIN (
        SELECT
          project_id,
          COUNT(*)::int AS requirement_count
        FROM engicost.material_requirements
        WHERE company_id = $1
        GROUP BY project_id
      ) AS req_stats ON req_stats.project_id = p.id
      LEFT JOIN (
        SELECT
          project_id,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(total_cost), 0)::numeric AS material_spent
        FROM engicost.material_purchases
        WHERE company_id = $1
        GROUP BY project_id
      ) AS purchase_stats ON purchase_stats.project_id = p.id
      LEFT JOIN (
        SELECT
          project_id,
          COUNT(*)::int AS document_count
        FROM engicost.documents
        WHERE company_id = $1
        GROUP BY project_id
      ) AS document_stats ON document_stats.project_id = p.id
      LEFT JOIN (
        SELECT
          project_id,
          COUNT(*) FILTER (WHERE status = 'Flagged')::int AS variation_orders
        FROM engicost.expenses
        WHERE company_id = $1
        GROUP BY project_id
      ) AS expense_stats ON expense_stats.project_id = p.id
      WHERE ${filters.join(" AND ")}
      ORDER BY p.updated_at DESC, p.created_at DESC
      `,
      params,
    );

    const rows = result.rows.map((row) => {
      const contractValue = Number(row.contract_value);
      const amountReceived = Number(row.amount_received);
      const totalSpent = Number(row.total_spent);
      const pendingClientPayments = Number(row.pending_client_payments);
      const workerPaid = Number(row.worker_paid);
      const laborPaid = Number(row.labor_paid);
      const laborCost = Math.max(workerPaid, laborPaid);
      const materialCost = Number(row.material_spent);
      const variationOrders =
        Number(row.variation_orders) + (totalSpent > contractValue ? 1 : 0);

      return {
        id: row.project_id,
        projectId: row.project_id,
        projectName: row.project_name,
        siteLocation: row.site_location,
        clientName: row.client_name,
        contractNo: row.contract_number,
        tenderAmount: contractValue,
        contractSum: contractValue,
        amountReceived,
        totalSpent,
        remainingBalance: contractValue - totalSpent,
        pendingClientPayments,
        paymentTerms: buildPaymentTerms(
          contractValue,
          amountReceived,
          pendingClientPayments,
        ),
        milestones: buildMilestoneSummary(row.progress, row.status),
        variationOrders,
        status: row.status,
        progress: row.progress,
        documents: Number(row.document_count),
        workerCount: Number(row.worker_count),
        materialRequirementCount: Number(row.requirement_count),
        materialPurchaseCount: Number(row.purchase_count),
        laborCost,
        materialCost,
        startDate: row.start_date,
        expectedCompletionDate: row.expected_completion_date,
      };
    });

    const summary = rows.reduce(
      (acc, item) => ({
        totalContracts: acc.totalContracts + 1,
        totalTenderAmount: acc.totalTenderAmount + item.tenderAmount,
        totalContractSum: acc.totalContractSum + item.contractSum,
        totalLaborCost: acc.totalLaborCost + item.laborCost,
        totalMaterialCost: acc.totalMaterialCost + item.materialCost,
        totalSpent: acc.totalSpent + item.totalSpent,
        totalRemainingBalance: acc.totalRemainingBalance + item.remainingBalance,
        overBudgetContracts:
          acc.overBudgetContracts + (item.totalSpent > item.contractSum ? 1 : 0),
        openVariationOrders: acc.openVariationOrders + item.variationOrders,
        pendingClientPayments:
          acc.pendingClientPayments + item.pendingClientPayments,
      }),
      {
        totalContracts: 0,
        totalTenderAmount: 0,
        totalContractSum: 0,
        totalLaborCost: 0,
        totalMaterialCost: 0,
        totalSpent: 0,
        totalRemainingBalance: 0,
        overBudgetContracts: 0,
        openVariationOrders: 0,
        pendingClientPayments: 0,
      },
    );

    res.json({
      summary,
      rows,
    });
  }),
);

export default router;

