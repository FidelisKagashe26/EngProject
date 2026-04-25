import { Clock3, FilePlus2, HandCoins, Pencil, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StackedCostBar } from "../components/charts";
import { ProgressBar, SectionTitle, StatusBadge, SurfaceCard } from "../components/ui";
import { projects as fallbackProjects, recentActivities } from "../data/mockData";
import { api, type ProjectApiRecord } from "../services/api";
import { formatTzs } from "../utils/format";

const projectTabs = [
  "Overview",
  "Contract",
  "Labor",
  "Materials",
  "Expenses",
  "Payments",
  "Documents",
  "Reports",
  "Activity Log",
] as const;

type ProjectTab = (typeof projectTabs)[number];

type ViewProject = {
  id: string;
  name: string;
  site: string;
  client: string;
  contractNumber: string;
  contractValue: number;
  amountReceived: number;
  spent: number;
  status: string;
  progress: number;
  pendingPayments: number;
};

const toViewProject = (row: ProjectApiRecord): ViewProject => ({
  id: row.id,
  name: row.name,
  site: row.siteLocation,
  client: row.clientName,
  contractNumber: row.contractNumber,
  contractValue: row.contractValue,
  amountReceived: row.amountReceived,
  spent: row.totalSpent,
  status: row.status,
  progress: row.progress,
  pendingPayments: row.pendingClientPayments,
});

const fallbackRows: ViewProject[] = fallbackProjects.map((project) => ({
  id: project.id,
  name: project.name,
  site: project.site,
  client: project.client,
  contractNumber: project.contractNumber,
  contractValue: project.contractValue,
  amountReceived: project.amountReceived,
  spent: project.spent,
  status: project.status,
  progress: project.progress,
  pendingPayments: project.pendingPayments,
}));

