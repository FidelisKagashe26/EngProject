import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useActiveProject } from "../project/ActiveProjectContext";
import { pushTopToast } from "../components/topToast";
import {
  DetailModal,
  EmptyState,
  FinancialInput,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  SurfaceCard,
  TablePagination,
  options,
} from "../components/ui";
import {
  MATERIAL_DELIVERY_STATUSES,
  MATERIAL_SUPPLY_SOURCES,
  MATERIAL_UNITS,
  PRIORITIES,
} from "../constants/options";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type MaterialPurchaseApiRecord,
  type MaterialRequirementApiRecord,
  type MaterialSupplySource,
  type ProjectApiRecord,
  type SupplierApiRecord,
} from "../services/api";
import { formatDate, formatNumber, formatTzs } from "../utils/format";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const priorityClass = (priority: string) => {
  switch (priority) {
    case "High": return "text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full";
    case "Medium": return "text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full";
    case "Low": return "text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full";
    default: return "text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full";
  }
};

const supplyStatusClass = (status: string) => {
  if (status.toLowerCase().includes("fulfilled") || status.toLowerCase().includes("fully"))
    return "text-sm font-medium text-emerald-700";
  if (status.toLowerCase().includes("partial"))
    return "text-sm font-medium text-amber-700";
  return "text-sm font-medium text-slate-500";
};

// ═════════════════════════════════════════════════════════════════════════════════
// Register Material Modal
// ═════════════════════════════════════════════════════════════════════════════════

type RegisterMaterialModalProps = {
  editing: MaterialRequirementApiRecord | null;
  projects: ProjectApiRecord[];
  defaultProjectId: string;
  onSave: () => void;
  onClose: () => void;
};

