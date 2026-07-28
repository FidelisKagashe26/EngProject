import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActiveProject } from "../project/ActiveProjectContext";
import {
  ConfirmModal,
  DetailModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
  SurfaceCard,
  TablePagination,
  options,
} from "../components/ui";
import {
  EQUIPMENT_CONDITIONS,
  EQUIPMENT_OWNERSHIP,
  EQUIPMENT_STATUSES,
} from "../constants/options";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type EquipmentApiRecord,
  type EquipmentResponse,
  type EquipmentStatus,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

type EquipmentPageProps = {
  embedded?: boolean;
  search?: string;
  /** Renders the shared operations tab bar with this page's actions on the search row. */
  renderSearchRow?: (actions?: ReactNode) => ReactNode;
  /** Renders the top tab strip, allowing this page to inject elements to the right side. */
  renderTabStrip?: (actions?: ReactNode) => ReactNode;
};

export const EquipmentPage = ({ embedded = false, search = "", renderSearchRow, renderTabStrip }: EquipmentPageProps) => {
  const { markSaved } = useUnsavedChanges();
  // Scope comes from the shared header switcher, not a per-page dropdown.
  const { activeProjectId } = useActiveProject();
  const projectFromQuery = activeProjectId;
  const listProjectFilter = activeProjectId || "All";

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
  const [editingEquipmentId, setEditingEquipmentId] = useState("");
  const [viewEquipment, setViewEquipment] = useState<EquipmentApiRecord | null>(null);
  const [equipmentToDelete, setEquipmentToDelete] = useState<EquipmentApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [projectId, setProjectId] = useState(projectFromQuery);
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignedTo, setAssignedTo] = useState("");
  const [conditionStatus, setConditionStatus] = useState("Good");
  const [checkInDate, setCheckInDate] = useState("");
  const [ownershipType, setOwnershipType] = useState<"Owned" | "Rented">("Owned");
  const [ownerName, setOwnerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyRate, setDailyRate] = useState("0");
  const [maintenanceCost, setMaintenanceCost] = useState("0");
  const [status, setStatus] = useState<EquipmentStatus>("In Use");
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
    let result = equipmentRows;
    if (listProjectFilter !== "All") {
      result = result.filter(r => r.projectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.equipmentName.toLowerCase().includes(q) ||
          r.equipmentType.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.assetTag.toLowerCase().includes(q) ||
          r.assignedTo.toLowerCase().includes(q) ||
          r.conditionStatus.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q),
      );
    }
    return result;
  }, [equipmentRows, search, listProjectFilter]);

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
    const qty = Math.max(Number(quantity) || 1, 1);
    const rental = ownershipType === "Rented" ? days * rate * qty : 0;
    return rental + maintenance;
  }, [computedUsageDays, dailyRate, maintenanceCost, ownershipType, quantity]);

  const resetForm = () => {
    setEditingEquipmentId("");
    setEquipmentName("");
    setEquipmentType("");
    setAssetTag("");
    setQuantity("1");
    setAssignedTo("");
    setConditionStatus("Good");
    setCheckInDate("");
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

  const openEditModal = (equipment: EquipmentApiRecord) => {
    setEditingEquipmentId(equipment.id);
    setProjectId(equipment.projectId);
    setEquipmentName(equipment.equipmentName);
    setEquipmentType(equipment.equipmentType);
    setAssetTag(equipment.assetTag);
    setQuantity(String(equipment.quantity || 1));
    setAssignedTo(equipment.assignedTo);
    setConditionStatus(equipment.conditionStatus);
    setCheckInDate(equipment.checkInDate ?? "");
    setOwnershipType(equipment.ownershipType);
    setOwnerName(equipment.ownerName);
    setStartDate(equipment.startDate);
    setEndDate(equipment.endDate);
    setDailyRate(String(equipment.dailyRate));
    setMaintenanceCost(String(equipment.maintenanceCost));
    setStatus(equipment.status);
    setMaintenanceNotes(equipment.maintenanceNotes);
    setShowAddModal(true);
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
      const payload = {
        projectId,
        equipmentName: equipmentName.trim(),
        equipmentType: equipmentType.trim(),
        assetTag: assetTag.trim(),
        quantity: Math.max(Number(quantity) || 1, 1),
        assignedTo: assignedTo.trim(),
        conditionStatus,
        checkInDate: checkInDate || undefined,
        ownershipType,
        ownerName: ownerName.trim(),
        startDate,
        endDate,
        usageDays: computedUsageDays,
        dailyRate: Number(dailyRate) || 0,
        maintenanceCost: Number(maintenanceCost) || 0,
        status,
        maintenanceNotes: maintenanceNotes.trim(),
      };
      if (editingEquipmentId) {
        await api.updateEquipment(editingEquipmentId, payload);
      } else {
        await api.createEquipment(payload);
      }
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
      await api.deleteEquipment(equipmentToDelete.id);
      await refreshEquipment();
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

      {renderTabStrip?.()}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Total Records">
          <p className="text-xl font-bold text-slate-900">{summary.totalRecords}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Rental Cost">
          <p className="text-xl font-bold text-slate-900">{formatTzs(summary.totalRentalCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="Maintenance Cost">
          <p className="text-xl font-bold text-amber-700">{formatTzs(summary.totalMaintenanceCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Equipment Cost">
          <p className="text-xl font-bold text-[#0b2a53]">{formatTzs(summary.totalCost)}</p>
        </SurfaceCard>
        <SurfaceCard title="In Use">
          <p className="text-xl font-bold text-emerald-700">{summary.inUseCount}</p>
        </SurfaceCard>
      </div>

      {renderSearchRow?.(
        <button
          className="btn-primary h-11 justify-center whitespace-nowrap"
          onClick={openAddModal}
          type="button"
        >
          + Add Equipment
        </button>
      )}

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
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[1040px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Equipment</th>
                    <th>Type</th>
                    <th>Project/Site</th>
                    <th>Usage</th>
                    <th>Days</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentPagination.paginatedRows.map((equipment, index) => (
                    <tr key={equipment.id}>
                      <td className="ops-sticky-sn">{equipmentPagination.startIndex + index + 1}</td>
                      <td><span className="ops-cell-strong">{equipment.equipmentName}</span></td>
                      <td><span className="ops-cell-text">{equipment.equipmentType}</span></td>
                      <td><span className="ops-cell-text">{equipment.projectName}</span></td>
                      <td>{formatDate(equipment.startDate)} - {formatDate(equipment.endDate)}</td>
                      <td>{equipment.usageDays}</td>
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
                      <td className="ops-sticky-actions">
                        <div className="ops-actions-row">
                          <button
                            className="btn-secondary py-1 px-3 text-xs"
                            onClick={() => setViewEquipment(equipment)}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="btn-secondary py-1 px-3 text-xs"
                            onClick={() => openEditModal(equipment)}
                            type="button"
                          >
                            Edit
                          </button>
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
          <SurfaceCard className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" title={editingEquipmentId ? "Edit Equipment Usage" : "Add Equipment Usage"}>
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
                <span>Asset Tag / Plate</span>
                <input className="input-field" onChange={(e) => setAssetTag(e.target.value)} placeholder="EQ-001 / T123 ABC" value={assetTag} />
              </label>
              <label className="form-field">
                <span>Quantity</span>
                <input className="input-field" min="1" onChange={(e) => setQuantity(e.target.value)} type="number" value={quantity} />
              </label>
              <label className="form-field">
                <span>Assigned To</span>
                <input className="input-field" onChange={(e) => setAssignedTo(e.target.value)} placeholder="Operator / team" value={assignedTo} />
              </label>
              <label className="form-field">
                <span>Condition</span>
                <GuiSelect className="input-field" onChange={(e) => setConditionStatus(e.target.value)} value={conditionStatus}>
                  {options(EQUIPMENT_CONDITIONS)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Check-in Date</span>
                <input className="input-field" onChange={(e) => setCheckInDate(e.target.value)} type="date" value={checkInDate} />
              </label>
              <label className="form-field">
                <span>Owned / Rented</span>
                <GuiSelect className="input-field" onChange={(e) => setOwnershipType(e.target.value as "Owned" | "Rented")} value={ownershipType}>
                  {options(EQUIPMENT_OWNERSHIP)}
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
                <GuiSelect className="input-field" onChange={(e) => setStatus(e.target.value as EquipmentStatus)} value={status}>
                  {options(EQUIPMENT_STATUSES)}
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
                  {editingEquipmentId ? "Update Equipment Usage" : "Save Equipment Usage"}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      <DetailModal
        onClose={() => setViewEquipment(null)}
        open={viewEquipment !== null}
        rows={viewEquipment ? [
          { label: "Project / Site", value: viewEquipment.projectName },
          { label: "Equipment", value: viewEquipment.equipmentName },
          { label: "Type", value: viewEquipment.equipmentType },
          { label: "Asset Tag", value: viewEquipment.assetTag || "-" },
          { label: "Quantity", value: String(viewEquipment.quantity) },
          { label: "Assigned To", value: viewEquipment.assignedTo || "-" },
          { label: "Condition", value: viewEquipment.conditionStatus },
          { label: "Check-in Date", value: viewEquipment.checkInDate ? formatDate(viewEquipment.checkInDate) : "-" },
          { label: "Ownership", value: viewEquipment.ownershipType },
          { label: "Owner / Provider", value: viewEquipment.ownerName || "-" },
          { label: "Usage Period", value: `${formatDate(viewEquipment.startDate)} – ${formatDate(viewEquipment.endDate)}` },
          { label: "Usage Days", value: String(viewEquipment.usageDays) },
          { label: "Daily Rate", value: formatTzs(viewEquipment.dailyRate) },
          { label: "Rental Cost", value: formatTzs(viewEquipment.rentalCost) },
          { label: "Maintenance Cost", value: formatTzs(viewEquipment.maintenanceCost) },
          { label: "Total Cost", value: formatTzs(viewEquipment.totalCost) },
          { label: "Status", value: <StatusBadge status={viewEquipment.status} /> },
          { label: "Maintenance Notes", value: viewEquipment.maintenanceNotes || "-", full: true },
        ] : []}
        subtitle={viewEquipment ? viewEquipment.equipmentName : ""}
        title="Equipment Details"
      />

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
