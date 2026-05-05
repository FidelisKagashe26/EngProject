import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toMoney } from "./utils";

const router = Router();

const workOrderSchema = z.object({
  projectId: z.string().min(3),
  orderNumber: z.string().min(2),
  clientName: z.string().min(2),
  orderDate: z.string().date(),
  description: z.string().min(2),
  materialsCost: z.number().nonnegative(),
  materialsProfitPct: z.number().min(0).max(100),
  labourCost: z.number().nonnegative(),
  labourProfitPct: z.number().min(0).max(100),
  status: z.string().optional().default("Draft"),
  notes: z.string().optional().default(""),
});

const workOrderUpdateSchema = workOrderSchema.partial();

type WorkOrderRow = {
  id: string;
  project_id: string;
  project_name: string | null;
  order_number: string;
  client_name: string;
  order_date: string;
  description: string;
  materials_cost: string;
  materials_profit_pct: string;
  materials_profit_amount: string;
  labour_cost: string;
  labour_profit_pct: string;
  labour_profit_amount: string;
  total_cost: string;
  total_profit: string;
  grand_total: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const mapWorkOrder = (row: WorkOrderRow) => ({
  id: row.id,
  projectId: row.project_id,
  projectName: row.project_name ?? "",
  orderNumber: row.order_number,
  clientName: row.client_name,
  orderDate: row.order_date,
  description: row.description,
  materialsCost: Number(row.materials_cost),
  materialsProfitPct: Number(row.materials_profit_pct),
  materialsProfitAmount: Number(row.materials_profit_amount),
  labourCost: Number(row.labour_cost),
  labourProfitPct: Number(row.labour_profit_pct),
  labourProfitAmount: Number(row.labour_profit_amount),
  totalCost: Number(row.total_cost),
  totalProfit: Number(row.total_profit),
  grandTotal: Number(row.grand_total),
  status: row.status,
  notes: row.notes ?? "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT_WORK_ORDERS = `
  SELECT
    wo.id,
    wo.project_id,
    p.name AS project_name,
    wo.order_number,
    wo.client_name,
    wo.order_date::text,
    wo.description,
    wo.materials_cost::text,
    wo.materials_profit_pct::text,
    wo.materials_profit_amount::text,
    wo.labour_cost::text,
    wo.labour_profit_pct::text,
    wo.labour_profit_amount::text,
    wo.total_cost::text,
    wo.total_profit::text,
    wo.grand_total::text,
    wo.status,
    wo.notes,
    wo.created_at::text,
    wo.updated_at::text
  FROM engicost.work_orders wo
  LEFT JOIN engicost.projects p ON p.id = wo.project_id
`;

// GET /work-orders
router.get(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const projectId = String(req.query.projectId ?? "").trim();

    const params: Array<string | number> = [companyId];
    let filter = "wo.company_id = $1";

    if (projectId.length > 0 && projectId !== "All") {
      params.push(projectId);
      filter += ` AND wo.project_id = $${params.length}`;
    }

    const result = await db.query<WorkOrderRow>(
      `${SELECT_WORK_ORDERS} WHERE ${filter} ORDER BY wo.created_at DESC`,
      params,
    );

    res.json(result.rows.map(mapWorkOrder));
  }),
);

// GET /work-orders/:id
router.get(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);

    const result = await db.query<WorkOrderRow>(
      `${SELECT_WORK_ORDERS} WHERE wo.company_id = $1 AND wo.id = $2 LIMIT 1`,
      [companyId, id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Work order not found." });
      return;
    }

    res.json(mapWorkOrder(result.rows[0]));
  }),
);

// POST /work-orders
router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = workOrderSchema.parse({
      ...req.body,
      materialsCost: toMoney(req.body.materialsCost),
      materialsProfitPct: Number(req.body.materialsProfitPct) || 0,
      labourCost: toMoney(req.body.labourCost),
      labourProfitPct: Number(req.body.labourProfitPct) || 0,
    });

    // Verify project exists
    const projectCheck = await db.query<{ id: string; name: string }>(
      "SELECT id, name FROM engicost.projects WHERE company_id = $1 AND id = $2 LIMIT 1",
      [companyId, parsed.projectId],
    );
    if (projectCheck.rowCount === 0) {
      res.status(400).json({ message: "Project not found." });
      return;
    }

    const materialsProfitAmount = (parsed.materialsCost * parsed.materialsProfitPct) / 100;
    const labourProfitAmount = (parsed.labourCost * parsed.labourProfitPct) / 100;
    const totalCost = parsed.materialsCost + parsed.labourCost;
    const totalProfit = materialsProfitAmount + labourProfitAmount;
    const grandTotal = totalCost + totalProfit;

    const id = makeId("WO");
    const inserted = await db.query<WorkOrderRow>(
      `
      INSERT INTO engicost.work_orders (
        id, company_id, project_id, order_number, client_name, order_date, description,
        materials_cost, materials_profit_pct, materials_profit_amount,
        labour_cost, labour_profit_pct, labour_profit_amount,
        total_cost, total_profit, grand_total, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17, $18
      )
      RETURNING
        id, project_id, order_number, client_name, order_date::text, description,
        materials_cost::text, materials_profit_pct::text, materials_profit_amount::text,
        labour_cost::text, labour_profit_pct::text, labour_profit_amount::text,
        total_cost::text, total_profit::text, grand_total::text,
        status, notes, created_at::text, updated_at::text
      `,
      [
        id, companyId, parsed.projectId, parsed.orderNumber, parsed.clientName,
        parsed.orderDate, parsed.description,
        parsed.materialsCost, parsed.materialsProfitPct, materialsProfitAmount,
        parsed.labourCost, parsed.labourProfitPct, labourProfitAmount,
        totalCost, totalProfit, grandTotal, parsed.status, parsed.notes,
      ],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Site Supervisor', 'Created Work Order', 'Work Orders', $3, $4, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, parsed.projectId, `Created work order ${parsed.orderNumber} for ${parsed.clientName}.`],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      ...mapWorkOrder({ ...row, project_name: projectCheck.rows[0].name }),
    });
  }),
);

// PUT /work-orders/:id
router.put(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);

    const existing = await db.query<WorkOrderRow>(
      `${SELECT_WORK_ORDERS} WHERE wo.company_id = $1 AND wo.id = $2 LIMIT 1`,
      [companyId, id],
    );
    if (existing.rowCount === 0) {
      res.status(404).json({ message: "Work order not found." });
      return;
    }

    const cur = existing.rows[0];
    const parsed = workOrderUpdateSchema.parse({
      ...req.body,
      materialsCost: req.body.materialsCost !== undefined ? toMoney(req.body.materialsCost) : undefined,
      materialsProfitPct: req.body.materialsProfitPct !== undefined ? Number(req.body.materialsProfitPct) : undefined,
      labourCost: req.body.labourCost !== undefined ? toMoney(req.body.labourCost) : undefined,
      labourProfitPct: req.body.labourProfitPct !== undefined ? Number(req.body.labourProfitPct) : undefined,
    });

    const materialsCost = parsed.materialsCost ?? Number(cur.materials_cost);
    const materialsProfitPct = parsed.materialsProfitPct ?? Number(cur.materials_profit_pct);
    const labourCost = parsed.labourCost ?? Number(cur.labour_cost);
    const labourProfitPct = parsed.labourProfitPct ?? Number(cur.labour_profit_pct);

    const materialsProfitAmount = (materialsCost * materialsProfitPct) / 100;
    const labourProfitAmount = (labourCost * labourProfitPct) / 100;
    const totalCost = materialsCost + labourCost;
    const totalProfit = materialsProfitAmount + labourProfitAmount;
    const grandTotal = totalCost + totalProfit;

    const updated = await db.query<WorkOrderRow>(
      `
      UPDATE engicost.work_orders SET
        project_id = $3,
        order_number = $4,
        client_name = $5,
        order_date = $6,
        description = $7,
        materials_cost = $8,
        materials_profit_pct = $9,
        materials_profit_amount = $10,
        labour_cost = $11,
        labour_profit_pct = $12,
        labour_profit_amount = $13,
        total_cost = $14,
        total_profit = $15,
        grand_total = $16,
        status = $17,
        notes = $18,
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING
        id, project_id, order_number, client_name, order_date::text, description,
        materials_cost::text, materials_profit_pct::text, materials_profit_amount::text,
        labour_cost::text, labour_profit_pct::text, labour_profit_amount::text,
        total_cost::text, total_profit::text, grand_total::text,
        status, notes, created_at::text, updated_at::text
      `,
      [
        companyId, id,
        parsed.projectId ?? cur.project_id,
        parsed.orderNumber ?? cur.order_number,
        parsed.clientName ?? cur.client_name,
        parsed.orderDate ?? cur.order_date,
        parsed.description ?? cur.description,
        materialsCost, materialsProfitPct, materialsProfitAmount,
        labourCost, labourProfitPct, labourProfitAmount,
        totalCost, totalProfit, grandTotal,
        parsed.status ?? cur.status,
        parsed.notes ?? cur.notes ?? "",
      ],
    );

    const row = updated.rows[0];
    res.json(mapWorkOrder({ ...row, project_name: cur.project_name }));
  }),
);

// DELETE /work-orders/:id
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);

    const deleted = await db.query<{ id: string; order_number: string }>(
      "DELETE FROM engicost.work_orders WHERE company_id = $1 AND id = $2 RETURNING id, order_number",
      [companyId, id],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: "Work order not found." });
      return;
    }

    res.json({ message: `Work order ${deleted.rows[0].order_number} deleted.` });
  }),
);

export default router;
