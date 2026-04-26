import { FileText, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  EmptyState,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
  GuiSelect,
} from "../components/ui";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type DocumentApiRecord,
  type ProjectApiRecord,
  type TenderApiRecord,
  type TendersSummary,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const defaultSummary: TendersSummary = {
  totalContracts: 0,
  totalTenderAmount: 0,
  totalContractSum: 0,
  totalLaborCost: 0,
  totalMaterialCost: 0,
  totalSpent: 0,
  totalRemainingBalance: 0,
  overBudgetContracts: 0,
  openVariationOrders: 0,
  pendingClientPayments: 0,
};

export const TendersPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<TenderApiRecord[]>([]);
  const [summary, setSummary] = useState<TendersSummary>(defaultSummary);
  const [documents, setDocuments] = useState<DocumentApiRecord[]>([]);
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedTenderId, setSelectedTenderId] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, tendersResponse, documentRows] = await Promise.all([
          api.getProjects(),
          api.getTenders(),
          api.getDocuments(),
        ]);

        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setRows(tendersResponse.rows);
        setSummary(tendersResponse.summary);
        setDocuments(documentRows);
        setSelectedTenderId(tendersResponse.rows[0]?.id ?? "");
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load tenders/contracts data.";
        setError(message);
        setRows([]);
        setSummary(defaultSummary);
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

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchMatch =
        normalizedSearch.length === 0 ||
        `${row.projectName} ${row.clientName} ${row.contractNo} ${row.siteLocation}`
          .toLowerCase()
          .includes(normalizedSearch);
      const projectMatch =
        projectFilter === "All" || row.projectId === projectFilter;
      const statusMatch =
        statusFilter === "All Status" || row.status === statusFilter;
      return searchMatch && projectMatch && statusMatch;
    });
  }, [projectFilter, rows, search, statusFilter]);

  const statuses = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))),
    [rows],
  );

  const tenderPagination = useTablePagination(filteredRows);

  const selectedTender = useMemo(() => {
    if (filteredRows.length === 0) {
      return null;
    }
    return (
      filteredRows.find((row) => row.id === selectedTenderId) ?? filteredRows[0]
    );
  }, [filteredRows, selectedTenderId]);

  useEffect(() => {
    if (
      selectedTender &&
      selectedTenderId !== selectedTender.id
    ) {
      setSelectedTenderId(selectedTender.id);
    }
  }, [selectedTender, selectedTenderId]);

  const selectedDocuments = useMemo(() => {
    if (!selectedTender) {
      return [];
    }
    return documents
      .filter((document) => document.projectId === selectedTender.projectId)
      .slice(0, 5);
  }, [documents, selectedTender]);

  const contractsWithVariations = useMemo(
    () => rows.filter((row) => row.variationOrders > 0).length,
    [rows],
  );

  const contractsWithoutDocuments = useMemo(
    () => rows.filter((row) => row.documents === 0).length,
    [rows],
  );

  const averageWorkersLinked = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }
    const totalWorkers = rows.reduce((sum, row) => sum + row.workerCount, 0);
    return Math.round(totalWorkers / rows.length);
  }, [rows]);

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <Link className="btn-primary" to="/projects/new">
            <Plus className="h-4 w-4" />
            Register Contract
          </Link>
        }
        subtitle="Contract governance view: terms, milestones, variation orders, and compliance linkage."
        title="Contracts Governance"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <p className="text-sm text-slate-600">
          Use <span className="font-semibold text-slate-900">Projects / Sites</span> for execution
          performance and budget tracking. Use this page for{" "}
          <span className="font-semibold text-slate-900">contract terms, milestones, variations</span>,
          and document/compliance linkage.
        </p>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SurfaceCard title="Contracts">
          <p className="text-2xl font-bold text-slate-900">{summary.totalContracts}</p>
        </SurfaceCard>
        <SurfaceCard title="Open Variations">
          <p className="text-2xl font-bold text-amber-700">{summary.openVariationOrders}</p>
          <p className="mt-1 text-xs text-slate-500">
            across {contractsWithVariations} contract{contractsWithVariations === 1 ? "" : "s"}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Contracts at Risk">
          <p className="text-2xl font-bold text-red-700">{summary.overBudgetContracts}</p>
        </SurfaceCard>
        <SurfaceCard title="Pending Client Payments">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(summary.pendingClientPayments)}</p>
        </SurfaceCard>
        <SurfaceCard title="Missing Contract Docs">
          <p className="text-2xl font-bold text-amber-700">
            {contractsWithoutDocuments}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Avg Workers Linked">
          <p className="text-2xl font-bold text-slate-900">
            {averageWorkersLinked}
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field md:col-span-2">
            <span>Search Contract</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Contract no, project, site, client..."
                type="search"
                value={search}
              />
            </div>
          </label>
          <label className="form-field">
            <span>Project</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setProjectFilter(event.target.value)}
              value={projectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Status</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="All Status">All Status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </GuiSelect>
          </label>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Contract Governance Table">
        {loading ? (
          <SkeletonTable rows={4} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            description="No contracts found with the current filters."
            title="No contracts found"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1380px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Project / Site</th>
                    <th>Contract No.</th>
                    <th>Payment Terms</th>
                    <th>Milestones</th>
                    <th>Variations</th>
                    <th>Linkage</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenderPagination.paginatedRows.map((item, index) => (
                    <tr
                      className={
                        item.id === selectedTender?.id
                          ? "bg-blue-50/60"
                          : ""
                      }
                      key={item.id}
                    >
                      <td>{tenderPagination.startIndex + index + 1}</td>
                      <td>
                        <button
                          className="text-left text-sm font-semibold text-[#0b2a53]"
                          onClick={() => setSelectedTenderId(item.id)}
                          type="button"
                        >
                          {item.projectName}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{item.siteLocation}</p>
                      </td>
                      <td>{item.contractNo}</td>
                      <td className="max-w-[240px] text-xs whitespace-normal break-words text-slate-600">
                        {item.paymentTerms}
                      </td>
                      <td className="max-w-[280px] text-xs whitespace-normal break-words text-slate-600">
                        {item.milestones}
                      </td>
                      <td>
                        <span className="font-semibold text-amber-700">{item.variationOrders}</span>
                      </td>
                      <td>
                        <div className="space-y-0.5 text-xs text-slate-600">
                          <p>
                            Workers: <span className="font-semibold">{item.workerCount}</span>
                          </p>
                          <p>
                            Material Req/Purchase:{" "}
                            <span className="font-semibold">
                              {item.materialRequirementCount}/{item.materialPurchaseCount}
                            </span>
                          </p>
                          <p>
                            Docs:{" "}
                            <span className="font-semibold">{item.documents}</span>
                          </p>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="btn-secondary !px-2 !py-1 text-xs"
                            to={`/projects/${encodeURIComponent(item.projectId)}`}
                          >
                            Project
                          </Link>
                          <Link
                            className="btn-secondary !px-2 !py-1 text-xs"
                            to={`/labor?projectId=${encodeURIComponent(item.projectId)}`}
                          >
                            Labor
                          </Link>
                          <Link
                            className="btn-secondary !px-2 !py-1 text-xs"
                            to={`/documents#upload-document`}
                          >
                            Docs
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={tenderPagination.endIndex}
              itemLabel="contracts"
              onPageChange={tenderPagination.setPage}
              onPageSizeChange={tenderPagination.setPageSize}
              page={tenderPagination.page}
              pageSize={tenderPagination.pageSize}
              startIndex={tenderPagination.startIndex}
              totalCount={tenderPagination.totalCount}
              totalPages={tenderPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Contract Detail">
          {!selectedTender ? (
            <p className="text-sm text-slate-500">
              Select a contract to view detailed linkage.
            </p>
          ) : (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>
                  Tender Amount:{" "}
                  <span className="font-semibold">{formatTzs(selectedTender.tenderAmount)}</span>
                </p>
                <p>
                  Contract Sum:{" "}
                  <span className="font-semibold">{formatTzs(selectedTender.contractSum)}</span>
                </p>
                <p>
                  Amount Received:{" "}
                  <span className="font-semibold">{formatTzs(selectedTender.amountReceived)}</span>
                </p>
                <p>
                  Total Spent:{" "}
                  <span className="font-semibold">{formatTzs(selectedTender.totalSpent)}</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Scope of Work Summary
                </p>
                <p className="mt-1">
                  {selectedTender.projectName} at {selectedTender.siteLocation} for{" "}
                  {selectedTender.clientName}.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Payment Terms
                </p>
                <p className="mt-1">{selectedTender.paymentTerms}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Milestones
                </p>
                <p className="mt-1">{selectedTender.milestones}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>
                  Workers Linked:{" "}
                  <span className="font-semibold">{selectedTender.workerCount}</span>
                </p>
                <p>
                  Material Requirements:{" "}
                  <span className="font-semibold">
                    {selectedTender.materialRequirementCount}
                  </span>
                </p>
                <p>
                  Material Purchases:{" "}
                  <span className="font-semibold">
                    {selectedTender.materialPurchaseCount}
                  </span>
                </p>
                <p>
                  Open Variations:{" "}
                  <span className="font-semibold text-amber-700">{selectedTender.variationOrders}</span>
                </p>
                <p>
                  Remaining Balance:{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatTzs(selectedTender.remainingBalance)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Contract Timeline
                </p>
                <p className="mt-1">
                  {formatDate(selectedTender.startDate)} -{" "}
                  {formatDate(selectedTender.expectedCompletionDate)}
                </p>
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Attachments">
          {!selectedTender ? (
            <p className="text-sm text-slate-500">
              Select a contract to view linked documents.
            </p>
          ) : selectedDocuments.length === 0 ? (
            <p className="text-sm text-slate-500">
              No linked files found for this contract.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDocuments.map((file) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  key={file.id}
                >
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <FileText className="h-4 w-4 text-[#0b2a53]" />
                    {file.documentName}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {file.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};


