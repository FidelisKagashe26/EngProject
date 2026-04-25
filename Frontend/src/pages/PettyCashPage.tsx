import { useMemo, useState } from "react";
import { FinancialInput, SectionTitle, StatusBadge, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { pettyCash, projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatDate, formatTzs } from "../utils/format";

export const PettyCashPage = () => {
  const { markSaved } = useUnsavedChanges();
  const openingBalance = 1_800_000;
  const cashIn = pettyCash.reduce((sum, row) => sum + row.cashIn, 0);
  const cashOut = pettyCash.reduce((sum, row) => sum + row.cashOut, 0);
  const currentBalance = openingBalance + cashIn - cashOut;

  const [transactionType, setTransactionType] = useState<"Cash In" | "Cash Out">("Cash Out");
  const [amount, setAmount] = useState("150000");
  const pettyCashPagination = useTablePagination(pettyCash);

  const projectedBalance = useMemo(() => {
    const value = Number(amount) || 0;
    return transactionType === "Cash In" ? currentBalance + value : currentBalance - value;
  }, [amount, currentBalance, transactionType]);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Manage daily petty cash movement and reconciliation for each site."
        title="Petty Cash Management"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Opening Balance">
          <p className="text-xl font-bold text-slate-900">{formatTzs(openingBalance)}</p>
        </SurfaceCard>
        <SurfaceCard title="Cash In">
          <p className="text-xl font-bold text-emerald-700">{formatTzs(cashIn)}</p>
        </SurfaceCard>
        <SurfaceCard title="Cash Out">
          <p className="text-xl font-bold text-amber-700">{formatTzs(cashOut)}</p>
        </SurfaceCard>
        <SurfaceCard title="Current Balance">
          <p className="text-xl font-bold text-[#0b2a53]">{formatTzs(currentBalance)}</p>
        </SurfaceCard>
        <SurfaceCard title="Pending Reconciliation">
          <p className="text-xl font-bold text-red-700">2 Entries</p>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Petty Cash Table">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Date</th>
                <th>Project</th>
                <th>Description</th>
                <th>Cash In</th>
                <th>Cash Out</th>
                <th>Balance</th>
                <th>Recorded By</th>
                <th>Receipt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pettyCashPagination.paginatedRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{pettyCashPagination.startIndex + index + 1}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.project}</td>
                  <td>{row.description}</td>
                  <td>{formatTzs(row.cashIn)}</td>
                  <td>{formatTzs(row.cashOut)}</td>
                  <td>{formatTzs(row.balance)}</td>
                  <td>{row.recordedBy}</td>
                  <td>{row.receipt}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          endIndex={pettyCashPagination.endIndex}
          itemLabel="entries"
          onPageChange={pettyCashPagination.setPage}
          onPageSizeChange={pettyCashPagination.setPageSize}
          page={pettyCashPagination.page}
          pageSize={pettyCashPagination.pageSize}
          startIndex={pettyCashPagination.startIndex}
          totalCount={pettyCashPagination.totalCount}
          totalPages={pettyCashPagination.totalPages}
        />
      </SurfaceCard>

      <SurfaceCard title="Add Petty Cash Transaction">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="form-field">
            <span>Project</span>
            <GuiSelect className="input-field">
              <option>Main Office</option>
              {projects.map((project) => (
                <option key={`pc-${project.id}`}>{project.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Transaction Type</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setTransactionType(event.target.value as "Cash In" | "Cash Out")}
              value={transactionType}
            >
              <option>Cash In</option>
              <option>Cash Out</option>
            </GuiSelect>
          </label>
          <FinancialInput label="Amount" onChange={setAmount} placeholder="150000" value={amount} />
          <label className="form-field">
            <span>Description</span>
            <input className="input-field" placeholder="Transaction details..." />
          </label>
          <label className="form-field">
            <span>Date</span>
            <input className="input-field" type="date" />
          </label>
          <label className="form-field">
            <span>Paid/Received By</span>
            <input className="input-field" placeholder="Name" />
          </label>
          <label className="form-field">
            <span>Upload Receipt</span>
            <input className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-[#0b2a53] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" type="file" />
          </label>
          <label className="form-field sm:col-span-2 xl:col-span-3">
            <span>Notes</span>
            <textarea className="input-field min-h-20" />
          </label>
          <div className="sm:col-span-2 xl:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Balance Preview</p>
            <p className={`mt-1 text-sm font-semibold ${projectedBalance >= 0 ? "text-[#0b2a53]" : "text-red-700"}`}>
              Projected Balance: {formatTzs(projectedBalance)}
            </p>
          </div>
          <div className="sm:col-span-2 xl:col-span-3 flex justify-end gap-2">
            <button className="btn-secondary" type="button">
              Cancel
            </button>
            <button className="btn-primary" onClick={markSaved} type="button">
              Save Transaction
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};


