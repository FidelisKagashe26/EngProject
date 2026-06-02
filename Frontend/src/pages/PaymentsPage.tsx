import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ConfirmModal,
  DetailModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  ProgressBar,
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
  type PaymentApiRecord,
  type PaymentsResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const paymentMethodOptions = [
  "Not specified",
  "Bank Transfer",
  "Cash",
  "Mobile Money",
  "Cheque",
] as const;

export const PaymentsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [topCards, setTopCards] = useState<PaymentsResponse["topCards"]>({
    totalReceived: 0,
    pendingReceivables: 0,
    totalCashOutflow: 0,
    netCashPosition: 0,
    nextExpectedPayment: null,
  });
  const [paymentRows, setPaymentRows] = useState<PaymentApiRecord[]>([]);
  const [cashFlow, setCashFlow] = useState<PaymentsResponse["cashFlow"]>({
    incomeVsOutflow: { income: 0, outflow: 0 },
    projectBalances: [],
  });

  // Transactions table filter
  const [tableProjectFilter, setTableProjectFilter] = useState(projectFromQuery || "All");

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [viewPayment, setViewPayment] = useState<PaymentApiRecord | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState(projectFromQuery);
  const [clientName, setClientName] = useState("");
  const [paymentType, setPaymentType] = useState<"Advance" | "Milestone" | "Stage" | "Final" | "Other">("Advance");
  const [milestone, setMilestone] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Not specified");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [status, setStatus] = useState("Received");
  const [notes, setNotes] = useState("");
  const [paymentAttachmentFile, setPaymentAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, paymentsResponse] = await Promise.all([
          api.getProjects(),
          api.getPayments(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setTopCards(paymentsResponse.topCards);
        setPaymentRows(paymentsResponse.rows);
        setCashFlow(paymentsResponse.cashFlow);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load payments data.");
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
    const p = projects.find((pr) => pr.id === projectFromQuery);
    if (p) setClientName(p.clientName);
  }, [projectFromQuery, projects]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) return;
    setProjectId(projects[0].id);
    setClientName(projects[0].clientName);
  }, [projectId, projects]);

  const refreshPayments = async () => {
    const response = await api.getPayments();
    setTopCards(response.topCards);
    setPaymentRows(response.rows);
    setCashFlow(response.cashFlow);
  };

  // ── Project collection totals (received vs still outstanding) ──
  const projectTotals = useMemo(
    () =>
      projects.reduce(
        (acc, p) => {
          acc.contract += p.contractValue;
          acc.received += p.amountReceived;
          acc.outstanding += p.pendingClientPayments;
          return acc;
        },
        { contract: 0, received: 0, outstanding: 0 },
      ),
    [projects],
  );

  const collectionRate = projectTotals.contract > 0
    ? Math.round((projectTotals.received / projectTotals.contract) * 100)
    : 0;
  const outflow = topCards.totalCashOutflow;
  const netCashPosition = projectTotals.received - outflow;

  const projectTracker = useMemo(
    () =>
      [...projects]
        .filter((p) => p.contractValue > 0 || p.amountReceived > 0)
        .sort((a, b) => b.pendingClientPayments - a.pendingClientPayments),
    [projects],
  );

  const filteredRows = useMemo(() => {
    if (tableProjectFilter === "All") return paymentRows;
    return paymentRows.filter((row) => row.projectId === tableProjectFilter);
  }, [tableProjectFilter, paymentRows]);

  const paymentPagination = useTablePagination(filteredRows);

  const income = cashFlow.incomeVsOutflow.income;
  const outflowBar = cashFlow.incomeVsOutflow.outflow;
  const totalFlow = income + outflowBar;
  const incomeWidth = totalFlow > 0 ? (income / totalFlow) * 100 : 0;
  const outflowWidth = totalFlow > 0 ? (outflowBar / totalFlow) * 100 : 0;

  const resetForm = () => {
    setEditingPaymentId("");
    setClientName("");
    setPaymentType("Advance");
    setMilestone("");
    setAmountReceived("");
    setPaymentDate("");
    setPaymentMethod("Not specified");
    setReferenceNumber("");
    setStatus("Received");
    setNotes("");
    setPaymentAttachmentFile(null);
  };

  const openAddModal = () => {
    resetForm();
    if (projects.length > 0) {
      const first = projects.find((p) => p.id === projectId) ?? projects[0];
      setProjectId(first.id);
      setClientName(first.clientName);
    }
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const openEditModal = (payment: PaymentApiRecord) => {
    setEditingPaymentId(payment.id);
    setProjectId(payment.projectId);
    setClientName(payment.client);
    setPaymentType(payment.paymentType as "Advance" | "Milestone" | "Stage" | "Final" | "Other");
    setMilestone(payment.milestone);
    setAmountReceived(String(payment.amountReceived));
    setPaymentDate(payment.paymentDate);
    setPaymentMethod(payment.paymentMethod || "Not specified");
    setReferenceNumber(payment.referenceNumber);
    setStatus(payment.status);
    setNotes(payment.notes);
    setPaymentAttachmentFile(null);
    setShowAddModal(true);
  };

  const handleProjectChange = (nextId: string) => {
    setProjectId(nextId);
    const p = projects.find((pr) => pr.id === nextId);
    if (p) setClientName(p.clientName);
  };

  const handlePaymentAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPaymentAttachmentFile(file);
    event.target.value = "";
  };

  const handleSavePayment = async () => {
    if (
      projectId.trim().length === 0 ||
      clientName.trim().length < 2 ||
      (Number(amountReceived) || 0) <= 0 ||
      paymentDate.trim().length === 0 ||
      paymentMethod.trim().length < 2
    ) {
      setError("Please provide project, client, amount received, payment date and payment method.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const attachmentFields: {
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentType?: string;
      } = {};

      if (paymentAttachmentFile) {
        const uploaded = await api.uploadDocumentFile(paymentAttachmentFile, {
          notifySuccess: false,
        });
        attachmentFields.attachmentUrl = uploaded.url;
        attachmentFields.attachmentName = paymentAttachmentFile.name;
        attachmentFields.attachmentType = paymentAttachmentFile.type || uploaded.mimetype;
      }

      const received = Number(amountReceived) || 0;
      const payload = {
        projectId,
        clientName: clientName.trim(),
        paymentType,
        milestone: milestone.trim(),
        // Transactions-only log: expected mirrors the received amount.
        amountExpected: received,
        amountReceived: received,
        paymentDate,
        paymentMethod: paymentMethod.trim(),
        referenceNumber: referenceNumber.trim(),
        status,
        notes: notes.trim(),
        ...attachmentFields,
      };
      if (editingPaymentId) {
        await api.updatePayment(editingPaymentId, payload);
      } else {
        await api.createPayment(payload);
      }
      await refreshPayments();
      markSaved();
      closeAddModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.deletePayment(paymentToDelete.id);
      await refreshPayments();
      markSaved();
      setPaymentToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete payment.");
      setPaymentToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track client funds received per project — see whether each project has paid in full or still has a balance."
        title="Payments & Cash Flow"
      />

      {/* Summary cards: received vs outstanding */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Received">
          <p className="text-2xl font-bold text-emerald-700">{formatTzs(projectTotals.received)}</p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding (Still Expected)">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(projectTotals.outstanding)}</p>
        </SurfaceCard>
        <SurfaceCard title="Collection Rate">
          <p className="text-2xl font-bold text-[#0b2a53]">{collectionRate}%</p>
          <p className="mt-1 text-xs text-slate-500">Received of total contract value</p>
        </SurfaceCard>
        <SurfaceCard title="Total Cash Outflow">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(outflow)}</p>
        </SurfaceCard>
        <SurfaceCard title="Net Cash Position">
          <p className={`text-2xl font-bold ${netCashPosition >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatTzs(netCashPosition)}
          </p>
        </SurfaceCard>
      </div>

      {/* Project collection tracker */}
      <SurfaceCard
        subtitle="Per project: how much has been received and how much is still expected."
        title="Project Collection Tracker"
      >
        {loading ? (
          <SkeletonTable rows={3} />
        ) : projectTracker.length === 0 ? (
          <EmptyState description="No projects to track yet." title="No projects" />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {projectTracker.map((project) => {
              const rate = project.contractValue > 0
                ? Math.round((project.amountReceived / project.contractValue) * 100)
                : 0;
              return (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-4"
                  key={`tracker-${project.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
                      <p className="truncate text-xs text-slate-500">{project.clientName}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${project.pendingClientPayments <= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {project.pendingClientPayments <= 0 ? "Fully paid" : "Pending"}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar positive value={rate} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-400">Contract</dt>
                      <dd className="font-semibold text-slate-700">{formatTzs(project.contractValue)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Received</dt>
                      <dd className="font-semibold text-emerald-700">{formatTzs(project.amountReceived)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Outstanding</dt>
                      <dd className="font-semibold text-amber-700">{formatTzs(project.pendingClientPayments)}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Transactions header: filter + add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <label className="form-field sm:w-72">
          <span className="text-sm">Filter by project</span>
          <GuiSelect
            className="input-field"
            onChange={(e) => setTableProjectFilter(e.target.value)}
            value={tableProjectFilter}
          >
            <option value="All">All Projects</option>
            {projects.map((p) => (
              <option key={`filter-${p.id}`} value={p.id}>{p.name}</option>
            ))}
          </GuiSelect>
        </label>
        <button className="btn-primary whitespace-nowrap" onClick={openAddModal} type="button">
          + Add Payment
        </button>
      </div>

      {/* Payments transactions log */}
      <SurfaceCard title="Client Payment Transactions">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState description="No payment transactions recorded yet." title="No payments" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1000px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Payment Type</th>
                    <th>Milestone/Stage</th>
                    <th>Amount Received</th>
                    <th>Payment Method</th>
                    <th>Reference</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentPagination.paginatedRows.map((payment, index) => (
                    <tr key={payment.id}>
                      <td>{paymentPagination.startIndex + index + 1}</td>
                      <td>{formatDate(payment.paymentDate)}</td>
                      <td>{payment.projectName}</td>
                      <td>{payment.client}</td>
                      <td>{payment.paymentType}</td>
                      <td>{payment.milestone || "-"}</td>
                      <td className="font-medium text-emerald-700">{formatTzs(payment.amountReceived)}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{payment.referenceNumber || "-"}</td>
                      <td>
                        {payment.attachmentUrl ? (
                          <a
                            className="text-sm font-semibold text-[#0b2a53] hover:underline"
                            href={payment.attachmentUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {payment.attachmentName || "View"}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className={
                          payment.status === "Received"
                            ? "text-sm font-medium text-emerald-700"
                            : payment.status === "Partial"
                              ? "text-sm font-medium text-amber-700"
                              : "text-sm font-medium text-slate-500"
                        }>
                          {payment.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setViewPayment(payment)} type="button">
                            View
                          </button>
                          <button className="btn-secondary py-1 px-3 text-xs" onClick={() => openEditModal(payment)} type="button">
                            Edit
                          </button>
                          <button className="btn-danger py-1 px-3 text-xs" onClick={() => setPaymentToDelete(payment)} type="button">
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
              endIndex={paymentPagination.endIndex}
              itemLabel="payments"
              onPageChange={paymentPagination.setPage}
              onPageSizeChange={paymentPagination.setPageSize}
              page={paymentPagination.page}
              pageSize={paymentPagination.pageSize}
              startIndex={paymentPagination.startIndex}
              totalCount={paymentPagination.totalCount}
              totalPages={paymentPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      {/* Income vs Outflow */}
      <SurfaceCard title="Income vs Outflow">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="bg-[#0b2a53]" style={{ width: `${incomeWidth}%` }} />
            <div className="bg-[#f28c28]" style={{ width: `${outflowWidth}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-600">Income: {formatTzs(income)} | Outflow: {formatTzs(outflowBar)}</p>
        </div>
      </SurfaceCard>

      {/* View Payment Modal */}
      <DetailModal
        onClose={() => setViewPayment(null)}
        open={viewPayment !== null}
        rows={viewPayment ? [
          { label: "Project", value: viewPayment.projectName },
          { label: "Client", value: viewPayment.client },
          { label: "Payment Type", value: viewPayment.paymentType },
          { label: "Milestone / Stage", value: viewPayment.milestone || "-" },
          { label: "Amount Received", value: formatTzs(viewPayment.amountReceived) },
          { label: "Payment Date", value: formatDate(viewPayment.paymentDate) },
          { label: "Payment Method", value: viewPayment.paymentMethod },
          { label: "Reference", value: viewPayment.referenceNumber || "-" },
          { label: "Status", value: <StatusBadge status={viewPayment.status} /> },
          {
            label: "Receipt / Bank Slip",
            value: viewPayment.attachmentUrl ? (
              <a className="font-semibold text-[#0b2a53] hover:underline" href={viewPayment.attachmentUrl} rel="noreferrer" target="_blank">
                {viewPayment.attachmentName || "View attachment"}
              </a>
            ) : "No receipt uploaded",
            full: true,
          },
          { label: "Notes", value: viewPayment.notes || "-", full: true },
        ] : []}
        subtitle={viewPayment ? `Recorded on ${formatDate(viewPayment.paymentDate)}` : ""}
        title="Payment Details"
      />

      {/* Add / Edit Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title={editingPaymentId ? "Edit Payment" : "Add Payment"}>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project</span>
                <GuiSelect className="input-field" onChange={(e) => handleProjectChange(e.target.value)} value={projectId}>
                  {projects.map((p) => <option key={`pmt-${p.id}`} value={p.id}>{p.name}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Client</span>
                <input className="input-field" onChange={(e) => setClientName(e.target.value)} placeholder="Client company name" value={clientName} />
              </label>
              <label className="form-field">
                <span>Payment Type</span>
                <GuiSelect className="input-field" onChange={(e) => setPaymentType(e.target.value as "Advance" | "Milestone" | "Stage" | "Final" | "Other")} value={paymentType}>
                  <option value="Advance">Advance</option>
                  <option value="Milestone">Milestone</option>
                  <option value="Stage">Stage</option>
                  <option value="Final">Final</option>
                  <option value="Other">Other</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Milestone / Stage</span>
                <input className="input-field" onChange={(e) => setMilestone(e.target.value)} placeholder="Optional milestone reference" value={milestone} />
              </label>
              <FinancialInput label="Amount Received" onChange={setAmountReceived} placeholder="20000000" value={amountReceived} />
              <label className="form-field">
                <span>Payment Date</span>
                <input className="input-field" onChange={(e) => setPaymentDate(e.target.value)} type="date" value={paymentDate} />
              </label>
              <label className="form-field">
                <span>Payment Method</span>
                <GuiSelect className="input-field" onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
                  {paymentMethodOptions.map((method) => (
                    <option key={`method-${method}`} value={method}>{method}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Reference Number</span>
                <input className="input-field" onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Reference / transaction number" value={referenceNumber} />
              </label>
              <label className="form-field">
                <span>Status</span>
                <GuiSelect className="input-field" onChange={(e) => setStatus(e.target.value)} value={status}>
                  <option value="Received">Received</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Receipt / Bank Slip (Optional)</span>
                <input
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="input-field"
                  onChange={handlePaymentAttachmentChange}
                  type="file"
                />
                {paymentAttachmentFile && (
                  <span className="mt-1 text-xs text-slate-500">{paymentAttachmentFile.name}</span>
                )}
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea className="input-field min-h-20" onChange={(e) => setNotes(e.target.value)} value={notes} />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeAddModal} type="button">Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={() => void handleSavePayment()} type="button">
                  {editingPaymentId ? "Update Payment" : "Save Payment"}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        description={paymentToDelete ? `Delete payment for "${paymentToDelete.projectName}"? Project payment totals will be reversed automatically.` : ""}
        onCancel={() => setPaymentToDelete(null)}
        onConfirm={() => void handleDeletePayment()}
        open={paymentToDelete !== null}
        title="Delete Payment"
      />
    </div>
  );
};
