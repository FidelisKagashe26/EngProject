import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionTitle, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { activityLog as fallbackActivity } from "../data/mockData";
import { useTablePagination } from "../hooks/useTablePagination";
import { api, type ActivityApiRecord } from "../services/api";

const fallbackRows: ActivityApiRecord[] = fallbackActivity.map((row) => ({
  id: row.id,
  actorName: row.user,
  action: row.action,
  module: row.module,
  projectId: null,
  projectName: row.project,
  description: row.description,
  ipDevice: row.ipDevice,
  createdAt: row.dateTime,
}));

export const ActivityLogPage = () => {
  const [rows, setRows] = useState<ActivityApiRecord[]>(fallbackRows);
  const [error, setError] = useState("");
  const activityPagination = useTablePagination(rows);

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
          setRows(fallbackRows);
          setError("Using local activity preview data. Backend API is not reachable yet.");
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
              <input className="input-field pl-9" placeholder="User, action, module or project..." />
            </div>
          </label>
          <label className="form-field">
            <span>Module</span>
            <GuiSelect className="input-field">
              <option>All Modules</option>
              <option>Projects</option>
              <option>Payments</option>
              <option>Materials</option>
              <option>Documents</option>
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Date</span>
            <input className="input-field" type="date" />
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


