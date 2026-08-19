import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireRoles, requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toInteger, toMoney } from "./utils";
import { withTransaction, type Queryable } from "../db/transaction";
import { CLOSED_PROJECT_STATUSES, recalculateProjectSpend } from "../services/projectLedger";
import { SELECTABLE_PROJECT_STATUSES } from "../constants/vocabulary";

const router = Router();
const projectManagerRoles = ["Admin", "Engineer / Project Manager"] as const;

const projectSchema = z.object({
  name: z.string().min(2),
  siteLocation: z.string().min(2),
  clientName: z.string().min(2),
  clientPhone: z.string().optional().default(""),
  clientEmail: z.string().optional().default(""),
  clientTin: z.string().optional().default(""),
  pettyCash: z.number().nonnegative().optional().default(0),
  contractNumber: z.string().min(3),
  startDate: z.string().date(),
  expectedCompletionDate: z.string().date(),
  contractValue: z.number().nonnegative(),
  amountReceived: z.number().nonnegative().optional().default(0),
  totalSpent: z.number().nonnegative().optional().default(0),
  status: z.enum(SELECTABLE_PROJECT_STATUSES).optional().default("Draft"),
  progress: z.number().int().min(0).max(100).optional().default(0),
  pendingClientPayments: z.number().nonnegative().optional().default(0),
  laborBudget: z.number().nonnegative().optional().default(0),
  materialBudget: z.number().nonnegative().optional().default(0),
  operationalBudget: z.number().nonnegative().optional().default(0),
  expectedProfitMarginPct: z.number().min(0).max(100).optional().default(0),
  paymentTerms: z.string().optional().default(""),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

/**
 * Spelled out rather than derived from `projectSchema.partial()`, for two
 * reasons.
 *
 * First, `.partial()` does not strip `.default()` — an omitted `status` still
 * parses to "Pending" and an omitted `progress` to 0, so the `?? row.x`
 * fallbacks below never fired and a partial edit silently reset those fields.
 *
 * Second, money derived from transactions is deliberately absent: amount
 * received comes from client payments, total spent from the project ledger, and
 * pending client payments is a formula over the two. Accepting them here would
 * let a project edit overwrite the books.
 */
const projectUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  siteLocation: z.string().min(2).optional(),
  clientName: z.string().min(2).optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  clientTin: z.string().optional(),
  pettyCash: z.number().nonnegative().optional(),
  contractNumber: z.string().min(3).optional(),
  startDate: z.string().date().optional(),
  expectedCompletionDate: z.string().date().optional(),
  contractValue: z.number().nonnegative().optional(),
  // Only the manually-settable states. Closing a project reconciles its books
  // and stamps who did it, so "Completed"/"Closed" go through /close instead of
  // being reachable by editing this field.
  status: z.enum(SELECTABLE_PROJECT_STATUSES).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  laborBudget: z.number().nonnegative().optional(),
  materialBudget: z.number().nonnegative().optional(),
  operationalBudget: z.number().nonnegative().optional(),
  expectedProfitMarginPct: z.number().min(0).max(100).optional(),
  paymentTerms: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const mapProject = (row: {
  id: string;
  name: string;
  site_location: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_tin: string;
  petty_cash: string;
  contract_number: string;
  start_date: string;
  expected_completion_date: string;
  contract_value: string;
  amount_received: string;
  total_spent: string;
  status: string;
  progress: number;
  pending_client_payments: string;
  labor_budget: string;
  material_budget: string;
  operational_budget: string;
  labor_spent: string;
  material_spent: string;
  operational_spent: string;
  closed_at: string | null;
  closed_by: string | null;
  expected_profit_margin_pct: string;
  payment_terms: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}) => ({
  id: row.id,
  name: row.name,
  siteLocation: row.site_location,
  clientName: row.client_name,
  clientPhone: row.client_phone,
  clientEmail: row.client_email,
  clientTin: row.client_tin,
  pettyCash: Number(row.petty_cash),
  contractNumber: row.contract_number,
  startDate: row.start_date,
  expectedCompletionDate: row.expected_completion_date,
  contractValue: Number(row.contract_value),
  amountReceived: Number(row.amount_received),
  totalSpent: Number(row.total_spent),
  remainingBalance: Number(row.contract_value) - Number(row.total_spent),
  profitLossEstimate: Number(row.amount_received) - Number(row.total_spent),
  status: row.status,
  progress: row.progress,
  // Derived, never stored: what the client still owes on the contract. Keeping
  // it as a formula means it can never drift from amount_received the way a
  // separately-incremented column did.
  pendingClientPayments: Math.max(
    Number(row.contract_value) - Number(row.amount_received),
    0,
  ),
  // How much of the company's own money is tied up here: spend that the client
  // has not funded yet. Zero once the client is ahead of the work.
  ownCapitalDeployed: Math.max(
    Number(row.total_spent) - Number(row.amount_received),
    0,
  ),
  // Share of the contract already consumed. Read against the manually-entered
  // progress it answers "are we spending faster than we are building?" — which
  // is why progress stays a human judgement rather than being derived from it.
  costConsumedPct:
    Number(row.contract_value) > 0
      ? Math.round((Number(row.total_spent) / Number(row.contract_value)) * 100)
      : 0,
  isOverBudget: Number(row.total_spent) > Number(row.contract_value),
  laborBudget: Number(row.labor_budget),
  materialBudget: Number(row.material_budget),
  operationalBudget: Number(row.operational_budget),
  laborSpent: Number(row.labor_spent),
  materialSpent: Number(row.material_spent),
  operationalSpent: Number(row.operational_spent),
  expectedProfitMarginPct: Number(row.expected_profit_margin_pct),
  closedAt: row.closed_at,
  closedBy: row.closed_by ?? "",
  paymentTerms: row.payment_terms ?? "",
  description: row.description ?? "",
  notes: row.notes ?? "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const logProjectActivity = async (
  companyId: number,
  action: string,
  projectId: string,
  description: string,
): Promise<void> => {
  await db.query(
    `
    INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
    VALUES ($1, $2, 'Faraja Nyerere', $3, 'Projects', $4, $5, '127.0.0.1 / Local Dev')
    `,
    [makeId("ACT"), companyId, action, projectId, description],
  );
};

router.get(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();

    const params: Array<string | number> = [companyId];
    const filters: string[] = ['company_id = $1', 'is_deleted = FALSE'];

    if (search.length > 0) {
      params.push(`%${search}%`);
      filters.push(
        `(name ILIKE $${params.length} OR site_location ILIKE $${params.length} OR client_name ILIKE $${params.length})`,
      );
    }

    if (status.length > 0) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }

    const query = `
      SELECT
        id,
        name,
        site_location,
        client_name,
        client_phone,
        client_email,
        client_tin,
        petty_cash::text,
        contract_number,
        start_date::text,
        expected_completion_date::text,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        status,
        progress,
        pending_client_payments::text,
        labor_budget::text,
        material_budget::text,
        operational_budget::text,
        labor_spent::text,
        material_spent::text,
        operational_spent::text,
        closed_at::text,
        closed_by,
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes,
        created_at::text,
        updated_at::text
      FROM engicost.projects
      WHERE ${filters.join(" AND ")}
      ORDER BY updated_at DESC, created_at DESC
    `;

    const result = await db.query(query, params);
    res.json(result.rows.map(mapProject));
  }),
);

