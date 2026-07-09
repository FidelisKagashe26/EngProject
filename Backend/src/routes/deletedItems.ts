import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { requireSuperAdmin } from "../middleware/auth";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();
router.use(requireSuperAdmin);

type DeletedItemRow = {
  entity: string;
  id: string;
  module: string;
  title: string;
  subtitle: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
  restore_preview: string | null;
};

type PurgeTarget = {
  table: string;
  module: string;
};

const mapDeletedItem = (row: DeletedItemRow) => ({
  entity: row.entity,
  id: row.id,
  module: row.module,
  title: row.title,
  subtitle: row.subtitle ?? "",
  deletedAt: row.deleted_at,
  deletedBy: row.deleted_by ?? "",
  deleteReason: row.delete_reason ?? "",
  restorePreview: row.restore_preview ?? "",
});

const purgeTargets: Record<string, PurgeTarget> = {
  projects: { table: "engicost.projects", module: "Projects" },
  workers: { table: "engicost.workers", module: "Labor" },
  users: { table: "engicost.users", module: "Users" },
  documents: { table: "engicost.documents", module: "Documents" },
  suppliers: { table: "engicost.suppliers", module: "Suppliers" },
  "quote-requests": { table: "engicost.quote_requests", module: "Website" },
  gallery: { table: "engicost.gallery_items", module: "Website" },
  expenses: { table: "engicost.expenses", module: "Expenses" },
  payments: { table: "engicost.client_payments", module: "Payments" },
  "labor-payments": { table: "engicost.labor_payments", module: "Labor" },
  "material-purchases": { table: "engicost.material_purchases", module: "Materials" },
  equipment: { table: "engicost.equipment_usage", module: "Equipment" },
  "petty-cash": { table: "engicost.petty_cash_transactions", module: "Petty Cash" },
};

const buildDeletedItemsSql = () => {
  const queries = [
    "SELECT 'projects' AS entity, id::text, 'Projects' AS module, name AS title, site_location AS subtitle, deleted_at::text, deleted_by, delete_reason, 'Restores the project/site to active project lists.' AS restore_preview FROM engicost.projects WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'workers', id::text, 'Labor', full_name, skill_role, deleted_at::text, deleted_by, delete_reason, 'Restores the worker to the labor list as Active.' FROM engicost.workers WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'users', id::text, 'Users', full_name, email, deleted_at::text, deleted_by, delete_reason, 'Restores the user account as Active.' FROM engicost.users WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'documents', id::text, 'Documents', document_name, category, deleted_at::text, deleted_by, delete_reason, 'Restores the document record. The file link remains available if the file still exists.' FROM engicost.documents WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'suppliers', id::text, 'Suppliers', name, contact_person, deleted_at::text, deleted_by, delete_reason, 'Restores the supplier to procurement lists.' FROM engicost.suppliers WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'quote-requests', id::text, 'Website', full_name, service, deleted_at::text, deleted_by, delete_reason, 'Restores the website quote request to follow-up lists.' FROM engicost.quote_requests WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'gallery', id::text, 'Website', title, category, deleted_at::text, deleted_by, delete_reason, 'Restores the gallery item. Visibility still follows its visible setting.' FROM engicost.gallery_items WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'expenses', id::text, 'Expenses', description, category, deleted_at::text, deleted_by, delete_reason, CASE WHEN approval_status IN ('APPROVED', 'AUTO_APPROVED') THEN 'Restoring this expense adds the amount back to project total spent.' ELSE 'Restoring this expense does not affect applied totals until approved.' END FROM engicost.expenses WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'payments', id::text, 'Payments', client_name, payment_type, deleted_at::text, deleted_by, delete_reason, CASE WHEN approval_status IN ('APPROVED', 'AUTO_APPROVED') THEN 'Restoring this payment adds the amount back to project receipts.' ELSE 'Restoring this payment does not affect applied totals until approved.' END FROM engicost.client_payments WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'labor-payments', lp.id::text, 'Labor', COALESCE(w.full_name, lp.worker_id), COALESCE(p.name, lp.project_id), lp.deleted_at::text, lp.deleted_by, lp.delete_reason, CASE WHEN lp.approval_status IN ('APPROVED', 'AUTO_APPROVED') THEN 'Restoring this labor payment re-applies its amount to labor and project totals.' ELSE 'Restoring this labor payment does not affect applied totals until approved.' END FROM engicost.labor_payments lp LEFT JOIN engicost.workers w ON w.id = lp.worker_id LEFT JOIN engicost.projects p ON p.id = lp.project_id WHERE lp.company_id = $1 AND lp.is_deleted = TRUE",
    "SELECT 'material-purchases', id::text, 'Materials', material_name, supplier_name, deleted_at::text, deleted_by, delete_reason, CASE WHEN approval_status IN ('APPROVED', 'AUTO_APPROVED') THEN 'Restoring this purchase adds the cost back to project total spent.' ELSE 'Restoring this purchase does not affect applied totals until approved.' END FROM engicost.material_purchases WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'equipment', id::text, 'Equipment', equipment_name, assigned_to, deleted_at::text, deleted_by, delete_reason, CASE WHEN approval_status IN ('APPROVED', 'AUTO_APPROVED') THEN 'Restoring this equipment usage adds the cost back to project total spent.' ELSE 'Restoring this equipment usage does not affect applied totals until approved.' END FROM engicost.equipment_usage WHERE company_id = $1 AND is_deleted = TRUE",
    "SELECT 'petty-cash', id::text, 'Petty Cash', description, transaction_type, deleted_at::text, deleted_by, delete_reason, 'Restores the petty cash transaction to cash flow records.' FROM engicost.petty_cash_transactions WHERE company_id = $1 AND is_deleted = TRUE",
  ];

  return queries.join(" UNION ALL ") + " ORDER BY deleted_at DESC NULLS LAST";
};

router.get("/", handleAsync(async (_req, res) => {
  const companyId = await getSingleTenantCompanyId();
  const result = await db.query<DeletedItemRow>(buildDeletedItemsSql(), [companyId]);
  res.json({ rows: result.rows.map(mapDeletedItem) });
}));

router.delete("/:entity/:id/purge", handleAsync(async (req, res) => {
  const companyId = await getSingleTenantCompanyId();
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  const target = purgeTargets[entity];

  if (target === undefined) {
    res.status(400).json({ message: "Unsupported deleted record type." });
    return;
  }

  if ((req.body?.confirm === "PURGE") === false) {
    res.status(400).json({ message: "Type PURGE to permanently delete this record." });
    return;
  }

  const result = await db.query<{ id: string }>(
    "DELETE FROM " + target.table + " WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING id",
    [companyId, id],
  );

  if (result.rowCount === 0) {
    res.status(404).json({ message: "Deleted record not found." });
    return;
  }

  await db.query(
    "INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device) VALUES ($1, $2, $3, 'Purged Deleted Record', $4, NULL, $5, '127.0.0.1 / Local Dev')",
    [makeId("ACT"), companyId, req.authUser?.fullName ?? "Super Admin", target.module, "Permanently purged " + entity + " record " + id + "."],
  );

  res.json({ message: "Deleted record permanently purged." });
}));

export default router;
