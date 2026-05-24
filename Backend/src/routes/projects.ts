import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toInteger, toMoney } from "./utils";

const router = Router();

const projectSchema = z.object({
  name: z.string().min(2),
  siteLocation: z.string().min(2),
  clientName: z.string().min(2),
  contractNumber: z.string().min(3),
  startDate: z.string().date(),
  expectedCompletionDate: z.string().date(),
  contractValue: z.number().nonnegative(),
  amountReceived: z.number().nonnegative().optional().default(0),
  totalSpent: z.number().nonnegative().optional().default(0),
  status: z.string().min(2).optional().default("Pending"),
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

const projectUpdateSchema = projectSchema.partial();

const mapProject = (row: {
  id: string;
  name: string;
  site_location: string;
  client_name: string;
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
  pendingClientPayments: Number(row.pending_client_payments),
  laborBudget: Number(row.labor_budget),
  materialBudget: Number(row.material_budget),
  operationalBudget: Number(row.operational_budget),
  expectedProfitMarginPct: Number(row.expected_profit_margin_pct),
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
    const filters: string[] = ["company_id = $1"];

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
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes,
        created_at::text,
        updated_at::text
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2
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
        operational_budget, expected_profit_margin_pct, payment_terms, description, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21
      )
      RETURNING
        id,
        name,
        site_location,
        client_name,
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
      ],
    );

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
      "SELECT id FROM engicost.projects WHERE company_id = $1 AND id = $2 LIMIT 1",
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
        expected_profit_margin_pct::text,
        payment_terms,
        description,
        notes
      FROM engicost.projects
      WHERE company_id = $1 AND id = $2
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
        amount_received = $10,
        total_spent = $11,
        status = $12,
        progress = $13,
        pending_client_payments = $14,
        labor_budget = $15,
        material_budget = $16,
        operational_budget = $17,
        expected_profit_margin_pct = $18,
        payment_terms = $19,
        description = $20,
        notes = $21,
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING
        id,
        name,
        site_location,
        client_name,
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
        parsed.amountReceived ?? Number(row.amount_received),
        parsed.totalSpent ?? Number(row.total_spent),
        parsed.status ?? row.status,
        parsed.progress ?? row.progress,
        parsed.pendingClientPayments ?? Number(row.pending_client_payments),
        parsed.laborBudget ?? Number(row.labor_budget),
        parsed.materialBudget ?? Number(row.material_budget),
        parsed.operationalBudget ?? Number(row.operational_budget),
        parsed.expectedProfitMarginPct ?? Number(row.expected_profit_margin_pct),
        parsed.paymentTerms ?? (row.payment_terms ?? ""),
        parsed.description ?? row.description,
        parsed.notes ?? row.notes,
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
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.params.id);
    const deleted = await db.query<{ id: string; name: string }>(
      `
      DELETE FROM engicost.projects
      WHERE company_id = $1 AND id = $2
      RETURNING id, name
      `,
      [companyId, projectId],
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

export default router;

