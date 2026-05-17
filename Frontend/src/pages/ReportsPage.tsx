import { useEffect, useMemo, useState } from "react";
import { IncomeExpenseChart, StackedCostBar } from "../components/charts";
import {
  EmptyState,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type PdfReportType,
  type ProjectApiRecord,
  type ReportProjectCostRow,
  type ReportsResponse,
} from "../services/api";
import { formatTzs } from "../utils/format";

type ReportTab =
  | "Project Cost Summary"
  | "Labor Report"
  | "Material Report"
  | "Expense Report"
  | "Payment Report"
  | "Budget Variance";

const TABS: ReportTab[] = [
  "Project Cost Summary",
  "Labor Report",
  "Material Report",
  "Expense Report",
  "Payment Report",
  "Budget Variance",
];

const PDF_REPORT_OPTIONS: Array<{ value: PdfReportType; label: string }> = [
  { value: "comprehensive", label: "Comprehensive Financial Report" },
  { value: "project-cost-summary", label: "Project Cost Summary" },
  { value: "income-expense", label: "Income vs Expense Statement" },
  { value: "payments", label: "Payment Collection Report" },
  { value: "labor", label: "Labor Cost Report" },
  { value: "materials", label: "Material Cost Report" },
  { value: "expenses-by-category", label: "Expense by Category Report" },
  { value: "budget-variance", label: "Budget Variance Report" },
];

const BudgetBar = ({ spent, total }: { spent: number; total: number }) => {
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#0b2a53]";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-slate-600">{pct}%</span>
    </div>
  );
};

