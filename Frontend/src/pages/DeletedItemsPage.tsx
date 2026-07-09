import { ArchiveRestore, RefreshCcw, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal, EmptyState, GuiSelect, SectionTitle, SkeletonTable, SurfaceCard, TablePagination } from "../components/ui";
import { useTablePagination } from "../hooks/useTablePagination";
import { api, type DeletedItemApiRecord } from "../services/api";

const formatDeletedAt = (value: DeletedItemApiRecord["deletedAt"]): string => {
  if (value === null) return "-";
  if (value.length === 0) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const restoreKey = (row: DeletedItemApiRecord): string => row.entity + ":" + row.id;

export const DeletedItemsPage = () => {
  const [rows, setRows] = useState<DeletedItemApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All Modules");
  const [restoreTarget, setRestoreTarget] = useState<DeletedItemApiRecord | null>(null);
  const [restoringKey, setRestoringKey] = useState("");

  const loadDeletedItems = async () => {
    setLoading(true);
    try {
      const response = await api.getDeletedItems();
      setRows(response.rows);
      setError("");
    } catch {
      setRows([]);
      setError("Failed to load deleted records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeletedItems();
  }, []);

  const moduleOptions = useMemo(() => {
    const options = Array.from(new Set(rows.map((row) => row.module).filter((moduleName) => moduleName.length > 0)));
    options.sort((aName, bName) => aName.localeCompare(bName));
    return options;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const moduleMatch = moduleFilter === "All Modules" ? true : row.module === moduleFilter;
      const searchText = [row.module, row.title, row.subtitle, row.deletedBy, row.entity].join(" ").toLowerCase();
      const searchMatch = query.length === 0 ? true : searchText.includes(query);
      return moduleMatch ? searchMatch : false;
    });
  }, [moduleFilter, rows, search]);

  const pagination = useTablePagination(filteredRows, 10);


  const clearFilters = () => {
    setSearch("");
    setModuleFilter("All Modules");
  };

  const confirmRestore = async () => {
    if (restoreTarget === null) return;

    const target = restoreTarget;
    const key = restoreKey(target);
    setRestoringKey(key);
    try {
      await api.restoreDeletedItem(target.entity, target.id);
      setRows((currentRows) => currentRows.filter((row) => restoreKey(row) !== key));
      setRestoreTarget(null);
    } catch {
      setRestoreTarget(target);
    } finally {
      setRestoringKey("");
    }
  };

  const emptyTitle = rows.length === 0 ? "No deleted records" : "No matches found";
  const emptyDescription = rows.length === 0
    ? "Soft-deleted records will appear here after users delete business data."
    : "Try another search term or module filter.";
  const emptyActionLabel = rows.length === 0 ? undefined : "Clear filters";

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <button className="btn-secondary" onClick={() => { void loadDeletedItems(); }} type="button">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        }
        subtitle="Super Admin area for restoring soft-deleted business records."
        title="Recycle Bin"
      />

      {error.length > 0 ? (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field md:col-span-2">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Record, module, deleted by..."
                value={search}
              />
            </div>
          </label>
          <label className="form-field">
            <span>Module</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setModuleFilter(event.target.value)}
              value={moduleFilter}
            >
              <option value="All Modules">All Modules</option>
              {moduleOptions.map((moduleName) => (
                <option key={"deleted-module-" + moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </GuiSelect>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary w-full justify-center" onClick={clearFilters} type="button">
              Clear
            </button>
          </div>
        </div>
      </SurfaceCard>


      <SurfaceCard
        right={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            <ArchiveRestore className="h-4 w-4" />
            {filteredRows.length} deleted
          </span>
        }
        title="Deleted Records"
      >
        {loading ? (
          <SkeletonTable rows={6} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            actionLabel={emptyActionLabel}
            description={emptyDescription}
            onAction={emptyActionLabel ? clearFilters : undefined}
            title={emptyTitle}
          />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[980px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Module</th>
                    <th>Record</th>
                    <th>Details</th>
                    <th>Deleted At</th>
                    <th>Deleted By</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((row, index) => {
                    const key = restoreKey(row);
                    const isRestoring = restoringKey === key;
                    return (
                      <tr key={key}>
                        <td className="ops-sticky-sn">{pagination.startIndex + index + 1}</td>
                        <td>
                          <span className="ops-cell-strong">{row.module}</span>
                          <span className="ops-cell-text text-xs text-slate-500">{row.entity}</span>
                        </td>
                        <td><span className="ops-cell-wide font-semibold text-slate-900">{row.title}</span></td>
                        <td><span className="ops-cell-wide">{row.subtitle.length > 0 ? row.subtitle : "-"}</span></td>
                        <td>{formatDeletedAt(row.deletedAt)}</td>
                        <td><span className="ops-cell-text">{row.deletedBy.length > 0 ? row.deletedBy : "-"}</span></td>
                        <td className="ops-sticky-actions">
                          <div className="ops-actions-row">
                            <button
                              aria-label={"Restore " + row.title}
                              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={isRestoring}
                              onClick={() => setRestoreTarget(row)}
                              type="button"
                            >
                              <RotateCcw className="h-4 w-4" />
                              {isRestoring ? "Restoring" : "Restore"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={pagination.endIndex}
              itemLabel="deleted records"
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              page={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={[10, 20, 50]}
              startIndex={pagination.startIndex}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-primary"
        confirmLabel={restoringKey.length > 0 ? "Restoring..." : "Restore"}
        description={restoreTarget ? "Restore " + restoreTarget.title + " back to active records?" : ""}
        onCancel={() => setRestoreTarget(null)}
        onConfirm={() => { void confirmRestore(); }}
        open={Boolean(restoreTarget)}
        title="Restore deleted record"
      />
    </div>
  );
};
