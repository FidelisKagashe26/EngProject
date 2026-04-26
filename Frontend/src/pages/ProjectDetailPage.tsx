import { Clock3, FilePlus2, HandCoins, Pencil, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { StackedCostBar } from "../components/charts";
import { ProgressBar, SectionTitle, StatusBadge, SurfaceCard } from "../components/ui";
import { projects as fallbackProjects, recentActivities } from "../data/mockData";
import { api, type ProjectApiRecord, type TenderApiRecord } from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

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
  startDate: string;
  endDate: string;
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
  startDate: row.startDate,
  endDate: row.expectedCompletionDate,
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
  startDate: project.startDate,
  endDate: project.endDate,
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

const toProjectFallbackContract = (project: ViewProject): TenderApiRecord => ({
  id: `local-contract-${project.id}`,
  projectId: project.id,
  projectName: project.name,
  siteLocation: project.site,
  clientName: project.client,
  contractNo: project.contractNumber,
  tenderAmount: project.contractValue,
  contractSum: project.contractValue,
  amountReceived: project.amountReceived,
  totalSpent: project.spent,
  remainingBalance: project.contractValue - project.spent,
  pendingClientPayments: project.pendingPayments,
  paymentTerms:
    "Milestone-based client payments with retention release at practical completion.",
  milestones:
    "Mobilization, sub-structure completion, main works execution, inspection, and handover.",
  variationOrders: 0,
  status: project.status,
  progress: project.progress,
  documents: 0,
  workerCount: 0,
  materialRequirementCount: 0,
  materialPurchaseCount: 0,
  laborCost: 0,
  materialCost: 0,
  startDate: project.startDate,
  expectedCompletionDate: project.endDate,
});

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<ProjectTab>("Overview");
  const [project, setProject] = useState<ViewProject>(getFallbackProject(projectId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contract, setContract] = useState<TenderApiRecord | null>(null);
  const [contractLoading, setContractLoading] = useState(true);
  const [contractError, setContractError] = useState("");

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

  useEffect(() => {
    let mounted = true;

    const loadContract = async () => {
      if (!project.id) {
        if (mounted) {
          setContract(null);
          setContractLoading(false);
          setContractError("");
        }
        return;
      }

      setContractLoading(true);
      try {
        const response = await api.getTenders({ projectId: project.id });
        if (!mounted) {
          return;
        }

        const matchedContract =
          response.rows.find(
            (row) =>
              row.projectId === project.id &&
              row.contractNo.trim().toLowerCase() ===
                project.contractNumber.trim().toLowerCase(),
          ) ?? response.rows[0] ?? null;

        if (matchedContract) {
          setContract(matchedContract);
          setContractError("");
        } else {
          setContract(toProjectFallbackContract(project));
          setContractError(
            "No dedicated contract record found yet. Showing contract snapshot from project data.",
          );
        }
      } catch {
        if (!mounted) {
          return;
        }
        setContract(toProjectFallbackContract(project));
        setContractError(
          "Contract registry not reachable. Showing contract snapshot from project data.",
        );
      } finally {
        if (mounted) {
          setContractLoading(false);
        }
      }
    };

    void loadContract();
    return () => {
      mounted = false;
    };
  }, [
    project.amountReceived,
    project.client,
    project.contractNumber,
    project.contractValue,
    project.endDate,
    project.id,
    project.name,
    project.pendingPayments,
    project.progress,
    project.site,
    project.spent,
    project.startDate,
    project.status,
  ]);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <SurfaceCard title="Financial Summary">
              <p className="text-xs text-slate-500">Contract Value</p>
              <p className="mt-1 text-base font-bold leading-tight break-words text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
                {formatTzs(project.contractValue)}
              </p>
              <p className="mt-3 text-xs text-slate-500">Amount Received</p>
              <p className="mt-1 text-sm font-semibold leading-tight break-words text-slate-700 [overflow-wrap:anywhere]">
                {formatTzs(project.amountReceived)}
              </p>
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
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
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

    if (activeTab === "Contract") {
      return (
        <div className="space-y-4">
          {contractError && (
            <SurfaceCard>
              <p className="text-sm text-amber-700">{contractError}</p>
            </SurfaceCard>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SurfaceCard className="xl:col-span-2" title="Contract Terms & Milestones">
              {contractLoading ? (
                <p className="text-sm text-slate-500">Loading contract governance data...</p>
              ) : !contract ? (
                <p className="text-sm text-slate-500">
                  No contract detail available for this project.
                </p>
              ) : (
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="metric-tile">
                      <p className="metric-label">Contract No.</p>
                      <p className="metric-value break-words [overflow-wrap:anywhere]">
                        {contract.contractNo}
                      </p>
                    </div>
                    <div className="metric-tile">
                      <p className="metric-label">Contract Sum</p>
                      <p className="metric-value break-words [overflow-wrap:anywhere]">
                        {formatTzs(contract.contractSum)}
                      </p>
                    </div>
                    <div className="metric-tile">
                      <p className="metric-label">Status</p>
                      <div className="mt-2">
                        <StatusBadge status={contract.status} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Payment Terms
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words [overflow-wrap:anywhere]">
                      {contract.paymentTerms}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Milestones
                    </p>
                    <p className="mt-1 whitespace-pre-line break-words [overflow-wrap:anywhere]">
                      {contract.milestones}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Contract Timeline
                    </p>
                    <p className="mt-1">
                      {formatDate(contract.startDate)} -{" "}
                      {formatDate(contract.expectedCompletionDate)}
                    </p>
                  </div>
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard title="Governance Snapshot">
              {contractLoading ? (
                <p className="text-sm text-slate-500">Preparing snapshot...</p>
              ) : !contract ? (
                <p className="text-sm text-slate-500">
                  Contract governance data unavailable.
                </p>
              ) : (
                <div className="space-y-3 text-sm text-slate-700">
                  <p className="flex items-center justify-between">
                    <span>Variation Orders</span>
                    <span className="font-semibold text-amber-700">
                      {contract.variationOrders}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Workers Linked</span>
                    <span className="font-semibold">{contract.workerCount}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Material Req/Purchase</span>
                    <span className="font-semibold">
                      {contract.materialRequirementCount}/{contract.materialPurchaseCount}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Linked Documents</span>
                    <span className="font-semibold">{contract.documents}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Pending Client Payments</span>
                    <span className="font-semibold text-amber-700">
                      {formatTzs(contract.pendingClientPayments)}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Remaining Balance</span>
                    <span className="font-semibold text-emerald-700">
                      {formatTzs(contract.remainingBalance)}
                    </span>
                  </p>
                </div>
              )}
            </SurfaceCard>
          </div>

          <SurfaceCard title="Linked Modules">
            <div className="flex flex-wrap gap-2">
              <Link
                className="btn-secondary !px-3 !py-1.5 text-xs"
                to={`/labor?projectId=${encodeURIComponent(project.id)}`}
              >
                Labor Linkage
              </Link>
              <Link
                className="btn-secondary !px-3 !py-1.5 text-xs"
                to={`/materials?projectId=${encodeURIComponent(project.id)}`}
              >
                Materials Linkage
              </Link>
              <Link
                className="btn-secondary !px-3 !py-1.5 text-xs"
                to="/documents#upload-document"
              >
                Contract Documents
              </Link>
            </div>
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
  }, [
    activeTab,
    contract,
    contractError,
    contractLoading,
    project.amountReceived,
    project.contractValue,
    project.id,
    project.spent,
  ]);

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
            <Link
              className="btn-secondary"
              to={`/expenses?projectId=${encodeURIComponent(project.id)}#add-expense-form`}
            >
              <FilePlus2 className="h-4 w-4" />
              Add Expense
            </Link>
            <Link
              className="btn-secondary"
              to={`/payments?projectId=${encodeURIComponent(project.id)}#add-payment-form`}
            >
              <HandCoins className="h-4 w-4" />
              Add Payment
            </Link>
          </div>
        }
        subtitle={`${project.site} | ${project.client}`}
        title={project.name || "Project Detail"}
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge status={project.status} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-slate-500">Progress</p>
            <div className="mt-2">
              <ProgressBar value={project.progress} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-slate-500">Contract Value</p>
            <p className="mt-2 text-base font-bold leading-tight break-words text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
              {formatTzs(project.contractValue)}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2 2xl:col-span-1">
            <p className="text-xs uppercase tracking-wider text-slate-500">Quick Actions</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link
                className="btn-secondary !px-2 !py-1"
                to={`/expenses?projectId=${encodeURIComponent(project.id)}#add-expense-form`}
              >
                Expense
              </Link>
              <Link
                className="btn-secondary !px-2 !py-1"
                to={`/payments?projectId=${encodeURIComponent(project.id)}#add-payment-form`}
              >
                Payment
              </Link>
              <Link
                className="btn-secondary !px-2 !py-1"
                to={`/materials?projectId=${encodeURIComponent(project.id)}#add-material-purchase-form`}
              >
                Material
              </Link>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Contract Value">
          <p className="text-base font-bold leading-tight break-words text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
            {formatTzs(project.contractValue)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Amount Received">
          <p className="text-base font-bold leading-tight break-words text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
            {formatTzs(project.amountReceived)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Total Spent">
          <p className="text-base font-bold leading-tight break-words text-slate-900 [overflow-wrap:anywhere] sm:text-lg">
            {formatTzs(project.spent)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Remaining Balance">
          <p className="text-base font-bold leading-tight break-words text-emerald-700 [overflow-wrap:anywhere] sm:text-lg">
            {formatTzs(remainingBalance)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Estimated Profit/Loss">
          <p
            className={`text-base font-bold leading-tight break-words [overflow-wrap:anywhere] sm:text-lg ${
              estimatedProfit >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatTzs(estimatedProfit)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Pending Payments">
          <p className="text-base font-bold leading-tight break-words text-amber-700 [overflow-wrap:anywhere] sm:text-lg">
            {formatTzs(pendingPayments)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="min-w-0 2xl:col-span-1" title="Budget Used %">
          <div className="space-y-2">
            <p className="text-base font-bold text-slate-900 sm:text-lg">{budgetUsed}%</p>
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
