import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionTitle, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { useTablePagination } from "../hooks/useTablePagination";
import { api, type ActivityApiRecord } from "../services/api";

export const ActivityLogPage = () => {
  const [rows, setRows] = useState<ActivityApiRecord[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All Modules");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getActivityLog();
        if (mounted) {
          setRows(response);
          setError("");
        }
      } catch {
        if (mounted) {
          setRows([]);
          setError("Failed to load activity log from backend.");
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const moduleOptions = useMemo(() => {
    const options = Array.from(
      new Set(rows.map((row) => row.module.trim()).filter((moduleName) => moduleName.length > 0)),
    );
    options.sort((a, b) => a.localeCompare(b));
    return options;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const searchMatch =
        search.trim().length === 0 ||
        `${row.actorName} ${row.action} ${row.module} ${row.projectName} ${row.description}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const moduleMatch =
        moduleFilter === "All Modules" || row.module === moduleFilter;
      const dateMatch =
        dateFilter.length === 0 || row.createdAt.startsWith(dateFilter);
      return searchMatch && moduleMatch && dateMatch;
    });
  }, [dateFilter, moduleFilter, rows, search]);

  const activityPagination = useTablePagination(filteredRows);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Auditable trail of all financial, procurement and project changes."
        title="Activity Log / Audit Trail"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-amber-700">{error}</p>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field md:col-span-2">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="User, action, module or project..."
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
                <option key={`activity-module-${moduleName}`} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Date</span>
            <input
              className="input-field"
              onChange={(event) => setDateFilter(event.target.value)}
              type="date"
              value={dateFilter}
            />
          </label>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Audit Table">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1200px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Date/Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Project</th>
                <th>Description</th>
                <th>IP/Device</th>
              </tr>
            </thead>
            <tbody>
              {activityPagination.paginatedRows.map((item, index) => (
                <tr key={item.id}>
                  <td>{activityPagination.startIndex + index + 1}</td>
                  <td>{item.createdAt}</td>
                  <td>{item.actorName}</td>
                  <td>{item.action}</td>
                  <td>{item.module}</td>
                  <td>{item.projectName}</td>
                  <td>{item.description}</td>
                  <td>{item.ipDevice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          endIndex={activityPagination.endIndex}
          itemLabel="activities"
          onPageChange={activityPagination.setPage}
          onPageSizeChange={activityPagination.setPageSize}
          page={activityPagination.page}
          pageSize={activityPagination.pageSize}
          startIndex={activityPagination.startIndex}
          totalCount={activityPagination.totalCount}
          totalPages={activityPagination.totalPages}
        />
      </SurfaceCard>
    </div>
  );
};


