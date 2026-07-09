import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireAdmin, requireSuperAdmin } from "../middleware/auth";
import { handleAsync } from "./utils";

const router = Router();
router.use(requireAdmin);

const createUserSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email(),
  phone: z.string().min(7).max(60),
  role: z.enum([
    "Super Admin",
    "Admin",
    "Engineer / Project Manager",
    "Accountant",
    "Store Keeper",
    "Site Supervisor",
  ]),
  assignedProjects: z.string().optional().default(""),
  status: z.enum(["Active", "Invited", "Suspended"]).optional().default("Active"),
  password: z.string().min(8).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(160).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(60).optional(),
  role: z
    .enum([
      "Super Admin",
      "Admin",
      "Engineer / Project Manager",
      "Accountant",
      "Store Keeper",
      "Site Supervisor",
    ])
    .optional(),
  assignedProjects: z.string().optional(),
  status: z.enum(["Active", "Invited", "Suspended"]).optional(),
  password: z.string().min(8).optional(),
});

type UserRow = {
  id: number;
  company_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  assigned_projects: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
};

const mapUser = (row: UserRow) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone ?? "",
  role: row.role,
  status: row.status,
  assignedProjects: row.assigned_projects ?? "",
  lastLogin: row.last_login ?? "Never",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const countOtherActiveAdmins = async (
  companyId: number,
  userId: number,
): Promise<number> => {
  const result = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM engicost.users
      WHERE company_id = $1
      AND id <> $2
      AND role IN ('Super Admin', 'Admin')
      AND status = 'Active'
      AND is_deleted = FALSE
    `,
    [companyId, userId],
  );
  return Number(result.rows[0]?.count ?? 0);
};

// GET /users — list all users in company
router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const result = await db.query<UserRow>(
      `
      SELECT
        id, company_id, full_name, email, phone, role, status,
        assigned_projects,
        CASE WHEN last_login IS NULL THEN NULL ELSE last_login::text END AS last_login,
        created_at::text,
        updated_at::text
      FROM engicost.users
      WHERE company_id = $1 AND is_deleted = FALSE
      ORDER BY created_at ASC
      `,
      [companyId],
    );

    res.json({ rows: result.rows.map(mapUser) });
  }),
);

// POST /users — create new user
router.post(
  "/",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = createUserSchema.parse(req.body);
    const normalizedEmail = parsed.email.trim().toLowerCase();

    if (parsed.role === "Super Admin" && req.authUser?.role !== "Super Admin") {
      res.status(403).json({ message: "Only a Super Admin can create another Super Admin." });
      return;
    }

    // Check duplicate email
    const existing = await db.query<{ id: number }>(
      "SELECT id FROM engicost.users WHERE lower(email) = $1 LIMIT 1",
      [normalizedEmail],
    );
    if (existing.rowCount !== 0) {
      res.status(409).json({ message: "A user with this email already exists." });
      return;
    }

    let passwordHash: string | null = null;
    if (parsed.password && parsed.password.length >= 8) {
      passwordHash = await bcrypt.hash(parsed.password, 12);
    }

    const inserted = await db.query<UserRow>(
      `
      INSERT INTO engicost.users (
        company_id, full_name, email, phone, role, status,
        assigned_projects, password_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING
        id, company_id, full_name, email, phone, role, status,
        assigned_projects,
        NULL::text AS last_login,
        created_at::text,
        updated_at::text
      `,
      [
        companyId,
        parsed.fullName.trim(),
        normalizedEmail,
        parsed.phone.trim(),
        parsed.role,
        parsed.status,
        parsed.assignedProjects,
        passwordHash,
      ],
    );

    const row = inserted.rows[0];

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Created User', 'Users', NULL, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        req.authUser?.fullName ?? "Admin",
        `Created user account for ${row.full_name} (${row.role})`,
      ],
    );

    res.status(201).json(mapUser(row));
  }),
);

// PUT /users/:id — update user
router.put(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId)) {
      res.status(400).json({ message: "Invalid user ID." });
      return;
    }

    const existing = await db.query<UserRow>(
      `
      SELECT id, company_id, full_name, email, phone, role, status,
             assigned_projects,
             NULL::text AS last_login,
             created_at::text, updated_at::text
      FROM engicost.users
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      LIMIT 1
      `,
      [companyId, userId],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const parsed = updateUserSchema.parse(req.body);
    const existingUser = existing.rows[0];
    const nextRole = parsed.role ?? existingUser.role;
    const nextStatus = parsed.status ?? existingUser.status;

    if (req.authUser?.role !== "Super Admin" && (existingUser.role === "Super Admin" || nextRole === "Super Admin")) {
      res.status(403).json({ message: "Only a Super Admin can manage Super Admin accounts." });
      return;
    }

    if (
      req.authUser?.userId === userId &&
      (['Super Admin', 'Admin'].includes(nextRole) === false || nextStatus === 'Active' === false)
    ) {
      res.status(400).json({ message: "You cannot remove your own active admin access." });
      return;
    }

    if (
      ['Super Admin', 'Admin'].includes(existingUser.role) &&
      existingUser.status === "Active" &&
      (['Super Admin', 'Admin'].includes(nextRole) === false || nextStatus === 'Active' === false)
    ) {
      const otherAdmins = await countOtherActiveAdmins(companyId, userId);
      if (otherAdmins === 0) {
        res.status(400).json({ message: "At least one active admin account is required." });
        return;
      }
    }

    // Check email uniqueness if changing
    if (parsed.email) {
      const normalizedEmail = parsed.email.trim().toLowerCase();
      const duplicate = await db.query<{ id: number }>(
        'SELECT id FROM engicost.users WHERE lower(email) = $1 AND id <> $2 LIMIT 1',
        [normalizedEmail, userId],
      );
      if (duplicate.rows.length > 0) {
        res.status(409).json({ message: "Email is already in use by another account." });
        return;
      }
    }

    // Build dynamic update
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [companyId, userId];
    let paramIndex = 3;

    if (parsed.fullName !== undefined) {
      setClauses.push(`full_name = $${paramIndex++}`);
      values.push(parsed.fullName.trim());
    }
    if (parsed.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(parsed.email.trim().toLowerCase());
    }
    if (parsed.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(parsed.phone.trim());
    }
    if (parsed.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      values.push(parsed.role);
    }
    if (parsed.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(parsed.status);
    }
    if (parsed.assignedProjects !== undefined) {
      setClauses.push(`assigned_projects = $${paramIndex++}`);
      values.push(parsed.assignedProjects);
    }
    if (parsed.password && parsed.password.length >= 8) {
      const hash = await bcrypt.hash(parsed.password, 12);
      setClauses.push(`password_hash = $${paramIndex++}`);
      values.push(hash);
    }

    const updated = await db.query<UserRow>(
      `
      UPDATE engicost.users
      SET ${setClauses.join(", ")}
      WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
      RETURNING
        id, company_id, full_name, email, phone, role, status,
        assigned_projects,
        CASE WHEN last_login IS NULL THEN NULL ELSE last_login::text END AS last_login,
        created_at::text,
        updated_at::text
      `,
      values,
    );

    const row = updated.rows[0];

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Updated User', 'Users', NULL, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        req.authUser?.fullName ?? "Admin",
        `Updated user account for ${row.full_name}`,
      ],
    );

    res.json(mapUser(row));
  }),
);

// DELETE /users/:id — suspend (soft delete)
router.delete(
  "/:id",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId)) {
      res.status(400).json({ message: "Invalid user ID." });
      return;
    }

    if (req.authUser?.userId === userId) {
      res.status(400).json({ message: "You cannot suspend your own account." });
      return;
    }

    const existing = await db.query<{ full_name: string; role: string; status: string }>(
      'SELECT full_name, role, status FROM engicost.users WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE LIMIT 1',
      [companyId, userId],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const targetUser = existing.rows[0];
    if (req.authUser?.role !== "Super Admin" && targetUser.role === "Super Admin") {
      res.status(403).json({ message: "Only a Super Admin can delete Super Admin accounts." });
      return;
    }

    if (['Super Admin', 'Admin'].includes(targetUser.role) && targetUser.status === 'Active') {
      const otherAdmins = await countOtherActiveAdmins(companyId, userId);
      if (otherAdmins === 0) {
        res.status(400).json({ message: "At least one active admin account is required." });
        return;
      }
    }

    await db.query(
      'UPDATE engicost.users SET status = ' + String.fromCharCode(39) + 'Suspended' + String.fromCharCode(39) + ', is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3, updated_at = NOW() WHERE company_id = $1 AND id = $2',
      [companyId, userId, req.authUser?.fullName ?? 'Admin'],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, $3, 'Suspended User', 'Users', NULL, $4, '127.0.0.1 / Local Dev')
      `,
      [
        makeId("ACT"),
        companyId,
        req.authUser?.fullName ?? "Admin",
        `Suspended user account: ${targetUser.full_name}`,
      ],
    );

    res.json({ message: 'User deleted successfully.' });
  }),
);


