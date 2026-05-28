import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireRoles } from "../middleware/auth";
import { handleAsync } from "./utils";

const router = Router();

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{
      id: string;
      project_id: string | null;
      project_name: string | null;
      alert_type: string;
      title: string;
      description: string;
      priority: string;
      status: string;
      reminder_count: number;
      last_reminded_at: string | null;
      created_at: string;
    }>(
      `
      SELECT
        n.id,
        n.project_id,
        p.name AS project_name,
        n.alert_type,
        n.title,
        n.description,
        n.priority,
        n.status,
        COALESCE(n.reminder_count, 0) AS reminder_count,
        n.last_reminded_at::text,
        n.created_at::text
      FROM engicost.notifications n
      LEFT JOIN engicost.projects p ON p.id = n.project_id
      WHERE n.company_id = $1
      ORDER BY n.created_at DESC
      `,
      [companyId],
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name ?? "General",
        type: row.alert_type,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        reminderCount: row.reminder_count,
        lastRemindedAt: row.last_reminded_at,
        createdAt: row.created_at,
      })),
    );
  }),
);

// POST /notifications/:id/remind - Send a reminder (max 3 times)
router.post(
  "/:id/remind",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const notificationId = String(req.params.id);

    const existing = await db.query<{
      id: string;
      title: string;
      reminder_count: number;
      status: string;
    }>(
      `
      SELECT id, title, COALESCE(reminder_count, 0) AS reminder_count, status
      FROM engicost.notifications
      WHERE company_id = $1 AND id = $2
      LIMIT 1
      `,
      [companyId, notificationId],
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ message: "Notification not found." });
      return;
    }

    const notification = existing.rows[0];

    if (notification.reminder_count >= 3) {
      res.status(400).json({
        message: "Maximum reminders (3) already sent for this notification.",
        reminderCount: notification.reminder_count,
      });
      return;
    }

    const updated = await db.query<{
      id: string;
      reminder_count: number;
      last_reminded_at: string;
    }>(
      `
      UPDATE engicost.notifications
      SET
        reminder_count = COALESCE(reminder_count, 0) + 1,
        last_reminded_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING id, reminder_count, last_reminded_at::text
      `,
      [companyId, notificationId],
    );

    const row = updated.rows[0];

    await db.query(
      `
      INSERT INTO engicost.activity_logs (id, company_id, actor_name, action, module, project_id, description, ip_device)
      VALUES ($1, $2, 'System', 'Sent Reminder', 'Notifications', NULL, $3, '127.0.0.1 / System')
      `,
      [
        makeId("ACT"),
        companyId,
        `Reminder ${row.reminder_count}/3 sent for: ${notification.title}`,
      ],
    );

    res.json({
      id: row.id,
      reminderCount: row.reminder_count,
      lastRemindedAt: row.last_reminded_at,
      message: `Reminder ${row.reminder_count}/3 sent successfully.`,
    });
  }),
);

// PATCH /notifications/:id/resolve
router.patch(
  "/:id/resolve",
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const notificationId = String(req.params.id);

    const updated = await db.query<{ id: string }>(
      `
      UPDATE engicost.notifications
      SET status = 'Resolved'
      WHERE company_id = $1 AND id = $2
      RETURNING id
      `,
      [companyId, notificationId],
    );

    if (updated.rowCount === 0) {
      res.status(404).json({ message: "Notification not found." });
      return;
    }

    res.json({ message: "Notification resolved." });
  }),
);

router.get(
  "/activity-log",
  requireRoles("Admin", "Accountant"),
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const result = await db.query<{
      id: string;
      actor_name: string;
      action: string;
      module: string;
      project_id: string | null;
      project_name: string | null;
      description: string;
      ip_device: string | null;
      created_at: string;
    }>(
      `
      SELECT
        a.id,
        a.actor_name,
        a.action,
        a.module,
        a.project_id,
        p.name AS project_name,
        a.description,
        a.ip_device,
        a.created_at::text
      FROM engicost.activity_logs a
      LEFT JOIN engicost.projects p ON p.id = a.project_id
      WHERE a.company_id = $1
      ORDER BY a.created_at DESC
      `,
      [companyId],
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        actorName: row.actor_name,
        action: row.action,
        module: row.module,
        projectId: row.project_id,
        projectName: row.project_name ?? "General",
        description: row.description,
        ipDevice: row.ip_device ?? "",
        createdAt: row.created_at,
      })),
    );
  }),
);

export default router;
