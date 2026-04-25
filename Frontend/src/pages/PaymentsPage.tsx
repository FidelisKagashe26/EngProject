import { useMemo, useState } from "react";
import { FinancialInput, SectionTitle, StatusBadge, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { clientPayments, paymentMethods, projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatDate, formatTzs } from "../utils/format";

const paymentTabs = ["Client Payments", "Cash Outflows", "Pending Payments", "Milestone Payments"] as const;

export const PaymentsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [activeTab, setActiveTab] = useState<(typeof paymentTabs)[number]>("Client Payments");
  const [amountExpected, setAmountExpected] = useState("24000000");
  const [amountReceived, setAmountReceived] = useState("20000000");
  const paymentPagination = useTablePagination(clientPayments);

  const balance = useMemo(() => {
    return Math.max((Number(amountExpected) || 0) - (Number(amountReceived) || 0), 0);
  }, [amountExpected, amountReceived]);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track incoming client funds versus outgoing project execution payments."
        title="Payments & Cash Flow"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Received">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(210_000_000)}</p>
        </SurfaceCard>
        <SurfaceCard title="Pending Receivables">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(139_000_000)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Cash Outflow">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(156_400_000)}</p>
        </SurfaceCard>
        <SurfaceCard title="Net Cash Position">
          <p className="text-2xl font-bold text-emerald-700">{formatTzs(53_600_000)}</p>
        </SurfaceCard>
        <SurfaceCard title="Next Expected Payment">
          <p className="text-lg font-bold text-[#0b2a53]">{formatTzs(18_000_000)}</p>
          <p className="mt-1 text-xs text-slate-500">Mbeya Road Works - 30 Apr 2026</p>
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
                  <td>{formatDate(payment.date)}</td>
                  <td>{payment.project}</td>
                  <td>{payment.client}</td>
                  <td>{payment.paymentType}</td>
                  <td>{payment.milestone}</td>
                  <td>{formatTzs(payment.expected)}</td>
                  <td>{formatTzs(payment.received)}</td>
                  <td>{formatTzs(payment.expected - payment.received)}</td>
                  <td>{payment.method}</td>
                  <td>{payment.reference}</td>
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
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Payment Received Form">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-payment-form">
            <label className="form-field">
              <span>Project</span>
              <GuiSelect className="input-field">
                {projects.map((project) => (
                  <option key={`pmt-${project.id}`}>{project.name}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Client</span>
              <input className="input-field" placeholder="Client company name" />
            </label>
            <label className="form-field">
              <span>Payment Type</span>
              <GuiSelect className="input-field">
                <option>Advance</option>
                <option>Milestone</option>
                <option>Stage</option>
                <option>Final</option>
                <option>Other</option>
              </GuiSelect>
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
              <input className="input-field" type="date" />
            </label>
            <label className="form-field">
              <span>Payment Method</span>
              <GuiSelect className="input-field">
                {paymentMethods.map((method) => (
                  <option key={`method-${method}`}>{method}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Reference Number</span>
              <input className="input-field" placeholder="Reference / transaction number" />
            </label>
            <label className="form-field">
              <span>Upload Proof</span>
              <input className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-[#0b2a53] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" type="file" />
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea className="input-field min-h-20" />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" type="button">
                Cancel
              </button>
              <button className="btn-primary" onClick={markSaved} type="button">
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
                <div className="bg-[#0b2a53]" style={{ width: "57%" }} />
                <div className="bg-[#f28c28]" style={{ width: "43%" }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Income: {formatTzs(210_000_000)} | Outflow: {formatTzs(156_400_000)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Project Balance by Project
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li className="flex justify-between">
                  <span>Dodoma Drainage</span>
                  <span>{formatTzs(71_500_000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Arusha Renovation</span>
                  <span>{formatTzs(52_800_000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Mbeya Road Works</span>
                  <span>{formatTzs(108_300_000)}</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Client Payments
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                <li>Mbeya Road Works - TZS 18,000,000</li>
                <li>Dodoma Drainage Construction - TZS 4,000,000</li>
                <li>Mwanza Site Extension - TZS 10,000,000</li>
              </ul>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};


