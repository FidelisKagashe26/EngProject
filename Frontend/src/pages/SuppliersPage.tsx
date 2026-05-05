import { useEffect, useMemo, useState } from "react";
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
  type SupplierApiRecord,
  type SuppliersResponse,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

export const SuppliersPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SuppliersResponse["summary"]>({
    totalSuppliers: 0,
    totalPurchases: 0,
    totalOutstandingBalance: 0,
    activeSuppliers: 0,
  });
  const [supplierRows, setSupplierRows] = useState<SupplierApiRecord[]>([]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierApiRecord | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [materialCategories, setMaterialCategories] = useState("");
  const [totalPurchases, setTotalPurchases] = useState("0");
  const [outstandingBalance, setOutstandingBalance] = useState("0");
  const [status, setStatus] = useState("Active");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await api.getSuppliers();
        if (!mounted) return;
        setSummary(response.summary);
        setSupplierRows(response.rows);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load suppliers data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const refreshSuppliers = async () => {
    const response = await api.getSuppliers();
    setSummary(response.summary);
    setSupplierRows(response.rows);
  };

  const suppliersPagination = useTablePagination(supplierRows);

  const resetForm = () => {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setLocation("");
    setMaterialCategories("");
    setTotalPurchases("0");
    setOutstandingBalance("0");
    setStatus("Active");
    setNotes("");
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleSaveSupplier = async () => {
    if (name.trim().length < 2 || contactPerson.trim().length < 2 || phone.trim().length < 7) {
      setError("Please provide supplier name, contact person and valid phone.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createSupplier({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        location: location.trim(),
        materialCategories: materialCategories.trim(),
        totalPurchases: Number(totalPurchases) || 0,
        outstandingBalance: Number(outstandingBalance) || 0,
        status,
        notes: notes.trim(),
      });
      await refreshSuppliers();
      markSaved();
      closeAddModal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    setDeleting(true);
    setError("");
    try {
      // Soft delete: remove from local list (TODO: wire DELETE /suppliers/:id)
      setSupplierRows((prev) => prev.filter((s) => s.id !== supplierToDelete.id));
      if (selectedSupplier?.id === supplierToDelete.id) setSelectedSupplier(null);
      markSaved();
      setSupplierToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete supplier.");
      setSupplierToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  // Detail panel supplier (from row click)
  const viewSupplier = useMemo(
    () => supplierRows.find((s) => s.id === selectedSupplier?.id) ?? selectedSupplier,
    [selectedSupplier, supplierRows],
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Monitor supplier relationships, balances, and delivery records."
        title="Supplier Management"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard title="Total Suppliers">
          <p className="text-2xl font-bold text-slate-900">{summary.totalSuppliers}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Purchases">
          <p className="text-2xl font-bold text-[#0b2a53]">{formatTzs(summary.totalPurchases)}</p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding Balance">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(summary.totalOutstandingBalance)}</p>
        </SurfaceCard>
        <SurfaceCard title="Active Suppliers">
          <p className="text-2xl font-bold text-emerald-700">{summary.activeSuppliers}</p>
        </SurfaceCard>
      </div>

      {/* Add Supplier button - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <button className="btn-primary whitespace-nowrap" onClick={openAddModal} type="button">
          + Add Supplier
        </button>
      </div>

      {/* Supplier Table */}
      <SurfaceCard title="Supplier Table">
        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : supplierRows.length === 0 ? (
          <EmptyState description="No suppliers found. Click Add Supplier to get started." title="No suppliers" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th>S/N</th>
                    <th>Supplier Name</th>
                    <th>Contact Person</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Materials Supplied</th>
                    <th>Total Purchases</th>
                    <th>Outstanding Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersPagination.paginatedRows.map((supplier, index) => (
                    <tr key={supplier.id}>
                      <td>{suppliersPagination.startIndex + index + 1}</td>
                      <td>{supplier.name}</td>
                      <td>{supplier.contactPerson}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.location || "-"}</td>
                      <td>{supplier.materialCategories || "-"}</td>
                      <td>{formatTzs(supplier.totalPurchases)}</td>
                      <td className={supplier.outstandingBalance > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {formatTzs(supplier.outstandingBalance)}
                      </td>
                      <td>
                        <span className={
                          supplier.status === "Active"
                            ? "text-sm font-medium text-emerald-700"
                            : supplier.status === "Inactive"
                              ? "text-sm font-medium text-slate-500"
                              : "text-sm font-medium text-red-600"
                        }>
                          {supplier.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn-primary py-1 px-3 text-xs"
                            onClick={() => setSelectedSupplier(supplier)}
                            type="button"
                          >
                            View
                          </button>
                          <button
                            className="btn-danger py-1 px-3 text-xs"
                            onClick={() => setSupplierToDelete(supplier)}
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
              endIndex={suppliersPagination.endIndex}
              itemLabel="suppliers"
              onPageChange={suppliersPagination.setPage}
              onPageSizeChange={suppliersPagination.setPageSize}
              page={suppliersPagination.page}
              pageSize={suppliersPagination.pageSize}
              startIndex={suppliersPagination.startIndex}
              totalCount={suppliersPagination.totalCount}
              totalPages={suppliersPagination.totalPages}
            />
          </>
        )}
      </SurfaceCard>

      {/* Supplier Detail Panel (shown when a row is clicked) */}
      {viewSupplier && (
        <SurfaceCard title={`Supplier Detail — ${viewSupplier.name}`}>
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</p>
                <p className="mt-1 font-semibold text-slate-900">{viewSupplier.name}</p>
                <p>{viewSupplier.contactPerson} | {viewSupplier.phone}</p>
                <p>{viewSupplier.email || "No email set"}</p>
                <p>{viewSupplier.location || "No location set"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Financial Snapshot</p>
                <p className="mt-1">Purchases: {formatTzs(viewSupplier.totalPurchases)}</p>
                <p>Outstanding: {formatTzs(viewSupplier.outstandingBalance)}</p>
                <p>Status: {viewSupplier.status}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Material Categories</p>
                <p className="mt-1">{viewSupplier.materialCategories || "Not specified"}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Last Updated</p>
                <p className="mt-1">{formatDate(viewSupplier.updatedAt)}</p>
              </div>
            </div>
            {viewSupplier.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                <p className="mt-1">{viewSupplier.notes}</p>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={() => setSelectedSupplier(null)} type="button">Close</button>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" title="Add Supplier">
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Supplier Name</span>
                <input className="input-field" onChange={(e) => setName(e.target.value)} placeholder="Supplier legal name" value={name} />
              </label>
              <label className="form-field">
                <span>Contact Person</span>
                <input className="input-field" onChange={(e) => setContactPerson(e.target.value)} placeholder="Primary contact" value={contactPerson} />
              </label>
              <label className="form-field">
                <span>Phone</span>
                <input className="input-field" onChange={(e) => setPhone(e.target.value)} placeholder="+255 ..." value={phone} />
              </label>
              <label className="form-field">
                <span>Email</span>
                <input className="input-field" onChange={(e) => setEmail(e.target.value)} placeholder="supplier@email.com" type="email" value={email} />
              </label>
              <label className="form-field">
                <span>Location</span>
                <input className="input-field" onChange={(e) => setLocation(e.target.value)} placeholder="City / Region" value={location} />
              </label>
              <label className="form-field">
                <span>Material Categories</span>
                <input className="input-field" onChange={(e) => setMaterialCategories(e.target.value)} placeholder="Cement, Steel, Fuel..." value={materialCategories} />
              </label>
              <FinancialInput label="Total Purchases" onChange={setTotalPurchases} placeholder="0" value={totalPurchases} />
              <FinancialInput label="Outstanding Balance" onChange={setOutstandingBalance} placeholder="0" value={outstandingBalance} />
              <label className="form-field">
                <span>Status</span>
                <GuiSelect className="input-field" onChange={(e) => setStatus(e.target.value)} value={status}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blacklisted">Blacklisted</option>
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea className="input-field min-h-20" onChange={(e) => setNotes(e.target.value)} value={notes} />
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button className="btn-secondary" onClick={closeAddModal} type="button">Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={() => void handleSaveSupplier()} type="button">
                  Save Supplier
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
        description={supplierToDelete ? `Delete supplier "${supplierToDelete.name}"? This action cannot be undone.` : ""}
        onCancel={() => setSupplierToDelete(null)}
        onConfirm={() => void handleDelete()}
        open={supplierToDelete !== null}
        title="Delete Supplier"
      />
    </div>
  );
};
