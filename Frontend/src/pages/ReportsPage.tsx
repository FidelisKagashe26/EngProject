import { useEffect, useMemo, useState } from "react";
import { IncomeExpenseChart } from "../components/charts";
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
import { formatDate, formatTzs } from "../utils/format";

type ReportCategory =
  | "project-cost-summary"
  | "income-expense"
  | "payments"
  | "labor"
  | "materials"
  | "expenses-by-category";

const REPORT_CATEGORIES: Array<{ value: ReportCategory; label: string; help: string }> = [
  {
    value: "project-cost-summary",
    label: "Project Summary",
    help: "Snapshot of contract value, receipts, spending, profit/loss, and status per project.",
  },
  {
    value: "income-expense",
    label: "Income vs Expense",
    help: "Shows incoming funds versus spending for each project.",
  },
  {
    value: "payments",
    label: "Client Payments",
    help: "Tracks expected amount, received amount, and outstanding balance.",
  },
  {
    value: "labor",
    label: "Labor Cost",
    help: "Detailed labour payments by worker, payment type, rate, paid, and outstanding amounts.",
  },
  {
    value: "materials",
    label: "Material Cost",
    help: "Detailed material purchases including quantity, unit cost, and total cost.",
  },
  {
    value: "expenses-by-category",
    label: "Expense Categories",
    help: "Breakdown of expenses by project and category to identify top cost drivers.",
  },
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
  const [projectFilter, setProjectFilter] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("project-cost-summary");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");
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
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProjectCost = useMemo<ReportProjectCostRow[]>(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.projectCostSummary;
    return data.projectCostSummary.filter((row) => row.id === projectFilter);
  }, [data, projectFilter]);

  const selectedProjectName = useMemo(() => {
    if (projectFilter === "All") return "";
    return projects.find((project) => project.id === projectFilter)?.name ?? "";
  }, [projectFilter, projects]);

  const filteredLabor = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.laborDetails;
    return data.laborDetails.filter(
      (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
    );
  }, [data, projectFilter, selectedProjectName]);

  const filteredMaterial = useMemo(() => {
    if (!data) return [];
    if (projectFilter === "All") return data.materialPurchaseDetails;
    return data.materialPurchaseDetails.filter(
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

  const scopedExpenseCategoryRows = useMemo(() => {
    if (!data) return [];
    let rows = data.expenseByCategoryByProject;
    if (projectFilter !== "All") {
      rows = rows.filter(
        (row) => row.projectId === projectFilter || row.projectName === selectedProjectName,
      );
    }
    if (expenseCategoryFilter !== "All") {
      rows = rows.filter((row) => row.category === expenseCategoryFilter);
    }
    return rows;
  }, [data, expenseCategoryFilter, projectFilter, selectedProjectName]);

  const categorySummaryRows = useMemo(() => {
    const grouped = scopedExpenseCategoryRows.reduce<Record<string, { count: number; total: number }>>(
      (acc, row) => {
        const key = row.category;
        const current = acc[key] ?? { count: 0, total: 0 };
        current.count += row.count;
        current.total += row.total;
        acc[key] = current;
        return acc;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([category, summary]) => ({
        category,
        count: summary.count,
        total: summary.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [scopedExpenseCategoryRows]);

  const incomeStatementRows = useMemo(
    () =>
      filteredProjectCost.map((row) => {
        const marginPct = row.amountReceived > 0
          ? (row.estimatedProfitLoss / row.amountReceived) * 100
          : 0;
        return {
          id: row.id,
          projectName: row.projectName,
          income: row.amountReceived,
          expenses: row.totalSpent,
          net: row.estimatedProfitLoss,
          marginPct,
        };
      }),
    [filteredProjectCost],
  );

  const scopeTotals = useMemo(
    () =>
      filteredProjectCost.reduce(
        (acc, row) => {
          acc.contractValue += row.contractValue;
          acc.amountReceived += row.amountReceived;
          acc.totalSpent += row.totalSpent;
          acc.estimatedProfitLoss += row.estimatedProfitLoss;
          acc.pendingClientPayments += row.pendingClientPayments;
          return acc;
        },
        {
          contractValue: 0,
          amountReceived: 0,
          totalSpent: 0,
          estimatedProfitLoss: 0,
          pendingClientPayments: 0,
        },
      ),
    [filteredProjectCost],
  );

  const monthlyChartData = useMemo(() => {
    if (!data) return [];
    return data.monthlyExpenseTrend.map((row) => ({
      month: row.month.split(" ")[0],
      income: 0,
      expenses: row.total,
    }));
  }, [data]);

  const expenseCategoryOptions = useMemo(
    () =>
      Array.from(new Set((data?.expenseByCategoryByProject ?? []).map((row) => row.category))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [data],
  );

  const selectedCategoryInfo = useMemo(
    () =>
      REPORT_CATEGORIES.find((item) => item.value === selectedCategory) ?? REPORT_CATEGORIES[0],
    [selectedCategory],
  );

  const overviewPagination = useTablePagination(filteredProjectCost);
  const incomePagination = useTablePagination(incomeStatementRows);
  const laborPagination = useTablePagination(filteredLabor);
  const materialPagination = useTablePagination(filteredMaterial);
  const expenseProjectPagination = useTablePagination(filteredExpenseByProject);
  const paymentPagination = useTablePagination(filteredPayments);
  const expenseCategoryPagination = useTablePagination(categorySummaryRows);

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
      const reportType: PdfReportType = selectedCategory;
      const { blob, filename } = await api.downloadReportPdf({
        reportType,
        projectId: projectFilter === "All" ? undefined : projectFilter,
        category:
          selectedCategory === "expenses-by-category" && expenseCategoryFilter !== "All"
            ? expenseCategoryFilter
            : undefined,
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
        subtitle="Choose a report category, apply filters, and export a standard PDF."
        title="Reports"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Contract Value">
          <p className="text-2xl font-bold text-[#0b2a53]">{formatTzs(scopeTotals.contractValue)}</p>
        </SurfaceCard>
        <SurfaceCard title="Amount Received">
          <p className="text-2xl font-bold text-emerald-700">{formatTzs(scopeTotals.amountReceived)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Spent">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(scopeTotals.totalSpent)}</p>
        </SurfaceCard>
        <SurfaceCard title="Profit / Loss">
          <p
            className={`text-2xl font-bold ${
              scopeTotals.estimatedProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatTzs(scopeTotals.estimatedProfitLoss)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Pending Client Payments">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(scopeTotals.pendingClientPayments)}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard
        subtitle="The selected category controls both on-screen data and the downloaded PDF."
        title="Report Controls"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="form-field">
            <span className="text-sm">Project / Site</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setProjectFilter(event.target.value)}
              value={projectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((project) => (
                <option key={`rp-${project.id}`} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </label>

          <label className="form-field">
            <span className="text-sm">Report Category</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setSelectedCategory(event.target.value as ReportCategory)}
              value={selectedCategory}
            >
              {REPORT_CATEGORIES.map((category) => (
                <option key={`rc-${category.value}`} value={category.value}>
                  {category.label}
                </option>
              ))}
            </GuiSelect>
          </label>

          {selectedCategory === "expenses-by-category" ? (
            <label className="form-field">
              <span className="text-sm">Expense Category (Optional)</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setExpenseCategoryFilter(event.target.value)}
                value={expenseCategoryFilter}
              >
                <option value="All">All Categories</option>
                {expenseCategoryOptions.map((category) => (
                  <option key={`expense-category-${category}`} value={category}>
                    {category}
                  </option>
                ))}
              </GuiSelect>
            </label>
          ) : (
            <div />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-field">
              <span className="text-sm">From Date</span>
              <input
                className="input-field"
                onChange={(event) => setPdfFromDate(event.target.value)}
                type="date"
                value={pdfFromDate}
              />
            </label>
            <label className="form-field">
              <span className="text-sm">To Date</span>
              <input
                className="input-field"
                onChange={(event) => setPdfToDate(event.target.value)}
                type="date"
                value={pdfToDate}
              />
            </label>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-600">{selectedCategoryInfo.help}</p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="btn-primary w-full justify-center sm:w-auto"
            disabled={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
            type="button"
          >
            {downloadingPdf ? "Generating PDF..." : "Download Standard PDF"}
          </button>
          {pdfDownloadMessage && (
            <p className={`text-xs ${pdfDownloadError ? "text-red-700" : "text-emerald-700"}`}>
              {pdfDownloadMessage}
            </p>
          )}
        </div>
      </SurfaceCard>

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      {selectedCategory === "project-cost-summary" && (
        <SurfaceCard title="Project Summary Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredProjectCost.length === 0 ? (
            <EmptyState description="No project data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project</th>
                      <th>Contract Value</th>
                      <th>Amount Received</th>
                      <th>Total Spent</th>
                      <th>Profit / Loss</th>
                      <th>Pending Client Payment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewPagination.paginatedRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{overviewPagination.startIndex + index + 1}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{formatTzs(row.contractValue)}</td>
                        <td>{formatTzs(row.amountReceived)}</td>
                        <td>{formatTzs(row.totalSpent)}</td>
                        <td className={row.estimatedProfitLoss >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {formatTzs(row.estimatedProfitLoss)}
                        </td>
                        <td className={row.pendingClientPayments > 0 ? "text-amber-700" : "text-emerald-700"}>
                          {formatTzs(row.pendingClientPayments)}
                        </td>
                        <td>
                          <span
                            className={
                              row.status === "Active"
                                ? "text-sm font-medium text-emerald-700"
                                : row.status === "Completed"
                                  ? "text-sm font-medium text-blue-700"
                                  : row.status === "On Hold"
                                    ? "text-sm font-medium text-amber-700"
                                    : "text-sm font-medium text-red-600"
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={overviewPagination.endIndex}
                itemLabel="projects"
                onPageChange={overviewPagination.setPage}
                onPageSizeChange={overviewPagination.setPageSize}
                page={overviewPagination.page}
                pageSize={overviewPagination.pageSize}
                startIndex={overviewPagination.startIndex}
                totalCount={overviewPagination.totalCount}
                totalPages={overviewPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}

      {selectedCategory === "income-expense" && (
        <div className="space-y-4">
          {monthlyChartData.length > 0 && (
            <SurfaceCard title="Monthly Expense Trend">
              <IncomeExpenseChart data={monthlyChartData} />
            </SurfaceCard>
          )}

          <SurfaceCard title="Income vs Expense Statement">
            {loading ? (
              <SkeletonTable rows={4} />
            ) : incomeStatementRows.length === 0 ? (
              <EmptyState description="No financial data available." title="No data" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[850px]">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Project</th>
                        <th>Income</th>
                        <th>Expenses</th>
                        <th>Net</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomePagination.paginatedRows.map((row, index) => (
                        <tr key={`income-${row.id}`}>
                          <td>{incomePagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.projectName}</td>
                          <td className="text-emerald-700">{formatTzs(row.income)}</td>
                          <td className="text-amber-700">{formatTzs(row.expenses)}</td>
                          <td className={row.net >= 0 ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                            {formatTzs(row.net)}
                          </td>
                          <td className={row.marginPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                            {row.marginPct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  endIndex={incomePagination.endIndex}
                  itemLabel="projects"
                  onPageChange={incomePagination.setPage}
                  onPageSizeChange={incomePagination.setPageSize}
                  page={incomePagination.page}
                  pageSize={incomePagination.pageSize}
                  startIndex={incomePagination.startIndex}
                  totalCount={incomePagination.totalCount}
                  totalPages={incomePagination.totalPages}
                />
              </>
            )}
          </SurfaceCard>
        </div>
      )}

      {selectedCategory === "payments" && (
        <SurfaceCard title="Client Payment Report">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState description="No payment data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[760px]">
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
                        <td className="min-w-[140px]">
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

      {selectedCategory === "labor" && (
        <SurfaceCard title="Labor Payment Report (Detailed)">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredLabor.length === 0 ? (
            <EmptyState description="No labor data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Worker</th>
                      <th>Project / Site</th>
                      <th>Payment Type</th>
                      <th>Rate</th>
                      <th>Total Paid</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborPagination.paginatedRows.map((row, index) => (
                      <tr key={`labor-${row.workerId}`}>
                        <td>{laborPagination.startIndex + index + 1}</td>
                        <td className="font-medium text-slate-900">{row.workerName}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{row.paymentType}</td>
                        <td>{formatTzs(row.rateAmount)}</td>
                        <td className="text-emerald-700">{formatTzs(row.totalPaid)}</td>
                        <td className={row.outstandingAmount > 0 ? "text-amber-700" : "text-emerald-700"}>
                          {formatTzs(row.outstandingAmount)}
                        </td>
                        <td>
                          <span
                            className={
                              row.status === "Active"
                                ? "text-sm font-medium text-emerald-700"
                                : row.status === "Inactive"
                                  ? "text-sm font-medium text-red-600"
                                  : "text-sm font-medium text-slate-700"
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={laborPagination.endIndex}
                itemLabel="workers"
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

      {selectedCategory === "materials" && (
        <SurfaceCard title="Material Purchase Report (Detailed)">
          {loading ? (
            <SkeletonTable rows={4} />
          ) : filteredMaterial.length === 0 ? (
            <EmptyState description="No material data available." title="No data" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1120px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Date</th>
                      <th>Project / Site</th>
                      <th>Material</th>
                      <th>Supplier</th>
                      <th>Qty Purchased</th>
                      <th>Unit Cost</th>
                      <th>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialPagination.paginatedRows.map((row, index) => (
                      <tr key={`material-${row.purchaseId}`}>
                        <td>{materialPagination.startIndex + index + 1}</td>
                        <td>{formatDate(row.purchaseDate)}</td>
                        <td className="font-medium text-slate-900">{row.projectName}</td>
                        <td>{row.materialName}</td>
                        <td>{row.supplierName}</td>
                        <td>{row.quantityPurchased.toLocaleString("en-TZ")}</td>
                        <td>{formatTzs(row.unitCost)}</td>
                        <td className="font-medium text-amber-700">{formatTzs(row.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={materialPagination.endIndex}
                itemLabel="purchases"
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

      {selectedCategory === "expenses-by-category" && (
        <div className="space-y-4">
          <SurfaceCard title="Expenses by Project">
            {loading ? (
              <SkeletonTable rows={4} />
            ) : filteredExpenseByProject.length === 0 ? (
              <EmptyState description="No expense data available." title="No data" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[620px]">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Project / Site</th>
                        <th>Entries</th>
                        <th>Total Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseProjectPagination.paginatedRows.map((row, index) => (
                        <tr key={`exp-project-${index}`}>
                          <td>{expenseProjectPagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.projectName}</td>
                          <td>{row.expenseCount}</td>
                          <td className="font-medium text-amber-700">{formatTzs(row.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  endIndex={expenseProjectPagination.endIndex}
                  itemLabel="projects"
                  onPageChange={expenseProjectPagination.setPage}
                  onPageSizeChange={expenseProjectPagination.setPageSize}
                  page={expenseProjectPagination.page}
                  pageSize={expenseProjectPagination.pageSize}
                  startIndex={expenseProjectPagination.startIndex}
                  totalCount={expenseProjectPagination.totalCount}
                  totalPages={expenseProjectPagination.totalPages}
                />
              </>
            )}
          </SurfaceCard>

          <SurfaceCard title="Expense Categories">
            {loading ? (
              <SkeletonTable rows={4} />
            ) : categorySummaryRows.length === 0 ? (
              <EmptyState description="No category data available for selected filters." title="No data" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Category</th>
                        <th>Entries</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseCategoryPagination.paginatedRows.map((row, index) => (
                        <tr key={`expense-category-${row.category}`}>
                          <td>{expenseCategoryPagination.startIndex + index + 1}</td>
                          <td className="font-medium text-slate-900">{row.category}</td>
                          <td>{row.count}</td>
                          <td className="font-medium text-amber-700">{formatTzs(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  endIndex={expenseCategoryPagination.endIndex}
                  itemLabel="categories"
                  onPageChange={expenseCategoryPagination.setPage}
                  onPageSizeChange={expenseCategoryPagination.setPageSize}
                  page={expenseCategoryPagination.page}
                  pageSize={expenseCategoryPagination.pageSize}
                  startIndex={expenseCategoryPagination.startIndex}
                  totalCount={expenseCategoryPagination.totalCount}
                  totalPages={expenseCategoryPagination.totalPages}
                />
              </>
            )}
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
