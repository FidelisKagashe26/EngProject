import { Router } from "express";
import { db } from "../db/pool";
import { getSingleTenantCompanyId } from "../db/init";
import { handleAsync } from "./utils";

const router = Router();

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [summaryResult, statusResult, projectsResult, alertsResult, activitiesResult] =
      await Promise.all([
        db.query<{
          total_projects: string;
          active_sites: string;
          total_contract_value: string;
          total_amount_received: string;
          total_expenses: string;
          estimated_profit: string;
          pending_client_payments: string;
          over_budget_projects: string;
        }>(
          `
          SELECT
            COUNT(*)::text AS total_projects,
            COUNT(*) FILTER (WHERE status = 'Active')::text AS active_sites,
            COALESCE(SUM(contract_value), 0)::text AS total_contract_value,
            COALESCE(SUM(amount_received), 0)::text AS total_amount_received,
            COALESCE(SUM(total_spent), 0)::text AS total_expenses,
            COALESCE(SUM(amount_received - total_spent), 0)::text AS estimated_profit,
            COALESCE(SUM(pending_client_payments), 0)::text AS pending_client_payments,
            COUNT(*) FILTER (WHERE status = 'Over Budget' OR total_spent > contract_value)::text AS over_budget_projects
          FROM engicost.projects
          WHERE company_id = $1
          `,
          [companyId],
        ),
        db.query<{ status: string; count: string }>(
          `
          SELECT status, COUNT(*)::text AS count
          FROM engicost.projects
          WHERE company_id = $1
          GROUP BY status
          ORDER BY COUNT(*) DESC
          `,
          [companyId],
        ),
        db.query<{
          id: string;
          name: string;
          site_location: string;
          client_name: string;
          contract_value: string;
          total_spent: string;
          status: string;
          progress: number;
        }>(
          `
          SELECT
            id,
            name,
            site_location,
            client_name,
            contract_value::text,
            total_spent::text,
            status,
            progress
          FROM engicost.projects
          WHERE company_id = $1
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 6
          `,
          [companyId],
        ),
        db.query<{
          id: string;
          title: string;
          description: string;
          priority: string;
          created_at: string;
        }>(
          `
          SELECT id, title, description, priority, created_at::text
          FROM engicost.notifications
          WHERE company_id = $1
          ORDER BY created_at DESC
          LIMIT 6
          `,
          [companyId],
        ),
        db.query<{
          id: string;
          actor_name: string;
          action: string;
          module: string;
          description: string;
          created_at: string;
        }>(
          `
          SELECT id, actor_name, action, module, description, created_at::text
          FROM engicost.activity_logs
          WHERE company_id = $1
          ORDER BY created_at DESC
          LIMIT 8
          `,
          [companyId],
        ),
      ]);

    const summary = summaryResult.rows[0];

    res.json({
      summary: {
        totalProjects: Number(summary?.total_projects ?? 0),
        activeSites: Number(summary?.active_sites ?? 0),
        totalContractValue: Number(summary?.total_contract_value ?? 0),
        totalAmountReceived: Number(summary?.total_amount_received ?? 0),
        totalExpenses: Number(summary?.total_expenses ?? 0),
        estimatedProfit: Number(summary?.estimated_profit ?? 0),
        pendingClientPayments: Number(summary?.pending_client_payments ?? 0),
        overBudgetProjects: Number(summary?.over_budget_projects ?? 0),
      },
      monthlyFinance: [
        { month: "Jan", income: 36_000_000, expenses: 24_500_000 },
        { month: "Feb", income: 45_000_000, expenses: 29_300_000 },
        { month: "Mar", income: 29_000_000, expenses: 31_000_000 },
        { month: "Apr", income: 40_000_000, expenses: 27_500_000 },
        { month: "May", income: 33_000_000, expenses: 22_000_000 },
        { month: "Jun", income: 27_000_000, expenses: 22_100_000 },
      ],
      statusBreakdown: statusResult.rows.map((row) => ({
        label: row.status,
        value: Number(row.count),
      })),
      recentProjects: projectsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        site: row.site_location,
        client: row.client_name,
        contractValue: Number(row.contract_value),
        spent: Number(row.total_spent),
        balance: Number(row.contract_value) - Number(row.total_spent),
        status: row.status,
        progress: row.progress,
      })),
      alerts: alertsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.description,
        priority: row.priority,
        createdAt: row.created_at,
      })),
      recentActivities: activitiesResult.rows.map((row) => ({
        id: row.id,
        title: `${row.actor_name} - ${row.action}`,
        module: row.module,
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  }),
);

export default router;