router.get(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const result = await db.query(
      `
      SELECT
        id,
        name,
        site_location,
        client_name,
        client_phone,
        client_email,
        client_tin,
        petty_cash::text,
        contract_number,
        start_date::text,
        expected_completion_date::text,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        status,
        progress,
        pending_client_payments::text,
        labor_budget::text,
        material_budget::text,
        operational_budget::text,
        labor_spent::text,
        material_spent::text,
        operational_spent::text,
        closed_at::text,
        closed_by,
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes,
        created_at::text,
        updated_at::text
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, projectId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Project not found." });
      return;
    }

    res.json(mapProject(result.rows[0]));
  }),
);

router.post(
  "/",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = projectSchema.parse({
      ...req.body,
      contractValue: toMoney(req.body.contractValue),
      amountReceived: toMoney(req.body.amountReceived),
      totalSpent: toMoney(req.body.totalSpent),
      pendingClientPayments: toMoney(req.body.pendingClientPayments),
      laborBudget: toMoney(req.body.laborBudget),
      materialBudget: toMoney(req.body.materialBudget),
      operationalBudget: toMoney(req.body.operationalBudget),
      expectedProfitMarginPct: toMoney(req.body.expectedProfitMarginPct),
      progress: toInteger(req.body.progress),
    });

    const id = makeId("PRJ");
    const inserted = await db.query(
      `
      INSERT INTO engicost.projects (
        id, company_id, name, site_location, client_name, contract_number,
        start_date, expected_completion_date, contract_value, amount_received,
        total_spent, status, progress, pending_client_payments, labor_budget, material_budget,
        operational_budget, expected_profit_margin_pct, payment_terms, description, notes,
        client_phone, client_email, client_tin, petty_cash
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25
      )
      RETURNING
        id,
        name,
        site_location,
        client_name,
        client_phone,
        client_email,
        client_tin,
        petty_cash::text,
        contract_number,
        start_date::text,
        expected_completion_date::text,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        status,
        progress,
        pending_client_payments::text,
        labor_budget::text,
        material_budget::text,
        operational_budget::text,
        labor_spent::text,
        material_spent::text,
        operational_spent::text,
        closed_at::text,
        closed_by,
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes,
        created_at::text,
        updated_at::text
      `,
      [
        id,
        companyId,
        parsed.name,
        parsed.siteLocation,
        parsed.clientName,
        parsed.contractNumber,
        parsed.startDate,
        parsed.expectedCompletionDate,
        parsed.contractValue,
        parsed.amountReceived,
        parsed.totalSpent,
        parsed.status,
        parsed.progress,
        parsed.pendingClientPayments,
        parsed.laborBudget,
        parsed.materialBudget,
        parsed.operationalBudget,
        parsed.expectedProfitMarginPct,
        parsed.paymentTerms,
        parsed.description,
        parsed.notes,
        parsed.clientPhone,
        parsed.clientEmail,
        parsed.clientTin,
        parsed.pettyCash,
      ],
    );

    // Record the initial advance as a client payment transaction so it shows up
    // in the Payments & Cash Flow log. The project INSERT above already set
    // amount_received / pending_client_payments, so we DO NOT touch project
    // totals here (otherwise the advance would be double-counted).
    if (parsed.amountReceived > 0) {
      await db.query(
        `
        INSERT INTO engicost.client_payments (
          id, company_id, project_id, client_name, payment_type, milestone,
          amount_expected, amount_received, payment_date, payment_method,
          reference_number, status, notes, approval_status,
          approval_requested_by, approval_requested_at
        ) VALUES (
          $1, $2, $3, $4, 'Advance', 'Initial advance (project setup)',
          $5, $5, $6, 'Not specified',
          '', 'Received', '', 'AUTO_APPROVED',
          $7, NOW()
        )
        `,
        [
          makeId("PAY"),
          companyId,
          id,
          parsed.clientName,
          parsed.amountReceived,
          parsed.startDate,
          req.authUser?.fullName || "System",
        ],
      );
    }

    await logProjectActivity(
      companyId,
      "Created Project",
      id,
      `Created project ${parsed.name} (${parsed.contractNumber})`,
    );

    res.status(201).json(mapProject(inserted.rows[0]));
  }),
);

router.put(
  "/:id",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const parsed = projectUpdateSchema.parse({
      ...req.body,
      contractValue:
        req.body.contractValue !== undefined
          ? toMoney(req.body.contractValue)
          : undefined,
      amountReceived:
        req.body.amountReceived !== undefined
          ? toMoney(req.body.amountReceived)
          : undefined,
      totalSpent:
        req.body.totalSpent !== undefined ? toMoney(req.body.totalSpent) : undefined,
      pendingClientPayments:
        req.body.pendingClientPayments !== undefined
          ? toMoney(req.body.pendingClientPayments)
          : undefined,
      laborBudget:
        req.body.laborBudget !== undefined
          ? toMoney(req.body.laborBudget)
          : undefined,
      materialBudget:
        req.body.materialBudget !== undefined
          ? toMoney(req.body.materialBudget)
          : undefined,
      operationalBudget:
        req.body.operationalBudget !== undefined
          ? toMoney(req.body.operationalBudget)
          : undefined,
      expectedProfitMarginPct:
        req.body.expectedProfitMarginPct !== undefined
          ? toMoney(req.body.expectedProfitMarginPct)
          : undefined,
      progress:
        req.body.progress !== undefined ? toInteger(req.body.progress) : undefined,
    });

    const existing = await db.query(
      'SELECT id FROM engicost.projects WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE LIMIT 1',
      [companyId, projectId],
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ message: "Project not found." });
      return;
    }

    const current = await db.query(
      `
      SELECT
        name,
        site_location,
        client_name,
        client_phone,
        client_email,
        client_tin,
        petty_cash::text,
        contract_number,
        start_date::text,
        expected_completion_date::text,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        status,
        progress,
        pending_client_payments::text,
        labor_budget::text,
        material_budget::text,
        operational_budget::text,
        labor_spent::text,
        material_spent::text,
        operational_spent::text,
        closed_at::text,
        closed_by,
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, projectId],
    );
    const row = current.rows[0];

    const updated = await db.query(
      `
      UPDATE engicost.projects
      SET
        name = $3,
        site_location = $4,
        client_name = $5,
        contract_number = $6,
        start_date = $7,
        expected_completion_date = $8,
        contract_value = $9,
        status = $10,
        progress = $11,
        labor_budget = $12,
        material_budget = $13,
        operational_budget = $14,
        expected_profit_margin_pct = $15,
        payment_terms = $16,
        description = $17,
        notes = $18,
        client_phone = $19,
        client_email = $20,
        client_tin = $21,
        petty_cash = $22,
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      RETURNING
        id,
        name,
        site_location,
        client_name,
        client_phone,
        client_email,
        client_tin,
        petty_cash::text,
        contract_number,
        start_date::text,
        expected_completion_date::text,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        status,
        progress,
        pending_client_payments::text,
        labor_budget::text,
        material_budget::text,
        operational_budget::text,
        labor_spent::text,
        material_spent::text,
        operational_spent::text,
        closed_at::text,
        closed_by,
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes,
        created_at::text,
        updated_at::text
      `,
      [
        companyId,
        projectId,
        parsed.name ?? row.name,
        parsed.siteLocation ?? row.site_location,
        parsed.clientName ?? row.client_name,
        parsed.contractNumber ?? row.contract_number,
        parsed.startDate ?? row.start_date,
        parsed.expectedCompletionDate ?? row.expected_completion_date,
        parsed.contractValue ?? Number(row.contract_value),
        parsed.status ?? row.status,
        parsed.progress ?? row.progress,
        parsed.laborBudget ?? Number(row.labor_budget),
        parsed.materialBudget ?? Number(row.material_budget),
        parsed.operationalBudget ?? Number(row.operational_budget),
        parsed.expectedProfitMarginPct ?? Number(row.expected_profit_margin_pct),
        parsed.paymentTerms ?? (row.payment_terms ?? ""),
        parsed.description ?? row.description,
        parsed.notes ?? row.notes,
        parsed.clientPhone ?? row.client_phone,
        parsed.clientEmail ?? row.client_email,
        parsed.clientTin ?? row.client_tin,
        parsed.pettyCash ?? Number(row.petty_cash),
      ],
    );

    await logProjectActivity(
      companyId,
      "Updated Project",
      projectId,
      `Updated project ${updated.rows[0].name}`,
    );

    res.json(mapProject(updated.rows[0]));
  }),
);

