import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  HandCoins,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart, IncomeExpenseChart } from "../components/charts";
import {
  AlertCallout,
  KpiCard,
  ProgressBar,
  SectionTitle,
  SkeletonCards,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import {
  budgetAlerts,
  monthlyFinance,
  projectStatusBreakdown,
  projects,
  recentActivities,
} from "../data/mockData";
import { useTablePagination } from "../hooks/useTablePagination";
import { api, type DashboardResponse } from "../services/api";
import { formatDateTime, formatTzs } from "../utils/format";

const statusColorMap: Record<string, string> = {
  Active: "#0b2a53",
  Completed: "#1f8a4c",
  "On Hold": "#d97706",
  "Over Budget": "#c0392b",
  Pending: "#f59e0b",
};

const fallbackDashboard: DashboardResponse = {
  summary: {
    totalProjects: 24,
    activeSites: 8,
    totalContractValue: 485_000_000,
    totalAmountReceived: 210_000_000,
    totalExpenses: 156_400_000,
    estimatedProfit: 53_600_000,
    pendingClientPayments: 139_000_000,
    overBudgetProjects: 2,
  },
  monthlyFinance,
  statusBreakdown: projectStatusBreakdown.map((item) => ({
    label: item.label,
    value: item.value,
  })),
  recentProjects: projects.map((project) => ({
    id: project.id,
    name: project.name,
    site: project.site,
    client: project.client,
    contractValue: project.contractValue,
    spent: project.spent,
    balance: project.contractValue - project.spent,
    status: project.status,
    progress: project.progress,
  })),
  alerts: budgetAlerts.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    priority: item.priority,
    createdAt: "",
  })),
  recentActivities: recentActivities.map((item, index) => ({
    id: String(index),
    title: "Recent Activity",
    module: "General",
    description: item,
    createdAt: new Date(Date.now() - index * 30 * 60 * 1000).toISOString(),
  })),
};

export const DashboardPage = () => {
  const [dashboard, setDashboard] = useState<DashboardResponse>(fallbackDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getDashboard();
        if (mounted) {
          setDashboard(response);
          setError("");
        }
      } catch (requestError) {
        if (mounted) {
          setDashboard(fallbackDashboard);
          setError("Using local preview data. Backend API is not reachable yet.");
        }
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

  const donutData = useMemo(
    () =>
      dashboard.statusBreakdown.map((item) => ({
        ...item,
        color: statusColorMap[item.label] ?? "#64748b",
      })),
    [dashboard.statusBreakdown],
  );
  const recentProjectsPagination = useTablePagination(dashboard.recentProjects);

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <div className="flex gap-2">
            <button className="btn-accent">Export Snapshot</button>
          </div>
        }
        subtitle="Cross-project financial visibility for active engineering sites."
        title="Main Dashboard"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      )}

      {loading ? (
        <SkeletonCards />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            label="Total Projects"
            meta="Registered projects"
            value={String(dashboard.summary.totalProjects)}
          />
          <KpiCard
            icon={<Landmark className="h-4 w-4" />}
            label="Active Sites"
            meta="Running sites"
            value={String(dashboard.summary.activeSites)}
          />
          <KpiCard
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Total Contract Value"
            meta="TZS portfolio value"
            value={formatTzs(dashboard.summary.totalContractValue)}
          />
          <KpiCard
            icon={<Wallet className="h-4 w-4" />}
            label="Total Amount Received"
            meta="Client inflows"
            value={formatTzs(dashboard.summary.totalAmountReceived)}
          />
          <KpiCard
            icon={<TrendingDown className="h-4 w-4" />}
            label="Total Expenses"
            meta="Execution outflows"
            value={formatTzs(dashboard.summary.totalExpenses)}
          />
          <KpiCard
            accent
            icon={<TrendingUp className="h-4 w-4" />}
            label="Estimated Profit"
            meta="Net margin estimate"
            value={formatTzs(dashboard.summary.estimatedProfit)}
          />
          <KpiCard
            icon={<HandCoins className="h-4 w-4" />}
            label="Pending Client Payments"
            meta="Receivables pending"
            value={formatTzs(dashboard.summary.pendingClientPayments)}
          />
          <KpiCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Over Budget Projects"
            meta="Risk projects"
            value={String(dashboard.summary.overBudgetProjects)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard subtitle="Monthly Income vs Expenses (Jan-Jun)" title="Financial Overview">
          <IncomeExpenseChart data={dashboard.monthlyFinance} />
        </SurfaceCard>

        <SurfaceCard subtitle="Active, completed and risk distribution" title="Project Status">
          <DonutChart data={donutData} />
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SurfaceCard
          className="xl:col-span-2"
          right={<Link className="text-xs font-semibold text-[var(--primary)] hover:opacity-90" to="/projects">View all</Link>}
          title="Recent Projects"
        >
          {loading ? (
            <SkeletonTable rows={4} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[920px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Project Name</th>
                      <th>Site Location</th>
                      <th>Client</th>
                      <th>Contract Value</th>
                      <th>Spent</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProjectsPagination.paginatedRows.map((project, index) => (
                      <tr key={project.id}>
                        <td>{recentProjectsPagination.startIndex + index + 1}</td>
                        <td>{project.name}</td>
                        <td>{project.site}</td>
                        <td>{project.client}</td>
                        <td>{formatTzs(project.contractValue)}</td>
                        <td>{formatTzs(project.spent)}</td>
                        <td className={project.balance >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {formatTzs(project.balance)}
                        </td>
                        <td>
                          <StatusBadge status={project.status} />
                        </td>
                        <td>
                          <ProgressBar value={project.progress} />
                        </td>
                        <td>
                          <Link
                            className="btn-secondary !px-2 !py-1 text-xs"
                            to={`/projects/${encodeURIComponent(project.id)}`}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={recentProjectsPagination.endIndex}
                itemLabel="projects"
                onPageChange={recentProjectsPagination.setPage}
                onPageSizeChange={recentProjectsPagination.setPageSize}
                page={recentProjectsPagination.page}
                pageSize={recentProjectsPagination.pageSize}
                startIndex={recentProjectsPagination.startIndex}
                totalCount={recentProjectsPagination.totalCount}
                totalPages={recentProjectsPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>

        <div className="space-y-4 xl:col-span-1">
          <SurfaceCard title="Overspending / Budget Alerts">
            <div className="space-y-4">
              {dashboard.alerts.map((alert) => (
                <AlertCallout
                  key={alert.id}
                  text={alert.subtitle}
                  title={alert.title}
                  tone={
                    alert.priority === "High"
                      ? "danger"
                      : alert.priority === "Medium"
                        ? "warning"
                        : "info"
                  }
                />
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Recent Activities">
            <ul className="space-y-3 text-sm text-slate-700">
              {dashboard.recentActivities.map((activity) => (
                <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" key={activity.id}>
                  <p className="text-sm text-slate-700">{activity.description}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">{activity.module}</span>
                    <time dateTime={activity.createdAt}>
                      {formatDateTime(activity.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard subtitle="Current quarter trend" title="Financial Pulse">
            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#0b2a53]" />
                  Income
                </span>
                <span className="font-semibold text-emerald-700">
                  {formatTzs(dashboard.summary.totalAmountReceived)}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Expenses</span>
                <span className="font-semibold text-red-700">{formatTzs(dashboard.summary.totalExpenses)}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Projected Net Position</span>
                <span className="font-semibold text-[#0b2a53]">
                  {formatTzs(dashboard.summary.estimatedProfit)}
                </span>
              </p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};
