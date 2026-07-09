type QueryResult<T> = {
  rows: T[];
  rowCount: number | null;
};

type Queryable = {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

type ProjectSpendRow = {
  name: string;
  contract_value: string;
  amount_received: string;
  total_spent: string;
};

export type SpendGuardResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      projectName: string;
      availableCash: number;
      remainingBudget: number;
      requestedAmount: number;
    };

const formatTzs = (value: number): string =>
  "TZS " + Math.max(value, 0).toLocaleString("en-TZ", { maximumFractionDigits: 0 });

export const checkProjectSpendCapacity = async (
  queryable: Queryable,
  companyId: number,
  projectId: string,
  requestedAmount: number,
  context = "transaction",
): Promise<SpendGuardResult> => {
  const amount = Number(requestedAmount) || 0;
  if (amount <= 0) {
    return { ok: true };
  }

  const result = await queryable.query<ProjectSpendRow>(
    [
      "SELECT name, contract_value::text, amount_received::text, total_spent::text",
      "FROM engicost.projects",
      "WHERE company_id = $1 AND id = $2 AND is_deleted = FALSE",
      "LIMIT 1",
    ].join("\n"),
    [companyId, projectId],
  );

  if (result.rowCount === 0) {
    return {
      ok: false,
      message: "Selected project/site does not exist.",
      projectName: "Unknown Project",
      availableCash: 0,
      remainingBudget: 0,
      requestedAmount: amount,
    };
  }

  const project = result.rows[0];
  const contractValue = Number(project.contract_value) || 0;
  const amountReceived = Number(project.amount_received) || 0;
  const totalSpent = Number(project.total_spent) || 0;
  const availableCash = amountReceived - totalSpent;
  const remainingBudget = contractValue - totalSpent;

  if (amount > availableCash) {
    return {
      ok: false,
      message:
        "Insufficient project funds for this " +
        context +
        ". " +
        project.name +
        " has " +
        formatTzs(availableCash) +
        " available, but this transaction needs " +
        formatTzs(amount) +
        ".",
      projectName: project.name,
      availableCash,
      remainingBudget,
      requestedAmount: amount,
    };
  }

  if (amount > remainingBudget) {
    return {
      ok: false,
      message:
        "This " +
        context +
        " exceeds the project budget. " +
        project.name +
        " has " +
        formatTzs(remainingBudget) +
        " remaining budget, but this transaction needs " +
        formatTzs(amount) +
        ".",
      projectName: project.name,
      availableCash,
      remainingBudget,
      requestedAmount: amount,
    };
  }

  return { ok: true };
};

export const spendGuardResponse = (result: SpendGuardResult) => {
  if (result.ok) {
    return null;
  }

  return {
    message: result.message,
    projectName: result.projectName,
    availableCash: Math.max(result.availableCash, 0),
    remainingBudget: Math.max(result.remainingBudget, 0),
    requestedAmount: result.requestedAmount,
  };
};
