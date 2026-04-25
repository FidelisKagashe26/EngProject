import { useMemo, useState } from "react";
import { FinancialInput, SectionTitle, StatusBadge, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { equipmentRecords, projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatTzs } from "../utils/format";

export const EquipmentPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [dailyRate, setDailyRate] = useState("160000");
  const [days, setDays] = useState("14");
  const [maintenance, setMaintenance] = useState("200000");
  const equipmentPagination = useTablePagination(equipmentRecords);

  const totalCost = useMemo(() => {
    return (Number(dailyRate) || 0) * (Number(days) || 0) + (Number(maintenance) || 0);
  }, [dailyRate, days, maintenance]);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Manage rented and owned equipment usage, costs and maintenance."
        title="Equipment Usage Records"
      />

      <SurfaceCard title="Equipment Table">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th>S/N</th>
                <th>Equipment Name</th>
                <th>Type</th>
                <th>Project/Site</th>
                <th>Owner</th>
                <th>Rental Cost</th>
                <th>Usage Dates</th>
                <th>Maintenance Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {equipmentPagination.paginatedRows.map((equipment, index) => (
                <tr key={equipment.id}>
                  <td>{equipmentPagination.startIndex + index + 1}</td>
                  <td>{equipment.name}</td>
                  <td>{equipment.type}</td>
                  <td>{equipment.project}</td>
                  <td>{equipment.owner}</td>
                  <td>{formatTzs(equipment.rentalCost)}</td>
                  <td>{equipment.usageDates}</td>
                  <td>{formatTzs(equipment.maintenanceCost)}</td>
                  <td>
                    <StatusBadge status={equipment.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          endIndex={equipmentPagination.endIndex}
          itemLabel="equipment"
          onPageChange={equipmentPagination.setPage}
          onPageSizeChange={equipmentPagination.setPageSize}
          page={equipmentPagination.page}
          pageSize={equipmentPagination.pageSize}
          startIndex={equipmentPagination.startIndex}
          totalCount={equipmentPagination.totalCount}
          totalPages={equipmentPagination.totalPages}
        />
      </SurfaceCard>

      <SurfaceCard title="Add Equipment Usage Form">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="form-field">
            <span>Project</span>
            <GuiSelect className="input-field">
              {projects.map((project) => (
                <option key={`eq-${project.id}`}>{project.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Equipment Name</span>
            <input className="input-field" placeholder="Equipment name" />
          </label>
          <label className="form-field">
            <span>Equipment Type</span>
            <input className="input-field" placeholder="Excavator / Mixer / Vehicle" />
          </label>
          <label className="form-field">
            <span>Owned / Rented</span>
            <GuiSelect className="input-field">
              <option>Owned</option>
              <option>Rented</option>
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Supplier / Owner</span>
            <input className="input-field" placeholder="Owner or rental company" />
          </label>
          <label className="form-field">
            <span>Start Date</span>
            <input className="input-field" type="date" />
          </label>
          <label className="form-field">
            <span>End Date</span>
            <input className="input-field" type="date" />
          </label>
          <label className="form-field">
            <span>Usage Days</span>
            <input className="input-field" onChange={(event) => setDays(event.target.value)} type="number" value={days} />
          </label>
          <FinancialInput label="Daily Rate" onChange={setDailyRate} placeholder="160000" value={dailyRate} />
          <FinancialInput
            label="Maintenance Cost"
            onChange={setMaintenance}
            placeholder="200000"
            value={maintenance}
          />
          <label className="form-field">
            <span>Total Cost (Auto)</span>
            <input className="input-field bg-slate-50" readOnly value={formatTzs(totalCost)} />
          </label>
          <label className="form-field sm:col-span-2 xl:col-span-3">
            <span>Maintenance Notes</span>
            <textarea className="input-field min-h-20" placeholder="Maintenance and usage notes..." />
          </label>
          <div className="sm:col-span-2 xl:col-span-3 flex justify-end gap-2">
            <button className="btn-secondary" type="button">
              Cancel
            </button>
            <button className="btn-primary" onClick={markSaved} type="button">
              Save Equipment Usage
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};