router.delete(
  "/:id",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const deleted = await db.query<{ id: string; name: string }>(
      'UPDATE engicost.projects SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE RETURNING id, name',
      [companyId, projectId, req.authUser?.fullName ?? 'System Admin'],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: "Project not found." });
      return;
    }

    await logProjectActivity(
      companyId,
      "Deleted Project",
      deleted.rows[0].id,
      `Deleted project ${deleted.rows[0].name}`,
    );

    res.json({ message: "Project deleted successfully." });
  }),
);


type ClosureOutstanding = {
  clientBalance: number;
  workerOutstanding: number;
  unreconciledPettyCash: number;
  pendingApprovals: number;
  undeliveredRequirements: number;
};

/**
 * Reconciles a project's booked spend against its transactions and reports
 * everything still open. Used both to preview a closure and to perform one, so
 * the numbers a user is shown are the numbers the close acts on.
 */
const buildClosureSummary = async (
  client: Queryable,
  companyId: number,
  projectId: string,
) => {
  const spend = await recalculateProjectSpend(client, companyId, projectId);

  const project = await client.query<{
    name: string;
    status: string;
    contract_value: string;
    amount_received: string;
  }>(
    `
    SELECT name, status, contract_value::text, amount_received::text
    FROM engicost.projects
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
    `,
    [companyId, projectId],
  );

  if (project.rowCount === 0) {
    return null;
  }

  const openItems = await client.query<{
    worker_outstanding: string;
    unreconciled_petty_cash: string;
    pending_approvals: string;
    undelivered_requirements: string;
  }>(
    `
    SELECT
      (
        SELECT COALESCE(SUM(outstanding_amount), 0)
        FROM engicost.workers
        WHERE company_id = $1 AND assigned_project_id = $2 AND is_deleted = FALSE
      )::text AS worker_outstanding,
      (
        SELECT COALESCE(SUM(amount), 0)
        FROM engicost.petty_cash_transactions
        WHERE company_id = $1 AND project_id = $2
          AND is_deleted = FALSE AND status = 'Pending'
      )::text AS unreconciled_petty_cash,
      (
        (SELECT COUNT(*) FROM engicost.expenses
          WHERE company_id = $1 AND project_id = $2 AND is_deleted = FALSE AND approval_status = 'PENDING')
        + (SELECT COUNT(*) FROM engicost.labor_payments
          WHERE company_id = $1 AND project_id = $2 AND is_deleted = FALSE AND approval_status = 'PENDING')
        + (SELECT COUNT(*) FROM engicost.material_purchases
          WHERE company_id = $1 AND project_id = $2 AND is_deleted = FALSE AND approval_status = 'PENDING')
        + (SELECT COUNT(*) FROM engicost.equipment_usage
          WHERE company_id = $1 AND project_id = $2 AND is_deleted = FALSE AND approval_status = 'PENDING')
      )::text AS pending_approvals,
      (
        SELECT COUNT(*)
        FROM engicost.material_requirements
        WHERE company_id = $1 AND project_id = $2 AND supply_status <> 'Completed'
      )::text AS undelivered_requirements
    `,
    [companyId, projectId],
  );

  const row = project.rows[0];
  const open = openItems.rows[0];
  const contractValue = Number(row.contract_value);
  const amountReceived = Number(row.amount_received);

  const outstanding: ClosureOutstanding = {
    clientBalance: Math.max(contractValue - amountReceived, 0),
    workerOutstanding: Number(open?.worker_outstanding ?? 0),
    unreconciledPettyCash: Number(open?.unreconciled_petty_cash ?? 0),
    pendingApprovals: Number(open?.pending_approvals ?? 0),
    undeliveredRequirements: Number(open?.undelivered_requirements ?? 0),
  };

  return {
    projectName: row.name,
    status: row.status,
    contractValue,
    amountReceived,
    totalSpent: spend.totalSpent,
    laborSpent: spend.labor,
    materialSpent: spend.material,
    operationalSpent: spend.operational,
    profitLoss: amountReceived - spend.totalSpent,
    outstanding,
    readyToClose:
      outstanding.clientBalance === 0 &&
      outstanding.workerOutstanding === 0 &&
      outstanding.unreconciledPettyCash === 0 &&
      outstanding.pendingApprovals === 0 &&
      outstanding.undeliveredRequirements === 0,
  };
};

