import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ConfirmModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type PettyCashApiRecord,
  type PettyCashResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const OPENING_BALANCE = 1_800_000;

type PettyCashPageProps = {
  embedded?: boolean;
  search?: string;
  tabBar?: ReactNode;
};

export const PettyCashPage = ({ embedded = false, search = "", tabBar }: PettyCashPageProps) => {
  const { markSaved } = useUnsavedChanges();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [summary, setSummary] = useState<PettyCashResponse["summary"]>({
    totalCashIn: 0,
    totalCashOut: 0,
    pendingCount: 0,
  });
  const [rows, setRows] = useState<PettyCashApiRecord[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<PettyCashApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formProjectId, setFormProjectId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionType, setTransactionType] = useState<"Cash In" | "Cash Out">("Cash Out");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [recordedBy, setRecordedBy] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [formStatus, setFormStatus] = useState<"Pending" | "Reconciled">("Pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, pettyCashResponse] = await Promise.all([
          api.getProjects(),
          api.getPettyCash(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setSummary(pettyCashResponse.summary);
        setRows(pettyCashResponse.rows);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load petty cash data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const refreshData = async () => {
    const response = await api.getPettyCash();
    setSummary(response.summary);
    setRows(response.rows);
  };

  const filteredRows = useMemo(() => {
    if (search.trim().length === 0) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.description.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        r.recordedBy.toLowerCase().includes(q) ||
        r.transactionType.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pagination = useTablePagination(filteredRows);

  const currentBalance = useMemo(
    () => OPENING_BALANCE + summary.totalCashIn - summary.totalCashOut,
    [summary],
  );

  const projectedBalance = useMemo(() => {
    const value = Number(amount) || 0;
    return transactionType === "Cash In"
      ? currentBalance + value
      : currentBalance - value;
  }, [amount, currentBalance, transactionType]);

  const resetForm = () => {
    setFormProjectId("");
    setTransactionDate("");
    setTransactionType("Cash Out");
    setDescription("");
    setAmount("");
    setRecordedBy("");
    setReceiptRef("");
    setFormStatus("Pending");
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

  const handleSave = async () => {
    if (
      description.trim().length < 3 ||
      (Number(amount) || 0) <= 0 ||
      transactionDate.trim().length === 0 ||
      recordedBy.trim().length < 2
    ) {
      setError("Please fill description, amount, date and recorded by.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createPettyCash({
        projectId: formProjectId,
        transactionDate,
        transactionType,
        description: description.trim(),
        amount: Number(amount) || 0,
        recordedBy: recordedBy.trim(),
        receiptRef: receiptRef.trim(),
        status: formStatus,
        notes: notes.trim(),
      });
      await refreshData();
      markSaved();
      closeAddModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entryToDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.deletePettyCash(entryToDelete.id);
      await refreshData();
      markSaved();
      setEntryToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete entry.");
      setEntryToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Manage daily petty cash movement and reconciliation for each site."
          title="Petty Cash Management"
        />
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Opening Balance">
          <p className="text-xl font-bold text-slate-900">{formatTzs(OPENING_BALANCE)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Cash In">
          <p className="text-xl font-bold text-emerald-700">{formatTzs(summary.totalCashIn)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Cash Out">
          <p className="text-xl font-bold text-amber-700">{formatTzs(summary.totalCashOut)}</p>
        </SurfaceCard>
        <SurfaceCard title="Current Balance">
          <p className={`text-xl font-bold ${currentBalance >= 0 ? "text-[#0b2a53]" : "text-red-700"}`}>
            {formatTzs(currentBalance)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Pending Reconciliation">
          <p className="text-xl font-bold text-red-700">
            {summary.pendingCount} {summary.pendingCount === 1 ? "Entry" : "Entries"}
          </p>
        </SurfaceCard>
      </div>

      {/* Tab bar — between stats and table */}
      {tabBar}

      {/* Add button - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <button className="btn-primary whitespace-nowrap" onClick={openAddModal} type="button">
          + Add Transaction
        </button>
      </div>

      {/* Petty Cash Table */}
      <SurfaceCard title="Petty Cash Ledger">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            description="No petty cash transactions yet. Click Add Transaction to record the first entry."
            title="No transactions"
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
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Recorded By</th>
                    <th>Receipt Ref</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{pagination.startIndex + index + 1}</td>
                      <td>{formatDate(row.transactionDate)}</td>
                      <td>{row.projectName}</td>
                      <td>{row.description}</td>
                      <td>
                        <span
                          className={
                            row.transactionType === "Cash In"
                              ? "text-sm font-medium text-emerald-700"
                              : "text-sm font-medium text-amber-700"
                          }
                        >
                          {row.transactionType}
                        </span>
                      </td>
                      <td
                        className={
                          row.transactionType === "Cash In"
                            ? "text-emerald-700 font-medium"
                            : "text-amber-700 font-medium"
                        }
                      >
                        {formatTzs(row.amount)}
                      </td>
                      <td>{row.recordedBy}</td>
                      <td>{row.receiptRef || "-"}</td>
                      <td>
                        <span
                          className={
                            row.status === "Reconciled"
                              ? "text-sm font-medium text-emerald-700"
                              : "text-sm font-medium text-amber-700"
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-danger py-1 px-3 text-xs"
                          onClick={() => setEntryToDelete(row)}
                          type="button"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={pagination.endIndex}
              itemLabel="entries"
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              page={pagination.page}
              pageSize={pagination.pageSize}
              startIndex={pagination.startIndex}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Add Petty Cash Transaction">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project / Site</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => setFormProjectId(e.target.value)}
                  value={formProjectId}
                >
                  <option value="">Main Office</option>
                  {projects.map((p) => (
                    <option key={`pc-${p.id}`} value={p.id}>{p.name}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Transaction Type</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => setTransactionType(e.target.value as "Cash In" | "Cash Out")}
                  value={transactionType}
                >
                  <option value="Cash Out">Cash Out</option>
                  <option value="Cash In">Cash In</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Date</span>
                <input
                  className="input-field"
                  onChange={(e) => setTransactionDate(e.target.value)}
                  type="date"
                  value={transactionDate}
                />
              </label>
              <FinancialInput
                label="Amount"
                onChange={setAmount}
                placeholder="150000"
                value={amount}
              />
              <label className="form-field sm:col-span-2">
                <span>Description</span>
                <input
                  className="input-field"
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Transaction details..."
                  value={description}
                />
              </label>
              <label className="form-field">
                <span>Recorded By</span>
                <input
                  className="input-field"
                  onChange={(e) => setRecordedBy(e.target.value)}
                  placeholder="Name or role"
                  value={recordedBy}
                />
              </label>
              <label className="form-field">
                <span>Receipt Reference</span>
                <input
                  className="input-field"
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="PC-RCP-001"
                  value={receiptRef}
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => setFormStatus(e.target.value as "Pending" | "Reconciled")}
                  value={formStatus}
                >
                  <option value="Pending">Pending</option>
                  <option value="Reconciled">Reconciled</option>
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  value={notes}
                />
              </label>

              {/* Balance Preview */}
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Balance Preview</p>
                <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3 text-sm">
                  <p className="text-slate-700">
                    Current: <span className="font-semibold">{formatTzs(currentBalance)}</span>
                  </p>
                  <p className="text-slate-700">
                    This transaction:{" "}
                    <span className={`font-semibold ${transactionType === "Cash In" ? "text-emerald-700" : "text-amber-700"}`}>
                      {transactionType === "Cash In" ? "+" : "-"}{formatTzs(Number(amount) || 0)}
                    </span>
                  </p>
                  <p className={`font-semibold ${projectedBalance >= 0 ? "text-[#0b2a53]" : "text-red-700"}`}>
                    Projected: {formatTzs(projectedBalance)}
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeAddModal} type="button">
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        description={
          entryToDelete
            ? `Delete this petty cash entry "${entryToDelete.description}" (${formatTzs(entryToDelete.amount)})? This cannot be undone.`
            : ""
        }
        onCancel={() => setEntryToDelete(null)}
        onConfirm={() => void handleDelete()}
        open={entryToDelete !== null}
        title="Delete Petty Cash Entry"
      />
    </div>
  );
};
