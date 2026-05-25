import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  FinancialInput,
  ProgressBar,
  SectionTitle,
  SkeletonTable,
  SurfaceCard,
  TablePagination,
  GuiSelect,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type MaterialPurchaseApiRecord,
  type MaterialRequirementApiRecord,
  type MaterialsResponse,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate, formatNumber, formatTzs } from "../utils/format";

const materialIndicator = (needed: number, purchased: number) => {
  if (purchased >= needed) return "Fully purchased";
  if (purchased > 0) return "Partially purchased";
  return "Not purchased";
};

type MaterialTableRow = {
  id: string;
  projectId: string;
  projectName: string;
  materialName: string;
  needed: number;
  purchased: number;
  remaining: number;
  unit: string;
  supplier: string;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  deliveryStatus: string;
};

const normalizeMaterialName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

type MaterialsPageProps = {
  embedded?: boolean;
  search?: string;
  tabBar?: ReactNode;
};

export const MaterialsPage = ({ embedded = false, search = "", tabBar }: MaterialsPageProps) => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [requirements, setRequirements] = useState<MaterialRequirementApiRecord[]>([]);
  const [purchases, setPurchases] = useState<MaterialPurchaseApiRecord[]>([]);
  const [listProjectFilter, setListProjectFilter] = useState(projectFromQuery || "All");

  // Modal states
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Requirement form
  const [requirementProjectId, setRequirementProjectId] = useState(projectFromQuery);
  const [requirementMaterialName, setRequirementMaterialName] = useState("");
  const [requiredQuantity, setRequiredQuantity] = useState("");
  const [requirementUnit, setRequirementUnit] = useState("Bags");
  const [estimatedUnitCost, setEstimatedUnitCost] = useState("");
  const [priority, setPriority] = useState("High");
  const [neededByDate, setNeededByDate] = useState("");
  const [requirementNotes, setRequirementNotes] = useState("");
  const [savingRequirement, setSavingRequirement] = useState(false);

  // Purchase form
  const [purchaseProjectId, setPurchaseProjectId] = useState(projectFromQuery);
  const [purchaseRequirementId, setPurchaseRequirementId] = useState("");
  const [purchaseMaterialName, setPurchaseMaterialName] = useState("");
  const [qtyPurchased, setQtyPurchased] = useState("120");
  const [unitCost, setUnitCost] = useState("17500");
  const [supplierName, setSupplierName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("Pending Delivery");
  const [receiptRef, setReceiptRef] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [projectRows, materialsResponse] = await Promise.all([
          api.getProjects(),
          api.getMaterials(),
        ]);
        if (!mounted) return;
        setProjects(projectRows);
        setRequirements(materialsResponse.requirements);
        setPurchases(materialsResponse.purchases);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load materials data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (projectFromQuery.length === 0) return;
    setListProjectFilter(projectFromQuery);
    setRequirementProjectId(projectFromQuery);
    setPurchaseProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0) return;
    const defaultId = projects[0]?.id ?? "";
    if (requirementProjectId.length === 0) setRequirementProjectId(projectFromQuery || defaultId);
    if (purchaseProjectId.length === 0) setPurchaseProjectId(projectFromQuery || defaultId);
  }, [projectFromQuery, projects, purchaseProjectId, requirementProjectId]);

  const refreshMaterials = async () => {
    const response: MaterialsResponse = await api.getMaterials();
    setRequirements(response.requirements);
    setPurchases(response.purchases);
  };

  const requirementOptions = useMemo(
    () => requirements.filter((r) => purchaseProjectId.length === 0 || r.projectId === purchaseProjectId),
    [purchaseProjectId, requirements],
  );

  useEffect(() => {
    if (requirementOptions.length === 0) { setPurchaseRequirementId(""); return; }
    if (purchaseRequirementId.length > 0 && !requirementOptions.some((r) => r.id === purchaseRequirementId)) {
      setPurchaseRequirementId("");
    }
  }, [purchaseRequirementId, requirementOptions]);

  const selectedRequirement = useMemo(
    () => requirementOptions.find((r) => r.id === purchaseRequirementId) ?? null,
    [purchaseRequirementId, requirementOptions],
  );

  useEffect(() => {
    if (!selectedRequirement) return;
    setPurchaseMaterialName(selectedRequirement.materialName);
    if (!unitCost || Number(unitCost) === 0) setUnitCost(String(selectedRequirement.estimatedUnitCost));
  }, [selectedRequirement, unitCost]);

  const tableRows = useMemo<MaterialTableRow[]>(() => {
    return requirements.map((req) => {
      const related = purchases.filter((p) => {
        if (p.requirementId) return p.requirementId === req.id;
        return p.projectId === req.projectId && normalizeMaterialName(p.materialName) === normalizeMaterialName(req.materialName);
      });
      const latest = related.reduce<MaterialPurchaseApiRecord | null>((acc, cur) => {
        if (!acc) return cur;
        return cur.purchaseDate > acc.purchaseDate ? cur : acc;
      }, null);
      return {
        id: req.id,
        projectId: req.projectId,
        projectName: req.projectName,
        materialName: req.materialName,
        needed: req.requiredQuantity,
        purchased: req.purchasedQuantity,
        remaining: req.remainingQuantity,
        unit: req.unit,
        supplier: latest?.supplierName ?? "-",
        unitCost: latest?.unitCost ?? req.estimatedUnitCost,
        totalCost: latest?.totalCost ?? 0,
        purchaseDate: latest?.purchaseDate ?? "",
        deliveryStatus: latest?.deliveryStatus ?? "Pending Delivery",
      };
    });
  }, [purchases, requirements]);

  const filteredRows = useMemo(() => {
    let result = tableRows;
    if (listProjectFilter !== "All") {
      result = result.filter((r) => r.projectId === listProjectFilter);
    }
    if (search.trim().length > 0) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.materialName.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q) ||
          r.supplier.toLowerCase().includes(q) ||
          r.deliveryStatus.toLowerCase().includes(q),
      );
    }
    return result;
  }, [listProjectFilter, search, tableRows]);

  const materialsSummary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalRequirements += 1;
        acc.totalNeeded += row.needed;
        acc.totalPurchased += row.purchased;
        acc.totalRemaining += row.remaining;
        acc.totalValue += row.totalCost;
        if (row.remaining <= 0) acc.completedRequirements += 1;
        return acc;
      },
      {
        totalRequirements: 0,
        totalNeeded: 0,
        totalPurchased: 0,
        totalRemaining: 0,
        totalValue: 0,
        completedRequirements: 0,
      },
    );
  }, [filteredRows]);

  const materialsPagination = useTablePagination(filteredRows);

  const purchaseTotal = useMemo(() => (Number(qtyPurchased) || 0) * (Number(unitCost) || 0), [qtyPurchased, unitCost]);

  const purchaseProgress = useMemo(() => {
    if (!selectedRequirement) return 0;
    const target = selectedRequirement.requiredQuantity || 1;
    const expected = selectedRequirement.purchasedQuantity + (Number(qtyPurchased) || 0);
    return Math.min(100, Math.max(0, Math.round((expected / target) * 100)));
  }, [qtyPurchased, selectedRequirement]);

  const resetRequirementForm = () => {
    setRequirementMaterialName("");
    setRequiredQuantity("");
    setEstimatedUnitCost("");
    setNeededByDate("");
    setRequirementNotes("");
  };

  const resetPurchaseForm = () => {
    setPurchaseRequirementId("");
    setPurchaseMaterialName("");
    setQtyPurchased("");
    setSupplierName("");
    setUnitCost("");
    setPurchaseDate("");
    setDeliveryNoteNumber("");
    setDeliveryStatus("Pending Delivery");
    setReceiptRef("");
    setPurchaseNotes("");
  };

  const handleSaveRequirement = async () => {
    if (requirementProjectId.trim().length === 0 || requirementMaterialName.trim().length < 2 || (Number(requiredQuantity) || 0) <= 0) {
      setError("Please provide project, material name and valid required quantity.");
      return;
    }
    setSavingRequirement(true);
    setError("");
    try {
      await api.createMaterialRequirement({
        projectId: requirementProjectId,
        materialName: requirementMaterialName.trim(),
        requiredQuantity: Number(requiredQuantity) || 0,
        unit: requirementUnit,
        estimatedUnitCost: Number(estimatedUnitCost) || 0,
        priority,
        neededByDate: neededByDate || undefined,
        notes: requirementNotes.trim(),
      });
      await refreshMaterials();
      markSaved();
      setShowRequirementModal(false);
      resetRequirementForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save material requirement.");
    } finally {
      setSavingRequirement(false);
    }
  };

  const handleSavePurchase = async () => {
    if (purchaseProjectId.trim().length === 0 || purchaseMaterialName.trim().length < 2 || supplierName.trim().length < 2 || (Number(qtyPurchased) || 0) <= 0 || purchaseDate.trim().length === 0) {
      setError("Please provide project, material, supplier, quantity and purchase date.");
      return;
    }
    setSavingPurchase(true);
    setError("");
    try {
      await api.createMaterialPurchase({
        projectId: purchaseProjectId,
        requirementId: purchaseRequirementId,
        materialName: purchaseMaterialName.trim(),
        quantityPurchased: Number(qtyPurchased) || 0,
        supplierName: supplierName.trim(),
        unitCost: Number(unitCost) || 0,
        purchaseDate,
        deliveryNoteNumber: deliveryNoteNumber.trim(),
        deliveryStatus,
        receiptRef: receiptRef.trim(),
        notes: purchaseNotes.trim(),
      });
      await refreshMaterials();
      markSaved();
      setShowPurchaseModal(false);
      resetPurchaseForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save material purchase.");
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <SectionTitle
          subtitle="Track required materials, purchases, supplier deliveries and quantity gaps."
          title="Materials & Requirements Management"
        />
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SurfaceCard title="Requirements">
          <p className="text-2xl font-bold text-slate-900">{materialsSummary.totalRequirements}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Qty Needed">
          <p className="text-2xl font-bold text-slate-900">{formatNumber(materialsSummary.totalNeeded)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Qty Purchased">
          <p className="text-2xl font-bold text-emerald-700">{formatNumber(materialsSummary.totalPurchased)}</p>
        </SurfaceCard>
        <SurfaceCard title="Remaining Qty">
          <p className={`text-2xl font-bold ${materialsSummary.totalRemaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {formatNumber(materialsSummary.totalRemaining)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Purchase Value">
          <p className="text-2xl font-bold text-[#0b2a53]">{formatTzs(materialsSummary.totalValue)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Completed: {materialsSummary.completedRequirements}/{materialsSummary.totalRequirements}
          </p>
        </SurfaceCard>
      </div>

      {tabBar}

      {/* Filter and Add buttons - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <div className="w-full sm:w-56">
          <label className="form-field">
            <span className="text-sm">Filter by Project</span>
            <GuiSelect className="input-field" onChange={(e) => setListProjectFilter(e.target.value)} value={listProjectFilter}>
              <option value="All">All Projects</option>
              {projects.map((p) => <option key={`mat-list-${p.id}`} value={p.id}>{p.name}</option>)}
            </GuiSelect>
          </label>
        </div>
        <button className="btn-primary whitespace-nowrap" onClick={() => { resetRequirementForm(); setShowRequirementModal(true); }} type="button">
          + Add Requirement
        </button>
        <button className="btn-primary whitespace-nowrap" onClick={() => { resetPurchaseForm(); setShowPurchaseModal(true); }} type="button">
          + Add Purchase
        </button>
      </div>

      {/* Materials Table */}
      <SurfaceCard title="Material Requirements & Purchases">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState description="No material requirements found for the selected project." title="No materials" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Material Name</th>
                    <th>Project/Site</th>
                    <th>Qty Needed</th>
                    <th>Qty Purchased</th>
                    <th>Remaining</th>
                    <th>Unit</th>
                    <th>Supplier</th>
                    <th>Unit Cost</th>
                    <th>Total Cost</th>
                    <th>Purchase Date</th>
                    <th>Delivery Status</th>
                    <th>Indicator</th>
                  </tr>
                </thead>
                <tbody>
                  {materialsPagination.paginatedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{materialsPagination.startIndex + index + 1}</td>
                      <td>{row.materialName}</td>
                      <td>{row.projectName}</td>
                      <td>{formatNumber(row.needed)}</td>
                      <td>{formatNumber(row.purchased)}</td>
                      <td className={row.remaining > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {formatNumber(row.remaining)}
                      </td>
                      <td>{row.unit}</td>
                      <td>{row.supplier}</td>
                      <td>{formatTzs(row.unitCost)}</td>
                      <td>{formatTzs(row.totalCost)}</td>
                      <td>{row.purchaseDate ? formatDate(row.purchaseDate) : "-"}</td>
                      <td>
                        <span className={
                          row.deliveryStatus === "Delivered"
                            ? "text-sm font-medium text-emerald-700"
                            : row.deliveryStatus === "Partially Delivered"
                              ? "text-sm font-medium text-amber-700"
                              : "text-sm font-medium text-slate-500"
                        }>
                          {row.deliveryStatus}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-slate-700">
                          {materialIndicator(row.needed, row.purchased)}
                        </span>
                      </td>
                    </tr>
                  ))}
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

      {/* Add Requirement Modal */}
      {showRequirementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Add Material Requirement">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project</span>
                <GuiSelect className="input-field" onChange={(e) => setRequirementProjectId(e.target.value)} value={requirementProjectId}>
                  {projects.map((p) => <option key={`req-${p.id}`} value={p.id}>{p.name}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Material Name</span>
                <input className="input-field" onChange={(e) => setRequirementMaterialName(e.target.value)} placeholder="Cement / Steel bars..." value={requirementMaterialName} />
              </label>
              <label className="form-field">
                <span>Required Quantity</span>
                <input className="input-field" onChange={(e) => setRequiredQuantity(e.target.value)} type="number" value={requiredQuantity} />
              </label>
              <label className="form-field">
                <span>Unit</span>
                <GuiSelect className="input-field" onChange={(e) => setRequirementUnit(e.target.value)} value={requirementUnit}>
                  {["Bags", "Pieces", "Tonnes", "Litres", "Lengths", "Cubic Meter"].map((u) => <option key={u} value={u}>{u}</option>)}
                </GuiSelect>
              </label>
              <FinancialInput label="Estimated Unit Cost" onChange={setEstimatedUnitCost} placeholder="17500" value={estimatedUnitCost} />
              <label className="form-field">
                <span>Priority</span>
                <GuiSelect className="input-field" onChange={(e) => setPriority(e.target.value)} value={priority}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Needed By Date</span>
                <input className="input-field" onChange={(e) => setNeededByDate(e.target.value)} type="date" value={neededByDate} />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea className="input-field min-h-20" onChange={(e) => setRequirementNotes(e.target.value)} value={requirementNotes} />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => { setShowRequirementModal(false); resetRequirementForm(); }} type="button">Cancel</button>
                <button className="btn-primary" disabled={savingRequirement} onClick={() => void handleSaveRequirement()} type="button">
                  Save Requirement
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Add Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Add Material Purchase">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project</span>
                <GuiSelect className="input-field" onChange={(e) => setPurchaseProjectId(e.target.value)} value={purchaseProjectId}>
                  {projects.map((p) => <option key={`buy-${p.id}`} value={p.id}>{p.name}</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Requirement (Optional)</span>
                <GuiSelect className="input-field" onChange={(e) => setPurchaseRequirementId(e.target.value)} value={purchaseRequirementId}>
                  <option value="">No linked requirement</option>
                  {requirementOptions.map((r) => <option key={`buy-req-${r.id}`} value={r.id}>{r.materialName} ({formatNumber(r.remainingQuantity)} remaining)</option>)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Material Name</span>
                <input className="input-field" onChange={(e) => setPurchaseMaterialName(e.target.value)} placeholder="Material purchased..." value={purchaseMaterialName} />
              </label>
              <label className="form-field">
                <span>Quantity Purchased</span>
                <input className="input-field" onChange={(e) => setQtyPurchased(e.target.value)} type="number" value={qtyPurchased} />
              </label>
              <label className="form-field">
                <span>Supplier</span>
                <input className="input-field" onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" value={supplierName} />
              </label>
              <FinancialInput label="Unit Cost" onChange={setUnitCost} placeholder="17500" value={unitCost} />
              <label className="form-field">
                <span>Total Cost (Auto)</span>
                <input className="input-field bg-slate-50" readOnly value={formatTzs(purchaseTotal)} />
              </label>
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
                <GuiSelect className="input-field" onChange={(e) => setDeliveryStatus(e.target.value)} value={deliveryStatus}>
                  <option value="Pending Delivery">Pending Delivery</option>
                  <option value="Partially Delivered">Partially Delivered</option>
                  <option value="Delivered">Delivered</option>
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
              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase Completion Indicator</p>
                <div className="mt-2"><ProgressBar value={purchaseProgress} /></div>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => { setShowPurchaseModal(false); resetPurchaseForm(); }} type="button">Cancel</button>
                <button className="btn-primary" disabled={savingPurchase} onClick={() => void handleSavePurchase()} type="button">
                  Save Purchase
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
};
