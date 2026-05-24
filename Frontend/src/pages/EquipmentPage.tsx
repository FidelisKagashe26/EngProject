import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
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

type EquipmentPageProps = {
  embedded?: boolean;
  search?: string;
  tabBar?: ReactNode;
};

export const EquipmentPage = ({ embedded = false, search = "", tabBar }: EquipmentPageProps) => {
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

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<EquipmentApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState(projectFromQuery);
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [ownershipType, setOwnershipType] = useState<"Owned" | "Rented">("Owned");
  const [ownerName, setOwnerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyRate, setDailyRate] = useState("0");
  const [maintenanceCost, setMaintenanceCost] = useState("0");
  const [status, setStatus] = useState<"In Use" | "Idle" | "Under Maintenance">("In Use");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, equipmentResponse] = await Promise.all([
          api.getProjects(),
          api.getEquipment(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setSummary(equipmentResponse.summary);
        setEquipmentRows(equipmentResponse.rows);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load equipment data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length === 0) return;
    setProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0 || projectId.length > 0) return;
    setProjectId(projects[0].id);
  }, [projectId, projects]);

  const refreshEquipment = async () => {
    const response = await api.getEquipment();
    setSummary(response.summary);
    setEquipmentRows(response.rows);
  };

  const filteredEquipmentRows = useMemo(() => {
    if (search.trim().length === 0) return equipmentRows;
    const q = search.toLowerCase();
    return equipmentRows.filter(
      (r) =>
        r.equipmentName.toLowerCase().includes(q) ||
        r.equipmentType.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [equipmentRows, search]);

  const equipmentPagination = useTablePagination(filteredEquipmentRows);

  const computedUsageDays = useMemo(() => {
    if (startDate.trim().length === 0 || endDate.trim().length === 0 || endDate < startDate) {
      return 0;
    }

    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    if ([sy, sm, sd, ey, em, ed].some((value) => !Number.isFinite(value))) {
      return 0;
    }

    const startUtc = Date.UTC(sy, sm - 1, sd);
    const endUtc = Date.UTC(ey, em - 1, ed);
    return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const computedTotalCost = useMemo(() => {
    const days = computedUsageDays;
    const rate = Number(dailyRate) || 0;
    const maintenance = Number(maintenanceCost) || 0;
    const rental = ownershipType === "Rented" ? days * rate : 0;
    return rental + maintenance;
  }, [computedUsageDays, dailyRate, maintenanceCost, ownershipType]);

  const resetForm = () => {
    setEquipmentName("");
    setEquipmentType("");
    setOwnershipType("Owned");
    setOwnerName("");
    setStartDate("");
    setEndDate("");
    setDailyRate("0");
    setMaintenanceCost("0");
    setStatus("In Use");
    setMaintenanceNotes("");
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
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
      setError("Please provide project, equipment name/type, owner and usage dates.");
      return;
    }
    if (computedUsageDays <= 0) {
      setError("End date must be on or after start date so usage days can be calculated.");
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
        usageDays: computedUsageDays,
        dailyRate: Number(dailyRate) || 0,
        maintenanceCost: Number(maintenanceCost) || 0,
        status,
        maintenanceNotes: maintenanceNotes.trim(),
      });
      await refreshEquipment();
      markSaved();
      closeAddModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save equipment usage.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!equipmentToDelete) return;
    setDeleting(true);
    setError("");
    try {
      // Equipment records are financial records — soft delete not needed, just remove from UI for now
      // TODO: wire up DELETE /equipment/:id when backend supports it
      setEquipmentRows((prev) => prev.filter((e) => e.id !== equipmentToDelete.id));
      markSaved();
      setEquipmentToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete record.");
      setEquipmentToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Manage rented and owned equipment usage, costs and maintenance."
          title="Equipment Usage Records"
        />
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Records">
          <p className="text-2xl font-bold text-slate-900">{summary.totalRecords}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Rental Cost">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(summary.totalRentalCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="Maintenance Cost">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(summary.totalMaintenanceCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Equipment Cost">
          <p className="text-2xl font-bold text-[#0b2a53]">{formatTzs(summary.totalCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="In Use">
          <p className="text-2xl font-bold text-emerald-700">{summary.inUseCount}</p>
        </SurfaceCard>
      </div>

      {/* Tab bar — between stats and table */}
      {tabBar}

      {/* Filter and Add button - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <button className="btn-primary whitespace-nowrap" onClick={openAddModal} type="button">
          + Add Equipment
        </button>
      </div>

      {/* Equipment Table */}
      <SurfaceCard title="Equipment Table">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : equipmentRows.length === 0 ? (
          <EmptyState
            description="No equipment usage records yet. Click Add Equipment to get started."
            title="No equipment records"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1280px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Equipment Name</th>
                    <th>Type</th>
                    <th>Project/Site</th>
                    <th>Ownership</th>
                    <th>Owner</th>
                    <th>Usage Dates</th>
                    <th>Days</th>
                    <th>Rental Cost</th>
                    <th>Maintenance</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                      <td>{formatDate(equipment.startDate)} – {formatDate(equipment.endDate)}</td>
                      <td>{equipment.usageDays}</td>
                      <td>{formatTzs(equipment.rentalCost)}</td>
                      <td>{formatTzs(equipment.maintenanceCost)}</td>
                      <td>{formatTzs(equipment.totalCost)}</td>
                      <td>
                        <span
                          className={
                            equipment.status === "In Use"
                              ? "text-sm font-medium text-emerald-700"
                              : equipment.status === "Under Maintenance"
                                ? "text-sm font-medium text-amber-700"
                                : "text-sm font-medium text-slate-500"
                          }
                        >
                          {equipment.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-danger py-1 px-3 text-xs"
                            onClick={() => setEquipmentToDelete(equipment)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
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

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" title="Add Equipment Usage">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="form-field">
                <span>Project</span>
                <GuiSelect className="input-field" onChange={(e) => setProjectId(e.target.value)} value={projectId}>
                  {projects.map((p) => <option key={`eq-${p.id}`} value={p.id}>{p.name}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Equipment Name</span>
                <input className="input-field" onChange={(e) => setEquipmentName(e.target.value)} placeholder="Equipment name" value={equipmentName} />
              </label>
              <label className="form-field">
                <span>Equipment Type</span>
                <input className="input-field" onChange={(e) => setEquipmentType(e.target.value)} placeholder="Excavator / Mixer / Vehicle" value={equipmentType} />
              </label>
              <label className="form-field">
                <span>Owned / Rented</span>
                <GuiSelect className="input-field" onChange={(e) => setOwnershipType(e.target.value as "Owned" | "Rented")} value={ownershipType}>
                  <option value="Owned">Owned</option>
                  <option value="Rented">Rented</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Supplier / Owner</span>
                <input className="input-field" onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner or rental company" value={ownerName} />
              </label>
              <label className="form-field">
                <span>Start Date</span>
                <input className="input-field" onChange={(e) => setStartDate(e.target.value)} type="date" value={startDate} />
              </label>
              <label className="form-field">
                <span>End Date</span>
                <input className="input-field" onChange={(e) => setEndDate(e.target.value)} type="date" value={endDate} />
              </label>
              {startDate.trim().length > 0 && endDate.trim().length > 0 && computedUsageDays <= 0 ? (
                <p className="text-xs text-red-600 sm:col-span-2 xl:col-span-3">
                  End date must be the same day or after start date.
                </p>
              ) : null}
              <label className="form-field">
                <span>Usage Days</span>
                <input
                  className="input-field bg-slate-50"
                  readOnly
                  type="number"
                  value={computedUsageDays > 0 ? String(computedUsageDays) : ""}
                />
              </label>
              <FinancialInput label="Daily Rate" onChange={setDailyRate} placeholder="160000" value={dailyRate} />
              <FinancialInput label="Maintenance Cost" onChange={setMaintenanceCost} placeholder="200000" value={maintenanceCost} />
              <label className="form-field">
                <span>Status</span>
                <GuiSelect className="input-field" onChange={(e) => setStatus(e.target.value as "In Use" | "Idle" | "Under Maintenance")} value={status}>
                  <option value="In Use">In Use</option>
                  <option value="Idle">Idle</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Total Cost (Auto)</span>
                <input className="input-field bg-slate-50" readOnly value={formatTzs(computedTotalCost)} />
              </label>
              <label className="form-field sm:col-span-2 xl:col-span-3">
                <span>Maintenance Notes</span>
                <textarea className="input-field min-h-20" onChange={(e) => setMaintenanceNotes(e.target.value)} placeholder="Maintenance and usage notes..." value={maintenanceNotes} />
              </label>
              <div className="sm:col-span-2 xl:col-span-3 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeAddModal} type="button">Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={() => void handleSaveEquipment()} type="button">
                  Save Equipment Usage
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        description={equipmentToDelete ? `Delete equipment record "${equipmentToDelete.equipmentName}"? This action cannot be undone.` : ""}
        onCancel={() => setEquipmentToDelete(null)}
        onConfirm={() => void handleDelete()}
        open={equipmentToDelete !== null}
        title="Delete Equipment Record"
      />
    </div>
  );
};
