import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toMoney } from "./utils";
import {
  APPROVAL_THRESHOLDS,
  getApprovalStatusForAmount,
  isAppliedApprovalStatus,
  requiresApproval,
} from "../services/approval";

const router = Router();

const materialSupplySourceSchema = z.enum(["Company Purchased", "Client Supplied"]);

const requirementSchema = z.object({
  projectId: z.string().min(3),
  materialName: z.string().min(2),
  requiredQuantity: z.number().nonnegative(),
  unit: z.string().min(1),
  estimatedUnitCost: z.number().nonnegative(),
  supplySource: materialSupplySourceSchema.optional().default("Company Purchased"),
  requestedQuantity: z.number().nonnegative().optional().default(0),
  supplyStatus: z.string().optional().default("Planned"),
  priority: z.string().optional().default("Medium"),
  neededByDate: z.string().date().optional(),
  notes: z.string().optional().default(""),
});

const requestSupplySchema = z.object({
  requestedQuantity: z.number().positive(),
  requestDate: z.string().date().optional(),
  notes: z.string().optional().default(""),
});

const purchaseSchema = z.object({
  projectId: z.string().min(3),
  requirementId: z.string().optional().default(""),
  materialName: z.string().min(2),
  quantityPurchased: z.number().nonnegative(),
  supplierName: z.string().min(2),
  unitCost: z.number().nonnegative(),
  supplySource: materialSupplySourceSchema.optional().default("Company Purchased"),
  purchaseDate: z.string().date(),
  deliveryNoteNumber: z.string().optional().default(""),
  deliveryStatus: z.string().optional().default("Pending Delivery"),
  receiptRef: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

type ProjectLookup = {
  id: string;
  name: string;
};

type RequirementLookup = {
  id: string;
  project_id: string;
  material_name: string;
  supply_source: string;
};

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

const normalizeText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const getTodaySqlDate = (): string => new Date().toISOString().slice(0, 10);

const getProjectById = async (
  companyId: number,
  projectId: string,
): Promise<ProjectLookup | null> => {
  const result = await db.query<ProjectLookup>(
    `
    SELECT id, name
    FROM engicost.projects
    WHERE company_id = $1 AND id = $2
    LIMIT 1
    `,
    [companyId, projectId],
  );
  return result.rows[0] ?? null;
};

const getRequirementById = async (
  companyId: number,
  requirementId: string,
): Promise<RequirementLookup | null> => {
  const result = await db.query<RequirementLookup>(
    `
    SELECT id, project_id, material_name, supply_source
    FROM engicost.material_requirements
    WHERE company_id = $1 AND id = $2
    LIMIT 1
    `,
    [companyId, requirementId],
  );
  return result.rows[0] ?? null;
};

const refreshRequirementSupplyStatus = async (
  queryable: QueryExecutor,
  companyId: number,
  requirementId: string | null | undefined,
): Promise<void> => {
  if (!requirementId || requirementId.trim().length === 0) {
    return;
  }

  await queryable.query(
    `
    UPDATE engicost.material_requirements mr
    SET
      supply_status = CASE
        WHEN delivered.quantity >= mr.required_quantity THEN 'Fulfilled'
        WHEN delivered.quantity > 0 THEN 'Partially Delivered'
        WHEN mr.requested_quantity > 0 THEN 'Requested'
        ELSE 'Planned'
      END,
      updated_at = NOW()
    FROM (
      SELECT COALESCE(SUM(quantity_purchased), 0) AS quantity
      FROM engicost.material_purchases
      WHERE company_id = $1
        AND requirement_id = $2
        AND is_deleted = FALSE
    ) delivered
    WHERE mr.company_id = $1 AND mr.id = $2
    `,
    [companyId, requirementId],
  );
};

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [requirementsResult, purchasesResult] = await Promise.all([
      db.query<{
        id: string;
        project_id: string;
        project_name: string;
        material_name: string;
        required_quantity: string;
        unit: string;
        estimated_unit_cost: string;
        supply_source: string;
        requested_quantity: string;
        last_request_date: string | null;
        supply_status: string;
        priority: string;
        needed_by_date: string | null;
        notes: string | null;
      }>(
        `
        SELECT
          mr.id,
          mr.project_id,
          p.name AS project_name,
          mr.material_name,
          mr.required_quantity::text,
          mr.unit,
          mr.estimated_unit_cost::text,
          mr.supply_source,
          mr.requested_quantity::text,
          mr.last_request_date::text,
          mr.supply_status,
          mr.priority,
          mr.needed_by_date::text,
          mr.notes
        FROM engicost.material_requirements mr
        JOIN engicost.projects p ON p.id = mr.project_id
        WHERE mr.company_id = $1
        ORDER BY mr.created_at DESC
        `,
        [companyId],
      ),
      db.query<{
        id: string;
        project_id: string;
        project_name: string;
        requirement_id: string | null;
        material_name: string;
        quantity_purchased: string;
        supplier_name: string;
        unit_cost: string;
        total_cost: string;
        supply_source: string;
        purchase_date: string;
        delivery_note_number: string | null;
        delivery_status: string;
        receipt_ref: string | null;
        notes: string | null;
        approval_status: string;
      }>(
        `
        SELECT
          mp.id,
          mp.project_id,
          p.name AS project_name,
          mp.requirement_id,
          mp.material_name,
          mp.quantity_purchased::text,
          mp.supplier_name,
          mp.unit_cost::text,
          mp.total_cost::text,
          mp.supply_source,
          mp.purchase_date::text,
          mp.delivery_note_number,
          mp.delivery_status,
          mp.receipt_ref,
          mp.notes
        FROM engicost.material_purchases mp
        JOIN engicost.projects p ON p.id = mp.project_id
        WHERE mp.company_id = $1 AND mp.is_deleted = FALSE
        ORDER BY mp.purchase_date DESC, mp.created_at DESC
        `,
        [companyId],
      ),
    ]);

    const purchasedByRequirement = purchasesResult.rows.reduce<Record<string, number>>(
      (acc, item) => {
        if (item.requirement_id) {
          acc[item.requirement_id] =
            (acc[item.requirement_id] ?? 0) + Number(item.quantity_purchased);
        }
        return acc;
      },
      {},
    );
    const clientSuppliedByRequirement = purchasesResult.rows.reduce<Record<string, number>>(
      (acc, item) => {
        if (item.requirement_id && item.supply_source === "Client Supplied") {
          acc[item.requirement_id] =
            (acc[item.requirement_id] ?? 0) + Number(item.quantity_purchased);
        }
        return acc;
      },
      {},
    );
    const companyPurchasedByRequirement = purchasesResult.rows.reduce<Record<string, number>>(
      (acc, item) => {
        if (item.requirement_id && item.supply_source !== "Client Supplied") {
          acc[item.requirement_id] =
            (acc[item.requirement_id] ?? 0) + Number(item.quantity_purchased);
        }
        return acc;
      },
      {},
    );

    res.json({
      requirements: requirementsResult.rows.map((row) => {
        const purchased = purchasedByRequirement[row.id] ?? 0;
        const required = Number(row.required_quantity);
        return {
          id: row.id,
          projectId: row.project_id,
          projectName: row.project_name,
          materialName: row.material_name,
          requiredQuantity: required,
          purchasedQuantity: purchased,
          companyPurchasedQuantity: companyPurchasedByRequirement[row.id] ?? 0,
          clientSuppliedQuantity: clientSuppliedByRequirement[row.id] ?? 0,
          remainingQuantity: Math.max(required - purchased, 0),
          unit: row.unit,
          estimatedUnitCost: Number(row.estimated_unit_cost),
          supplySource: row.supply_source,
          requestedQuantity: Number(row.requested_quantity),
          lastRequestDate: row.last_request_date,
          supplyStatus: row.supply_status,
          priority: row.priority,
          neededByDate: row.needed_by_date,
          notes: row.notes ?? "",
        };
      }),
      purchases: purchasesResult.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        requirementId: row.requirement_id,
        materialName: row.material_name,
        quantityPurchased: Number(row.quantity_purchased),
        supplierName: row.supplier_name,
        unitCost: Number(row.unit_cost),
        totalCost: Number(row.total_cost),
        supplySource: row.supply_source,
        purchaseDate: row.purchase_date,
        deliveryNoteNumber: row.delivery_note_number ?? "",
        deliveryStatus: row.delivery_status,
        receiptRef: row.receipt_ref ?? "",
        notes: row.notes ?? "",
      })),
    });
  }),
);

