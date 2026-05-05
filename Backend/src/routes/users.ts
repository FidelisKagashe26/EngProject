import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();

const createUserSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email(),
  phone: z.string().min(7).max(60),
  role: z.enum([
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
      WHERE company_id = $1
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
      VALUES ($1, $2, 'Admin', 'Created User', 'Users', NULL, $3, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, `Created user account for ${row.full_name} (${row.role})`],
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
      WHERE company_id = $1 AND id = $2
      LIMIT 1
      `,
      [companyId, userId],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    const parsed = updateUserSchema.parse(req.body);

    // Check email uniqueness if changing
    if (parsed.email) {
      const normalizedEmail = parsed.email.trim().toLowerCase();
      const duplicate = await db.query<{ id: number }>(
        "SELECT id FROM engicost.users WHERE lower(email) = $1 AND id <> $2 LIMIT 1",
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
      WHERE company_id = $1 AND id = $2
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
      VALUES ($1, $2, 'Admin', 'Updated User', 'Users', NULL, $3, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, `Updated user account for ${row.full_name}`],
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

    const existing = await db.query<{ full_name: string }>(
      "SELECT full_name FROM engicost.users WHERE company_id = $1 AND id = $2 LIMIT 1",
      [companyId, userId],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    await db.query(
      "UPDATE engicost.users SET status = 'Suspended', updated_at = NOW() WHERE company_id = $1 AND id = $2",
      [companyId, userId],
    );

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'Admin', 'Suspended User', 'Users', NULL, $3, '127.0.0.1 / Local Dev')
      `,
      [makeId("ACT"), companyId, `Suspended user account: ${existing.rows[0].full_name}`],
    );

    res.json({ message: "User suspended successfully." });
  }),
);

export default router;
