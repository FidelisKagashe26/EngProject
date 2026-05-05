import { Router } from "express";
import { db } from "../db/pool";
import { getSingleTenantCompanyId } from "../db/init";
import { handleAsync } from "./utils";

const router = Router();

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();

    const [
      projectSummaryResult,
      laborSummaryResult,
      materialSummaryResult,
      expenseSummaryResult,
      paymentSummaryResult,
      expenseByCategoryResult,
      laborByProjectResult,
      materialByProjectResult,
      monthlyExpenseResult,
      budgetVarianceResult,
    ] = await Promise.all([

      // 1. Project cost summary
      db.query<{
        id: string;
        name: string;
        contract_value: string;
        amount_received: string;
        total_spent: string;
        pending_client_payments: string;
        status: string;
        progress: number;
      }>(
        `
        SELECT
          id,
          name,
          contract_value::text,
          amount_received::text,
          total_spent::text,
          pending_client_payments::text,
          status,
          progress
        FROM engicost.projects
        WHERE company_id = $1
        ORDER BY contract_value DESC
        `,
        [companyId],
      ),

      // 2. Labor totals per project
      db.query<{
        project_id: string;
        project_name: string;
        total_paid: string;
        outstanding: string;
        worker_count: string;
      }>(
        `
        SELECT
          w.assigned_project_id AS project_id,
          p.name AS project_name,
          COALESCE(SUM(w.total_paid), 0)::text AS total_paid,
          COALESCE(SUM(w.outstanding_amount), 0)::text AS outstanding,
          COUNT(w.id)::text AS worker_count
        FROM engicost.workers w
        LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
        WHERE w.company_id = $1
        GROUP BY w.assigned_project_id, p.name
        ORDER BY SUM(w.total_paid) DESC
        `,
        [companyId],
      ),

      // 3. Material totals per project
      db.query<{
        project_id: string;
        project_name: string;
        total_cost: string;
        purchase_count: string;
      }>(
        `
        SELECT
          mp.project_id,
          p.name AS project_name,
          COALESCE(SUM(mp.total_cost), 0)::text AS total_cost,
          COUNT(mp.id)::text AS purchase_count
        FROM engicost.material_purchases mp
        LEFT JOIN engicost.projects p ON p.id = mp.project_id
        WHERE mp.company_id = $1
        GROUP BY mp.project_id, p.name
        ORDER BY SUM(mp.total_cost) DESC
        `,
        [companyId],
      ),

      // 4. Expense totals per project
      db.query<{
        project_id: string;
        project_name: string;
        total_amount: string;
        expense_count: string;
      }>(
        `
        SELECT
          e.project_id,
          p.name AS project_name,
          COALESCE(SUM(e.amount), 0)::text AS total_amount,
          COUNT(e.id)::text AS expense_count
        FROM engicost.expenses e
        LEFT JOIN engicost.projects p ON p.id = e.project_id
        WHERE e.company_id = $1
        GROUP BY e.project_id, p.name
        ORDER BY SUM(e.amount) DESC
        `,
        [companyId],
      ),

      // 5. Payment summary per project
      db.query<{
        project_id: string;
        project_name: string;
        total_expected: string;
        total_received: string;
        total_balance: string;
      }>(
        `
        SELECT
          cp.project_id,
          p.name AS project_name,
          COALESCE(SUM(cp.amount_expected), 0)::text AS total_expected,
          COALESCE(SUM(cp.amount_received), 0)::text AS total_received,
          COALESCE(SUM(cp.amount_expected - cp.amount_received), 0)::text AS total_balance
        FROM engicost.client_payments cp
        LEFT JOIN engicost.projects p ON p.id = cp.project_id
        WHERE cp.company_id = $1
        GROUP BY cp.project_id, p.name
        ORDER BY SUM(cp.amount_expected) DESC
        `,
        [companyId],
      ),

      // 6. Expenses by category
      db.query<{ category: string; total: string; count: string }>(
        `
        SELECT
          category,
          COALESCE(SUM(amount), 0)::text AS total,
          COUNT(*)::text AS count
        FROM engicost.expenses
        WHERE company_id = $1
        GROUP BY category
        ORDER BY SUM(amount) DESC
        `,
        [companyId],
      ),

      // 7. Labor cost by project (for stacked bar)
      db.query<{ project_name: string; labor_cost: string }>(
        `
        SELECT
          COALESCE(p.name, 'Unassigned') AS project_name,
          COALESCE(SUM(w.total_paid), 0)::text AS labor_cost
        FROM engicost.workers w
        LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
        WHERE w.company_id = $1
        GROUP BY p.name
        ORDER BY SUM(w.total_paid) DESC
        LIMIT 6
        `,
        [companyId],
      ),

      // 8. Material cost by project
      db.query<{ project_name: string; material_cost: string }>(
        `
        SELECT
          COALESCE(p.name, 'Unassigned') AS project_name,
          COALESCE(SUM(mp.total_cost), 0)::text AS material_cost
        FROM engicost.material_purchases mp
        LEFT JOIN engicost.projects p ON p.id = mp.project_id
        WHERE mp.company_id = $1
        GROUP BY p.name
        ORDER BY SUM(mp.total_cost) DESC
        LIMIT 6
        `,
        [companyId],
      ),

      // 9. Monthly expense trend (last 6 months)
      db.query<{ month: string; total: string }>(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('month', expense_date), 'Mon YYYY') AS month,
          COALESCE(SUM(amount), 0)::text AS total
        FROM engicost.expenses
        WHERE company_id = $1
          AND expense_date >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', expense_date)
        ORDER BY DATE_TRUNC('month', expense_date) ASC
        `,
        [companyId],
      ),

      // 10. Budget variance per project
      db.query<{
        id: string;
        name: string;
        contract_value: string;
        total_spent: string;
        variance: string;
        variance_pct: string;
      }>(
        `
        SELECT
          id,
          name,
          contract_value::text,
          total_spent::text,
          (contract_value - total_spent)::text AS variance,
          CASE
            WHEN contract_value > 0
            THEN ROUND(((total_spent / contract_value) * 100)::numeric, 1)::text
            ELSE '0'
          END AS variance_pct
        FROM engicost.projects
        WHERE company_id = $1
        ORDER BY (total_spent / NULLIF(contract_value, 0)) DESC
        `,
        [companyId],
      ),
    ]);

    // Build combined project cost summary with labor + material + expense breakdown
    const laborMap = new Map(
      laborSummaryResult.rows.map((r) => [r.project_id, Number(r.total_paid)]),
    );
    const materialMap = new Map(
      materialSummaryResult.rows.map((r) => [r.project_id, Number(r.total_cost)]),
    );
    const expenseMap = new Map(
      expenseSummaryResult.rows.map((r) => [r.project_id, Number(r.total_amount)]),
    );

    const projectCostSummary = projectSummaryResult.rows.map((row) => {
      const laborCost = laborMap.get(row.id) ?? 0;
      const materialCost = materialMap.get(row.id) ?? 0;
      const otherExpenses = expenseMap.get(row.id) ?? 0;
      const contractValue = Number(row.contract_value);
      const amountReceived = Number(row.amount_received);
      const totalSpent = Number(row.total_spent);
      return {
        id: row.id,
        projectName: row.name,
        contractValue,
        amountReceived,
        laborCost,
        materialCost,
        otherExpenses,
        totalSpent,
        remainingBalance: contractValue - totalSpent,
        estimatedProfitLoss: amountReceived - totalSpent,
        pendingClientPayments: Number(row.pending_client_payments),
        status: row.status,
        progress: row.progress,
      };
    });

    // Overall totals
    const totals = projectCostSummary.reduce(
      (acc, row) => ({
        contractValue: acc.contractValue + row.contractValue,
        amountReceived: acc.amountReceived + row.amountReceived,
        laborCost: acc.laborCost + row.laborCost,
        materialCost: acc.materialCost + row.materialCost,
        otherExpenses: acc.otherExpenses + row.otherExpenses,
        totalSpent: acc.totalSpent + row.totalSpent,
        remainingBalance: acc.remainingBalance + row.remainingBalance,
        estimatedProfitLoss: acc.estimatedProfitLoss + row.estimatedProfitLoss,
      }),
      {
        contractValue: 0,
        amountReceived: 0,
        laborCost: 0,
        materialCost: 0,
        otherExpenses: 0,
        totalSpent: 0,
        remainingBalance: 0,
        estimatedProfitLoss: 0,
      },
    );

    res.json({
      totals,
      projectCostSummary,
      laborByProject: laborSummaryResult.rows.map((r) => ({
        projectName: r.project_name ?? "Unassigned",
        totalPaid: Number(r.total_paid),
        outstanding: Number(r.outstanding),
        workerCount: Number(r.worker_count),
      })),
      materialByProject: materialSummaryResult.rows.map((r) => ({
        projectName: r.project_name ?? "Unassigned",
        totalCost: Number(r.total_cost),
        purchaseCount: Number(r.purchase_count),
      })),
      expenseByProject: expenseSummaryResult.rows.map((r) => ({
        projectName: r.project_name ?? "Unassigned",
        totalAmount: Number(r.total_amount),
        expenseCount: Number(r.expense_count),
      })),
      paymentByProject: paymentSummaryResult.rows.map((r) => ({
        projectName: r.project_name ?? "Unassigned",
        totalExpected: Number(r.total_expected),
        totalReceived: Number(r.total_received),
        totalBalance: Number(r.total_balance),
      })),
      expenseByCategory: expenseByCategoryResult.rows.map((r) => ({
        category: r.category,
        total: Number(r.total),
        count: Number(r.count),
      })),
      monthlyExpenseTrend: monthlyExpenseResult.rows.map((r) => ({
        month: r.month,
        total: Number(r.total),
      })),
      budgetVariance: budgetVarianceResult.rows.map((r) => ({
        projectName: r.name,
        contractValue: Number(r.contract_value),
        totalSpent: Number(r.total_spent),
        variance: Number(r.variance),
        variancePct: Number(r.variance_pct),
      })),
    });
  }),
);

export default router;
