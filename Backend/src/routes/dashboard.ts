import { Router } from "express";
import { db } from "../db/pool";
import { getSingleTenantCompanyId } from "../db/init";
import { handleAsync } from "./utils";
import { APPLIED_APPROVAL_STATUS_SQL } from "../services/approval";

const router = Router();

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [summaryResult, monthlyFinanceResult, statusResult, projectsResult, alertsResult, activitiesResult] =
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
          WITH payment_totals AS (
            SELECT project_id, COALESCE(SUM(amount_received), 0) AS amount_received
            FROM engicost.client_payments
            WHERE company_id = $1
              AND is_deleted = FALSE
              AND approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
            GROUP BY project_id
          )
          SELECT
            COUNT(p.id)::text AS total_projects,
            COUNT(p.id) FILTER (WHERE p.status = 'Active')::text AS active_sites,
            COALESCE(SUM(p.contract_value), 0)::text AS total_contract_value,
            COALESCE(SUM(pt.amount_received), 0)::text AS total_amount_received,
            COALESCE(SUM(p.total_spent), 0)::text AS total_expenses,
            (COALESCE(SUM(pt.amount_received), 0) - COALESCE(SUM(p.total_spent), 0))::text AS estimated_profit,
            COALESCE(SUM(p.pending_client_payments), 0)::text AS pending_client_payments,
            COUNT(p.id) FILTER (WHERE p.status = 'Over Budget' OR p.total_spent > p.contract_value)::text AS over_budget_projects
          FROM engicost.projects p
          LEFT JOIN payment_totals pt ON pt.project_id = p.id
          WHERE p.company_id = $1
          `,
          [companyId],
        ),
        db.query<{
          month_label: string;
          income: string;
          expenses: string;
        }>(
          `
          WITH months AS (
            SELECT
              DATE_TRUNC('month', CURRENT_DATE) - (INTERVAL '1 month' * month_offset) AS month_start
            FROM generate_series(11, 0, -1) AS month_offset
          ),
          income_by_month AS (
            SELECT
              DATE_TRUNC('month', cp.payment_date) AS month_start,
              COALESCE(SUM(cp.amount_received), 0) AS income
            FROM engicost.client_payments cp
            WHERE cp.company_id = $1
              AND cp.is_deleted = FALSE
              AND cp.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
              AND cp.payment_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND cp.payment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
            GROUP BY DATE_TRUNC('month', cp.payment_date)
          ),
          expense_entries AS (
            SELECT DATE_TRUNC('month', e.expense_date) AS month_start, e.amount AS amount
            FROM engicost.expenses e
            WHERE e.company_id = $1
              AND e.is_deleted = FALSE
              AND e.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
              AND e.expense_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND e.expense_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'

            UNION ALL

            SELECT DATE_TRUNC('month', mp.purchase_date) AS month_start, mp.total_cost AS amount
            FROM engicost.material_purchases mp
            WHERE mp.company_id = $1
              AND mp.is_deleted = FALSE
              AND mp.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
              AND mp.purchase_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND mp.purchase_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'

            UNION ALL

            SELECT DATE_TRUNC('month', lp.work_end) AS month_start, lp.amount_paid AS amount
            FROM engicost.labor_payments lp
            WHERE lp.company_id = $1
              AND lp.is_deleted = FALSE
              AND lp.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
              AND lp.work_end >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND lp.work_end < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'

            UNION ALL

            SELECT DATE_TRUNC('month', eu.end_date) AS month_start, eu.total_cost AS amount
            FROM engicost.equipment_usage eu
            WHERE eu.company_id = $1
              AND eu.is_deleted = FALSE
              AND eu.approval_status IN ${APPLIED_APPROVAL_STATUS_SQL}
              AND eu.end_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND eu.end_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'

            UNION ALL

            SELECT
              DATE_TRUNC('month', pc.transaction_date) AS month_start,
              CASE WHEN pc.transaction_type = 'Cash Out' THEN pc.amount ELSE 0 END AS amount
            FROM engicost.petty_cash_transactions pc
            WHERE pc.company_id = $1
              AND pc.transaction_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
              AND pc.transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          ),
          expenses_by_month AS (
            SELECT month_start, COALESCE(SUM(amount), 0) AS expenses
            FROM expense_entries
            GROUP BY month_start
          )
          SELECT
            TO_CHAR(months.month_start, 'Mon') AS month_label,
            COALESCE(ibm.income, 0)::text AS income,
            COALESCE(ebm.expenses, 0)::text AS expenses
          FROM months
          LEFT JOIN income_by_month ibm ON ibm.month_start = months.month_start
          LEFT JOIN expenses_by_month ebm ON ebm.month_start = months.month_start
          ORDER BY months.month_start ASC
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
      monthlyFinance: monthlyFinanceResult.rows.map((row) => ({
        month: row.month_label,
        income: Number(row.income),
        expenses: Number(row.expenses),
      })),
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