router.post(
  "/requirements",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = requirementSchema.parse({
      ...req.body,
      requiredQuantity: toMoney(req.body.requiredQuantity),
      estimatedUnitCost: toMoney(req.body.estimatedUnitCost),
      requestedQuantity: req.body.requestedQuantity !== undefined ? toMoney(req.body.requestedQuantity) : undefined,
    });

    const project = await getProjectById(companyId, parsed.projectId);
    if (!project) {
      res.status(400).json({ message: "Selected project/site does not exist." });
      return;
    }

    const inserted = await db.query(
      `
      INSERT INTO engicost.material_requirements (
        id, company_id, project_id, material_name, required_quantity, unit,
        estimated_unit_cost, supply_source, requested_quantity, last_request_date,
        supply_status, priority, needed_by_date, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING
        id,
        project_id,
        material_name,
        required_quantity::text,
        unit,
        estimated_unit_cost::text,
        supply_source,
        requested_quantity::text,
        last_request_date::text,
        supply_status,
        priority,
        needed_by_date::text,
        notes
      `,
      [
        makeId("REQ"),
        companyId,
        parsed.projectId,
        parsed.materialName,
        parsed.requiredQuantity,
        parsed.unit,
        parsed.estimatedUnitCost,
        parsed.supplySource,
        parsed.requestedQuantity,
        parsed.requestedQuantity > 0 ? getTodaySqlDate() : null,
        parsed.requestedQuantity > 0 ? "Requested" : parsed.supplyStatus,
        parsed.priority,
        parsed.neededByDate ?? null,
        parsed.notes,
      ],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Store Keeper', 'Added Material Requirement', 'Materials', $3, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        parsed.projectId,
        `Added ${parsed.supplySource.toLowerCase()} requirement ${parsed.materialName} for ${project.name}.`,
      ],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      projectName: project.name,
      materialName: row.material_name,
      requiredQuantity: Number(row.required_quantity),
      unit: row.unit,
      estimatedUnitCost: Number(row.estimated_unit_cost),
      supplySource: row.supply_source,
      requestedQuantity: Number(row.requested_quantity),
      lastRequestDate: row.last_request_date,
      supplyStatus: row.supply_status,
      priority: row.priority,
      neededByDate: row.needed_by_date,
      notes: row.notes ?? "",
    });
  }),
);

