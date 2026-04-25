import { Calendar, Filter, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ProgressBar, SectionTitle, SkeletonTable, StatusBadge, SurfaceCard, GuiSelect } from "../components/ui";
import { projects as fallbackProjects } from "../data/mockData";
import { api, type ProjectApiRecord } from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

type ViewProject = {
  id: string;
  name: string;
  site: string;
  client: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  contractValue: number;
  spent: number;
  balance: number;
  profitEstimate: number;
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
  spent: row.totalSpent,
  balance: row.remainingBalance,
  profitEstimate: row.profitLossEstimate,
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
  spent: project.spent,
  balance: project.contractValue - project.spent,
  profitEstimate: project.amountReceived - project.spent,
  status: project.status,
  progress: project.progress,
  pendingPayments: project.pendingPayments,
}));

export const ProjectsPage = () => {
  const [rows, setRows] = useState<ViewProject[]>(fallbackRows);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [showEmptyPreview, setShowEmptyPreview] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getProjects();
        if (mounted) {
          setRows(response.map(toViewProject));
          setError("");
        }
      } catch {
        if (mounted) {
          setRows(fallbackRows);
          setError("Using local project preview data. Backend API is not reachable yet.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    return rows.filter((project) => {
      const searchMatch = `${project.name} ${project.client} ${project.site}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusMatch = statusFilter === "All" || project.status === statusFilter;
      const locationMatch =
        locationFilter === "All" ||
        project.site.toLowerCase().includes(locationFilter.toLowerCase());
      return searchMatch && statusMatch && locationMatch;
    });
  }, [rows, search, statusFilter, locationFilter]);

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <Link className="btn-primary" to="/projects/new">
            Add New Project
          </Link>
        }
        subtitle="Track contract value, costs, payment progress, and project health."
        title="Projects / Sites"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <label className="form-field md:col-span-2">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Project name, client or location"
                type="search"
                value={search}
              />
            </div>
          </label>

          <label className="form-field">
            <span>Status</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Over Budget">Over Budget</option>
            </GuiSelect>
          </label>

          <label className="form-field">
            <span>Location</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setLocationFilter(event.target.value)}
              value={locationFilter}
            >
              <option value="All">All</option>
              <option value="Dodoma">Dodoma</option>
              <option value="Arusha">Arusha</option>
              <option value="Mwanza">Mwanza</option>
              <option value="Mbeya">Mbeya</option>
            </GuiSelect>
          </label>

          <label className="form-field">
            <span>Date Range</span>
            <input className="input-field" type="date" />
          </label>

          <div className="flex items-end gap-2">
            <button className="btn-secondary w-full">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => setShowEmptyPreview((current) => !current)}
              type="button"
            >
              {showEmptyPreview ? "Show Data" : "Empty State"}
            </button>
          </div>
        </div>
      </SurfaceCard>

      {loading ? (
        <SkeletonTable rows={4} />
      ) : showEmptyPreview ? (
        <EmptyState
          actionLabel="Create First Project"
          description="No projects found. Start by registering your first engineering site."
          title="No projects found"
        />
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project, index) => (
            <SurfaceCard key={project.id}>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
                <div className="xl:col-span-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700">
                      #{index + 1}
                    </span>
                    <StatusBadge status={project.status} />
                    <span className="text-xs text-slate-400">{project.contractNumber}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    {project.site}
                  </p>
                  <p className="mt-3 text-sm text-slate-600">
                    Client: <span className="font-medium">{project.client}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-4 w-4" />
                    {formatDate(project.startDate)} - {formatDate(project.endDate)}
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Financial Overview (TZS)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="metric-tile">
                      <p className="metric-label">Contract Value</p>
                      <p className="metric-value">{formatTzs(project.contractValue)}</p>
                    </div>
                    <div className="metric-tile">
                      <p className="metric-label">Amount Spent</p>
                      <p className="metric-value">{formatTzs(project.spent)}</p>
                    </div>
                    <div className="metric-tile">
                      <p className="metric-label">Remaining Balance</p>
                      <p
                        className={`metric-value ${
                          project.balance >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatTzs(project.balance)}
                      </p>
                    </div>
                    <div className="metric-tile">
                      <p className="metric-label">Profit/Loss Estimate</p>
                      <p
                        className={`metric-value ${
                          project.profitEstimate >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatTzs(project.profitEstimate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-1">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Progress
                  </p>
                  <ProgressBar value={project.progress} />
                  <p className="mt-3 text-xs text-slate-500">
                    Pending Client Payments:{" "}
                    <span className="font-semibold text-amber-700">
                      {formatTzs(project.pendingPayments)}
                    </span>
                  </p>
                  <div className="mt-5 flex gap-2">
                    <Link
                      className="btn-secondary w-full justify-center text-xs"
                      to={`/projects/${encodeURIComponent(project.id)}`}
                    >
                      View details
                    </Link>
                    <Link
                      className="btn-primary w-full justify-center text-xs"
                      to={`/projects/${encodeURIComponent(project.id)}/edit`}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
};


