import { BarChart2, PieChart, TrendingUp } from "lucide-react";
import { FinancialInput, SectionTitle, StatusBadge, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { expenseCategories, expenses, projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatDate, formatTzs } from "../utils/format";

export const ExpensesPage = () => {
  const { markSaved } = useUnsavedChanges();
  const expensePagination = useTablePagination(expenses);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Capture all operational expenses beyond labor and materials."
        title="Expense Management"
      />

      <SurfaceCard title="Expense Categories">
        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((category) => (
            <span
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              key={category}
            >
              {category}
            </span>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Expense List">
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {expensePagination.paginatedRows.map((item, index) => (
                <tr key={item.id}>
                  <td>{expensePagination.startIndex + index + 1}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.project}</td>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td>{formatTzs(item.amount)}</td>
                  <td>{item.paidBy}</td>
                  <td>{item.method}</td>
                  <td>{item.receipt}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <button className="btn-secondary !px-2 !py-1 text-xs">View</button>
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
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Expense">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-expense-form">
            <label className="form-field">
              <span>Project/Site</span>
              <GuiSelect className="input-field">
                {projects.map((project) => (
                  <option key={`ex-${project.id}`}>{project.name}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Expense Category</span>
              <GuiSelect className="input-field">
                {expenseCategories.map((category) => (
                  <option key={`ex-cat-${category}`}>{category}</option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Description</span>
              <input className="input-field" placeholder="Expense details..." />
            </label>
            <FinancialInput label="Amount" placeholder="500000" />
            <label className="form-field">
              <span>Date</span>
              <input className="input-field" type="date" />
            </label>
            <label className="form-field">
              <span>Paid By</span>
              <input className="input-field" placeholder="Name or role" />
            </label>
            <label className="form-field">
              <span>Payment Method</span>
              <GuiSelect className="input-field">
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Mobile Money</option>
                <option>Cheque</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Upload Receipt</span>
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
                <li>Fuel - TZS 6,240,000</li>
                <li>Transport - TZS 4,180,000</li>
                <li>Machine Rental - TZS 3,090,000</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BarChart2 className="h-4 w-4 text-[#0b2a53]" />
                By Project
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                <li>Dodoma - TZS 8,420,000</li>
                <li>Arusha - TZS 5,960,000</li>
                <li>Mbeya - TZS 4,330,000</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <TrendingUp className="h-4 w-4 text-[#0b2a53]" />
                Monthly Trend
              </p>
              <p className="mt-2 text-sm text-slate-700">
                April expenses are 6.8% higher than March due to mobilization and fuel usage.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};