export const ReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTab>("Project Cost Summary");
  const [projectFilter, setProjectFilter] = useState("All");
  const [pdfReportType, setPdfReportType] = useState<PdfReportType>("comprehensive");
  const [pdfCategory, setPdfCategory] = useState("All");
  const [pdfFromDate, setPdfFromDate] = useState("");
  const [pdfToDate, setPdfToDate] = useState("");
  const [pdfDownloadMessage, setPdfDownloadMessage] = useState("");
  const [pdfDownloadError, setPdfDownloadError] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [data, setData] = useState<ReportsResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, reportsData] = await Promise.all([
          api.getProjects(),
          api.getReports(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setData(reportsData);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load reports data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const filteredProjectCost = useMemo<ReportProjectCostRow[]>(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.projectCostSummary;
    return data.projectCostSummary.filter((r) => r.id === projectFilter);
  }, [data, projectFilter]);

  const selectedProjectName = useMemo(() => {
    if (projectFilter === "All") return "";
    return projects.find((project) => project.id === projectFilter)?.name ?? "";
  }, [projectFilter, projects]);

  const filteredLabor = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.laborByProject;
    return data.laborByProject.filter(
      (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
    );
  }, [data, projectFilter, selectedProjectName]);

  const filteredMaterial = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.materialByProject;
    return data.materialByProject.filter(
      (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
    );
  }, [data, projectFilter, selectedProjectName]);

  const filteredExpenseByProject = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.expenseByProject;
    return data.expenseByProject.filter(
      (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
    );
  }, [data, projectFilter, selectedProjectName]);

  const filteredPayments = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.paymentByProject;
    return data.paymentByProject.filter(
      (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
    );
  }, [data, projectFilter, selectedProjectName]);

  const filteredBudgetVariance = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.budgetVariance;
    return data.budgetVariance.filter((row) => row.projectName === selectedProjectName);
  }, [data, projectFilter, selectedProjectName]);

  const costPagination = useTablePagination(filteredProjectCost);
  const laborPagination = useTablePagination(filteredLabor);
  const materialPagination = useTablePagination(filteredMaterial);
  const expensePagination = useTablePagination(filteredExpenseByProject);
  const paymentPagination = useTablePagination(filteredPayments);
  const variancePagination = useTablePagination(filteredBudgetVariance);

  // Monthly expense trend formatted for chart
  const monthlyChartData = useMemo(() => {
    if (!data) return [];
    return data.monthlyExpenseTrend.map((r) => ({
      month: r.month.split(" ")[0],
      income: 0,
      expenses: r.total,
    }));
  }, [data]);

  const totals = data?.totals;
  const expenseCategoryOptions = useMemo(
    () =>
      Array.from(new Set((data?.expenseByCategory ?? []).map((row) => row.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [data],
  );

  const handleDownloadPdf = async () => {
    if (pdfFromDate && pdfToDate && pdfFromDate > pdfToDate) {
      setPdfDownloadError(true);
      setPdfDownloadMessage("From date cannot be after To date.");
      return;
    }

    setDownloadingPdf(true);
    setPdfDownloadError(false);
    setPdfDownloadMessage("");
    try {
      const { blob, filename } = await api.downloadReportPdf({
        reportType: pdfReportType,
        projectId: projectFilter === "All" ? undefined : projectFilter,
        category: pdfCategory === "All" ? undefined : pdfCategory,
        fromDate: pdfFromDate || undefined,
        toDate: pdfToDate || undefined,
      });

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      setPdfDownloadError(false);
      setPdfDownloadMessage(`PDF downloaded: ${filename}`);
    } catch (downloadError) {
      setPdfDownloadError(true);
      setPdfDownloadMessage(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to generate PDF report.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Choose report type and analyze project costs, cash movement, and budget variance."
        title="Reports"
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard title="Total Contract Value">
          <p className="text-2xl font-bold text-[#0b2a53]">
            {formatTzs(totals?.contractValue ?? 0)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Total Amount Received">
          <p className="text-2xl font-bold text-emerald-700">
            {formatTzs(totals?.amountReceived ?? 0)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Total Spent">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(totals?.totalSpent ?? 0)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Estimated Profit / Loss">
          <p className={`text-2xl font-bold ${(totals?.estimatedProfitLoss ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatTzs(totals?.estimatedProfitLoss ?? 0)}
          </p>
        </SurfaceCard>
      </div>

      {/* Cost Breakdown Bar + Expense by Category */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Overall Cost Breakdown">
          {totals ? (
            <div className="space-y-4">
              <StackedCostBar
                labor={totals.laborCost}
                material={totals.materialCost}
                operations={totals.otherExpenses}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Labor</p>
                  <p className="mt-1 font-bold text-[#0b2a53]">{formatTzs(totals.laborCost)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Materials</p>
                  <p className="mt-1 font-bold text-[#f28c28]">{formatTzs(totals.materialCost)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operations</p>
                  <p className="mt-1 font-bold text-emerald-700">{formatTzs(totals.otherExpenses)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading...</p>
          )}
        </SurfaceCard>

        <SurfaceCard title="Top Expense Categories">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : (data?.expenseByCategory ?? []).length === 0 ? (
            <EmptyState description="No expense data yet." title="No data" />
          ) : (
            <ul className="space-y-3">
              {(data?.expenseByCategory ?? []).slice(0, 6).map((item) => {
                const maxCat = Math.max(...(data?.expenseByCategory ?? []).map((c) => c.total), 1);
                const pct = Math.round((item.total / maxCat) * 100);
                return (
                  <li key={item.category}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.category}</span>
                      <span className="text-slate-500">{formatTzs(item.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#f28c28]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>
      </div>

      {/* Monthly Expense Trend */}
      {monthlyChartData.length > 0 && (
        <SurfaceCard title="Monthly Expense Trend">
          <IncomeExpenseChart data={monthlyChartData} />
        </SurfaceCard>
      )}

      <SurfaceCard
        subtitle="Choose scope and report type, then generate downloadable PDF reports for all projects or a single project."
        title="Report Controls"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="form-field">
            <span className="text-sm">Filter by Project</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => setProjectFilter(e.target.value)}
              value={projectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={`rp-${p.id}`} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GuiSelect>
          </label>

          <label className="form-field">
            <span className="text-sm">On-screen Report View</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setActiveTab(event.target.value as ReportTab)}
              value={activeTab}
            >
              {TABS.map((tab) => (
                <option key={`report-type-${tab}`} value={tab}>
                  {tab}
                </option>
              ))}
            </GuiSelect>
          </label>

          <label className="form-field">
            <span className="text-sm">PDF Report Type</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setPdfReportType(event.target.value as PdfReportType)}
              value={pdfReportType}
            >
              {PDF_REPORT_OPTIONS.map((option) => (
                <option key={`pdf-report-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </GuiSelect>
          </label>

          <label className="form-field">
            <span className="text-sm">Specific Category (Optional)</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setPdfCategory(event.target.value)}
              value={pdfCategory}
            >
              <option value="All">All Categories</option>
              {expenseCategoryOptions.map((category) => (
                <option key={`pdf-category-${category}`} value={category}>
                  {category}
                </option>
              ))}
            </GuiSelect>
          </label>

          <label className="form-field">
            <span className="text-sm">From Date (Optional)</span>
            <input
              className="input-field"
              onChange={(event) => setPdfFromDate(event.target.value)}
              type="date"
              value={pdfFromDate}
            />
          </label>

          <label className="form-field">
            <span className="text-sm">To Date (Optional)</span>
            <input
              className="input-field"
              onChange={(event) => setPdfToDate(event.target.value)}
              type="date"
              value={pdfToDate}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="btn-primary w-full justify-center sm:w-auto"
            disabled={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
            type="button"
          >
            {downloadingPdf ? "Generating PDF..." : "Download PDF Report"}
          </button>
          {pdfDownloadMessage && (
            <p className={`text-xs ${pdfDownloadError ? "text-red-700" : "text-emerald-700"}`}>
              {pdfDownloadMessage}
            </p>
          )}
        </div>
      </SurfaceCard>

      {/* Report Tables */}
      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      {/* PROJECT COST SUMMARY */}
      {activeTab === "Project Cost Summary" && (
        <SurfaceCard title="Project Cost Summary Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredProjectCost.length === 0 ? (
            <EmptyState description="No project data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1300px]">
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
                      <th>Profit / Loss</th>
                      <th>Budget Used</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costPagination.paginatedRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{costPagination.startIndex + index + 1}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{formatTzs(row.contractValue)}</td>
                        <td>{formatTzs(row.amountReceived)}</td>
                        <td>{formatTzs(row.laborCost)}</td>
                        <td>{formatTzs(row.materialCost)}</td>
                        <td>{formatTzs(row.otherExpenses)}</td>
                        <td className="font-medium">{formatTzs(row.totalSpent)}</td>
                        <td className={row.remainingBalance >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {formatTzs(row.remainingBalance)}
                        </td>
                        <td className={row.estimatedProfitLoss >= 0 ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                          {formatTzs(row.estimatedProfitLoss)}
                        </td>
                        <td className="min-w-[120px]">
                          <BudgetBar spent={row.totalSpent} total={row.contractValue} />
                        </td>
                        <td>
                          <span className={
                            row.status === "Active"
                              ? "text-sm font-medium text-emerald-700"
                              : row.status === "Completed"
                                ? "text-sm font-medium text-blue-700"
                                : row.status === "On Hold"
                                  ? "text-sm font-medium text-amber-700"
                                  : "text-sm font-medium text-red-600"
                          }>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  {totals && filteredProjectCost.length > 1 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold text-slate-900">
                        <td colSpan={2} className="px-3 py-3 text-xs uppercase tracking-wider">Totals</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.contractValue, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.amountReceived, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.laborCost, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.materialCost, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.otherExpenses, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.totalSpent, 0))}</td>
                        <td className="px-3 py-3 text-emerald-700">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.remainingBalance, 0))}</td>
                        <td className="px-3 py-3">{formatTzs(filteredProjectCost.reduce((s, r) => s + r.estimatedProfitLoss, 0))}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <TablePagination
                endIndex={costPagination.endIndex}
                itemLabel="projects"
                onPageChange={costPagination.setPage}
                onPageSizeChange={costPagination.setPageSize}
                page={costPagination.page}
                pageSize={costPagination.pageSize}
                startIndex={costPagination.startIndex}
                totalCount={costPagination.totalCount}
                totalPages={costPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}

      {/* LABOR REPORT */}
      {activeTab === "Labor Report" && (
        <SurfaceCard title="Labor Payment Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredLabor.length === 0 ? (
            <EmptyState description="No labor data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[700px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project / Site</th>
                      <th>Workers</th>
                      <th>Total Paid</th>
                      <th>Outstanding</th>
                      <th>Total Labor Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborPagination.paginatedRows.map((row, index) => (
                      <tr key={`labor-${index}`}>
                        <td>{laborPagination.startIndex + index + 1}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{row.workerCount}</td>
                        <td className="text-emerald-700">{formatTzs(row.totalPaid)}</td>
                        <td className={row.outstanding > 0 ? "text-amber-700" : "text-emerald-700"}>
                          {formatTzs(row.outstanding)}
                        </td>
                        <td className="font-medium">{formatTzs(row.totalPaid + row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={laborPagination.endIndex}
                itemLabel="projects"
                onPageChange={laborPagination.setPage}
                onPageSizeChange={laborPagination.setPageSize}
                page={laborPagination.page}
                pageSize={laborPagination.pageSize}
                startIndex={laborPagination.startIndex}
                totalCount={laborPagination.totalCount}
                totalPages={laborPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}

      {/* MATERIAL REPORT */}
      {activeTab === "Material Report" && (
        <SurfaceCard title="Material Purchase Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredMaterial.length === 0 ? (
            <EmptyState description="No material data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[600px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project / Site</th>
                      <th>Purchases</th>
                      <th>Total Material Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPagination.paginatedRows.map((row, index) => (
                      <tr key={`mat-${index}`}>
                        <td>{materialPagination.startIndex + index + 1}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{row.purchaseCount}</td>
                        <td className="font-medium text-amber-700">{formatTzs(row.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={materialPagination.endIndex}
                itemLabel="projects"
                onPageChange={materialPagination.setPage}
                onPageSizeChange={materialPagination.setPageSize}
                page={materialPagination.page}
                pageSize={materialPagination.pageSize}
                startIndex={materialPagination.startIndex}
                totalCount={materialPagination.totalCount}
                totalPages={materialPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}

      {/* EXPENSE REPORT */}
      {activeTab === "Expense Report" && (
        <div className="space-y-4">
          <SurfaceCard title="Expenses by Project">
            {loading ? (
              <SkeletonTable rows={4} />
            ) : filteredExpenseByProject.length === 0 ? (
              <EmptyState description="No expense data available." title="No data" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[600px]">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Project / Site</th>
                        <th>Entries</th>
                        <th>Total Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensePagination.paginatedRows.map((row, index) => (
                        <tr key={`exp-${index}`}>
                          <td>{expensePagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.projectName}</td>
                          <td>{row.expenseCount}</td>
                          <td className="font-medium text-amber-700">{formatTzs(row.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  endIndex={expensePagination.endIndex}
                  itemLabel="projects"
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

          <SurfaceCard title="Expenses by Category">
            {(data?.expenseByCategory ?? []).length === 0 ? (
              <EmptyState description="No category data." title="No data" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[400px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Category</th>
                      <th>Entries</th>
                      <th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.expenseByCategory ?? []).map((row, index) => (
                      <tr key={`cat-${row.category}`}>
                        <td>{index + 1}</td>
                        <td className="font-medium text-slate-900">{row.category}</td>
                        <td>{row.count}</td>
                        <td className="font-medium text-amber-700">{formatTzs(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </div>
      )}

      {/* PAYMENT REPORT */}
      {activeTab === "Payment Report" && (
        <SurfaceCard title="Client Payment Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState description="No payment data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[700px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project / Site</th>
                      <th>Total Expected</th>
                      <th>Total Received</th>
                      <th>Outstanding Balance</th>
                      <th>Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentPagination.paginatedRows.map((row, index) => (
                        <tr key={`pay-${index}`}>
                          <td>{paymentPagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.projectName}</td>
                          <td>{formatTzs(row.totalExpected)}</td>
                          <td className="text-emerald-700">{formatTzs(row.totalReceived)}</td>
                          <td className={row.totalBalance > 0 ? "text-amber-700" : "text-emerald-700"}>
                            {formatTzs(row.totalBalance)}
                          </td>
                          <td>
                            <BudgetBar spent={row.totalReceived} total={row.totalExpected} />
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={paymentPagination.endIndex}
                itemLabel="projects"
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
      )}

      {/* BUDGET VARIANCE */}
      {activeTab === "Budget Variance" && (
        <SurfaceCard title="Budget Variance Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredBudgetVariance.length === 0 ? (
            <EmptyState description="No budget data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[800px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project</th>
                      <th>Contract Value</th>
                      <th>Total Spent</th>
                      <th>Variance</th>
                      <th>Budget Used</th>
                      <th>Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variancePagination.paginatedRows.map((row, index) => {
                      const health =
                        row.variancePct >= 90
                          ? "Critical"
                          : row.variancePct >= 70
                            ? "Warning"
                            : "Healthy";
                      return (
                        <tr key={`var-${index}`}>
                          <td>{variancePagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.projectName}</td>
                          <td>{formatTzs(row.contractValue)}</td>
                          <td>{formatTzs(row.totalSpent)}</td>
                          <td className={row.variance >= 0 ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                            {formatTzs(row.variance)}
                          </td>
                          <td className="min-w-[140px]">
                            <BudgetBar spent={row.totalSpent} total={row.contractValue} />
                          </td>
                          <td>
                            <span className={
                              health === "Critical"
                                ? "text-sm font-medium text-red-600"
                                : health === "Warning"
                                  ? "text-sm font-medium text-amber-700"
                                  : "text-sm font-medium text-emerald-700"
                            }>
                              {health}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={variancePagination.endIndex}
                itemLabel="projects"
                onPageChange={variancePagination.setPage}
                onPageSizeChange={variancePagination.setPageSize}
                page={variancePagination.page}
                pageSize={variancePagination.pageSize}
                startIndex={variancePagination.startIndex}
                totalCount={variancePagination.totalCount}
                totalPages={variancePagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}
    </div>
  );
};
