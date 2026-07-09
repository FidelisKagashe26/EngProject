import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireRoles, requireSuperAdmin } from "../middleware/auth";
import { handleAsync, toMoney } from "./utils";

const router = Router();
const supplierManagerRoles = ["Admin", "Engineer / Project Manager", "Store Keeper"] as const;

const supplierSchema = z.object({
  name: z.string().min(2),
  contactPerson: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")).default(""),
  location: z.string().optional().default(""),
  materialCategories: z.string().optional().default(""),
  totalPurchases: z.number().nonnegative().optional().default(0),
  outstandingBalance: z.number().nonnegative().optional().default(0),
  status: z.string().optional().default("Active"),
  notes: z.string().optional().default(""),
});

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{
      id: string;
      name: string;
      contact_person: string;
      phone: string;
      email: string | null;
      location: string | null;
      material_categories: string | null;
      total_purchases: string;
      outstanding_balance: string;
      status: string;
      notes: string | null;
      calculated_purchases: string;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        s.id,
        s.name,
        s.contact_person,
        s.phone,
        s.email,
        s.location,
        s.material_categories,
        s.total_purchases::text,
        s.outstanding_balance::text,
        s.status,
        s.notes,
        COALESCE(p.calculated_purchases, 0)::text AS calculated_purchases,
        s.created_at::text,
        s.updated_at::text
      FROM engicost.suppliers s
      LEFT JOIN (
        SELECT
          lower(trim(supplier_name)) AS supplier_key,
          COALESCE(SUM(total_cost), 0)::numeric AS calculated_purchases
        FROM engicost.material_purchases
        WHERE company_id = $1
        GROUP BY lower(trim(supplier_name))
      ) AS p ON p.supplier_key = lower(trim(s.name))
      WHERE s.company_id = $1 AND s.is_deleted = FALSE
      ORDER BY s.updated_at DESC, s.created_at DESC
      `,
      [companyId],
    );

    const rows = result.rows.map((row) => {
      const recordedTotal = Number(row.total_purchases);
      const calculatedTotal = Number(row.calculated_purchases);
      return {
        id: row.id,
        name: row.name,
        contactPerson: row.contact_person,
        phone: row.phone,
        email: row.email ?? "",
        location: row.location ?? "",
        materialCategories: row.material_categories ?? "",
        totalPurchases: Math.max(recordedTotal, calculatedTotal),
        outstandingBalance: Number(row.outstanding_balance),
        status: row.status,
        notes: row.notes ?? "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const summary = rows.reduce(
      (acc, row) => ({
        totalSuppliers: acc.totalSuppliers + 1,
        totalPurchases: acc.totalPurchases + row.totalPurchases,
        totalOutstandingBalance:
          acc.totalOutstandingBalance + row.outstandingBalance,
        activeSuppliers: acc.activeSuppliers + (row.status === "Active" ? 1 : 0),
      }),
      {
        totalSuppliers: 0,
        totalPurchases: 0,
        totalOutstandingBalance: 0,
        activeSuppliers: 0,
      },
    );

    res.json({ summary, rows });
  }),
);

router.post(
  "/",
  requireRoles(...supplierManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = supplierSchema.parse({
      ...req.body,
      totalPurchases: toMoney(req.body.totalPurchases),
      outstandingBalance: toMoney(req.body.outstandingBalance),
    });

    const inserted = await db.query<{
      id: string;
      name: string;
      contact_person: string;
      phone: string;
      email: string | null;
      location: string | null;
      material_categories: string | null;
      total_purchases: string;
      outstanding_balance: string;
      status: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO engicost.suppliers (
        id, company_id, name, contact_person, phone, email, location,
        material_categories, total_purchases, outstanding_balance, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''),
        NULLIF($8, ''), $9, $10, $11, $12
      )
      RETURNING
        id,
        name,
        contact_person,
        phone,
        email,
        location,
        material_categories,
        total_purchases::text,
        outstanding_balance::text,
        status,
        notes,
        created_at::text,
        updated_at::text
      `,
      [
        makeId("SUP"),
        companyId,
        parsed.name,
        parsed.contactPerson,
        parsed.phone,
        parsed.email,
        parsed.location,
        parsed.materialCategories,
        parsed.totalPurchases,
        parsed.outstandingBalance,
        parsed.status,
        parsed.notes,
      ],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Store Keeper', 'Added Supplier', 'Suppliers', NULL, $3, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        `Added supplier ${parsed.name} (${parsed.contactPerson}).`,
      ],
    );

    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person,
      phone: row.phone,
      email: row.email ?? "",
      location: row.location ?? "",
      materialCategories: row.material_categories ?? "",
      totalPurchases: Number(row.total_purchases),
      outstandingBalance: Number(row.outstanding_balance),
      status: row.status,
      notes: row.notes ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }),
);


router.delete(
  '/:id',
  requireRoles(...supplierManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);
    const deleted = await db.query<{ id: string; name: string }>(
      'UPDATE engicost.suppliers SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE RETURNING id, name',
      [companyId, id, req.authUser?.fullName ?? 'System Admin'],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ message: 'Supplier not found.' });
      return;
    }

    res.json({ message: 'Supplier deleted successfully.' });
  }),
);

router.patch(
  '/:id/restore',
  requireSuperAdmin,
  requireRoles(...supplierManagerRoles),
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const id = String(req.params.id);
    const restored = await db.query<{ id: string; name: string }>(
      'UPDATE engicost.suppliers SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id, name',
      [companyId, id],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted supplier not found.' });
      return;
    }

    res.json({ message: 'Supplier restored successfully.' });
  }),
);
export default router;