router.patch(
  "/requirements/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const requirementId = String(req.params.id);
    const parsed = requirementSchema.partial().parse({
      ...req.body,
      requiredQuantity: req.body.requiredQuantity !== undefined ? toMoney(req.body.requiredQuantity) : undefined,
      estimatedUnitCost: req.body.estimatedUnitCost !== undefined ? toMoney(req.body.estimatedUnitCost) : undefined,
      requestedQuantity: req.body.requestedQuantity !== undefined ? toMoney(req.body.requestedQuantity) : undefined,
    });

    const setClauses: string[] = [];
    const params: unknown[] = [companyId, requirementId];
    let paramIndex = 3;

    if (parsed.projectId) {
      const project = await getProjectById(companyId, parsed.projectId);
      if (!project) {
        res.status(400).json({ message: "Selected project/site does not exist." });
        return;
      }
      setClauses.push(`project_id = $${paramIndex++}`);
      params.push(parsed.projectId);
    }
    if (parsed.materialName) {
      setClauses.push(`material_name = $${paramIndex++}`);
      params.push(parsed.materialName);
    }
    if (parsed.requiredQuantity !== undefined) {
      setClauses.push(`required_quantity = $${paramIndex++}`);
      params.push(parsed.requiredQuantity);
    }
    if (parsed.unit) {
      setClauses.push(`unit = $${paramIndex++}`);
      params.push(parsed.unit);
    }
    if (parsed.estimatedUnitCost !== undefined) {
      setClauses.push(`estimated_unit_cost = $${paramIndex++}`);
      params.push(parsed.estimatedUnitCost);
    }
    if (parsed.supplySource) {
      setClauses.push(`supply_source = $${paramIndex++}`);
      params.push(parsed.supplySource);
    }
    if (parsed.requestedQuantity !== undefined) {
      setClauses.push(`requested_quantity = $${paramIndex++}`);
      params.push(parsed.requestedQuantity);
      setClauses.push(`last_request_date = CASE WHEN $${paramIndex}::numeric > 0 THEN COALESCE(last_request_date, CURRENT_DATE) ELSE last_request_date END`);
      params.push(parsed.requestedQuantity);
      paramIndex += 1;
    }
    if (parsed.supplyStatus) {
      setClauses.push(`supply_status = $${paramIndex++}`);
      params.push(parsed.supplyStatus);
    }
    if (parsed.priority) {
      setClauses.push(`priority = $${paramIndex++}`);
      params.push(parsed.priority);
    }
    if (parsed.neededByDate !== undefined) {
      setClauses.push(`needed_by_date = $${paramIndex++}`);
      params.push(parsed.neededByDate ?? null);
    }
    if (parsed.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(parsed.notes);
    }

    if (setClauses.length === 0) {
      res.status(400).json({ message: "No requirement fields provided for update." });
      return;
    }

    const updated = await db.query<{
      id: string;
      project_id: string;
      material_name: string;
      required_quantity: string;
      unit: string;
      estimated_unit_cost: string;
      supply_source: string;
      requested_quantity: string;
      last_request_date: string | null;
      supply_status: string;
      priority: string;
      needed_by_date: string | null;
      notes: string | null;
    }>(
      `
      UPDATE engicost.material_requirements
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING
        id,
        project_id,
        material_name,
        required_quantity::text,
        unit,
        estimated_unit_cost::text,
        supply_source,
        requested_quantity::text,
        last_request_date::text,
        supply_status,
        priority,
        needed_by_date::text,
        notes
      `,
      params,
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ message: "Material requirement not found." });
      return;
    }

    const row = updated.rows[0];
    res.json({
      id: row.id,
      projectId: row.project_id,
      materialName: row.material_name,
      requiredQuantity: Number(row.required_quantity),
      unit: row.unit,
      estimatedUnitCost: Number(row.estimated_unit_cost),
      supplySource: row.supply_source,
      requestedQuantity: Number(row.requested_quantity),
      lastRequestDate: row.last_request_date,
      supplyStatus: row.supply_status,
      priority: row.priority,
      neededByDate: row.needed_by_date,
      notes: row.notes ?? "",
    });
  }),
);

