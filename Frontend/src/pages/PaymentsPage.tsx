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
  type PaymentApiRecord,
  type PaymentsResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const paymentTabs = [
  "Client Payments",
  "Cash Outflows",
  "Pending Payments",
  "Milestone Payments",
] as const;

const resolveNextExpectedPayment = (
  rows: PaymentApiRecord[],
  fallback: PaymentsResponse["topCards"]["nextExpectedPayment"],
) => {
  const fromRows = [...rows]
    .filter((row) => row.balance > 0)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0];

  if (fromRows) {
    return {
      amount: fromRows.balance,
      projectName: fromRows.projectName,
      paymentDate: fromRows.paymentDate,
    };
  }

  if (!fallback) {
    return null;
  }

  return {
    amount:
      (Number(fallback.amount_expected) || 0) -
      (Number(fallback.amount_received) || 0),
    projectName: fallback.project_name ?? "Unknown Project",
    paymentDate: fallback.payment_date ?? "",
  };
};

export const PaymentsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";
  const [activeTab, setActiveTab] = useState<(typeof paymentTabs)[number]>(
    "Client Payments",
  );
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

  const [projectId, setProjectId] = useState(projectFromQuery);
  const [clientName, setClientName] = useState("");
  const [paymentType, setPaymentType] = useState<
    "Advance" | "Milestone" | "Stage" | "Final" | "Other"
  >("Advance");
  const [milestone, setMilestone] = useState("");
  const [amountExpected, setAmountExpected] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [status, setStatus] = useState("Received");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, paymentsResponse] = await Promise.all([
          api.getProjects(),
          api.getPayments(),
        ]);
        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setTopCards(paymentsResponse.topCards);
        setPaymentRows(paymentsResponse.rows);
        setCashFlow(paymentsResponse.cashFlow);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load payments data.";
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
    const selectedProject = projects.find(
      (project) => project.id === projectFromQuery,
    );
    if (selectedProject) {
      setClientName(selectedProject.clientName);
    }
  }, [projectFromQuery, projects]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) {
      return;
    }
    setProjectId(projects[0].id);
    setClientName(projects[0].clientName);
  }, [projectId, projects]);

  const refreshPayments = async () => {
    const response = await api.getPayments();
    setTopCards(response.topCards);
    setPaymentRows(response.rows);
    setCashFlow(response.cashFlow);
  };

  const balance = useMemo(() => {
    return Math.max(
      (Number(amountExpected) || 0) - (Number(amountReceived) || 0),
      0,
    );
  }, [amountExpected, amountReceived]);

  const filteredRows = useMemo(() => {
    if (activeTab === "Pending Payments") {
      return paymentRows.filter((row) => row.balance > 0);
    }
    if (activeTab === "Milestone Payments") {
      return paymentRows.filter(
        (row) => row.paymentType === "Milestone" || row.paymentType === "Stage",
      );
    }
    return paymentRows;
  }, [activeTab, paymentRows]);

  const paymentPagination = useTablePagination(filteredRows);

  const nextExpectedPayment = useMemo(
    () => resolveNextExpectedPayment(paymentRows, topCards.nextExpectedPayment),
    [paymentRows, topCards.nextExpectedPayment],
  );

  const income = cashFlow.incomeVsOutflow.income;
  const outflow = cashFlow.incomeVsOutflow.outflow;
  const totalFlow = income + outflow;
  const incomeWidth = totalFlow > 0 ? (income / totalFlow) * 100 : 0;
  const outflowWidth = totalFlow > 0 ? (outflow / totalFlow) * 100 : 0;

  const pendingPayments = useMemo(
    () =>
      paymentRows
        .filter((row) => row.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3),
    [paymentRows],
  );

  const resetForm = () => {
    setClientName("");
    setPaymentType("Advance");
    setMilestone("");
    setAmountExpected("");
    setAmountReceived("");
    setPaymentDate("");
    setPaymentMethod("Bank Transfer");
    setReferenceNumber("");
    setStatus("Received");
    setNotes("");
  };

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const selectedProject = projects.find((project) => project.id === nextProjectId);
    if (selectedProject) {
      setClientName(selectedProject.clientName);
    }
  };

  const handleSavePayment = async () => {
    if (
      projectId.trim().length === 0 ||
      clientName.trim().length < 2 ||
      (Number(amountExpected) || 0) <= 0 ||
      paymentDate.trim().length === 0 ||
      paymentMethod.trim().length < 2
    ) {
      setError(
        "Please provide project, client, amount expected, payment date and payment method.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.createPayment({
        projectId,
        clientName: clientName.trim(),
        paymentType,
        milestone: milestone.trim(),
        amountExpected: Number(amountExpected) || 0,
        amountReceived: Number(amountReceived) || 0,
        paymentDate,
        paymentMethod: paymentMethod.trim(),
        referenceNumber: referenceNumber.trim(),
        status,
        notes: notes.trim(),
      });
      await refreshPayments();
      markSaved();
      resetForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save payment.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track incoming client funds versus outgoing project execution payments."
        title="Payments & Cash Flow"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Received">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(topCards.totalReceived)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Pending Receivables">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(topCards.pendingReceivables)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Total Cash Outflow">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(topCards.totalCashOutflow)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Net Cash Position">
          <p className="text-2xl font-bold text-emerald-700">
            {formatTzs(topCards.netCashPosition)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Next Expected Payment">
          <p className="text-lg font-bold text-[#0b2a53]">
            {formatTzs(nextExpectedPayment?.amount ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {nextExpectedPayment
              ? `${nextExpectedPayment.projectName} - ${
                  nextExpectedPayment.paymentDate
                    ? formatDate(nextExpectedPayment.paymentDate)
                    : "No date"
                }`
              : "No pending expected payments"}
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <div className="flex flex-wrap gap-2">
          {paymentTabs.map((tab) => (
            <button
              className={
                tab === activeTab
                  ? "rounded-full bg-[#0b2a53] px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              }
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title={activeTab}>
        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            description="No payments found for the current tab."
            title="No payments"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Payment Type</th>
                    <th>Milestone/Stage</th>
                    <th>Amount Expected</th>
                    <th>Amount Received</th>
                    <th>Balance</th>
                    <th>Payment Method</th>
                    <th>Reference Number</th>
                    <th>Status</th>
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
                      <td>{formatTzs(payment.amountExpected)}</td>
                      <td>{formatTzs(payment.amountReceived)}</td>
                      <td>{formatTzs(payment.balance)}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{payment.referenceNumber || "-"}</td>
                      <td>
                        <StatusBadge status={payment.status} />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Payment Received Form">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-payment-form">
            <label className="form-field">
              <span>Project</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => handleProjectChange(event.target.value)}
                value={projectId}
              >
                {projects.map((project) => (
                  <option key={`pmt-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Client</span>
              <input
                className="input-field"
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Client company name"
                value={clientName}
              />
            </label>
            <label className="form-field">
              <span>Payment Type</span>
              <GuiSelect
                className="input-field"
                onChange={(event) =>
                  setPaymentType(
                    event.target.value as
                      | "Advance"
                      | "Milestone"
                      | "Stage"
                      | "Final"
                      | "Other",
                  )
                }
                value={paymentType}
              >
                <option value="Advance">Advance</option>
                <option value="Milestone">Milestone</option>
                <option value="Stage">Stage</option>
                <option value="Final">Final</option>
                <option value="Other">Other</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Milestone / Stage</span>
              <input
                className="input-field"
                onChange={(event) => setMilestone(event.target.value)}
                placeholder="Optional milestone reference"
                value={milestone}
              />
            </label>
            <FinancialInput
              label="Amount Expected"
              onChange={setAmountExpected}
              placeholder="24000000"
              value={amountExpected}
            />
            <FinancialInput
              label="Amount Received"
              onChange={setAmountReceived}
              placeholder="20000000"
              value={amountReceived}
            />
            <label className="form-field">
              <span>Balance</span>
              <input className="input-field bg-slate-50" readOnly value={formatTzs(balance)} />
            </label>
            <label className="form-field">
              <span>Payment Date</span>
              <input
                className="input-field"
                onChange={(event) => setPaymentDate(event.target.value)}
                type="date"
                value={paymentDate}
              />
            </label>
            <label className="form-field">
              <span>Payment Method</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPaymentMethod(event.target.value)}
                value={paymentMethod}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Reference Number</span>
              <input
                className="input-field"
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Reference / transaction number"
                value={referenceNumber}
              />
            </label>
            <label className="form-field">
              <span>Status</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="Received">Received</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
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
                onClick={() => void handleSavePayment()}
                type="button"
              >
                Save Payment
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Cash Flow Visual Summary">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Income vs Outflow
              </p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="bg-[#0b2a53]" style={{ width: `${incomeWidth}%` }} />
                <div className="bg-[#f28c28]" style={{ width: `${outflowWidth}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Income: {formatTzs(income)} | Outflow: {formatTzs(outflow)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Project Balance by Project
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {cashFlow.projectBalances.slice(0, 4).map((row) => (
                  <li className="flex justify-between" key={row.projectName}>
                    <span>{row.projectName}</span>
                    <span>{formatTzs(row.balance)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Client Payments
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {pendingPayments.map((row) => (
                  <li key={`pending-${row.id}`}>
                    {row.projectName} - {formatTzs(row.balance)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
