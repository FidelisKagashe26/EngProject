import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type EquipmentApiRecord,
  type EquipmentResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

export const EquipmentPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [summary, setSummary] = useState<EquipmentResponse["summary"]>({
    totalRecords: 0,
    totalRentalCost: 0,
    totalMaintenanceCost: 0,
    totalCost: 0,
    inUseCount: 0,
  });
  const [equipmentRows, setEquipmentRows] = useState<EquipmentApiRecord[]>([]);

  const [projectId, setProjectId] = useState(projectFromQuery);
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [ownershipType, setOwnershipType] = useState<"Owned" | "Rented">(
    "Owned",
  );
  const [ownerName, setOwnerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [usageDays, setUsageDays] = useState("1");
  const [dailyRate, setDailyRate] = useState("0");
  const [maintenanceCost, setMaintenanceCost] = useState("0");
  const [status, setStatus] = useState<"In Use" | "Idle" | "Under Maintenance">(
    "In Use",
  );
  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [projectRows, equipmentResponse] = await Promise.all([
          api.getProjects(),
          api.getEquipment(),
        ]);
        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setSummary(equipmentResponse.summary);
        setEquipmentRows(equipmentResponse.rows);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load equipment data.";
        setError(message);
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

  useEffect(() => {
    if (projectFromQuery.length === 0) {
      return;
    }
    setProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) {
      return;
    }
    setProjectId(projects[0].id);
  }, [projectId, projects]);

  const refreshEquipment = async () => {
    const response = await api.getEquipment();
    setSummary(response.summary);
    setEquipmentRows(response.rows);
  };

  const equipmentPagination = useTablePagination(equipmentRows);

  const computedTotalCost = useMemo(() => {
    const days = Number(usageDays) || 0;
    const rate = Number(dailyRate) || 0;
    const maintenance = Number(maintenanceCost) || 0;
    const rental = ownershipType === "Rented" ? days * rate : 0;
    return rental + maintenance;
  }, [dailyRate, maintenanceCost, ownershipType, usageDays]);

  const resetForm = () => {
    setEquipmentName("");
    setEquipmentType("");
    setOwnershipType("Owned");
    setOwnerName("");
    setStartDate("");
    setEndDate("");
    setUsageDays("1");
    setDailyRate("0");
    setMaintenanceCost("0");
    setStatus("In Use");
    setMaintenanceNotes("");
  };

  const handleSaveEquipment = async () => {
    if (
      projectId.trim().length === 0 ||
      equipmentName.trim().length < 2 ||
      equipmentType.trim().length < 2 ||
      ownerName.trim().length < 2 ||
      startDate.trim().length === 0 ||
      endDate.trim().length === 0
    ) {
      setError(
        "Please provide project, equipment name/type, owner and usage dates.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.createEquipment({
        projectId,
        equipmentName: equipmentName.trim(),
        equipmentType: equipmentType.trim(),
        ownershipType,
        ownerName: ownerName.trim(),
        startDate,
        endDate,
        usageDays: Number(usageDays) || 0,
        dailyRate: Number(dailyRate) || 0,
        maintenanceCost: Number(maintenanceCost) || 0,
        status,
        maintenanceNotes: maintenanceNotes.trim(),
      });
      await refreshEquipment();
      markSaved();
      resetForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save equipment usage.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Manage rented and owned equipment usage, costs and maintenance."
        title="Equipment Usage Records"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Records">
          <p className="text-2xl font-bold text-slate-900">{summary.totalRecords}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Rental Cost">
          <p className="text-2xl font-bold text-slate-900">
            {formatTzs(summary.totalRentalCost)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Maintenance Cost">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(summary.totalMaintenanceCost)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Total Equipment Cost">
          <p className="text-2xl font-bold text-[#0b2a53]">
            {formatTzs(summary.totalCost)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="In Use">
          <p className="text-2xl font-bold text-emerald-700">{summary.inUseCount}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Equipment Table">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : equipmentRows.length === 0 ? (
          <EmptyState
            description="No equipment usage records yet. Add the first record below."
            title="No equipment records"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1180px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Equipment Name</th>
                    <th>Type</th>
                    <th>Project/Site</th>
                    <th>Ownership</th>
                    <th>Owner</th>
                    <th>Usage Dates</th>
                    <th>Usage Days</th>
                    <th>Rental Cost</th>
                    <th>Maintenance Cost</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentPagination.paginatedRows.map((equipment, index) => (
                    <tr key={equipment.id}>
                      <td>{equipmentPagination.startIndex + index + 1}</td>
                      <td>{equipment.equipmentName}</td>
                      <td>{equipment.equipmentType}</td>
                      <td>{equipment.projectName}</td>
                      <td>{equipment.ownershipType}</td>
                      <td>{equipment.ownerName}</td>
                      <td>
                        {formatDate(equipment.startDate)} - {formatDate(equipment.endDate)}
                      </td>
                      <td>{equipment.usageDays}</td>
                      <td>{formatTzs(equipment.rentalCost)}</td>
                      <td>{formatTzs(equipment.maintenanceCost)}</td>
                      <td>{formatTzs(equipment.totalCost)}</td>
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
          </>
        )}
      </SurfaceCard>

      <SurfaceCard title="Add Equipment Usage Form">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="form-field">
            <span>Project</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setProjectId(event.target.value)}
              value={projectId}
            >
              {projects.map((project) => (
                <option key={`eq-${project.id}`} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Equipment Name</span>
            <input
              className="input-field"
              onChange={(event) => setEquipmentName(event.target.value)}
              placeholder="Equipment name"
              value={equipmentName}
            />
          </label>
          <label className="form-field">
            <span>Equipment Type</span>
            <input
              className="input-field"
              onChange={(event) => setEquipmentType(event.target.value)}
              placeholder="Excavator / Mixer / Vehicle"
              value={equipmentType}
            />
          </label>
          <label className="form-field">
            <span>Owned / Rented</span>
            <GuiSelect
              className="input-field"
              onChange={(event) =>
                setOwnershipType(event.target.value as "Owned" | "Rented")
              }
              value={ownershipType}
            >
              <option value="Owned">Owned</option>
              <option value="Rented">Rented</option>
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Supplier / Owner</span>
            <input
              className="input-field"
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder="Owner or rental company"
              value={ownerName}
            />
          </label>
          <label className="form-field">
            <span>Start Date</span>
            <input
              className="input-field"
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>
          <label className="form-field">
            <span>End Date</span>
            <input
              className="input-field"
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
          <label className="form-field">
            <span>Usage Days</span>
            <input
              className="input-field"
              onChange={(event) => setUsageDays(event.target.value)}
              type="number"
              value={usageDays}
            />
          </label>
          <FinancialInput
            label="Daily Rate"
            onChange={setDailyRate}
            placeholder="160000"
            value={dailyRate}
          />
          <FinancialInput
            label="Maintenance Cost"
            onChange={setMaintenanceCost}
            placeholder="200000"
            value={maintenanceCost}
          />
          <label className="form-field">
            <span>Status</span>
            <GuiSelect
              className="input-field"
              onChange={(event) =>
                setStatus(
                  event.target.value as "In Use" | "Idle" | "Under Maintenance",
                )
              }
              value={status}
            >
              <option value="In Use">In Use</option>
              <option value="Idle">Idle</option>
              <option value="Under Maintenance">Under Maintenance</option>
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Total Cost (Auto)</span>
            <input
              className="input-field bg-slate-50"
              readOnly
              value={formatTzs(computedTotalCost)}
            />
          </label>
          <label className="form-field sm:col-span-2 xl:col-span-3">
            <span>Maintenance Notes</span>
            <textarea
              className="input-field min-h-20"
              onChange={(event) => setMaintenanceNotes(event.target.value)}
              placeholder="Maintenance and usage notes..."
              value={maintenanceNotes}
            />
          </label>
          <div className="sm:col-span-2 xl:col-span-3 flex justify-end gap-2">
            <button className="btn-secondary" onClick={resetForm} type="button">
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              onClick={() => void handleSaveEquipment()}
              type="button"
            >
              Save Equipment Usage
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};