router.patch(
  '/:id/restore',
  requireSuperAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const userId = Number(req.params.id);

    if (Number.isFinite(userId) === false) {
      res.status(400).json({ message: 'Invalid user ID.' });
      return;
    }

    const restored = await db.query<{ full_name: string }>(
      'UPDATE engicost.users SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, status = ' + String.fromCharCode(39) + 'Active' + String.fromCharCode(39) + ', updated_at = NOW() WHERE company_id = $1 AND id = $2 AND is_deleted = TRUE RETURNING full_name',
      [companyId, userId],
    );

    if (restored.rowCount === 0) {
      res.status(404).json({ message: 'Deleted user not found.' });
      return;
    }

    await db.query(
      'INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device) VALUES ($1, $2, $3, ' + String.fromCharCode(39) + 'Restored User' + String.fromCharCode(39) + ', ' + String.fromCharCode(39) + 'Users' + String.fromCharCode(39) + ', NULL, $4, ' + String.fromCharCode(39) + '127.0.0.1 / Local Dev' + String.fromCharCode(39) + ')',
      [makeId('ACT'), companyId, req.authUser?.fullName ?? 'Super Admin', 'Restored user account: ' + restored.rows[0].full_name],
    );

    res.json({ message: 'User restored successfully.' });
  }),
);
export default router;
