import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { makeId } from "../db/ids";
import { db } from "../db/pool";
import { requireRoles } from "../middleware/auth";
import { handleAsync } from "./utils";

const router = Router();

type NotificationSeed = {
  projectId: string | null;
  type: string;
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  referenceKey: string;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const paymentLabel = (paymentType: string): string => {
  if (paymentType === "Daily") return "daily";
  if (paymentType === "Weekly") return "weekly";
  if (paymentType === "Monthly") return "monthly";
  return paymentType.toLowerCase();
};

const insertNotificationOnce = async (companyId: number, notification: NotificationSeed): Promise<void> => {
  await db.query(
    [
      "INSERT INTO engicost.notifications (",
      "  id, company_id, project_id, alert_type, title, description, priority, reference_key",
      ")",
      "SELECT $1::varchar, $2::integer, $3::varchar, $4::varchar, $5::varchar, $6::text, $7::varchar, $8::varchar",
      "WHERE NOT EXISTS (",
      "  SELECT 1",
      "  FROM engicost.notifications",
      "  WHERE company_id = $2::integer AND reference_key = $8::varchar",
      ")",
    ].join("\n"),
    [
      makeId("NTF"),
      companyId,
      notification.projectId,
      notification.type,
      notification.title,
      notification.description,
      notification.priority,
      notification.referenceKey,
    ],
  );
};

const syncSystemNotifications = async (companyId: number): Promise<void> => {
  const dueWorkers = await db.query<{
    id: string;
    full_name: string;
    payment_type: string;
    assigned_project_id: string | null;
    project_name: string | null;
    next_payment_due_date: string;
  }>(
    [
      "SELECT",
      "  w.id,",
      "  w.full_name,",
      "  w.payment_type,",
      "  w.assigned_project_id,",
      "  p.name AS project_name,",
      "  w.next_payment_due_date::text",
      "FROM engicost.workers w",
      "LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id",
      "WHERE w.company_id = $1",
      "  AND w.is_deleted = FALSE",
      "  AND w.status <> 'Inactive'",
      "  AND w.payment_type IN ('Daily', 'Weekly', 'Monthly')",
      "  AND w.next_payment_due_date IS NOT NULL",
      "  AND w.next_payment_due_date <= CURRENT_DATE",
      "  AND (w.employment_end_date IS NULL OR w.next_payment_due_date <= w.employment_end_date)",
    ].join("\n"),
    [companyId],
  );

  for (const worker of dueWorkers.rows) {
    await insertNotificationOnce(companyId, {
      projectId: worker.assigned_project_id,
      type: "Labor",
      title: "Payment due for " + worker.full_name,
      description:
        worker.full_name +
        " is due for " +
        paymentLabel(worker.payment_type) +
        " labor payment on " +
        worker.next_payment_due_date +
        (worker.project_name ? " for " + worker.project_name : "") +
        ".",
      priority: "High",
      referenceKey: "worker-payment-due:" + worker.id + ":" + worker.next_payment_due_date,
    });
  }

  const endedWorkers = await db.query<{
    id: string;
    full_name: string;
    assigned_project_id: string | null;
    project_name: string | null;
    employment_end_date: string;
  }>(
    [
      "SELECT",
      "  w.id,",
      "  w.full_name,",
      "  w.assigned_project_id,",
      "  p.name AS project_name,",
      "  w.employment_end_date::text",
      "FROM engicost.workers w",
      "LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id",
      "WHERE w.company_id = $1",
      "  AND w.is_deleted = FALSE",
      "  AND w.status <> 'Inactive'",
      "  AND w.employment_end_date IS NOT NULL",
      "  AND w.employment_end_date < CURRENT_DATE",
    ].join("\n"),
    [companyId],
  );

  for (const worker of endedWorkers.rows) {
    await insertNotificationOnce(companyId, {
      projectId: worker.assigned_project_id,
      type: "Labor",
      title: "Worker contract ended: " + worker.full_name,
      description:
        worker.full_name +
        "'s planned work period ended on " +
        worker.employment_end_date +
        (worker.project_name ? " at " + worker.project_name : "") +
        ". Extend the end date or close the worker from labor operations.",
      priority: "Medium",
      referenceKey: "worker-ended:" + worker.id + ":" + worker.employment_end_date,
    });
  }

  const projectStarts = await db.query<{ id: string; name: string; start_date: string }>(
    [
      "SELECT id, name, start_date::text",
      "FROM engicost.projects",
      "WHERE company_id = $1",
      "  AND is_deleted = FALSE",
      "  AND start_date BETWEEN CURRENT_DATE AND $2::date",
    ].join("\n"),
    [companyId, addDaysIso(7)],
  );

  for (const project of projectStarts.rows) {
    await insertNotificationOnce(companyId, {
      projectId: project.id,
      type: "Deadline",
      title: "Project start date: " + project.name,
      description:
        project.name +
        " is scheduled to start on " +
        project.start_date +
        ". Confirm site readiness, team allocation, and materials planning.",
      priority: project.start_date <= todayIso() ? "High" : "Medium",
      referenceKey: "project-start:" + project.id + ":" + project.start_date,
    });
  }

  const projectDeadlines = await db.query<{ id: string; name: string; expected_completion_date: string }>(
    [
      "SELECT id, name, expected_completion_date::text",
      "FROM engicost.projects",
      "WHERE company_id = $1",
      "  AND is_deleted = FALSE",
      "  AND expected_completion_date BETWEEN CURRENT_DATE AND $2::date",
    ].join("\n"),
    [companyId, addDaysIso(14)],
  );

  for (const project of projectDeadlines.rows) {
    await insertNotificationOnce(companyId, {
      projectId: project.id,
      type: "Deadline",
      title: "Project deadline approaching: " + project.name,
      description:
        project.name +
        " is expected to finish on " +
        project.expected_completion_date +
        ". Review progress, pending tasks, and client handover items.",
      priority: project.expected_completion_date <= todayIso() ? "High" : "Medium",
      referenceKey: "project-end:" + project.id + ":" + project.expected_completion_date,
    });
  }
};

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    await syncSystemNotifications(companyId);
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
