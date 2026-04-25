import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { IncomeExpenseChart } from "../components/charts";
import { SectionTitle, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { monthlyFinance, projects, reportCards } from "../data/mockData";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatTzs } from "../utils/format";

const projectCostSummaryRows = [
  {
    id: "PCS-001",
    project: "Dodoma Drainage Construction",
    contractValue: 120_000_000,
    amountReceived: 65_000_000,
    laborCost: 18_200_000,
    materialCost: 21_600_000,
    otherExpenses: 8_700_000,
    totalSpent: 48_500_000,
    remainingBalance: 71_500_000,
    estimatedProfitLoss: 16_500_000,
    status: "Active",
  },
  {
    id: "PCS-002",
    project: "Arusha Office Renovation",
    contractValue: 85_000_000,
    amountReceived: 40_000_000,
    laborCost: 14_500_000,
    materialCost: 11_600_000,
    otherExpenses: 6_100_000,
    totalSpent: 32_200_000,
    remainingBalance: 52_800_000,
    estimatedProfitLoss: 7_800_000,
    status: "Active",
  },
];

export const ReportsPage = () => {
  const reportsPagination = useTablePagination(projectCostSummaryRows);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Analyze project costs, cash movement, profit projections and budget variance."
        title="Reports & Analytics"
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field">
            <span>Date Range</span>
            <input className="input-field" type="date" />
          </label>
          <label className="form-field">
            <span>Project Filter</span>
            <GuiSelect className="input-field">
              <option>All Projects</option>
              {projects.map((project) => (
                <option key={`rp-${project.id}`}>{project.name}</option>
              ))}
            </GuiSelect>
          </label>
          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <button className="btn-secondary">
              <FileText className="h-4 w-4" />
              Preview Report
            </button>
            <button className="btn-secondary">
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button className="btn-secondary">
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((report) => (
          <SurfaceCard key={report} title={report}>
            <p className="text-sm text-slate-600">
              Generate this report with selected date range and project filters.
            </p>
            <button className="btn-primary mt-4 text-xs">Generate</button>
          </SurfaceCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Contract Value vs Expenses by Project">
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex justify-between">
              <span>Dodoma Drainage</span>
              <span>{formatTzs(120_000_000)} / {formatTzs(48_500_000)}</span>
            </li>
            <li className="flex justify-between">
              <span>Arusha Renovation</span>
              <span>{formatTzs(85_000_000)} / {formatTzs(32_200_000)}</span>
            </li>
            <li className="flex justify-between">
              <span>Mwanza Extension</span>
              <span>{formatTzs(150_000_000)} / {formatTzs(54_000_000)}</span>
            </li>
          </ul>
        </SurfaceCard>

        <SurfaceCard title="Profit/Loss by Project">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between text-emerald-700">
              <span>Dodoma Drainage Construction</span>
              <span>{formatTzs(16_500_000)}</span>
            </li>
            <li className="flex justify-between text-emerald-700">
              <span>Arusha Office Renovation</span>
              <span>{formatTzs(7_800_000)}</span>
            </li>
            <li className="flex justify-between text-red-700">
              <span>Mwanza Site Extension</span>
              <span>{formatTzs(-4_000_000)}</span>
            </li>
          </ul>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Monthly Income vs Expenses">
          <IncomeExpenseChart data={monthlyFinance} />
        </SurfaceCard>
        <SurfaceCard title="Top Expense Categories">
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex justify-between">
              <span>Fuel</span>
              <span>{formatTzs(18_400_000)}</span>
            </li>
            <li className="flex justify-between">
              <span>Machine Rental</span>
              <span>{formatTzs(16_200_000)}</span>
            </li>
            <li className="flex justify-between">
              <span>Transport</span>
              <span>{formatTzs(14_750_000)}</span>
            </li>
            <li className="flex justify-between">
              <span>Food Allowance</span>
              <span>{formatTzs(7_430_000)}</span>
            </li>
          </ul>
        </SurfaceCard>
      </div>

      <SurfaceCard subtitle="Sample preview for client presentation" title="Project Cost Summary Report">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1150px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Project</th>
                <th>Contract Value</th>
                <th>Amount Received</th>
                <th>Labor Cost</th>
                <th>Material Cost</th>
                <th>Other Expenses</th>
                <th>Total Spent</th>
                <th>Remaining Balance</th>
                <th>Estimated Profit/Loss</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportsPagination.paginatedRows.map((row, index) => (
                <tr key={row.id}>
                  <td>{reportsPagination.startIndex + index + 1}</td>
                  <td>{row.project}</td>
                  <td>{formatTzs(row.contractValue)}</td>
                  <td>{formatTzs(row.amountReceived)}</td>
                  <td>{formatTzs(row.laborCost)}</td>
                  <td>{formatTzs(row.materialCost)}</td>
                  <td>{formatTzs(row.otherExpenses)}</td>
                  <td>{formatTzs(row.totalSpent)}</td>
                  <td>{formatTzs(row.remainingBalance)}</td>
                  <td className={row.estimatedProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"}>
                    {formatTzs(row.estimatedProfitLoss)}
                  </td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          endIndex={reportsPagination.endIndex}
          itemLabel="rows"
          onPageChange={reportsPagination.setPage}
          onPageSizeChange={reportsPagination.setPageSize}
          page={reportsPagination.page}
          pageSize={reportsPagination.pageSize}
          startIndex={reportsPagination.startIndex}
          totalCount={reportsPagination.totalCount}
          totalPages={reportsPagination.totalPages}
        />
      </SurfaceCard>
    </div>
  );
};