router.patch(
  "/requirements/:id/request-supply",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const requirementId = String(req.params.id);
    const parsed = requestSupplySchema.parse({
      ...req.body,
      requestedQuantity: toMoney(req.body.requestedQuantity),
    });

    const updated = await db.query<{
      id: string;
      project_id: string;
      material_name: string;
      requested_quantity: string;
      last_request_date: string | null;
      supply_status: string;
    }>(
      `
      UPDATE engicost.material_requirements
      SET
        requested_quantity = requested_quantity + $3,
        last_request_date = $4,
        supply_status = 'Requested',
        notes = CASE
          WHEN $5::text = '' THEN notes
          WHEN COALESCE(notes, '') = '' THEN $5
          ELSE notes || E'\n' || $5
        END,
        updated_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING id, project_id, material_name, requested_quantity::text, last_request_date::text, supply_status
      `,
      [
        companyId,
        requirementId,
        parsed.requestedQuantity,
        parsed.requestDate ?? getTodaySqlDate(),
        parsed.notes.trim(),
      ],
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ message: "Material requirement not found." });
      return;
    }

    const row = updated.rows[0];
    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Requested Material Supply', 'Materials', $4, $5, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        req.authUser?.fullName || "Store Keeper",
        row.project_id,
        `Requested ${parsed.requestedQuantity.toLocaleString("en-TZ")} more ${row.material_name}.`,
      ],
    );

    res.json({
      id: row.id,
      requestedQuantity: Number(row.requested_quantity),
      lastRequestDate: row.last_request_date,
      supplyStatus: row.supply_status,
    });
  }),
);