// Preview what a closure would reconcile to, without changing project status.
router.get(
  "/:id/closure-summary",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);

    const summary = await withTransaction((client) =>
      buildClosureSummary(client, companyId, projectId),
    );

    if (!summary) {
      res.status(404).json({ message: "Project not found." });
      return;
    }

    res.json(summary);
  }),
);

/**
 * Closes a project: reconciles its totals, then locks it against new spend.
 * Outstanding items do not block the close — a project can legitimately be
 * closed with a written-off balance — but they are reported back so the
 * decision is made with them on screen. Pass `force: true` to close anyway.
 */
router.post(
  "/:id/close",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const closedBy = req.authUser?.fullName ?? "System Admin";
    const force = req.body?.force === true;

    const result = await withTransaction(async (client) => {
      const summary = await buildClosureSummary(client, companyId, projectId);

      if (!summary) {
        return { notFound: true as const };
      }

      if (CLOSED_PROJECT_STATUSES.some((status) => status === summary.status)) {
        return { alreadyClosed: true as const, summary };
      }

      if (!summary.readyToClose && !force) {
        return { blocked: true as const, summary };
      }

      await client.query(
        `
        UPDATE engicost.projects
        SET status = 'Closed', progress = 100, closed_at = NOW(), closed_by = $3, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, projectId, closedBy],
      );

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Closed Project', 'Projects', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          closedBy,
          projectId,
          `Closed ${summary.projectName}. Final spend TZS ${summary.totalSpent.toLocaleString("en-TZ")}, ` +
            `profit/loss TZS ${summary.profitLoss.toLocaleString("en-TZ")}.`,
        ],
      );

      return { closed: true as const, summary };
    });

    if ("notFound" in result) {
      res.status(404).json({ message: "Project not found." });
      return;
    }

    if ("alreadyClosed" in result) {
      res.status(400).json({
        message: `${result.summary.projectName} is already ${result.summary.status}.`,
        summary: result.summary,
      });
      return;
    }

    if ("blocked" in result) {
      res.status(409).json({
        message:
          "This project still has open items. Review them, or resend with force to close anyway.",
        summary: result.summary,
      });
      return;
    }

    res.json({
      message: `${result.summary.projectName} closed successfully.`,
      summary: result.summary,
    });
  }),
);

// Reopening restores the ability to record spend against a closed project.
router.post(
  "/:id/reopen",
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const reopenedBy = req.authUser?.fullName ?? "System Admin";

    const reopened = await db.query<{ id: string; name: string }>(
      `
      UPDATE engicost.projects
      SET status = 'Active', closed_at = NULL, closed_by = NULL, updated_at = NOW()
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE AND status IN ('Completed', 'Closed')
      RETURNING id, name
      `,
      [companyId, projectId],
    );

    if (reopened.rowCount === 0) {
      res.status(404).json({ message: "Closed project not found." });
      return;
    }

    await logProjectActivity(
      companyId,
      "Reopened Project",
      reopened.rows[0].id,
      `Reopened project ${reopened.rows[0].name} (by ${reopenedBy})`,
    );

    res.json({ message: `${reopened.rows[0].name} reopened successfully.` });
  }),
);

router.patch(
  '/:id/restore',
  requireSuperAdmin,
  requireRoles(...projectManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);

    const restored = await db.query<{ id: string; name: string }>(
      'UPDATE engicost.projects SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id, name',
      [companyId, projectId],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted project not found.' });
      return;
    }

    await logProjectActivity(companyId, 'Restored Project', restored.rows[0].id, 'Restored project ' + restored.rows[0].name);

    res.json({ message: 'Project restored successfully.' });
  }),
);
export default router;

