import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { requireSuperAdmin } from "../middleware/auth";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();
router.use(requireSuperAdmin);

type DeletedItemRow = { entity: string; id: string; module: string; title: string; subtitle: string | null; deleted_at: string | null; deleted_by: string | null };

const mapDeletedItem = (row: DeletedItemRow) => ({ entity: row.entity, id: row.id, module: row.module, title: row.title, subtitle: row.subtitle ?? "", deletedAt: row.deleted_at, deletedBy: row.deleted_by ?? "" });

router.get("/", handleAsync(async (_req, res) => {
  const companyId = await getSingleTenantCompanyId();
  const queries = [
    "SELECT 'projects' AS entity, id::text, 'Projects' AS module, name AS title, site_location AS subtitle, deleted_at::text, deleted_by FROM engicost.projects WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'workers', id::text, 'Labor', full_name, skill_role, deleted_at::text, deleted_by FROM engicost.workers WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'users', id::text, 'Users', full_name, email, deleted_at::text, deleted_by FROM engicost.users WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'documents', id::text, 'Documents', document_name, category, deleted_at::text, deleted_by FROM engicost.documents WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'suppliers', id::text, 'Suppliers', name, contact_person, deleted_at::text, deleted_by FROM engicost.suppliers WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'quote-requests', id::text, 'Website', full_name, service, deleted_at::text, deleted_by FROM engicost.quote_requests WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'gallery', id::text, 'Website', title, category, deleted_at::text, deleted_by FROM engicost.gallery_items WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'expenses', id::text, 'Expenses', description, category, deleted_at::text, deleted_by FROM engicost.expenses WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'payments', id::text, 'Payments', client_name, payment_type, deleted_at::text, deleted_by FROM engicost.client_payments WHERE company_id = $1 AND is_deleted = TRUE",

    "SELECT 'labor-payments' AS entity, lp.id::text, 'Labor' AS module, COALESCE(w.full_name, lp.worker_id) AS title, COALESCE(p.name, lp.project_id) AS subtitle, lp.deleted_at::text, lp.deleted_by FROM engicost.labor_payments lp LEFT JOIN engicost.workers w ON w.id = lp.worker_id LEFT JOIN engicost.projects p ON p.id = lp.project_id WHERE lp.company_id = $1 AND lp.is_deleted = TRUE",
    "SELECT 'material-purchases' AS entity, id::text, 'Materials' AS module, material_name AS title, supplier_name AS subtitle, deleted_at::text, deleted_by FROM engicost.material_purchases WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'equipment' AS entity, id::text, 'Equipment' AS module, equipment_name AS title, assigned_to AS subtitle, deleted_at::text, deleted_by FROM engicost.equipment WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'petty-cash' AS entity, id::text, 'Petty Cash' AS module, description AS title, transaction_type AS subtitle, deleted_at::text, deleted_by FROM engicost.petty_cash_transactions WHERE company_id = $1 AND is_deleted = TRUE"
  ];
  const sql = queries.join(" UNION ALL ") + " ORDER BY deleted_at DESC NULLS LAST";
  const result = await db.query<DeletedItemRow>(sql, [companyId]);
  res.json({ rows: result.rows.map(mapDeletedItem) });
}));

export default router;