router.post(
  "/purchases",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = purchaseSchema.parse({
      ...req.body,
      quantityPurchased: toMoney(req.body.quantityPurchased),
      unitCost: toMoney(req.body.unitCost),
    });

    const project = await getProjectById(companyId, parsed.projectId);
    if (!project) {
      res.status(400).json({ message: "Selected project/site does not exist." });
      return;
    }

    let requirement: RequirementLookup | null = null;
    if (parsed.requirementId.trim().length > 0) {
      requirement = await getRequirementById(companyId, parsed.requirementId);
      if (!requirement) {
        res
          .status(400)
          .json({ message: "Selected material requirement does not exist." });
        return;
      }

      if (requirement.project_id !== parsed.projectId) {
        res.status(400).json({
          message:
            "Selected requirement belongs to another project. Please pick a matching project/requirement.",
        });
        return;
      }

      if (
        normalizeText(requirement.material_name) !==
        normalizeText(parsed.materialName)
      ) {
        res.status(400).json({
          message:
            "Material name must match the selected requirement to keep project records consistent.",
        });
        return;
      }
    }

    const isClientSupplied = parsed.supplySource === "Client Supplied";
    const totalCost = isClientSupplied ? 0 : parsed.quantityPurchased * parsed.unitCost;
    const needsApproval = !isClientSupplied && requiresApproval("material_purchases", totalCost);
    const approvalStatus = getApprovalStatusForAmount("material_purchases", totalCost);
    const requestedBy = req.body.requestedBy || req.authUser?.fullName || "Store Keeper";
    const client = await db.connect();
    let insertedRow:
      | {
          id: string;
          project_id: string;
          requirement_id: string | null;
          material_name: string;
          quantity_purchased: string;
          supplier_name: string;
          unit_cost: string;
          total_cost: string;
          supply_source: string;
          purchase_date: string;
          delivery_note_number: string | null;
          delivery_status: string;
          receipt_ref: string | null;
          notes: string | null;
          approval_status: string;
        }
      | undefined;

    try {
      await client.query("BEGIN");

      const inserted = await client.query<{
        id: string;
        project_id: string;
        requirement_id: string | null;
        material_name: string;
        quantity_purchased: string;
        supplier_name: string;
        unit_cost: string;
        total_cost: string;
        supply_source: string;
        purchase_date: string;
        delivery_note_number: string | null;
        delivery_status: string;
        receipt_ref: string | null;
        notes: string | null;
        approval_status: string;
      }>(
        `
        INSERT INTO engicost.material_purchases (
          id, company_id, project_id, requirement_id, material_name, quantity_purchased,
          supplier_name, unit_cost, total_cost, supply_source, purchase_date, delivery_note_number,
          delivery_status, receipt_ref, notes,
          approval_status, approval_requested_by, approval_requested_at
        ) VALUES (
          $1, $2, $3, NULLIF($4, ''), $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, NOW()
        )
        RETURNING
          id,
          project_id,
          requirement_id,
          material_name,
          quantity_purchased::text,
          supplier_name,
          unit_cost::text,
          total_cost::text,
          supply_source,
          purchase_date::text,
          delivery_note_number,
          delivery_status,
          receipt_ref,
          notes,
          approval_status
        `,
        [
          makeId("PUR"),
          companyId,
          parsed.projectId,
          parsed.requirementId,
          parsed.materialName,
          parsed.quantityPurchased,
          parsed.supplierName,
          isClientSupplied ? 0 : parsed.unitCost,
          totalCost,
          parsed.supplySource,
          parsed.purchaseDate,
          parsed.deliveryNoteNumber,
          parsed.deliveryStatus,
          parsed.receiptRef,
          parsed.notes,
          approvalStatus,
          requestedBy,
        ],
      );
      insertedRow = inserted.rows[0];

      if (!needsApproval) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, parsed.projectId, totalCost],
        );
      }

      await refreshRequirementSupplyStatus(client, companyId, parsed.requirementId);

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Added Material Purchase', 'Materials', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          requestedBy,
          parsed.projectId,
          needsApproval
            ? `Material purchase pending approval: ${parsed.materialName} for TZS ${totalCost.toLocaleString("en-TZ")}.`
            : isClientSupplied
              ? `Received client-supplied ${parsed.materialName}: ${parsed.quantityPurchased.toLocaleString("en-TZ")}.`
              : `Purchased ${parsed.materialName} from ${parsed.supplierName} for TZS ${totalCost.toLocaleString("en-TZ")}.`,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (!insertedRow) {
      res.status(500).json({ message: "Failed to save material purchase." });
      return;
    }

    const row = insertedRow;
    res.status(201).json({
      id: row.id,
      projectId: row.project_id,
      projectName: project.name,
      requirementId: row.requirement_id,
      materialName: row.material_name,
      quantityPurchased: Number(row.quantity_purchased),
      supplierName: row.supplier_name,
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.total_cost),
      supplySource: row.supply_source,
      purchaseDate: row.purchase_date,
      deliveryNoteNumber: row.delivery_note_number ?? "",
      deliveryStatus: row.delivery_status,
      receiptRef: row.receipt_ref ?? "",
      notes: row.notes ?? "",
      requirementMaterialName: requirement?.material_name ?? "",
      approvalStatus: row.approval_status,
      requiresApproval: needsApproval,
      threshold: APPROVAL_THRESHOLDS.material_purchases,
    });
  }),
);

