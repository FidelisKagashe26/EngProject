import { useEffect, useMemo, useState } from "react";
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
  type CreateWorkOrderPayload,
  type ProjectApiRecord,
  type WorkOrderApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const statusOptions = ["Draft", "Approved", "In Progress", "Completed", "Cancelled"];

/** Returns today's date as YYYY-MM-DD */
const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): CreateWorkOrderPayload => ({
  projectId: "",
  orderNumber: "",
  clientName: "",
  orderDate: todayStr(),
  description: "",
  materialsCost: 0,
  materialsProfitPct: 0,
  labourCost: 0,
  labourProfitPct: 0,
  status: "Draft",
  notes: "",
});

// ─── Reusable Work Order Modal ────────────────────────────────────────────────
// Exported so ProjectDetailPage can embed it inline without duplicating logic.

type WorkOrderModalProps = {
  projects: ProjectApiRecord[];
  /** When set, the project dropdown is locked to this project */
  lockedProjectId?: string;
  editingOrder?: WorkOrderApiRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

export const WorkOrderModal = ({
  projects,
  lockedProjectId,
  editingOrder,
  onClose,
  onSaved,
}: WorkOrderModalProps) => {
  const { markSaved } = useUnsavedChanges();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Derive initial project: locked > editing > first available
  const initialProjectId =
    lockedProjectId ??
    editingOrder?.projectId ??
    projects[0]?.id ??
    "";

  const initialClient =
    editingOrder?.clientName ??
    projects.find((p) => p.id === initialProjectId)?.clientName ??
    "";

  const [form, setForm] = useState<CreateWorkOrderPayload>(() =>
    editingOrder
      ? {
          projectId: editingOrder.projectId,
          orderNumber: editingOrder.orderNumber,
          clientName: editingOrder.clientName,
          orderDate: editingOrder.orderDate,
          description: editingOrder.description,
          materialsCost: editingOrder.materialsCost,
          materialsProfitPct: editingOrder.materialsProfitPct,
          labourCost: editingOrder.labourCost,
          labourProfitPct: editingOrder.labourProfitPct,
          status: editingOrder.status,
          notes: editingOrder.notes,
        }
      : {
          ...emptyForm(),
          projectId: initialProjectId,
          clientName: initialClient,
        },
  );

  const [materialsCostStr, setMaterialsCostStr] = useState(
    editingOrder ? String(editingOrder.materialsCost) : "",
  );
  const [labourCostStr, setLabourCostStr] = useState(
    editingOrder ? String(editingOrder.labourCost) : "",
  );

  // Auto-fill client when project changes (only when not locked)
  const handleProjectChange = (projectId: string) => {
    if (lockedProjectId) return; // locked — ignore
    const project = projects.find((p) => p.id === projectId);
    setForm((prev) => ({
      ...prev,
      projectId,
      clientName: project?.clientName ?? prev.clientName,
    }));
  };

  // Computed totals
  const materialsProfitAmount = useMemo(
    () => (form.materialsCost * form.materialsProfitPct) / 100,
    [form.materialsCost, form.materialsProfitPct],
  );
  const labourProfitAmount = useMemo(
    () => (form.labourCost * form.labourProfitPct) / 100,
    [form.labourCost, form.labourProfitPct],
  );
  const totalCost = form.materialsCost + form.labourCost;
  const totalProfit = materialsProfitAmount + labourProfitAmount;
  const grandTotal = totalCost + totalProfit;

  const handleSave = async () => {
    if (
      form.projectId.trim().length === 0 ||
      form.orderNumber.trim().length < 2 ||
      form.orderDate.trim().length === 0 ||
      form.description.trim().length < 2
    ) {
      setError("Please fill project, order number, date, and description.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingOrder) {
        await api.updateWorkOrder(editingOrder.id, form);
      } else {
        await api.createWorkOrder(form);
      }
      markSaved();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save work order.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === form.projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <SurfaceCard
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        title={editingOrder ? "Edit Work Order" : "New Work Order"}
      >
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* ── Project / Site ── */}
          <label className="form-field">
            <span>Project / Site</span>
            {lockedProjectId ? (
              // Locked — show as read-only display
              <div className="input-field bg-slate-50 text-slate-700 cursor-not-allowed select-none">
                {selectedProject?.name ?? lockedProjectId}
              </div>
            ) : (
              <GuiSelect
                className="input-field"
                onChange={(e) => handleProjectChange(e.target.value)}
                value={form.projectId}
              >
                {projects.map((p) => (
                  <option key={`wo-proj-${p.id}`} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </GuiSelect>
            )}
          </label>

          {/* ── Order Number ── */}
          <label className="form-field">
            <span>Order Number <span className="text-red-500">*</span></span>
            <input
              className="input-field"
              onChange={(e) => setForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
              placeholder="WO-2026-001"
              value={form.orderNumber}
            />
          </label>

          {/* ── Client Name — auto-filled, read-only ── */}
          <label className="form-field">
            <span>Client Name</span>
            <input
              className="input-field bg-slate-50 text-slate-600"
              readOnly
              title="Auto-filled from the selected project"
              value={form.clientName}
            />
          </label>

          {/* ── Order Date — defaults to today ── */}
          <label className="form-field">
            <span>Order Date <span className="text-red-500">*</span></span>
            <input
              className="input-field"
              onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
              type="date"
              value={form.orderDate}
            />
          </label>

          {/* ── Description ── */}
          <label className="form-field sm:col-span-2">
            <span>Work Description <span className="text-red-500">*</span></span>
            <textarea
              className="input-field min-h-16"
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Elezea kazi itakayofanywa..."
              value={form.description}
            />
          </label>

          {/* ── Materials ── */}
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Materials
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FinancialInput
                label="Materials Cost"
                onChange={(val) => {
                  setMaterialsCostStr(val);
                  setForm((prev) => ({ ...prev, materialsCost: Number(val) || 0 }));
                }}
                placeholder="0"
                value={materialsCostStr}
              />
              <label className="form-field">
                <span>Materials Profit %</span>
                <input
                  className="input-field"
                  max="100"
                  min="0"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      materialsProfitPct: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="15"
                  type="number"
                  value={form.materialsProfitPct || ""}
                />
              </label>
              <label className="form-field">
                <span>Materials Profit (Auto)</span>
                <input
                  className="input-field bg-slate-100 text-emerald-700 font-semibold"
                  readOnly
                  value={formatTzs(materialsProfitAmount)}
                />
              </label>
            </div>
          </div>

          {/* ── Labour ── */}
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Labour
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FinancialInput
                label="Labour Cost"
                onChange={(val) => {
                  setLabourCostStr(val);
                  setForm((prev) => ({ ...prev, labourCost: Number(val) || 0 }));
                }}
                placeholder="0"
                value={labourCostStr}
              />
              <label className="form-field">
                <span>Labour Profit %</span>
                <input
                  className="input-field"
                  max="100"
                  min="0"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      labourProfitPct: Number(e.target.value) || 0,
                    }))
                  }
                  placeholder="10"
                  type="number"
                  value={form.labourProfitPct || ""}
                />
              </label>
              <label className="form-field">
                <span>Labour Profit (Auto)</span>
                <input
                  className="input-field bg-slate-100 text-emerald-700 font-semibold"
                  readOnly
                  value={formatTzs(labourProfitAmount)}
                />
              </label>
            </div>
          </div>

          {/* ── Order Summary ── */}
          <div className="sm:col-span-2 rounded-xl border border-[#0b2a53]/20 bg-[#0b2a53]/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#0b2a53]">
              Order Summary
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Total Cost</p>
                <p className="text-base font-bold text-slate-900">{formatTzs(totalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Profit</p>
                <p className="text-base font-bold text-emerald-700">{formatTzs(totalProfit)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Grand Total (Client Charge)</p>
                <p className="text-xl font-bold text-[#0b2a53]">{formatTzs(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* ── Status ── */}
          <label className="form-field">
            <span>Status</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              value={form.status}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </GuiSelect>
          </label>

          {/* ── Notes ── */}
          <label className="form-field sm:col-span-2">
            <span>Additional Notes</span>
            <textarea
              className="input-field min-h-16"
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes..."
              value={form.notes}
            />
          </label>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
              type="button"
            >
              {saving ? "Saving..." : editingOrder ? "Update Order" : "Save Order"}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};

// ─── Work Orders Page (global view — all projects) ────────────────────────────

export const WorkOrdersPage = () => {
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderApiRecord[]>([]);
  const [projectFilter, setProjectFilter] = useState(projectFromQuery || "All");

  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrderApiRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, orderRows] = await Promise.all([
          api.getProjects(),
          api.getWorkOrders(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setWorkOrders(orderRows);
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load work orders.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length > 0) setProjectFilter(projectFromQuery);
  }, [projectFromQuery]);

  const refreshOrders = async () => {
    const rows = await api.getWorkOrders();
    setWorkOrders(rows);
  };

  const filteredOrders = useMemo(() => {
    if (projectFilter === "All") return workOrders;
    return workOrders.filter((o) => o.projectId === projectFilter);
  }, [projectFilter, workOrders]);

  const pagination = useTablePagination(filteredOrders);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteWorkOrder(deleteTarget.id);
      await refreshOrders();
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete work order.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track work orders, costs, and profit."
        title="Work Orders"
      />

      {/* Filter + Add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <div className="w-full sm:w-56">
          <label className="form-field">
            <span className="text-sm">Filter by Project</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => setProjectFilter(e.target.value)}
              value={projectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={`wo-filter-${p.id}`} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GuiSelect>
          </label>
        </div>
        <button
          className="btn-primary whitespace-nowrap"
          onClick={() => { setEditingOrder(null); setShowModal(true); }}
          type="button"
        >
          + New Work Order
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurfaceCard title="Total Orders">
          <p className="text-2xl font-bold text-slate-900">{filteredOrders.length}</p>
        </SurfaceCard>
        <SurfaceCard title="Grand Total">
          <p className="text-2xl font-bold text-emerald-700">
            {formatTzs(filteredOrders.reduce((s, o) => s + o.grandTotal, 0))}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Total Profit">
          <p className="text-2xl font-bold text-[#0b2a53]">
            {formatTzs(filteredOrders.reduce((s, o) => s + o.totalProfit, 0))}
          </p>
        </SurfaceCard>
      </div>

      {/* Table */}
      <SurfaceCard title="Work Orders List">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            description="No work orders yet. Create your first work order."
            title="No work orders"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Order Number</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Materials Cost</th>
                    <th>Materials Profit</th>
                    <th>Labour Cost</th>
                    <th>Labour Profit</th>
                    <th>Total Cost</th>
                    <th>Total Profit</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((order, index) => (
                    <tr key={order.id}>
                      <td>{pagination.startIndex + index + 1}</td>
                      <td className="font-medium">{order.orderNumber}</td>
                      <td>{order.projectName}</td>
                      <td>{order.clientName}</td>
                      <td>{formatDate(order.orderDate)}</td>
                      <td>{formatTzs(order.materialsCost)}</td>
                      <td className="text-emerald-700">
                        {formatTzs(order.materialsProfitAmount)}
                        <span className="ml-1 text-xs text-slate-400">({order.materialsProfitPct}%)</span>
                      </td>
                      <td>{formatTzs(order.labourCost)}</td>
                      <td className="text-emerald-700">
                        {formatTzs(order.labourProfitAmount)}
                        <span className="ml-1 text-xs text-slate-400">({order.labourProfitPct}%)</span>
                      </td>
                      <td>{formatTzs(order.totalCost)}</td>
                      <td className="font-semibold text-emerald-700">{formatTzs(order.totalProfit)}</td>
                      <td className="font-bold text-[#0b2a53]">{formatTzs(order.grandTotal)}</td>
                      <td>
                        <span
                          className={
                            order.status === "Completed"
                              ? "text-sm font-medium text-emerald-700"
                              : order.status === "Approved" || order.status === "In Progress"
                                ? "text-sm font-medium text-blue-700"
                                : order.status === "Cancelled"
                                  ? "text-sm font-medium text-red-600"
                                  : "text-sm font-medium text-slate-500"
                          }
                        >
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-secondary py-1 px-3 text-xs"
                            onClick={() => { setEditingOrder(order); setShowModal(true); }}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger py-1 px-3 text-xs"
                            onClick={() => setDeleteTarget(order)}
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
              endIndex={pagination.endIndex}
              itemLabel="work orders"
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              page={pagination.page}
              pageSize={pagination.pageSize}
              startIndex={pagination.startIndex}
              totalCount={pagination.totalCount}
              totalPages={pagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      {/* Modal */}
      {showModal && (
        <WorkOrderModal
          editingOrder={editingOrder}
          onClose={() => { setShowModal(false); setEditingOrder(null); }}
          onSaved={async () => {
            setShowModal(false);
            setEditingOrder(null);
            await refreshOrders();
          }}
          projects={projects}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        description={
          deleteTarget
            ? `Delete work order "${deleteTarget.orderNumber}"? This action cannot be undone.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        open={deleteTarget !== null}
        title="Delete Work Order"
      />
    </div>
  );
};

