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

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <Link className="btn-primary" to="/projects/new">
            <Plus className="h-4 w-4" />
            Add Contract
          </Link>
        }
        subtitle="Manage contracts, and trace labor/material linkage per project/site."
        title="Tenders & Contracts"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Contracts">
          <p className="text-2xl font-bold text-slate-900">{summary.totalContracts}</p>
        </SurfaceCard>
        <SurfaceCard title="Contract Sum">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(summary.totalContractSum)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Labor Linked">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(summary.totalLaborCost)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Materials Linked">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(summary.totalMaterialCost)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Open Variations">
          <p className="text-2xl font-bold text-amber-700">
            {summary.openVariationOrders}
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

      <SurfaceCard title="Tender & Contract List">
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
              <table className="data-table min-w-[1220px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Project</th>
                    <th>Tender / Contract No.</th>
                    <th>Contract Sum</th>
                    <th>Labor Linked</th>
                    <th>Material Linked</th>
                    <th>Variation Orders</th>
                    <th>Status</th>
                    <th>Documents</th>
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
                      </td>
                      <td>{item.contractNo}</td>
                      <td>{formatTzs(item.contractSum)}</td>
                      <td>{formatTzs(item.laborCost)}</td>
                      <td>{formatTzs(item.materialCost)}</td>
                      <td>{item.variationOrders}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>{item.documents} files</td>
                      <td>
                        <div className="flex gap-2">
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
                            to={`/materials?projectId=${encodeURIComponent(item.projectId)}`}
                          >
                            Materials
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