router.patch(
  "/purchases/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const purchaseId = String(req.params.id);

    const updateSchema = purchaseSchema.partial();
    const parsed = updateSchema.parse({
      ...req.body,
      quantityPurchased: req.body.quantityPurchased !== undefined ? Number(req.body.quantityPurchased) : undefined,
      unitCost: req.body.unitCost !== undefined ? toMoney(req.body.unitCost) : undefined,
    });

    const result = await db.query<{
      project_id: string;
      requirement_id: string | null;
      material_name: string;
      quantity_purchased: string;
      unit_cost: string;
      total_cost: string;
      supply_source: string;
      approval_status: string | null;
    }>(
      `
      SELECT
        project_id,
        requirement_id,
        material_name,
        quantity_purchased::text,
        unit_cost::text,
        total_cost::text,
        supply_source,
        approval_status
      FROM engicost.material_purchases
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, purchaseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Material purchase not found." });
      return;
    }

    const oldPurchase = result.rows[0];
    const oldTotalCost = Number(oldPurchase.total_cost);
    const oldRequirementId = oldPurchase.requirement_id ?? "";

    const newProjectId = parsed.projectId ?? oldPurchase.project_id;
    const newRequirementId =
      parsed.requirementId !== undefined ? parsed.requirementId.trim() : oldRequirementId;
    const newMaterialName = parsed.materialName ?? oldPurchase.material_name;
    const newQuantity = parsed.quantityPurchased ?? Number(oldPurchase.quantity_purchased);
    const newSupplySource = parsed.supplySource ?? oldPurchase.supply_source;
    const newUnitCost =
      newSupplySource === "Client Supplied"
        ? 0
        : parsed.unitCost ?? Number(oldPurchase.unit_cost);
    const newTotalCost = newSupplySource === "Client Supplied" ? 0 : newQuantity * newUnitCost;
    const costDifference = newTotalCost - oldTotalCost;

    if (parsed.projectId) {
      const project = await getProjectById(companyId, parsed.projectId);
      if (!project) {
        res.status(400).json({ message: "Selected project/site does not exist." });
        return;
      }
    }

    if (newRequirementId.length > 0) {
      const requirement = await getRequirementById(companyId, newRequirementId);
      if (!requirement) {
        res.status(400).json({ message: "Selected material requirement does not exist." });
        return;
      }

      if (requirement.project_id !== newProjectId) {
        res.status(400).json({
          message:
            "Selected requirement belongs to another project. Please pick a matching project/requirement.",
        });
        return;
      }

      if (normalizeText(requirement.material_name) !== normalizeText(newMaterialName)) {
        res.status(400).json({
          message:
            "Material name must match the selected requirement to keep project records consistent.",
        });
        return;
      }
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const setClauses: string[] = [];
      const params: unknown[] = [companyId, purchaseId];
      let paramIndex = 3;

      if (parsed.projectId) {
        setClauses.push(`project_id = $${paramIndex++}`);
        params.push(parsed.projectId);
      }
      if (parsed.requirementId !== undefined) {
        setClauses.push(`requirement_id = NULLIF($${paramIndex++}, '')`);
        params.push(parsed.requirementId.trim());
      }
      if (parsed.materialName) {
        setClauses.push(`material_name = $${paramIndex++}`);
        params.push(parsed.materialName);
      }
      if (parsed.quantityPurchased !== undefined) {
        setClauses.push(`quantity_purchased = $${paramIndex++}`);
        params.push(parsed.quantityPurchased);
      }
      if (parsed.unitCost !== undefined) {
        setClauses.push(`unit_cost = $${paramIndex++}`);
        params.push(newUnitCost);
      }
      if (parsed.supplySource !== undefined) {
        setClauses.push(`supply_source = $${paramIndex++}`);
        params.push(parsed.supplySource);
        if (parsed.supplySource === "Client Supplied" && parsed.unitCost === undefined) {
          setClauses.push(`unit_cost = $${paramIndex++}`);
          params.push(0);
        }
      }
      if (parsed.supplierName) {
        setClauses.push(`supplier_name = $${paramIndex++}`);
        params.push(parsed.supplierName);
      }
      if (parsed.purchaseDate) {
        setClauses.push(`purchase_date = $${paramIndex++}`);
        params.push(parsed.purchaseDate);
      }
      if (parsed.deliveryNoteNumber !== undefined) {
        setClauses.push(`delivery_note_number = $${paramIndex++}`);
        params.push(parsed.deliveryNoteNumber);
      }
      if (parsed.deliveryStatus) {
        setClauses.push(`delivery_status = $${paramIndex++}`);
        params.push(parsed.deliveryStatus);
      }
      if (parsed.receiptRef !== undefined) {
        setClauses.push(`receipt_ref = $${paramIndex++}`);
        params.push(parsed.receiptRef);
      }
      if (parsed.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex++}`);
        params.push(parsed.notes);
      }

      setClauses.push(`total_cost = $${paramIndex++}`);
      params.push(newTotalCost);

      if (setClauses.length > 0) {
        await client.query(
          `UPDATE engicost.material_purchases SET ${setClauses.join(", ")}, updated_at = NOW() WHERE company_id = $1 AND id = $2`,
          params,
        );
      }

      if (isAppliedApprovalStatus(oldPurchase.approval_status)) {
        if (newProjectId !== oldPurchase.project_id) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldPurchase.project_id, oldTotalCost],
          );
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = total_spent + $3, updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, newProjectId, newTotalCost],
          );
        } else if (costDifference !== 0) {
          await client.query(
            `
            UPDATE engicost.projects
            SET total_spent = GREATEST(total_spent + $3, 0), updated_at = NOW()
            WHERE company_id = $1 AND id = $2
            `,
            [companyId, oldPurchase.project_id, costDifference],
          );
        }
      }

      await refreshRequirementSupplyStatus(client, companyId, oldRequirementId);
      if (newRequirementId !== oldRequirementId) {
        await refreshRequirementSupplyStatus(client, companyId, newRequirementId);
      }

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Updated Material Purchase', 'Materials', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          req.authUser?.fullName || "Store Keeper",
          newProjectId,
          `Updated purchase - Cost change: ${costDifference > 0 ? "+" : ""}TZS ${costDifference.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Material purchase updated successfully.",
        totalCostDifference: costDifference,
        newTotalCost,
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
  "/purchases/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const purchaseId = String(req.params.id);
    const deletedBy = req.body?.deletedBy || "Store Keeper";

    const result = await db.query<{
      project_id: string;
      requirement_id: string | null;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, requirement_id, total_cost::text, approval_status
      FROM engicost.material_purchases
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, purchaseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Material purchase not found." });
      return;
    }

    const purchase = result.rows[0];
    const totalCost = Number(purchase.total_cost);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Soft delete: mark as deleted instead of hard delete
      await client.query(
        `
        UPDATE engicost.material_purchases
        SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, purchaseId, deletedBy],
      );

      if (isAppliedApprovalStatus(purchase.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = GREATEST(total_spent - $3, 0), updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, purchase.project_id, totalCost],
        );
      }

      await refreshRequirementSupplyStatus(client, companyId, purchase.requirement_id);

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Deleted Material Purchase', 'Materials', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          deletedBy,
          purchase.project_id,
          `Soft deleted material purchase - Reversed amount: TZS ${totalCost.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Material purchase deleted (soft delete) and total_spent reversed.",
        reversedAmount: totalCost,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

// Restore a soft-deleted material purchase
router.patch(
  "/purchases/:id/restore",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const purchaseId = String(req.params.id);
    const restoredBy = req.body?.restoredBy || "Store Keeper";

    const result = await db.query<{
      project_id: string;
      requirement_id: string | null;
      total_cost: string;
      approval_status: string | null;
    }>(
      `
      SELECT project_id, requirement_id, total_cost::text, approval_status
      FROM engicost.material_purchases
      WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE
      LIMIT 1
      `,
      [companyId, purchaseId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Deleted material purchase not found." });
      return;
    }

    const purchase = result.rows[0];
    const totalCost = Number(purchase.total_cost);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Restore: mark as not deleted
      await client.query(
        `
        UPDATE engicost.material_purchases
        SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, purchaseId],
      );

      if (isAppliedApprovalStatus(purchase.approval_status)) {
        await client.query(
          `
          UPDATE engicost.projects
          SET total_spent = total_spent + $3, updated_at = NOW()
          WHERE company_id = $1 AND id = $2
          `,
          [companyId, purchase.project_id, totalCost],
        );
      }

      await refreshRequirementSupplyStatus(client, companyId, purchase.requirement_id);

      // Log the action
      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, $3, 'Restored Material Purchase', 'Materials', $4, $5, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          restoredBy,
          purchase.project_id,
          `Restored soft-deleted material purchase - Amount re-added: TZS ${totalCost.toLocaleString("en-TZ")}`,
        ],
      );

      await client.query("COMMIT");

      res.json({
        message: "Material purchase restored successfully.",
        restoredAmount: totalCost,
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
