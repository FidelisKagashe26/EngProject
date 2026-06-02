import { db } from "../db/pool";
import { getSingleTenantCompanyId } from "../db/init";

// Approval thresholds in TZS.
// The approval gate is currently DISABLED: every record auto-approves and is
// applied to project totals / reports immediately, regardless of amount. This
// was turned off because large (but legitimate) records were sitting in
// "Pending approval" and disappearing from reports and project totals.
// To re-enable the gate for a module, set its threshold back to a finite value.
export const APPROVAL_THRESHOLDS = {
  expenses: Number.POSITIVE_INFINITY,
  material_purchases: Number.POSITIVE_INFINITY,
  equipment_usage: Number.POSITIVE_INFINITY,
  labor_payments: Number.POSITIVE_INFINITY,
  client_payments: Number.POSITIVE_INFINITY,
};

export type ApprovalModule =
  | "expenses"
  | "material_purchases"
  | "equipment_usage"
  | "labor_payments"
  | "client_payments";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED";

export const APPLIED_APPROVAL_STATUSES: ApprovalStatus[] = ["APPROVED", "AUTO_APPROVED"];

export const APPLIED_APPROVAL_STATUS_SQL = "('APPROVED', 'AUTO_APPROVED')";

export const APPROVAL_MODULES: ApprovalModule[] = [
  "expenses",
  "material_purchases",
  "equipment_usage",
  "labor_payments",
  "client_payments",
];

type ApprovalModuleConfig = {
  amountExpression: string;
  descriptionExpression: string;
  fromClause: string;
  idExpression: string;
  module: ApprovalModule;
};

const approvalModuleConfigs: Record<ApprovalModule, ApprovalModuleConfig> = {
  client_payments: {
    amountExpression: "cp.amount_received",
    descriptionExpression: "cp.client_name",
    fromClause: "engicost.client_payments cp",
    idExpression: "cp.id",
    module: "client_payments",
  },
  expenses: {
    amountExpression: "e.amount",
    descriptionExpression: "e.description",
    fromClause: "engicost.expenses e",
    idExpression: "e.id",
    module: "expenses",
  },
  material_purchases: {
    amountExpression: "mp.total_cost",
    descriptionExpression: "mp.material_name",
    fromClause: "engicost.material_purchases mp",
    idExpression: "mp.id",
    module: "material_purchases",
  },
  equipment_usage: {
    amountExpression: "eu.total_cost",
    descriptionExpression: "eu.equipment_name",
    fromClause: "engicost.equipment_usage eu",
    idExpression: "eu.id",
    module: "equipment_usage",
  },
  labor_payments: {
    amountExpression: "lp.amount_paid",
    descriptionExpression: "COALESCE(w.full_name, lp.worker_id)",
    fromClause: "engicost.labor_payments lp LEFT JOIN engicost.workers w ON w.id = lp.worker_id",
    idExpression: "lp.id",
    module: "labor_payments",
  },
};

export const isApprovalModule = (value: string): value is ApprovalModule =>
  APPROVAL_MODULES.includes(value as ApprovalModule);

export const isAppliedApprovalStatus = (status: string | null | undefined): boolean =>
  status === "APPROVED" || status === "AUTO_APPROVED";

/**
 * Check if an amount requires approval based on module and threshold
 */
export const requiresApproval = (module: ApprovalModule, amount: number): boolean => {
  const threshold = APPROVAL_THRESHOLDS[module] || Infinity;
  return amount > threshold;
};

export const getApprovalStatusForAmount = (
  module: ApprovalModule,
  amount: number,
): ApprovalStatus => (requiresApproval(module, amount) ? "PENDING" : "AUTO_APPROVED");

/**
 * Get approval status for a record
 */
export const getApprovalStatus = async (
  module: ApprovalModule,
  recordId: string,
): Promise<ApprovalStatus | null> => {
  const result = await db.query<{ approval_status: ApprovalStatus }>(
    `
    SELECT approval_status
    FROM engicost.${module}
    WHERE id = $1
    LIMIT 1
    `,
    [recordId],
  );

  return result.rows[0]?.approval_status ?? null;
};

/**
 * Get all pending approvals for a company
 */
export const getPendingApprovals = async (module?: ApprovalModule) => {
  const companyId = await getSingleTenantCompanyId();
  const modules = module ? [module] : APPROVAL_MODULES;
  const query = modules.map((approvalModule) => buildApprovalSelect(approvalModule, "approval_status = 'PENDING'")).join("\nUNION ALL\n");

  const result = await db.query(
    `
    ${query}
    ORDER BY approval_requested_at DESC
    `,
    [companyId],
  );

  return result.rows;
};

/**
 * Get approval history
 */
export const getApprovalHistory = async (module?: ApprovalModule) => {
  const companyId = await getSingleTenantCompanyId();
  const modules = module ? [module] : APPROVAL_MODULES;
  const query = modules
    .map((approvalModule) => buildApprovalSelect(approvalModule, "approval_status != 'AUTO_APPROVED'", true))
    .join("\nUNION ALL\n");

  const result = await db.query(
    `
    ${query}
    ORDER BY approval_requested_at DESC
    LIMIT 100
    `,
    [companyId],
  );

  return result.rows;
};

const buildApprovalSelect = (
  module: ApprovalModule,
  statusCondition: string,
  includeDecisionColumns = false,
): string => {
  const config = approvalModuleConfigs[module];
  const sourceAlias = config.idExpression.split(".")[0];
  const decisionColumns = includeDecisionColumns
    ? `
      ${sourceAlias}.approved_by,
      ${sourceAlias}.approved_at,
      ${sourceAlias}.rejected_by,
      ${sourceAlias}.rejection_reason,
      ${sourceAlias}.rejected_at,
    `
    : "";

  return `
    SELECT
      ${config.idExpression} AS id,
      ${sourceAlias}.approval_status,
      ${sourceAlias}.approval_requested_by,
      ${sourceAlias}.approval_requested_at,
      ${decisionColumns}
      ${config.amountExpression}::text AS amount,
      ${config.descriptionExpression}::text AS description,
      '${config.module}' AS module
    FROM ${config.fromClause}
    WHERE ${sourceAlias}.company_id = $1
      AND ${sourceAlias}.is_deleted = FALSE
      AND ${sourceAlias}.${statusCondition}
  `;
};

export const approvalService = {
  requiresApproval,
  getApprovalStatusForAmount,
  getApprovalStatus,
  getPendingApprovals,
  getApprovalHistory,
  isAppliedApprovalStatus,
  isApprovalModule,
  APPROVAL_THRESHOLDS,
};
