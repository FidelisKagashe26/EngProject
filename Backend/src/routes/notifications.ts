import { Router } from "express";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
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
        createdAt: row.created_at,
      })),
    );
  }),
);

router.get(
  "/activity-log",
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

