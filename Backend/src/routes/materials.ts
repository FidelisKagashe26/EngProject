import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync, toMoney } from "./utils";

const router = Router();

const requirementSchema = z.object({
  projectId: z.string().min(3),
  materialName: z.string().min(2),
  requiredQuantity: z.number().nonnegative(),
  unit: z.string().min(1),
  estimatedUnitCost: z.number().nonnegative(),
  priority: z.string().optional().default("Medium"),
  neededByDate: z.string().date().optional(),
  notes: z.string().optional().default(""),
});

const purchaseSchema = z.object({
  projectId: z.string().min(3),
  requirementId: z.string().optional().default(""),
  materialName: z.string().min(2),
  quantityPurchased: z.number().nonnegative(),
  supplierName: z.string().min(2),
  unitCost: z.number().nonnegative(),
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
};

const normalizeText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

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
    SELECT id, project_id, material_name
    FROM engicost.material_requirements
    WHERE company_id = $1 AND id = $2
    LIMIT 1
    `,
    [companyId, requirementId],
  );
  return result.rows[0] ?? null;
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
        purchase_date: string;
        delivery_note_number: string | null;
        delivery_status: string;
        receipt_ref: string | null;
        notes: string | null;
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
          mp.purchase_date::text,
          mp.delivery_note_number,
          mp.delivery_status,
          mp.receipt_ref,
          mp.notes
        FROM engicost.material_purchases mp
        JOIN engicost.projects p ON p.id = mp.project_id
        WHERE mp.company_id = $1
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
          remainingQuantity: Math.max(required - purchased, 0),
          unit: row.unit,
          estimatedUnitCost: Number(row.estimated_unit_cost),
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
        estimated_unit_cost, priority, needed_by_date, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10
      )
      RETURNING
        id,
        project_id,
        material_name,
        required_quantity::text,
        unit,
        estimated_unit_cost::text,
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
        `Added requirement ${parsed.materialName} for ${project.name}.`,
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
      priority: row.priority,
      neededByDate: row.needed_by_date,
      notes: row.notes ?? "",
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

    const totalCost = parsed.quantityPurchased * parsed.unitCost;
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
          purchase_date: string;
          delivery_note_number: string | null;
          delivery_status: string;
          receipt_ref: string | null;
          notes: string | null;
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
        purchase_date: string;
        delivery_note_number: string | null;
        delivery_status: string;
        receipt_ref: string | null;
        notes: string | null;
      }>(
        `
        INSERT INTO engicost.material_purchases (
          id, company_id, project_id, requirement_id, material_name, quantity_purchased,
          supplier_name, unit_cost, total_cost, purchase_date, delivery_note_number,
          delivery_status, receipt_ref, notes
        ) VALUES (
          $1, $2, $3, NULLIF($4, ''), $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14
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
          purchase_date::text,
          delivery_note_number,
          delivery_status,
          receipt_ref,
          notes
        `,
        [
          makeId("PUR"),
          companyId,
          parsed.projectId,
          parsed.requirementId,
          parsed.materialName,
          parsed.quantityPurchased,
          parsed.supplierName,
          parsed.unitCost,
          totalCost,
          parsed.purchaseDate,
          parsed.deliveryNoteNumber,
          parsed.deliveryStatus,
          parsed.receiptRef,
          parsed.notes,
        ],
      );
      insertedRow = inserted.rows[0];

      await client.query(
        `
        UPDATE engicost.projects
        SET total_spent = total_spent + $3, updated_at = NOW()
        WHERE company_id = $1 AND id = $2
        `,
        [companyId, parsed.projectId, totalCost],
      );

      await client.query(
        `
        INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
        VALUES ($1, $2, 'Store Keeper', 'Added Material Purchase', 'Materials', $3, $4, '127.0.0.1 / Local Dev')
        `,
        [
          makeId("ACT"),
          companyId,
          parsed.projectId,
          `Purchased ${parsed.materialName} from ${parsed.supplierName} for TZS ${totalCost.toLocaleString("en-TZ")}.`,
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
      purchaseDate: row.purchase_date,
      deliveryNoteNumber: row.delivery_note_number ?? "",
      deliveryStatus: row.delivery_status,
      receiptRef: row.receipt_ref ?? "",
      notes: row.notes ?? "",
      requirementMaterialName: requirement?.material_name ?? "",
    });
  }),
);

export default router;

