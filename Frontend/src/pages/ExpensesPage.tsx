import { BarChart2, PieChart, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActiveProject } from "../project/ActiveProjectContext";
import {
  ConfirmModal,
  DetailModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
  options,
} from "../components/ui";
import {
  PAYMENT_METHODS,
} from "../constants/options";
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

type ExpensesPageProps = {
  embedded?: boolean;
  search?: string;
  /** Renders the shared operations tab bar with this page's controls on the search row. */
  renderSearchRow?: (actions?: ReactNode) => ReactNode;
  /** Renders the top tab strip, allowing this page to inject elements to the right side. */
  renderTabStrip?: (actions?: ReactNode) => ReactNode;
};

export const ExpensesPage = ({ embedded = false, search = "", renderSearchRow, renderTabStrip }: ExpensesPageProps) => {
  const { markSaved } = useUnsavedChanges();
  // Scope comes from the shared header switcher, not a per-page dropdown.
  const { activeProjectId } = useActiveProject();
  const projectFromQuery = activeProjectId;
  const listProjectFilter = activeProjectId || "All";

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

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [activeExpenseSection, setActiveExpenseSection] = useState<"expenses" | "categories">("expenses");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [savedExpenseCategories, setSavedExpenseCategories] = useState<string[]>([]);
  const [viewExpense, setViewExpense] = useState<ExpenseApiRecord | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState(projectFromQuery);
  const [category, setCategory] = useState(defaultExpenseCategories[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [receiptRef, setReceiptRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, expensesResponse] = await Promise.all([
          api.getProjects(),
          api.getExpenses(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setExpenseRows(expensesResponse.rows);
        setCharts(expensesResponse.charts);
        setSavedExpenseCategories(expensesResponse.categories ?? []);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load expenses data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length === 0) return;
    setProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) return;
    setProjectId(projects[0].id);
  }, [projectId, projects]);

  const refreshExpenses = async () => {
    const response = await api.getExpenses();
    setExpenseRows(response.rows);
    setCharts(response.charts);
    setSavedExpenseCategories(response.categories ?? []);
  };

  const expenseCategories = useMemo(() => {
    const fromRows = expenseRows.map((r) => r.category);
    const fromCharts = charts.byCategory.map((i) => i.label);
    return Array.from(new Set([...defaultExpenseCategories, ...savedExpenseCategories, ...fromRows, ...fromCharts]));
  }, [charts.byCategory, expenseRows, savedExpenseCategories]);

  useEffect(() => {
    if (category.length === 0 || expenseCategories.some((i) => i === category)) return;
    setCategory(expenseCategories[0] ?? defaultExpenseCategories[0]);
  }, [category, expenseCategories]);

  const filteredExpenseRows = useMemo(() => {
    let result = expenseRows;
    if (listProjectFilter !== "All") {
      result = result.filter(r => r.projectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.projectName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.paidBy.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q),
      );
    }
    return result;
  }, [expenseRows, search, listProjectFilter]);

  const expenseSummary = useMemo(() => {
    return filteredExpenseRows.reduce(
      (acc, row) => {
        acc.totalRecords += 1;
        acc.totalSpent += row.amount;
        if (row.status === "Approved") acc.approvedAmount += row.amount;
        if (row.status === "Pending") acc.pendingAmount += row.amount;
        acc.projects.add(row.projectName);
        return acc;
      },
      {
        totalRecords: 0,
        totalSpent: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        projects: new Set<string>(),
      },
    );
  }, [filteredExpenseRows]);

  const expensePagination = useTablePagination(filteredExpenseRows);

  const monthTrendSummary = useMemo(() => {
    const trend = charts.monthlyTrend;
    if (trend.length < 2) return "Monthly trend will appear after at least two months of expense records.";
    const current = trend[trend.length - 1];
    const previous = trend[trend.length - 2];
    const previousTotal = previous?.total ?? 0;
    if (previousTotal <= 0) return `${current.month} has ${formatTzs(current.total)} in total expenses.`;
    const delta = ((current.total - previousTotal) / previousTotal) * 100;
    const direction = delta >= 0 ? "higher" : "lower";
    return `${current.month} expenses are ${Math.abs(delta).toFixed(1)}% ${direction} than ${previous.month}.`;
  }, [charts.monthlyTrend]);

  const resetForm = () => {
    setEditingExpenseId("");
    setDescription("");
    setAmount("");
    setDate("");
    setPaidBy("");
    setReceiptRef("");
    setNotes("");
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const openEditModal = (expense: ExpenseApiRecord) => {
    setEditingExpenseId(expense.id);
    setProjectId(expense.projectId);
    setCategory(expense.category);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setDate(expense.date);
    setPaidBy(expense.paidBy);
    setPaymentMethod(expense.paymentMethod);
    setReceiptRef(expense.receiptRef);
    setNotes(expense.notes);
    setShowAddModal(true);
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
      setError("Please fill project, category, description, amount, date and paid by.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        projectId,
        date,
        category,
        description: description.trim(),
        amount: Number(amount) || 0,
        paidBy: paidBy.trim(),
        paymentMethod,
        receiptRef: receiptRef.trim(),
        notes: notes.trim(),
      };
      if (editingExpenseId) {
        await api.updateExpense(editingExpenseId, payload);
      } else {
        await api.createExpense(payload);
      }
      await refreshExpenses();
      markSaved();
      closeAddModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    const value = newExpenseCategory.trim();
    if (value.length < 2) {
      setError("Please enter a valid expense category name.");
      return;
    }

    if (expenseCategories.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError("This expense category already exists.");
      return;
    }

    setSaving(true);
    try {
      await api.createExpenseCategory({ name: value });
      const response = await api.getExpenses();
      setExpenseRows(response.rows);
      setCharts(response.charts);
      setSavedExpenseCategories(response.categories ?? []);
      setCategory(value);
      setNewExpenseCategory("");
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteExpense(expenseToDelete.id);
      await refreshExpenses();
      markSaved();
      setExpenseToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete expense.");
      setExpenseToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Capture all operational expenses beyond labor and materials."
          title="Expense Management"
        />
      ) : null}

      {renderTabStrip?.(
        <div className="inline-flex h-10 w-full rounded-lg border border-[#0b2a53]/15 bg-white p-1 shadow-sm sm:w-auto dark:border-white/10 dark:bg-white/5">
          <button
            className={[
              "flex-1 rounded-md px-4 text-sm font-semibold transition sm:flex-none",
              activeExpenseSection === "categories"
                ? "bg-[#0b2a53] text-white"
                : "text-[#0b2a53] hover:bg-[#0b2a53]/5 dark:text-slate-200 dark:hover:bg-white/10",
            ].join(" ")}
            onClick={() => setActiveExpenseSection("categories")}
            type="button"
          >
            Category List
          </button>
          <button
            className={[
              "flex-1 rounded-md px-4 text-sm font-semibold transition sm:flex-none",
              activeExpenseSection === "expenses"
                ? "bg-[#0b2a53] text-white"
                : "text-[#0b2a53] hover:bg-[#0b2a53]/5 dark:text-slate-200 dark:hover:bg-white/10",
            ].join(" ")}
            onClick={() => setActiveExpenseSection("expenses")}
            type="button"
          >
            Expenses List
          </button>
        </div>,
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard className="[&_h3]:text-xs" title="Expense Records">
          <p className="text-xl font-bold text-slate-900">{expenseSummary.totalRecords}</p>
        </SurfaceCard>
        <SurfaceCard className="[&_h3]:text-xs" title="Total Spent">
          <p className="text-xl font-bold text-[#0b2a53]">{formatTzs(expenseSummary.totalSpent)}</p>
        </SurfaceCard>
        <SurfaceCard className="[&_h3]:text-xs" title="Approved Amount">
          <p className="text-xl font-bold text-emerald-700">{formatTzs(expenseSummary.approvedAmount)}</p>
        </SurfaceCard>
        <SurfaceCard className="[&_h3]:text-xs" title="Pending Amount">
          <p className="text-xl font-bold text-amber-700">{formatTzs(expenseSummary.pendingAmount)}</p>
        </SurfaceCard>
        <SurfaceCard className="[&_h3]:text-xs" title="Projects Covered">
          <p className="text-xl font-bold text-slate-900">{expenseSummary.projects.size}</p>
        </SurfaceCard>
      </div>

      {renderSearchRow?.(
        activeExpenseSection === "expenses" ? (
          <button
            className="btn-primary h-11 justify-center whitespace-nowrap"
            onClick={openAddModal}
            type="button"
          >
            + Add Expense
          </button>
        ) : null
      )}

      {activeExpenseSection === "categories" ? (
        <section className="space-y-4">
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex max-w-xl flex-col gap-2 sm:flex-row mb-6">
            <input
              className="input-field"
              onChange={(event) => setNewExpenseCategory(event.target.value)}
              placeholder="New expense category"
              value={newExpenseCategory}
            />
            <button className="btn-primary whitespace-nowrap" disabled={saving} onClick={() => void handleAddCategory()} type="button">
              + Add Category
            </button>
          </div>

          <SurfaceCard title="Registered Expense Categories">
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[500px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn w-16 text-center">S/N</th>
                    <th>Category Name</th>
                    <th className="ops-sticky-actions w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCategories.map((item, index) => (
                    <tr key={item}>
                      <td className="ops-sticky-sn text-center">{index + 1}</td>
                      <td><span className="ops-cell-text">{item}</span></td>
                      <td className="ops-sticky-actions text-center">
                        <button 
                          className="font-medium text-blue-600 hover:text-blue-800 text-sm"
                          onClick={() => alert("Edit category functionality coming soon!")}
                          type="button"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenseCategories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-slate-500">No categories found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </section>
      ) : (
        <>
      {/* Expense List Table */}
      <SurfaceCard title="Expense List">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : expenseRows.length === 0 ? (
          <EmptyState
            description="No expenses yet. Click Add Expense to record the first one."
            title="No expenses"
          />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[980px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Date</th>
                    <th>Project/Site</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePagination.paginatedRows.map((item, index) => (
                    <tr key={item.id}>
                      <td className="ops-sticky-sn">{expensePagination.startIndex + index + 1}</td>
                      <td>{formatDate(item.date)}</td>
                      <td><span className="ops-cell-text">{item.projectName}</span></td>
                      <td>{item.category}</td>
                      <td><span className="ops-cell-wide">{item.description}</span></td>
                      <td>{formatTzs(item.amount)}</td>
                      <td>
                        <span
                          className={
                            item.status === "Approved"
                              ? "text-sm font-medium text-emerald-700"
                              : item.status === "Pending"
                                ? "text-sm font-medium text-amber-700"
                                : "text-sm font-medium text-red-600"
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="ops-sticky-actions">
                        <div className="ops-actions-row">
                          <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setViewExpense(item)} type="button">
                            View
                          </button>
                          <button className="btn-secondary py-1 px-3 text-xs" onClick={() => openEditModal(item)} type="button">
                            Edit
                          </button>
                          <button className="btn-danger py-1 px-3 text-xs" onClick={() => setExpenseToDelete(item)} type="button">
                            Delete
                          </button>
                        </div>
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

      {/* Expense Insights */}
      <SurfaceCard title="Expense Insights">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <PieChart className="h-4 w-4 text-[#0b2a53]" />
              By Category
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {charts.byCategory.slice(0, 3).map((item) => (
                <li key={`by-cat-${item.label}`}>{item.label} - {formatTzs(item.total)}</li>
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
                <li key={`by-project-${item.label}`}>{item.label} - {formatTzs(item.total)}</li>
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
        </>
      )}

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title={editingExpenseId ? "Edit Expense" : "Add Expense"}>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project/Site</span>
                <GuiSelect className="input-field" onChange={(e) => setProjectId(e.target.value)} value={projectId}>
                  {projects.map((p) => <option key={`ex-${p.id}`} value={p.id}>{p.name}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Expense Category</span>
                <GuiSelect className="input-field" onChange={(e) => setCategory(e.target.value)} value={category}>
                  {expenseCategories.map((item) => <option key={`ex-cat-${item}`} value={item}>{item}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Description</span>
                <input className="input-field" onChange={(e) => setDescription(e.target.value)} placeholder="Expense details..." value={description} />
              </label>
              <FinancialInput label="Amount" onChange={setAmount} placeholder="500000" value={amount} />
              <label className="form-field">
                <span>Date</span>
                <input className="input-field" onChange={(e) => setDate(e.target.value)} type="date" value={date} />
              </label>
              <label className="form-field">
                <span>Paid By</span>
                <input className="input-field" onChange={(e) => setPaidBy(e.target.value)} placeholder="Name or role" value={paidBy} />
              </label>
              <label className="form-field">
                <span>Payment Method</span>
                <GuiSelect className="input-field" onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                  {options(PAYMENT_METHODS)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Receipt Reference</span>
                <input className="input-field" onChange={(e) => setReceiptRef(e.target.value)} placeholder="EXP-REC-001" value={receiptRef} />
              </label>
              {/* Status is not asked for: an expense's status is its approval
                  state, and a second hand-picked field using the same words let
                  a record read "Approved" while approval still held it. */}
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea className="input-field min-h-20" onChange={(e) => setNotes(e.target.value)} value={notes} />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeAddModal} type="button">Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={() => void handleSaveExpense()} type="button">
                  {editingExpenseId ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}
      <DetailModal
        onClose={() => setViewExpense(null)}
        open={viewExpense !== null}
        rows={viewExpense ? [
          { label: "Project / Site", value: viewExpense.projectName },
          { label: "Category", value: viewExpense.category },
          { label: "Amount", value: formatTzs(viewExpense.amount) },
          { label: "Date", value: formatDate(viewExpense.date) },
          { label: "Paid By", value: viewExpense.paidBy },
          { label: "Payment Method", value: viewExpense.paymentMethod },
          { label: "Receipt Reference", value: viewExpense.receiptRef || "-" },
          { label: "Status", value: <StatusBadge status={viewExpense.status} /> },
          { label: "Description", value: viewExpense.description, full: true },
          { label: "Notes", value: viewExpense.notes || "-", full: true },
        ] : []}
        subtitle={viewExpense ? `${viewExpense.category} expense` : ""}
        title="Expense Details"
      />
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        description={expenseToDelete ? `Delete expense "${expenseToDelete.description}"? Project totals will be reversed automatically.` : ""}
        onCancel={() => setExpenseToDelete(null)}
        onConfirm={() => void handleDeleteExpense()}
        open={expenseToDelete !== null}
        title="Delete Expense"
      />
    </div>
  );
};