const RegisterMaterialModal = ({
  editing,
  projects,
  defaultProjectId,
  onSave,
  onClose,
}: RegisterMaterialModalProps) => {
  const [projectId, setProjectId] = useState(editing?.projectId || defaultProjectId || projects[0]?.id || "");
  const [materialName, setMaterialName] = useState(editing?.materialName || "");
  const [requiredQty, setRequiredQty] = useState(editing ? String(editing.requiredQuantity) : "");
  const [unit, setUnit] = useState(editing?.unit || MATERIAL_UNITS[0]);
  const [estimatedUnitCost, setEstimatedUnitCost] = useState(
    editing && editing.estimatedUnitCost > 0 ? String(editing.estimatedUnitCost) : "",
  );
  const [supplySource, setSupplySource] = useState<MaterialSupplySource>(editing?.supplySource || "Company Purchased");
  const [priority, setPriority] = useState(editing?.priority || "Medium");
  const [neededByDate, setNeededByDate] = useState(editing?.neededByDate ?? "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSave = async () => {
    if (
      projectId.trim().length === 0 ||
      materialName.trim().length < 2 ||
      (Number(requiredQty) || 0) <= 0 ||
      unit.trim().length === 0
    ) {
      setFormError("Please provide project, material name, required quantity and unit.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await api.updateMaterialRequirement(editing.id, {
          projectId,
          materialName: materialName.trim(),
          requiredQuantity: Number(requiredQty) || 0,
          unit: unit.trim(),
          estimatedUnitCost: Number(estimatedUnitCost) || 0,
          supplySource,
          priority,
          neededByDate: neededByDate || undefined,
          notes: notes.trim(),
        });
      } else {
        await api.createMaterialRequirement({
          projectId,
          materialName: materialName.trim(),
          requiredQuantity: Number(requiredQty) || 0,
          unit: unit.trim(),
          estimatedUnitCost: Number(estimatedUnitCost) || 0,
          supplySource,
          requestedQuantity: 0,
          priority,
          neededByDate: neededByDate || undefined,
          notes: notes.trim(),
        });
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save material registration.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <SurfaceCard className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" title={editing ? "Edit Registered Material" : "Register Material"}>
        {formError && <p className="mb-3 text-sm text-red-700">{formError}</p>}
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="form-field">
            <span>Project</span>
            <GuiSelect className="input-field" onChange={(e) => setProjectId(e.target.value)} value={projectId}>
              {projects.map((p) => (
                <option key={`reg-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Material Name</span>
            <input className="input-field" onChange={(e) => setMaterialName(e.target.value)} placeholder="e.g. Cement, Steel bars..." value={materialName} />
          </label>
          <label className="form-field">
            <span>Required Quantity</span>
            <input className="input-field" onChange={(e) => setRequiredQty(e.target.value)} placeholder="e.g. 100" type="number" value={requiredQty} />
          </label>
          <label className="form-field">
            <span>Unit</span>
            <GuiSelect className="input-field" onChange={(e) => setUnit(e.target.value)} value={unit}>
              {options(MATERIAL_UNITS)}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Estimated Unit Cost (Optional)</span>
            <input
              className="input-field"
              onChange={(e) => setEstimatedUnitCost(e.target.value)}
              placeholder="e.g. 18000"
              type="number"
              value={estimatedUnitCost}
            />
            <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">
              Your cost per unit — pulled in when recording a purchase (still editable there).
            </span>
          </label>
          <label className="form-field">
            <span>Supply Source (Provider)</span>
            <GuiSelect className="input-field" onChange={(e) => setSupplySource(e.target.value as MaterialSupplySource)} value={supplySource}>
              {options(MATERIAL_SUPPLY_SOURCES)}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Priority</span>
            <GuiSelect className="input-field" onChange={(e) => setPriority(e.target.value)} value={priority}>
              {options(PRIORITIES)}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Needed By Date</span>
            <input className="input-field" onChange={(e) => setNeededByDate(e.target.value)} type="date" value={neededByDate} />
          </label>
          <label className="form-field sm:col-span-2">
            <span>Notes</span>
            <textarea className="input-field min-h-20" onChange={(e) => setNotes(e.target.value)} placeholder="Additional details about this material..." value={notes} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              {saving ? "Saving..." : editing ? "Update Registration" : "Save Registration"}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Add Material (Purchase) Modal
// ═════════════════════════════════════════════════════════════════════════════════

type RecordMaterialModalProps = {
  editing: MaterialPurchaseApiRecord | null;
  projects: ProjectApiRecord[];
  requirements: MaterialRequirementApiRecord[];
  suppliers: SupplierApiRecord[];
  defaultProjectId: string;
  onSave: () => void;
  onClose: () => void;
};

const RecordMaterialModal = ({
  editing,
  projects,
  requirements,
  suppliers,
  defaultProjectId,
  onSave,
  onClose,
}: RecordMaterialModalProps) => {
  const [projectId, setProjectId] = useState(editing?.projectId || defaultProjectId || projects[0]?.id || "");
  
  const projectRequirements = useMemo(() => 
    requirements.filter((r) => r.projectId === projectId),
    [requirements, projectId]
  );
  
  const [requirementId, setRequirementId] = useState(editing?.requirementId || "");
  const [fallbackMaterialName, setFallbackMaterialName] = useState(editing?.materialName || "");
  
  useEffect(() => {
    if (editing && editing.projectId === projectId && editing.requirementId === requirementId) return;
    if (projectRequirements.length > 0 && !projectRequirements.some((r) => r.id === requirementId)) {
      setRequirementId(projectRequirements[0].id);
    } else if (projectRequirements.length === 0) {
      setRequirementId("");
    }
  }, [projectId, projectRequirements, requirementId, editing]);

  const selectedReq = useMemo(() => 
    projectRequirements.find((r) => r.id === requirementId),
    [projectRequirements, requirementId]
  );

  const effectiveMaterialName = selectedReq?.materialName || fallbackMaterialName;
  const [qtyPurchased, setQtyPurchased] = useState(editing ? String(editing.quantityPurchased) : "");
  const [unitCost, setUnitCost] = useState(
    editing ? String(editing.unitCost) : "",
  );
  const [supplySource, setSupplySource] = useState<MaterialSupplySource>(editing?.supplySource || "Company Purchased");

  // When recording a new purchase, pull the chosen material's estimated cost in
  // as the starting unit cost — but leave it editable, since prices drift. Only
  // re-pulls when the selected material or supply source changes, so a value the
  // user has typed is never clobbered mid-edit.
  useEffect(() => {
    if (editing) return;
    if (supplySource === "Client Supplied") return;
    if (selectedReq && selectedReq.estimatedUnitCost > 0) {
      setUnitCost(String(selectedReq.estimatedUnitCost));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReq?.id, supplySource, editing]);

  const [supplierName, setSupplierName] = useState(editing?.supplierName || "");
  const [purchaseDate, setPurchaseDate] = useState(editing?.purchaseDate || "");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState(editing?.deliveryNoteNumber || "");
  const [deliveryStatus, setDeliveryStatus] = useState(editing?.deliveryStatus || "Pending Delivery");
  const [deliveredQuantity, setDeliveredQuantity] = useState(
    editing ? String(editing.deliveredQuantity) : "",
  );

  const handleStatusChange = (newStatus: string) => {
    setDeliveryStatus(newStatus);
    if (newStatus === "Delivered") setDeliveredQuantity(qtyPurchased);
    if (newStatus === "Pending Delivery") setDeliveredQuantity("0");
  };

  const [receiptRef, setReceiptRef] = useState(editing?.receiptRef || "");
  const [purchaseNotes, setPurchaseNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const isClientSupplied = supplySource === "Client Supplied";
  const purchaseTotal = useMemo(
    () => (Number(qtyPurchased) || 0) * (Number(unitCost) || 0),
    [qtyPurchased, unitCost],
  );
  const effectivePurchaseTotal = isClientSupplied ? 0 : purchaseTotal;

  const effectiveDeliveredQuantity = useMemo(() => {
    if (deliveryStatus === "Pending Delivery") return 0;
    return Math.max(Number(deliveredQuantity) || 0, 0);
  }, [deliveredQuantity, deliveryStatus]);

  const handleSave = async () => {
    const effectiveSupplierName = isClientSupplied
      ? (supplierName.trim() || "Client Supplied")
      : supplierName.trim();
    if (
      projectId.trim().length === 0 ||
      effectiveMaterialName.trim().length < 2 ||
      effectiveSupplierName.length < 2 ||
      (Number(qtyPurchased) || 0) <= 0 ||
      purchaseDate.trim().length === 0 ||
      (projectRequirements.length > 0 && !requirementId)
    ) {
      setFormError("Please provide project, registered material, supplier, quantity and purchase date.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        projectId,
        requirementId: requirementId || "",
        materialName: effectiveMaterialName.trim(),
        quantityPurchased: Number(qtyPurchased) || 0,
        deliveredQuantity: effectiveDeliveredQuantity,
        supplierName: effectiveSupplierName,
        unitCost: isClientSupplied ? 0 : Number(unitCost) || 0,
        supplySource,
        purchaseDate,
        deliveryNoteNumber: deliveryNoteNumber.trim(),
        deliveryStatus,
        receiptRef: receiptRef.trim(),
        notes: purchaseNotes.trim(),
      };
      if (editing) {
        await api.updateMaterialPurchase(editing.id, payload);
      } else {
        await api.createMaterialPurchase(payload);
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save material.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <SurfaceCard className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" title={editing ? "Edit Record" : "Record Material"}>
        {formError && <p className="mb-3 text-sm text-red-700">{formError}</p>}
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="form-field">
            <span>Project</span>
            <GuiSelect className="input-field" onChange={(e) => setProjectId(e.target.value)} value={projectId}>
              {projects.map((p) => (
                <option key={`buy-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Registered Material</span>
            {projectRequirements.length > 0 ? (
              <GuiSelect className="input-field" onChange={(e) => setRequirementId(e.target.value)} value={requirementId}>
                {projectRequirements.map((req) => (
                  <option key={`req-${req.id}`} value={req.id}>
                    {req.materialName} ({req.unit}) - Req: {req.requiredQuantity}
                  </option>
                ))}
              </GuiSelect>
            ) : (
              <input
                className="input-field"
                onChange={(e) => setFallbackMaterialName(e.target.value)}
                placeholder="No registered materials (Type name...)"
                value={fallbackMaterialName}
              />
            )}
          </label>
          <label className="form-field">
            <span>Supply Source</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => {
                const source = e.target.value as MaterialSupplySource;
                setSupplySource(source);
                if (source === "Client Supplied") {
                  setSupplierName((cur) => cur || "Client Supplied");
                  setUnitCost("0");
                } else if (supplierName === "Client Supplied") {
                  setSupplierName("");
                }
              }}
              value={supplySource}
            >
              {options(MATERIAL_SUPPLY_SOURCES)}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Quantity {isClientSupplied ? "Supplied" : "Purchased"} {selectedReq ? `(${selectedReq.unit})` : ""}</span>
            <input className="input-field" onChange={(e) => setQtyPurchased(e.target.value)} type="number" value={qtyPurchased} />
          </label>
          <label className="form-field">
            <span>Delivered Quantity</span>
            <input
              className="input-field"
              onChange={(e) => setDeliveredQuantity(e.target.value)}
              placeholder="Quantity received"
              type="number"
              value={deliveredQuantity}
            />
          </label>
          <label className="form-field relative">
            <span>{isClientSupplied ? "Supplied By" : "Supplier"}</span>
            <input 
              className="input-field" 
              list={isClientSupplied ? undefined : "supplier-options"} 
              onChange={(e) => setSupplierName(e.target.value)} 
              placeholder={isClientSupplied ? "Client" : "Select or type supplier name"} 
              value={supplierName} 
            />
            {!isClientSupplied && (
              <datalist id="supplier-options">
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
              </datalist>
            )}
          </label>
          {isClientSupplied ? (
            <div className="form-field sm:col-span-2">
              <span>Cost to Company</span>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                None — the client supplies this material, so it is tracked as quantity only.
              </p>
            </div>
          ) : (
            <>
              <FinancialInput label="Unit Cost" onChange={setUnitCost} placeholder="17500" value={unitCost} />
              <label className="form-field">
                <span>Total Cost (Auto)</span>
                <input className="input-field bg-slate-50" readOnly value={formatTzs(effectivePurchaseTotal)} />
              </label>
            </>
          )}
          <label className="form-field">
            <span>Date of Purchase</span>
            <input className="input-field" onChange={(e) => setPurchaseDate(e.target.value)} type="date" value={purchaseDate} />
          </label>
          <label className="form-field">
            <span>Delivery Note Number</span>
            <input className="input-field" onChange={(e) => setDeliveryNoteNumber(e.target.value)} placeholder="DN-..." value={deliveryNoteNumber} />
          </label>
          <label className="form-field">
            <span>Delivery Status</span>
            <GuiSelect className="input-field" onChange={(e) => handleStatusChange(e.target.value)} value={deliveryStatus}>
              {options(MATERIAL_DELIVERY_STATUSES)}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Receipt / Delivery Ref</span>
            <input className="input-field" onChange={(e) => setReceiptRef(e.target.value)} placeholder="MAT-RCP-001" value={receiptRef} />
          </label>
          <label className="form-field sm:col-span-2">
            <span>Notes</span>
            <textarea className="input-field min-h-20" onChange={(e) => setPurchaseNotes(e.target.value)} value={purchaseNotes} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={() => void handleSave()} type="button">
              {saving ? "Saving..." : editing ? "Update Material" : "Save Material"}
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════════
// Materials Page
// ═════════════════════════════════════════════════════════════════════════════════

type MaterialsPageProps = {
  embedded?: boolean;
  search?: string;
  /** Renders the shared operations tab bar with this page's filters on the search row. */
  renderSearchRow?: (actions?: ReactNode) => ReactNode;
  /** Renders the top tab strip, allowing this page to inject elements to the right side. */
  renderTabStrip?: (actions?: ReactNode) => ReactNode;
};

export const MaterialsPage = ({ embedded = false, search = "", renderSearchRow, renderTabStrip }: MaterialsPageProps) => {
  const { markSaved } = useUnsavedChanges();
  // Scope comes from the shared header switcher, not a per-page dropdown.
  const { activeProjectId } = useActiveProject();
  const projectFromQuery = activeProjectId;
  const listProjectFilter = activeProjectId || "All";

  // ─── Data state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [requirements, setRequirements] = useState<MaterialRequirementApiRecord[]>([]);
  const [purchases, setPurchases] = useState<MaterialPurchaseApiRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierApiRecord[]>([]);
  const [activeSection, setActiveSection] = useState<"registered" | "received">("registered");

  // ─── Modal visibility state (form state lives inside each modal component) ──
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<MaterialRequirementApiRecord | null>(null);
  const [viewRequirement, setViewRequirement] = useState<MaterialRequirementApiRecord | null>(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<MaterialPurchaseApiRecord | null>(null);
  const [viewPurchase, setViewPurchase] = useState<MaterialPurchaseApiRecord | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, materialsResponse, suppliersResponse] = await Promise.all([
          api.getProjects(),
          api.getMaterials(),
          api.getSuppliers(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setRequirements(materialsResponse.requirements);
        setPurchases(materialsResponse.purchases);
        setSuppliers(suppliersResponse.rows);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load materials.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  // Lock background scrolling while any modal is open
  useEffect(() => {
    const anyModalOpen = showRegisterModal || showPurchaseModal || viewRequirement !== null || viewPurchase !== null;
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showRegisterModal, showPurchaseModal, viewRequirement, viewPurchase]);

  const refreshData = async () => {
    const response = await api.getMaterials();
    setRequirements(response.requirements);
    setPurchases(response.purchases);
  };

  // ─── Bulk import from Excel ─────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProjectId, setImportProjectId] = useState(activeProjectId);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const openImport = () => {
    setImportProjectId(activeProjectId || projects[0]?.id || "");
    setShowImportModal(true);
  };

  const handleDownloadMaterialTemplate = async () => {
    try {
      const { blob, filename } = await api.downloadMaterialsTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      pushTopToast({ tone: "error", title: "Materials", message: "Failed to download the template." });
    }
  };

  const handleImportMaterials = async (file: File) => {
    if (!importProjectId) {
      pushTopToast({ tone: "error", title: "Materials", message: "Choose a project first." });
      return;
    }
    setImporting(true);
    try {
      const result = await api.importMaterials(importProjectId, file);
      await refreshData();
      const extra = result.skipped > 0 ? ` (${result.skipped} row(s) skipped)` : "";
      pushTopToast({
        tone: result.skipped > 0 ? "info" : "success",
        title: "Materials",
        message: `${result.imported} material(s) imported${extra}.`,
      });
      if (result.errors.length > 0) {
        pushTopToast({ tone: "error", title: "Skipped rows", message: result.errors.slice(0, 4).join(" · ") });
      }
      setShowImportModal(false);
    } catch (importError) {
      pushTopToast({
        tone: "error",
        title: "Materials",
        message: importError instanceof Error ? importError.message : "Import failed.",
      });
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  // ─── Filtered requirements ────────────────────────────────────────────────────
  const filteredRequirements = useMemo(() => {
    let result = requirements;
    if (listProjectFilter !== "All") {
      result = result.filter((req) => req.projectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const query = search.trim().toLowerCase();
      result = result.filter((req) =>
        req.materialName.toLowerCase().includes(query) ||
        req.projectName.toLowerCase().includes(query) ||
        req.supplySource.toLowerCase().includes(query) ||
        req.supplyStatus.toLowerCase().includes(query)
      );
    }
    return result;
  }, [listProjectFilter, requirements, search]);

  // ─── Filtered purchases ───────────────────────────────────────────────────────
  const filteredPurchases = useMemo(() => {
    let result = purchases;
    if (listProjectFilter !== "All") {
      result = result.filter((purchase) => purchase.projectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const query = search.trim().toLowerCase();
      result = result.filter((purchase) =>
        purchase.materialName.toLowerCase().includes(query) ||
        purchase.projectName.toLowerCase().includes(query) ||
        purchase.supplierName.toLowerCase().includes(query) ||
        purchase.deliveryStatus.toLowerCase().includes(query)
      );
    }
    return result;
  }, [listProjectFilter, purchases, search]);

  // ─── Summaries ────────────────────────────────────────────────────────────────
  const requirementsSummary = useMemo(() => filteredRequirements.reduce(
    (summary, req) => {
      summary.totalRegistered += 1;
      summary.totalRequired += req.requiredQuantity;
      summary.totalPurchased += req.purchasedQuantity;
      summary.totalRemaining += req.remainingQuantity;
      return summary;
    },
    { totalRegistered: 0, totalRequired: 0, totalPurchased: 0, totalRemaining: 0 },
  ), [filteredRequirements]);

  const purchasesSummary = useMemo(() => filteredPurchases.reduce(
    (summary, purchase) => {
      summary.totalReceipts += 1;
      summary.totalPurchased += purchase.quantityPurchased;
      summary.totalDelivered += purchase.deliveredQuantity;
      summary.totalPending += Math.max(purchase.quantityPurchased - purchase.deliveredQuantity, 0);
      summary.totalValue += purchase.totalCost;
      return summary;
    },
    {
      totalReceipts: 0,
      totalPurchased: 0,
      totalDelivered: 0,
      totalPending: 0,
      totalValue: 0,
    },
  ), [filteredPurchases]);

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const requirementsPagination = useTablePagination(filteredRequirements);
  const materialsPagination = useTablePagination(filteredPurchases);

  // ─── Modal open/close handlers ────────────────────────────────────────────────
  const openRegisterNew = () => {
    setEditingRequirement(null);
    setShowRegisterModal(true);
  };

  const openEditRequirement = (req: MaterialRequirementApiRecord) => {
    setEditingRequirement(req);
    setShowRegisterModal(true);
  };

  const handleRegisterSaved = async () => {
    await refreshData();
    markSaved();
    setShowRegisterModal(false);
    setEditingRequirement(null);
  };

  const closeRegisterModal = () => {
    setShowRegisterModal(false);
    setEditingRequirement(null);
  };

  const openPurchaseNew = () => {
    setEditingPurchase(null);
    setShowPurchaseModal(true);
  };

  const openEditPurchase = (purchase: MaterialPurchaseApiRecord) => {
    setEditingPurchase(purchase);
    setShowPurchaseModal(true);
  };

  const handlePurchaseSaved = async () => {
    await refreshData();
    markSaved();
    setShowPurchaseModal(false);
    setEditingPurchase(null);
  };

  const closePurchaseModal = () => {
    setShowPurchaseModal(false);
    setEditingPurchase(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Register materials needed for projects and record materials received."
          title="Materials Management"
        />
      ) : null}

      {renderTabStrip?.(
        <div className="inline-flex h-10 w-full rounded-lg border border-[#0b2a53]/15 bg-white p-1 shadow-sm sm:w-auto dark:border-white/10 dark:bg-white/5">
          <button
            className={[
              "flex-1 rounded-md px-4 text-sm font-semibold transition sm:flex-none",
              activeSection === "registered"
                ? "bg-[#0b2a53] text-white"
                : "text-[#0b2a53] hover:bg-[#0b2a53]/5 dark:text-slate-200 dark:hover:bg-white/10",
            ].join(" ")}
            onClick={() => setActiveSection("registered")}
            type="button"
          >
            Registered Materials
          </button>
          <button
            className={[
              "flex-1 rounded-md px-4 text-sm font-semibold transition sm:flex-none",
              activeSection === "received"
                ? "bg-[#0b2a53] text-white"
                : "text-[#0b2a53] hover:bg-[#0b2a53]/5 dark:text-slate-200 dark:hover:bg-white/10",
            ].join(" ")}
            onClick={() => setActiveSection("received")}
            type="button"
          >
            Materials Received
          </button>
        </div>,
      )}

      {renderSearchRow?.(
        activeSection === "registered" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn-secondary h-11 justify-center whitespace-nowrap"
              onClick={openImport}
              type="button"
            >
              Import Excel
            </button>
            <button
              className="btn-secondary h-11 justify-center whitespace-nowrap"
              onClick={openRegisterNew}
              type="button"
            >
              + Register Material
            </button>
          </div>
        ) : (
          <button
            className="btn-primary h-11 justify-center whitespace-nowrap"
            onClick={openPurchaseNew}
            type="button"
          >
            + Record Material
          </button>
        )
      )}

      {activeSection === "registered" ? (
        <div className="space-y-6">
          {/* ── Registered Materials ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard title="Registered">
          <p className="text-xl font-bold text-slate-900">{requirementsSummary.totalRegistered}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Required">
          <p className="text-xl font-bold text-slate-900">{formatNumber(requirementsSummary.totalRequired)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Purchased">
          <p className="text-xl font-bold text-emerald-700">{formatNumber(requirementsSummary.totalPurchased)}</p>
        </SurfaceCard>
        <SurfaceCard title="Remaining">
          <p className={`text-xl font-bold ${requirementsSummary.totalRemaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {formatNumber(requirementsSummary.totalRemaining)}
          </p>
        </SurfaceCard>
      </div>

      {/* ── Materials Received ────────────────────────────────────────────────── */}
      {/* Moved down below the Registered Materials table */}

      <SurfaceCard title="Registered Materials">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={4} />
        ) : filteredRequirements.length === 0 ? (
          <EmptyState description="No registered materials found. Use 'Register Material' to add materials needed for a project." title="No registered materials" />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[1020px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Material</th>
                    <th>Project</th>
                    <th>Unit</th>
                    <th>Required</th>
                    <th>Purchased</th>
                    <th>Remaining</th>
                    <th>Source</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementsPagination.paginatedRows.map((req, index) => (
                    <tr key={req.id}>
                      <td className="ops-sticky-sn">{requirementsPagination.startIndex + index + 1}</td>
                      <td><span className="ops-cell-strong">{req.materialName}</span></td>
                      <td><span className="ops-cell-text">{req.projectName}</span></td>
                      <td>{req.unit}</td>
                      <td>{formatNumber(req.requiredQuantity)}</td>
                      <td>{formatNumber(req.purchasedQuantity)}</td>
                      <td className={req.remainingQuantity > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {formatNumber(req.remainingQuantity)}
                      </td>
                      <td>{req.supplySource}</td>
                      <td><span className={priorityClass(req.priority)}>{req.priority}</span></td>
                      <td><span className={supplyStatusClass(req.supplyStatus)}>{req.supplyStatus}</span></td>
                      <td className="ops-sticky-actions">
                        <div className="ops-actions-row">
                          <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setViewRequirement(req)} type="button">
                            View
                          </button>
                          <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEditRequirement(req)} type="button">
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={requirementsPagination.endIndex}
              itemLabel="materials"
              onPageChange={requirementsPagination.setPage}
              onPageSizeChange={requirementsPagination.setPageSize}
              page={requirementsPagination.page}
              pageSize={requirementsPagination.pageSize}
              startIndex={requirementsPagination.startIndex}
              totalCount={requirementsPagination.totalCount}
              totalPages={requirementsPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>
        </div>
      ) : (
        <div className="space-y-6">
      {/* ── Materials Received ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Received">
          <p className="text-xl font-bold text-slate-900">{purchasesSummary.totalReceipts}</p>
        </SurfaceCard>
        <SurfaceCard title="Quantity Purchased">
          <p className="text-xl font-bold text-slate-900">{formatNumber(purchasesSummary.totalPurchased)}</p>
        </SurfaceCard>
        <SurfaceCard title="Quantity Delivered">
          <p className="text-xl font-bold text-emerald-700">{formatNumber(purchasesSummary.totalDelivered)}</p>
        </SurfaceCard>
        <SurfaceCard title="Pending Delivery">
          <p className={`text-xl font-bold ${purchasesSummary.totalPending > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {formatNumber(purchasesSummary.totalPending)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Purchase Value">
          <p className="text-xl font-bold text-[#0b2a53]">{formatTzs(purchasesSummary.totalValue)}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Materials Received">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredPurchases.length === 0 ? (
          <EmptyState description="No materials received yet. Use 'Record Material' to record materials purchased or supplied." title="No materials received" />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Material</th>
                    <th>Project/Site</th>
                    <th>Source</th>
                    <th>Quantity</th>
                    <th>Delivered</th>
                    <th>Pending</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materialsPagination.paginatedRows.map((purchase, index) => {
                    const pendingQuantity = Math.max(
                      purchase.quantityPurchased - purchase.deliveredQuantity,
                      0,
                    );
                    return (
                      <tr key={purchase.id}>
                        <td className="ops-sticky-sn">{materialsPagination.startIndex + index + 1}</td>
                        <td><span className="ops-cell-strong">{purchase.materialName}</span></td>
                        <td><span className="ops-cell-text">{purchase.projectName}</span></td>
                        <td>{purchase.supplySource}</td>
                        <td>{formatNumber(purchase.quantityPurchased)}</td>
                        <td>{formatNumber(purchase.deliveredQuantity)}</td>
                        <td className={pendingQuantity > 0 ? "text-amber-700" : "text-emerald-700"}>
                          {formatNumber(pendingQuantity)}
                        </td>
                        <td>{formatTzs(purchase.totalCost)}</td>
                        <td>
                          <span className={
                            purchase.deliveryStatus === "Delivered"
                              ? "text-sm font-medium text-emerald-700"
                              : purchase.deliveryStatus === "Partially Delivered"
                                ? "text-sm font-medium text-amber-700"
                                : "text-sm font-medium text-slate-500"
                          }>
                            {purchase.deliveryStatus}
                          </span>
                        </td>
                        <td className="ops-sticky-actions">
                          <div className="ops-actions-row">
                            <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setViewPurchase(purchase)} type="button">
                              View
                            </button>
                            <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => openEditPurchase(purchase)} type="button">
                              Edit
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
              endIndex={materialsPagination.endIndex}
              itemLabel="materials"
              onPageChange={materialsPagination.setPage}
              onPageSizeChange={materialsPagination.setPageSize}
              page={materialsPagination.page}
              pageSize={materialsPagination.pageSize}
              startIndex={materialsPagination.startIndex}
              totalCount={materialsPagination.totalCount}
              totalPages={materialsPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>
      </div>
      )}

      {/* ── View Registered Material detail modal ─────────────────────────────── */}
      <DetailModal
        onClose={() => setViewRequirement(null)}
        open={viewRequirement !== null}
        rows={viewRequirement ? [
          { label: "Project / Site", value: viewRequirement.projectName },
          { label: "Material", value: viewRequirement.materialName },
          { label: "Unit", value: viewRequirement.unit },
          { label: "Required Quantity", value: formatNumber(viewRequirement.requiredQuantity) },
          { label: "Purchased Quantity", value: formatNumber(viewRequirement.purchasedQuantity) },
          { label: "Delivered Quantity", value: formatNumber(viewRequirement.deliveredQuantity) },
          { label: "Remaining", value: formatNumber(viewRequirement.remainingQuantity) },
          { label: "Supply Source", value: viewRequirement.supplySource },
          { label: "Priority", value: viewRequirement.priority },
          { label: "Supply Status", value: viewRequirement.supplyStatus },
          { label: "Needed By", value: viewRequirement.neededByDate ? formatDate(viewRequirement.neededByDate) : "-" },
          { label: "Notes", value: viewRequirement.notes || "-", full: true },
        ] : []}
        subtitle={viewRequirement ? viewRequirement.materialName : ""}
        title="Registered Material Details"
      />

      {/* ── View Material Received detail modal ──────────────────────────────── */}
      <DetailModal
        onClose={() => setViewPurchase(null)}
        open={viewPurchase !== null}
        rows={viewPurchase ? [
          { label: "Project / Site", value: viewPurchase.projectName },
          { label: "Material", value: viewPurchase.materialName },
          { label: "Supply Source", value: viewPurchase.supplySource },
          { label: "Quantity", value: formatNumber(viewPurchase.quantityPurchased) },
          { label: "Delivered", value: formatNumber(viewPurchase.deliveredQuantity) },
          { label: "Supplier", value: viewPurchase.supplierName || "-" },
          { label: "Unit Cost", value: formatTzs(viewPurchase.unitCost) },
          { label: "Total Cost", value: formatTzs(viewPurchase.totalCost) },
          { label: "Purchase Date", value: formatDate(viewPurchase.purchaseDate) },
          { label: "Delivery Status", value: viewPurchase.deliveryStatus },
          { label: "Delivery Note", value: viewPurchase.deliveryNoteNumber || "-" },
          { label: "Receipt Reference", value: viewPurchase.receiptRef || "-" },
          { label: "Approval Status", value: viewPurchase.approvalStatus || "-" },
          { label: "Notes", value: viewPurchase.notes || "-", full: true },
        ] : []}
        subtitle={viewPurchase ? viewPurchase.materialName : ""}
        title="Material Details"
      />

      {/* ── Register Material form modal (isolated component) ────────────────── */}
      {showRegisterModal && (
        <RegisterMaterialModal
          defaultProjectId={projectFromQuery || projects[0]?.id || ""}
          editing={editingRequirement}
          onClose={closeRegisterModal}
          onSave={() => void handleRegisterSaved()}
          projects={projects}
        />
      )}

      {/* ── Record Material form modal (isolated component) ─────────────────────── */}
      {showPurchaseModal && (
        <RecordMaterialModal
          defaultProjectId={projectFromQuery || projects[0]?.id || ""}
          editing={editingPurchase}
          onClose={closePurchaseModal}
          onSave={() => void handlePurchaseSaved()}
          projects={projects}
          requirements={requirements}
          suppliers={suppliers}
        />
      )}

      {/* ── Bulk import from Excel ──────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <SurfaceCard className="my-8 w-full max-w-lg" title="Import Materials from Excel">
            <p className="mb-3 text-sm text-slate-500">
              Download the template, fill one row per material the project needs, then
              upload it. Each valid row is registered against the chosen project.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project / Site</span>
                <GuiSelect className="input-field" onChange={(e) => setImportProjectId(e.target.value)} value={importProjectId}>
                  <option value="">Select a project…</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </GuiSelect>
              </label>
              <div className="flex items-end">
                <button className="btn-secondary h-11 w-full justify-center" onClick={() => void handleDownloadMaterialTemplate()} type="button">
                  Download Excel template
                </button>
              </div>
            </div>

            <input
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImportMaterials(file); }}
              ref={importFileRef}
              type="file"
            />

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
              <button className="btn-secondary" onClick={() => setShowImportModal(false)} type="button">Cancel</button>
              <button
                className="btn-primary"
                disabled={importing || !importProjectId}
                onClick={() => importFileRef.current?.click()}
                type="button"
              >
                {importing ? "Importing…" : "Upload filled file"}
              </button>
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