const getFallbackProject = (projectId?: string): ViewProject => {
  if (projectId) {
    const matched = fallbackRows.find((row) => row.id === projectId);
    if (matched) return matched;
  }
  return fallbackRows[0];
};

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<ProjectTab>("Overview");
  const [project, setProject] = useState<ViewProject>(getFallbackProject(projectId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) {
      setProject(getFallbackProject(undefined));
      setError("Project ID missing. Showing local preview data.");
      setLoading(false);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getProjectById(projectId);
        if (mounted) {
          setProject(toViewProject(response));
          setError("");
        }
      } catch {
        if (mounted) {
          setProject(getFallbackProject(projectId));
          setError("Using local project preview data. Backend API is not reachable yet.");
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
  }, [projectId]);

  const remainingBalance = project.contractValue - project.spent;
  const estimatedProfit = project.amountReceived - project.spent;
  const budgetUsed = project.contractValue > 0
    ? Math.round((project.spent / project.contractValue) * 100)
    : 0;
  const pendingPayments = project.pendingPayments;

  const tabContent = useMemo(() => {
    if (activeTab === "Overview") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SurfaceCard title="Financial Summary">
              <p className="text-xs text-slate-500">Contract Value</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatTzs(project.contractValue)}</p>
              <p className="mt-3 text-xs text-slate-500">Amount Received</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{formatTzs(project.amountReceived)}</p>
            </SurfaceCard>
            <SurfaceCard title="Spending Breakdown">
              <StackedCostBar labor={18_200_000} material={21_600_000} operations={8_700_000} />
            </SurfaceCard>
            <SurfaceCard title="Progress Timeline">
              <ul className="space-y-2 text-sm text-slate-600">
                <li>Survey complete - 100%</li>
                <li>Excavation phase - 75%</li>
                <li>Pipe laying - 42%</li>
                <li>Final finishing - Pending</li>
              </ul>
            </SurfaceCard>
            <SurfaceCard title="Alerts">
              <p className="text-sm text-amber-700">
                Budget variance reached 9% due to fuel and transport.
              </p>
            </SurfaceCard>
          </div>

          <SurfaceCard title="Budget vs Actual Comparison">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="metric-tile">
                <p className="metric-label">Planned Budget</p>
                <p className="metric-value">{formatTzs(50_000_000)}</p>
              </div>
              <div className="metric-tile">
                <p className="metric-label">Actual Spent</p>
                <p className="metric-value">{formatTzs(project.spent)}</p>
              </div>
              <div className="metric-tile">
                <p className="metric-label">Variance</p>
                <p className="metric-value text-red-700">{formatTzs(project.spent - 50_000_000)}</p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Recent Activities">
            <ul className="space-y-2 text-sm text-slate-700">
              {recentActivities.map((activity) => (
                <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" key={activity}>
                  {activity}
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </div>
      );
    }

    return (
      <SurfaceCard title={`${activeTab} Workspace`}>
        <p className="text-sm text-slate-600">
          This tab is prepared for full module workflows including records, approvals,
          and documents for the selected project.
        </p>
      </SurfaceCard>
    );
  }, [activeTab, project.amountReceived, project.contractValue, project.spent]);

  return (
    <div className="space-y-6">
      {error && (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      )}

      {loading ? (
        <SurfaceCard>
          <div className="flex items-center justify-center py-6">
            <div className="global-loader-shell" aria-hidden="true">
              <span className="global-loader-ring global-loader-ring-a" />
              <span className="global-loader-ring global-loader-ring-b" />
              <span className="global-loader-core" />
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <SectionTitle
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary" to={`/projects/${encodeURIComponent(project.id)}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit Project
            </Link>
            <Link className="btn-secondary" to="/expenses#add-expense-form">
              <FilePlus2 className="h-4 w-4" />
              Add Expense
            </Link>
            <Link className="btn-secondary" to="/payments#add-payment-form">
              <HandCoins className="h-4 w-4" />
              Add Payment
            </Link>
          </div>
        }
        subtitle={`${project.site} | ${project.client}`}
        title={project.name || "Project Detail"}
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge status={project.status} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Progress</p>
            <div className="mt-2">
              <ProgressBar value={project.progress} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Contract Value</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{formatTzs(project.contractValue)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wider text-slate-500">Quick Actions</p>
            <div className="mt-2 flex gap-2 text-xs">
              <Link className="btn-secondary !px-2 !py-1" to="/expenses#add-expense-form">Expense</Link>
              <Link className="btn-secondary !px-2 !py-1" to="/payments#add-payment-form">Payment</Link>
              <Link className="btn-secondary !px-2 !py-1" to="/materials#add-material-purchase-form">Material</Link>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
        <SurfaceCard className="xl:col-span-1" title="Contract Value">
          <p className="text-lg font-bold text-slate-900">{formatTzs(project.contractValue)}</p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Amount Received">
          <p className="text-lg font-bold text-slate-900">{formatTzs(project.amountReceived)}</p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Total Spent">
          <p className="text-lg font-bold text-slate-900">{formatTzs(project.spent)}</p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Remaining Balance">
          <p className="text-lg font-bold text-emerald-700">{formatTzs(remainingBalance)}</p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Estimated Profit/Loss">
          <p className={`text-lg font-bold ${estimatedProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatTzs(estimatedProfit)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Pending Payments">
          <p className="text-lg font-bold text-amber-700">{formatTzs(pendingPayments)}</p>
        </SurfaceCard>
        <SurfaceCard className="xl:col-span-1" title="Budget Used %">
          <div className="space-y-2">
            <p className="text-lg font-bold text-slate-900">{budgetUsed}%</p>
            <ProgressBar value={budgetUsed} />
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <div className="flex flex-wrap gap-2">
          {projectTabs.map((tab) => (
            <button
              className={
                tab === activeTab
                  ? "rounded-full bg-[#0b2a53] px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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

      {tabContent}

      <SurfaceCard title="Project Timeline">
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Clock3 className="mt-0.5 h-4 w-4 text-[#0b2a53]" />
            Contract mobilization completed.
          </p>
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <WalletCards className="mt-0.5 h-4 w-4 text-[#0b2a53]" />
            Client milestone invoice submitted for phase 2.
          </p>
        </div>
      </SurfaceCard>
    </div>
  );
};
