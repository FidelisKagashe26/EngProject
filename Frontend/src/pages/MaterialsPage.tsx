import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  FinancialInput,
  ProgressBar,
  SectionTitle,
  SkeletonTable,
  StatusBadge,
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

export const MaterialsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [searchParams] = useSearchParams();
  const projectFromQuery = searchParams.get("projectId") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [requirements, setRequirements] = useState<MaterialRequirementApiRecord[]>(
    [],
  );
  const [purchases, setPurchases] = useState<MaterialPurchaseApiRecord[]>([]);
  const [listProjectFilter, setListProjectFilter] = useState(
    projectFromQuery || "All",
  );

  const [requirementProjectId, setRequirementProjectId] = useState(projectFromQuery);
  const [requirementMaterialName, setRequirementMaterialName] = useState("");
  const [requiredQuantity, setRequiredQuantity] = useState("");
  const [requirementUnit, setRequirementUnit] = useState("Bags");
  const [estimatedUnitCost, setEstimatedUnitCost] = useState("");
  const [priority, setPriority] = useState("High");
  const [neededByDate, setNeededByDate] = useState("");
  const [requirementNotes, setRequirementNotes] = useState("");
  const [savingRequirement, setSavingRequirement] = useState(false);

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

        if (!mounted) {
          return;
        }

        setProjects(projectRows);
        setRequirements(materialsResponse.requirements);
        setPurchases(materialsResponse.purchases);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load materials data.";
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

    setListProjectFilter(projectFromQuery);
    setRequirementProjectId(projectFromQuery);
    setPurchaseProjectId(projectFromQuery);
  }, [projectFromQuery]);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    const defaultProjectId = projects[0]?.id ?? "";
    if (requirementProjectId.length === 0) {
      setRequirementProjectId(projectFromQuery || defaultProjectId);
    }
    if (purchaseProjectId.length === 0) {
      setPurchaseProjectId(projectFromQuery || defaultProjectId);
    }
  }, [projectFromQuery, projects, purchaseProjectId, requirementProjectId]);

  const refreshMaterials = async () => {
    const response: MaterialsResponse = await api.getMaterials();
    setRequirements(response.requirements);
    setPurchases(response.purchases);
  };

  const requirementOptions = useMemo(
    () =>
      requirements.filter(
        (requirement) =>
          purchaseProjectId.length === 0 ||
          requirement.projectId === purchaseProjectId,
      ),
    [purchaseProjectId, requirements],
  );

  useEffect(() => {
    if (requirementOptions.length === 0) {
      setPurchaseRequirementId("");
      return;
    }

    if (
      purchaseRequirementId.length > 0 &&
      !requirementOptions.some((requirement) => requirement.id === purchaseRequirementId)
    ) {
      setPurchaseRequirementId("");
    }
  }, [purchaseRequirementId, requirementOptions]);

  const selectedRequirement = useMemo(
    () =>
      requirementOptions.find(
        (requirement) => requirement.id === purchaseRequirementId,
      ) ?? null,
    [purchaseRequirementId, requirementOptions],
  );

  useEffect(() => {
    if (!selectedRequirement) {
      return;
    }

    setPurchaseMaterialName(selectedRequirement.materialName);
    if (!unitCost || Number(unitCost) === 0) {
      setUnitCost(String(selectedRequirement.estimatedUnitCost));
    }
  }, [selectedRequirement, unitCost]);

  const tableRows = useMemo<MaterialTableRow[]>(() => {
    return requirements.map((requirement) => {
      const relatedPurchases = purchases.filter((purchase) => {
        if (purchase.requirementId) {
          return purchase.requirementId === requirement.id;
        }
        return (
          purchase.projectId === requirement.projectId &&
          normalizeMaterialName(purchase.materialName) ===
            normalizeMaterialName(requirement.materialName)
        );
      });

      const latestPurchase = relatedPurchases.reduce<MaterialPurchaseApiRecord | null>(
        (latest, current) => {
          if (!latest) {
            return current;
          }
          return current.purchaseDate > latest.purchaseDate ? current : latest;
        },
        null,
      );

      return {
        id: requirement.id,
        projectId: requirement.projectId,
        projectName: requirement.projectName,
        materialName: requirement.materialName,
        needed: requirement.requiredQuantity,
        purchased: requirement.purchasedQuantity,
        remaining: requirement.remainingQuantity,
        unit: requirement.unit,
        supplier: latestPurchase?.supplierName ?? "-",
        unitCost: latestPurchase?.unitCost ?? requirement.estimatedUnitCost,
        totalCost: latestPurchase?.totalCost ?? 0,
        purchaseDate: latestPurchase?.purchaseDate ?? "",
        deliveryStatus: latestPurchase?.deliveryStatus ?? "Pending Delivery",
      };
    });
  }, [purchases, requirements]);

  const filteredRows = useMemo(() => {
    if (listProjectFilter === "All") {
      return tableRows;
    }
    return tableRows.filter((row) => row.projectId === listProjectFilter);
  }, [listProjectFilter, tableRows]);

  const materialsPagination = useTablePagination(filteredRows);

  const purchaseTotal = useMemo(() => {
    return (Number(qtyPurchased) || 0) * (Number(unitCost) || 0);
  }, [qtyPurchased, unitCost]);

  const purchaseProgress = useMemo(() => {
    if (!selectedRequirement) {
      return 0;
    }

    const target = selectedRequirement.requiredQuantity || 1;
    const expectedTotal = selectedRequirement.purchasedQuantity + (Number(qtyPurchased) || 0);
    return Math.min(100, Math.max(0, Math.round((expectedTotal / target) * 100)));
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
    if (
      requirementProjectId.trim().length === 0 ||
      requirementMaterialName.trim().length < 2 ||
      (Number(requiredQuantity) || 0) <= 0
    ) {
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
      resetRequirementForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save material requirement.";
      setError(message);
    } finally {
      setSavingRequirement(false);
    }
  };

  const handleSavePurchase = async () => {
    if (
      purchaseProjectId.trim().length === 0 ||
      purchaseMaterialName.trim().length < 2 ||
      supplierName.trim().length < 2 ||
      (Number(qtyPurchased) || 0) <= 0 ||
      purchaseDate.trim().length === 0
    ) {
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
      resetPurchaseForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save material purchase.";
      setError(message);
    } finally {
      setSavingPurchase(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Track required materials, purchases, supplier deliveries and quantity gaps."
        title="Materials & Requirements Management"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <SurfaceCard title="Material Requirements & Purchases">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="form-field">
            <span>Filter by Project</span>
            <GuiSelect
              className="input-field"
              onChange={(event) => setListProjectFilter(event.target.value)}
              value={listProjectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((project) => (
                <option key={`mat-list-${project.id}`} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </label>
        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            description="No material requirements found for the selected project."
            title="No materials"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Material Name</th>
                    <th>Project/Site</th>
                    <th>Quantity Needed</th>
                    <th>Quantity Purchased</th>
                    <th>Remaining Quantity</th>
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
                      <td
                        className={
                          row.remaining > 0 ? "text-amber-700" : "text-emerald-700"
                        }
                      >
                        {formatNumber(row.remaining)}
                      </td>
                      <td>{row.unit}</td>
                      <td>{row.supplier}</td>
                      <td>{formatTzs(row.unitCost)}</td>
                      <td>{formatTzs(row.totalCost)}</td>
                      <td>{row.purchaseDate ? formatDate(row.purchaseDate) : "-"}</td>
                      <td>
                        <StatusBadge status={row.deliveryStatus} />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Add Material Requirement">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-material-requirement-form">
            <label className="form-field">
              <span>Project</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setRequirementProjectId(event.target.value)}
                value={requirementProjectId}
              >
                {projects.map((project) => (
                  <option key={`req-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Material Name</span>
              <input
                className="input-field"
                onChange={(event) => setRequirementMaterialName(event.target.value)}
                placeholder="Cement / Steel bars..."
                value={requirementMaterialName}
              />
            </label>
            <label className="form-field">
              <span>Required Quantity</span>
              <input
                className="input-field"
                onChange={(event) => setRequiredQuantity(event.target.value)}
                type="number"
                value={requiredQuantity}
              />
            </label>
            <label className="form-field">
              <span>Unit</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setRequirementUnit(event.target.value)}
                value={requirementUnit}
              >
                {[
                  "Bags",
                  "Pieces",
                  "Tonnes",
                  "Litres",
                  "Lengths",
                  "Cubic Meter",
                ].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <FinancialInput
              label="Estimated Unit Cost"
              onChange={setEstimatedUnitCost}
              placeholder="17500"
              value={estimatedUnitCost}
            />
            <label className="form-field">
              <span>Priority</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPriority(event.target.value)}
                value={priority}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Needed By Date</span>
              <input
                className="input-field"
                onChange={(event) => setNeededByDate(event.target.value)}
                type="date"
                value={neededByDate}
              />
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea
                className="input-field min-h-20"
                onChange={(event) => setRequirementNotes(event.target.value)}
                value={requirementNotes}
              />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" type="button">
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={savingRequirement}
                onClick={() => void handleSaveRequirement()}
                type="button"
              >
                Save Requirement
              </button>
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard title="Add Material Purchase">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" id="add-material-purchase-form">
            <label className="form-field">
              <span>Project</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPurchaseProjectId(event.target.value)}
                value={purchaseProjectId}
              >
                {projects.map((project) => (
                  <option key={`buy-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Requirement (Optional)</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setPurchaseRequirementId(event.target.value)}
                value={purchaseRequirementId}
              >
                <option value="">No linked requirement</option>
                {requirementOptions.map((requirement) => (
                  <option key={`buy-req-${requirement.id}`} value={requirement.id}>
                    {requirement.materialName} ({formatNumber(requirement.remainingQuantity)} remaining)
                  </option>
                ))}
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Material Name</span>
              <input
                className="input-field"
                onChange={(event) => setPurchaseMaterialName(event.target.value)}
                placeholder="Material purchased..."
                value={purchaseMaterialName}
              />
            </label>
            <label className="form-field">
              <span>Quantity Purchased</span>
              <input
                className="input-field"
                onChange={(event) => setQtyPurchased(event.target.value)}
                type="number"
                value={qtyPurchased}
              />
            </label>
            <label className="form-field">
              <span>Supplier</span>
              <input
                className="input-field"
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Supplier name"
                value={supplierName}
              />
            </label>
            <FinancialInput label="Unit Cost" onChange={setUnitCost} placeholder="17500" value={unitCost} />
            <label className="form-field">
              <span>Total Cost (Auto Calculated)</span>
              <input className="input-field bg-slate-50" readOnly value={formatTzs(purchaseTotal)} />
            </label>
            <label className="form-field">
              <span>Date of Purchase</span>
              <input
                className="input-field"
                onChange={(event) => setPurchaseDate(event.target.value)}
                type="date"
                value={purchaseDate}
              />
            </label>
            <label className="form-field">
              <span>Delivery Note Number</span>
              <input
                className="input-field"
                onChange={(event) => setDeliveryNoteNumber(event.target.value)}
                placeholder="DN-..."
                value={deliveryNoteNumber}
              />
            </label>
            <label className="form-field">
              <span>Delivery Status</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setDeliveryStatus(event.target.value)}
                value={deliveryStatus}
              >
                <option value="Pending Delivery">Pending Delivery</option>
                <option value="Partially Delivered">Partially Delivered</option>
                <option value="Delivered">Delivered</option>
              </GuiSelect>
            </label>
            <label className="form-field">
              <span>Receipt / Delivery Ref</span>
              <input
                className="input-field"
                onChange={(event) => setReceiptRef(event.target.value)}
                placeholder="MAT-RCP-001"
                value={receiptRef}
              />
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea
                className="input-field min-h-20"
                onChange={(event) => setPurchaseNotes(event.target.value)}
                value={purchaseNotes}
              />
            </label>
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase Completion Indicator</p>
              <div className="mt-2">
                <ProgressBar value={purchaseProgress} />
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" type="button">
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={savingPurchase}
                onClick={() => void handleSavePurchase()}
                type="button"
              >
                Save Purchase
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
};


