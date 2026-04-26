import { BarChart2, PieChart, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type ExpenseApiRecord,
  type ExpensesResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const defaultExpenseCategories = [
  "Fuel",
  "Transport",
  "Machine Rental",
  "Utilities",
  "Accommodation",
  "Admin",
];

export const ExpensesPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseApiRecord[]>([]);
  const [charts, setCharts] = useState<ExpensesResponse["charts"]>({
    byCategory: [],
    byProject: [],
    monthlyTrend: [],
  });

  const [projectId, setProjectId] = useState(projectFromQuery);
  const [category, setCategory] = useState(defaultExpenseCategories[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receiptRef, setReceiptRef] = useState("");
  const [status, setStatus] = useState("Approved");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, expensesResponse] = await Promise.all([
          api.getProjects(),
          api.getExpenses(),
        ]);

        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setExpenseRows(expensesResponse.rows);
        setCharts(expensesResponse.charts);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load expenses data.";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length === 0) {
      return;
    }
    setProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) {
      return;
    }
    setProjectId(projects[0].id);
  }, [projectId, projects]);

  const refreshExpenses = async () => {
    const response = await api.getExpenses();
    setExpenseRows(response.rows);
    setCharts(response.charts);
  };

  const expenseCategories = useMemo(() => {
    const categoriesFromRows = expenseRows.map((row) => row.category);
    const categoriesFromCharts = charts.byCategory.map((item) => item.label);
    return Array.from(
      new Set([
        ...defaultExpenseCategories,
        ...categoriesFromRows,
        ...categoriesFromCharts,
      ]),
    );
  }, [charts.byCategory, expenseRows]);

  useEffect(() => {
    if (
      category.length === 0 ||
      expenseCategories.some((item) => item === category)
    ) {
      return;
    }
    setCategory(expenseCategories[0] ?? defaultExpenseCategories[0]);
  }, [category, expenseCategories]);

  const expensePagination = useTablePagination(expenseRows);

  const monthTrendSummary = useMemo(() => {
    const trend = charts.monthlyTrend;
    if (trend.length < 2) {
      return "Monthly trend will appear after at least two months of expense records.";
    }

    const current = trend[trend.length - 1];
    const previous = trend[trend.length - 2];
    const previousTotal = previous?.total ?? 0;
    if (previousTotal <= 0) {
      return `${current.month} has ${formatTzs(current.total)} in total expenses.`;
    }

    const delta = ((current.total - previousTotal) / previousTotal) * 100;
    const direction = delta >= 0 ? "higher" : "lower";
    return `${current.month} expenses are ${Math.abs(delta).toFixed(
      1,
    )}% ${direction} than ${previous.month}.`;
  }, [charts.monthlyTrend]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setDate("");
    setPaidBy("");
    setReceiptRef("");
    setStatus("Approved");
    setNotes("");
  };

  const handleSaveExpense = async () => {
    if (
      projectId.trim().length === 0 ||
      category.trim().length === 0 ||
      description.trim().length < 3 ||
      (Number(amount) || 0) <= 0 ||
      date.trim().length === 0 ||
      paidBy.trim().length < 2
    ) {
      setError(
        "Please fill project, category, description, amount, date and paid by.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.createExpense({
        projectId,
        date,
        category,
        description: description.trim(),
        amount: Number(amount) || 0,
        paidBy: paidBy.trim(),
        paymentMethod,
        receiptRef: receiptRef.trim(),
        status,
        notes: notes.trim(),
      });
      await refreshExpenses();
      markSaved();
      resetForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save expense.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Capture all operational expenses beyond labor and materials."
        title="Expense Management"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <SurfaceCard title="Expense Categories">
        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((item) => (
            <span
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Expense List">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : expenseRows.length === 0 ? (
          <EmptyState
            description="No expenses are available yet. Save the first expense record below."
            title="No expenses"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Date</th>
                    <th>Project/Site</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Paid By</th>
                    <th>Payment Method</th>
                    <th>Receipt</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePagination.paginatedRows.map((item, index) => (
                    <tr key={item.id}>
                      <td>{expensePagination.startIndex + index + 1}</td>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.projectName}</td>
                      <td>{item.category}</td>
                      <td>{item.description}</td>
                      <td>{formatTzs(item.amount)}</td>
                      <td>{item.paidBy}</td>
                      <td>{item.paymentMethod}</td>
                      <td>{item.receiptRef || "-"}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={expensePagination.endIndex}
              itemLabel="expenses"
              onPageChange={expensePagination.setPage}
              onPageSizeChange={expensePagination.setPageSize}
              page={expensePagination.page}
              pageSize={expensePagination.pageSize}
              startIndex={expensePagination.startIndex}
              totalCount={expensePagination.totalCount}
              totalPages={expensePagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Expense">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-expense-form">
            <label className="form-field">
              <span>Project/Site</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                {projects.map((project) => (
                  <option key={`ex-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Expense Category</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                {expenseCategories.map((item) => (
                  <option key={`ex-cat-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Description</span>
              <input
                className="input-field"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Expense details..."
                value={description}
              />
            </label>
            <FinancialInput
              label="Amount"
              onChange={setAmount}
              placeholder="500000"
              value={amount}
            />
            <label className="form-field">
              <span>Date</span>
              <input
                className="input-field"
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>
            <label className="form-field">
              <span>Paid By</span>
              <input
                className="input-field"
                onChange={(event) => setPaidBy(event.target.value)}
                placeholder="Name or role"
                value={paidBy}
              />
            </label>
            <label className="form-field">
              <span>Payment Method</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPaymentMethod(event.target.value)}
                value={paymentMethod}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Receipt Reference</span>
              <input
                className="input-field"
                onChange={(event) => setReceiptRef(event.target.value)}
                placeholder="EXP-REC-001"
                value={receiptRef}
              />
            </label>
            <label className="form-field">
              <span>Status</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea
                className="input-field min-h-20"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" onClick={resetForm} type="button">
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSaveExpense()}
                type="button"
              >
                Save Expense
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Expense Insights">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <PieChart className="h-4 w-4 text-[#0b2a53]" />
                By Category
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {charts.byCategory.slice(0, 3).map((item) => (
                  <li key={`by-cat-${item.label}`}>
                    {item.label} - {formatTzs(item.total)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BarChart2 className="h-4 w-4 text-[#0b2a53]" />
                By Project
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {charts.byProject.slice(0, 3).map((item) => (
                  <li key={`by-project-${item.label}`}>
                    {item.label} - {formatTzs(item.total)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <TrendingUp className="h-4 w-4 text-[#0b2a53]" />
                Monthly Trend
              </p>
              <p className="mt-2 text-sm text-slate-700">{monthTrendSummary}</p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
