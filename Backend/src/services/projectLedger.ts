import type { Queryable } from "../db/transaction";

/**
 * Every spend that hits a project is booked against exactly one of these, so
 * the three category budgets captured on the project can be enforced and
 * reported against actuals.
 */
export type SpendCategory = "labor" | "material" | "operational";

/** Statuses that mean the project is finished and must not accept new spend. */
export const CLOSED_PROJECT_STATUSES = ["Completed", "Closed"] as const;

const CATEGORY_SPENT_COLUMN: Record<SpendCategory, string> = {
  labor: "labor_spent",
  material: "material_spent",
  operational: "operational_spent",
};

const CATEGORY_BUDGET_COLUMN: Record<SpendCategory, string> = {
  labor: "labor_budget",
  material: "material_budget",
  operational: "operational_budget",
};

const CATEGORY_LABEL: Record<SpendCategory, string> = {
  labor: "labour",
  material: "material",
  operational: "operational",
};

/**
 * Failure payload returned to the client. The shape is kept stable because the
 * frontend renders these fields directly on the spend-guard error.
 */
export type LedgerFailure = {
  message: string;
  projectName: string;
  availableCash: number;
  remainingBudget: number;
  requestedAmount: number;
};

export type ApplySpendInput = {
  companyId: number;
  projectId: string;
  category: SpendCategory;
  /** Positive books new spend, negative reverses previously booked spend. */
  delta: number;
  /** Human-readable noun used in error messages, e.g. "expense". */
  context: string;
};

type ProjectLedgerRow = {
  name: string;
  status: string;
  contract_value: string;
  amount_received: string;
  total_spent: string;
  category_budget: string;
  category_spent: string;
};

const formatTzs = (value: number): string =>
  "TZS " + Math.max(value, 0).toLocaleString("en-TZ", { maximumFractionDigits: 0 });

const isClosedStatus = (status: string): boolean =>
  CLOSED_PROJECT_STATUSES.some((closed) => closed === status);

/**
 * Books `delta` against a project's running totals.
 *
 * The project row is locked with `FOR UPDATE` before it is read, so two
 * concurrent spends cannot both pass the capacity check against the same
 * starting balance. **This means the caller must already be inside a
 * transaction** (see `withTransaction`) — outside one the lock is released
 * immediately and the guarantee is lost.
 *
 * Positive deltas are validated against project status, cash on hand, the
 * contract value and the category budget. Negative deltas are reversals of
 * spend that was already accepted, so they always apply.
 *
 * Returns `null` when the movement was applied, or a failure payload the
 * caller should return to the client with a 400.
 */
export const applyProjectSpend = async (
  client: Queryable,
  input: ApplySpendInput,
): Promise<LedgerFailure | null> => {
  const delta = Number(input.delta) || 0;
  if (delta === 0) {
    return null;
  }

  const spentColumn = CATEGORY_SPENT_COLUMN[input.category];
  const budgetColumn = CATEGORY_BUDGET_COLUMN[input.category];

  const locked = await client.query<ProjectLedgerRow>(
    `
    SELECT
      name,
      status,
      contract_value::text,
      amount_received::text,
      total_spent::text,
      ${budgetColumn}::text AS category_budget,
      ${spentColumn}::text AS category_spent
    FROM engicost.projects
    WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE
    FOR UPDATE
    `,
    [input.companyId, input.projectId],
  );

  if (locked.rowCount === 0) {
    return {
      message: "Selected project/site does not exist.",
      projectName: "Unknown Project",
      availableCash: 0,
      remainingBudget: 0,
      requestedAmount: delta,
    };
  }

  const row = locked.rows[0];
  const contractValue = Number(row.contract_value) || 0;
  const amountReceived = Number(row.amount_received) || 0;
  const totalSpent = Number(row.total_spent) || 0;
  const categoryBudget = Number(row.category_budget) || 0;
  const categorySpent = Number(row.category_spent) || 0;

  const availableCash = amountReceived - totalSpent;
  const remainingBudget = contractValue - totalSpent;
  const failure = (message: string): LedgerFailure => ({
    message,
    projectName: row.name,
    availableCash,
    remainingBudget,
    requestedAmount: delta,
  });

  if (delta > 0) {
    if (isClosedStatus(row.status)) {
      return failure(
        `${row.name} is marked ${row.status} and no longer accepts new spend. ` +
          `Reopen the project before recording this ${input.context}.`,
      );
    }

    if (delta > availableCash) {
      return failure(
        `Insufficient project funds for this ${input.context}. ${row.name} has ` +
          `${formatTzs(availableCash)} available, but this transaction needs ${formatTzs(delta)}.`,
      );
    }

    if (delta > remainingBudget) {
      return failure(
        `This ${input.context} exceeds the project budget. ${row.name} has ` +
          `${formatTzs(remainingBudget)} remaining budget, but this transaction needs ${formatTzs(delta)}.`,
      );
    }

    // A category budget of zero means "not budgeted", which we treat as no cap
    // rather than as a hard zero — otherwise every project would be blocked
    // until all three budgets are filled in.
    if (categoryBudget > 0) {
      const remainingCategoryBudget = categoryBudget - categorySpent;
      if (delta > remainingCategoryBudget) {
        return failure(
          `This ${input.context} exceeds the ${CATEGORY_LABEL[input.category]} budget for ` +
            `${row.name}. ${formatTzs(remainingCategoryBudget)} of the ` +
            `${formatTzs(categoryBudget)} ${CATEGORY_LABEL[input.category]} budget is left, ` +
            `but this transaction needs ${formatTzs(delta)}.`,
        );
      }
    }
  }

  await client.query(
    `
    UPDATE engicost.projects
    SET total_spent = GREATEST(total_spent + $3, 0),
        ${spentColumn} = GREATEST(${spentColumn} + $3, 0),
        updated_at = NOW()
    WHERE company_id = $1 AND id = $2
    `,
    [input.companyId, input.projectId, delta],
  );

  return null;
};

/**
 * Moves booked spend from one project to another, used when a transaction is
 * edited onto a different project. The reversal on the old project is applied
 * first so the new project sees the freed-up capacity.
 */
export const moveProjectSpend = async (
  client: Queryable,
  input: {
    companyId: number;
    fromProjectId: string;
    toProjectId: string;
    category: SpendCategory;
    previousAmount: number;
    nextAmount: number;
    context: string;
  },
): Promise<LedgerFailure | null> => {
  const { companyId, fromProjectId, toProjectId, category, context } = input;

  if (fromProjectId === toProjectId) {
    return applyProjectSpend(client, {
      companyId,
      projectId: toProjectId,
      category,
      delta: input.nextAmount - input.previousAmount,
      context,
    });
  }

  const reversal = await applyProjectSpend(client, {
    companyId,
    projectId: fromProjectId,
    category,
    delta: -input.previousAmount,
    context,
  });
  if (reversal) {
    return reversal;
  }

  return applyProjectSpend(client, {
    companyId,
    projectId: toProjectId,
    category,
    delta: input.nextAmount,
    context,
  });
};

type CategoryTotals = {
  labor: number;
  material: number;
  operational: number;
};

/**
 * Recomputes a project's booked spend straight from the transaction tables.
 *
 * This is the reconciliation source of truth: `projects.total_spent` and the
 * three category columns are denormalised running totals, and this rebuilds
 * them so a missed increment can never silently persist. Only records that are
 * live (not soft-deleted) and approval-applied are counted, matching the rules
 * the increments themselves use.
 */
export const recalculateProjectSpend = async (
  client: Queryable,
  companyId: number,
  projectId: string,
): Promise<CategoryTotals & { totalSpent: number }> => {
  const result = await client.query<{
    labor: string;
    material: string;
    operational: string;
  }>(
    `
    SELECT
      (
        SELECT COALESCE(SUM(amount_paid), 0)
        FROM engicost.labor_payments
        WHERE company_id = $1 AND project_id = $2
          AND is_deleted = FALSE
          AND approval_status IN ('APPROVED', 'AUTO_APPROVED')
      )::text AS labor,
      (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM engicost.material_purchases
        WHERE company_id = $1 AND project_id = $2
          AND is_deleted = FALSE
          AND approval_status IN ('APPROVED', 'AUTO_APPROVED')
      )::text AS material,
      (
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM engicost.expenses
          WHERE company_id = $1 AND project_id = $2
            AND is_deleted = FALSE
            AND approval_status IN ('APPROVED', 'AUTO_APPROVED')
        )
        +
        (
          SELECT COALESCE(SUM(total_cost), 0)
          FROM engicost.equipment_usage
          WHERE company_id = $1 AND project_id = $2
            AND is_deleted = FALSE
            AND approval_status IN ('APPROVED', 'AUTO_APPROVED')
        )
        +
        (
          -- Only Cash Out is a project cost. Cash In tops the float back up
          -- and would double-count the same money if it were included.
          SELECT COALESCE(SUM(amount), 0)
          FROM engicost.petty_cash_transactions
          WHERE company_id = $1 AND project_id = $2
            AND is_deleted = FALSE
            AND transaction_type = 'Cash Out'
        )
      )::text AS operational
    `,
    [companyId, projectId],
  );

  const row = result.rows[0];
  const totals: CategoryTotals = {
    labor: Number(row?.labor ?? 0),
    material: Number(row?.material ?? 0),
    operational: Number(row?.operational ?? 0),
  };
  const totalSpent = totals.labor + totals.material + totals.operational;

  await client.query(
    `
    UPDATE engicost.projects
    SET labor_spent = $3,
        material_spent = $4,
        operational_spent = $5,
        total_spent = $6,
        updated_at = NOW()
    WHERE company_id = $1 AND id = $2
    `,
    [companyId, projectId, totals.labor, totals.material, totals.operational, totalSpent],
  );

  return { ...totals, totalSpent };
};
