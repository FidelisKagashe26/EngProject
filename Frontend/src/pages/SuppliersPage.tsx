import { useEffect, useMemo, useState } from "react";
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
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

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
        if (!mounted) {
          return;
        }
        setSummary(response.summary);
        setSupplierRows(response.rows);
        setError("");
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load suppliers data.";
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
    if (supplierRows.length === 0) {
      setSelectedSupplierId("");
      return;
    }

    if (!supplierRows.some((supplier) => supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(supplierRows[0].id);
    }
  }, [selectedSupplierId, supplierRows]);

  const refreshSuppliers = async () => {
    const response = await api.getSuppliers();
    setSummary(response.summary);
    setSupplierRows(response.rows);
  };

  const suppliersPagination = useTablePagination(supplierRows);
  const selectedSupplier = useMemo(
    () =>
      supplierRows.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, supplierRows],
  );

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

  const handleSaveSupplier = async () => {
    if (
      name.trim().length < 2 ||
      contactPerson.trim().length < 2 ||
      phone.trim().length < 7
    ) {
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
      resetForm();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save supplier.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Monitor supplier relationships, balances, and delivery records."
        title="Supplier Management"
      />

      {error && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{error}</p>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard title="Total Suppliers">
          <p className="text-2xl font-bold text-slate-900">{summary.totalSuppliers}</p>
        </SurfaceCard>
        <SurfaceCard title="Total Purchases">
          <p className="text-2xl font-bold text-[#0b2a53]">
            {formatTzs(summary.totalPurchases)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding Balance">
          <p className="text-2xl font-bold text-amber-700">
            {formatTzs(summary.totalOutstandingBalance)}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Active Suppliers">
          <p className="text-2xl font-bold text-emerald-700">{summary.activeSuppliers}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Supplier Table">
        {loading ? (
          <SkeletonTable rows={5} />
        ) : supplierRows.length === 0 ? (
          <EmptyState
            description="No suppliers found. Add the first supplier below."
            title="No suppliers"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1040px]">
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
                    <th>Action</th>
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
                      <td
                        className={
                          supplier.outstandingBalance > 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }
                      >
                        {formatTzs(supplier.outstandingBalance)}
                      </td>
                      <td>
                        <StatusBadge status={supplier.status} />
                      </td>
                      <td>
                        <button
                          className="btn-secondary !px-2 !py-1 text-xs"
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          type="button"
                        >
                          View
                        </button>
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Supplier Detail">
          {selectedSupplier ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Supplier Profile
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedSupplier.name}
                </p>
                <p>
                  {selectedSupplier.contactPerson} | {selectedSupplier.phone}
                </p>
                <p>{selectedSupplier.email || "No email set"}</p>
                <p>{selectedSupplier.location || "No location set"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Financial Snapshot
                </p>
                <p className="mt-1">
                  Purchases: {formatTzs(selectedSupplier.totalPurchases)}
                </p>
                <p>
                  Outstanding: {formatTzs(selectedSupplier.outstandingBalance)}
                </p>
                <p>Status: {selectedSupplier.status}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Material Categories
                </p>
                <p className="mt-1">
                  {selectedSupplier.materialCategories || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Notes
                </p>
                <p className="mt-1">{selectedSupplier.notes || "No notes."}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Last Updated
                </p>
                <p className="mt-1">{formatDate(selectedSupplier.updatedAt)}</p>
              </div>
            </div>
          ) : (
            <EmptyState
              description="Select a supplier row to preview details."
              title="No supplier selected"
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Add Supplier">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-field">
              <span>Supplier Name</span>
              <input
                className="input-field"
                onChange={(event) => setName(event.target.value)}
                placeholder="Supplier legal name"
                value={name}
              />
            </label>
            <label className="form-field">
              <span>Contact Person</span>
              <input
                className="input-field"
                onChange={(event) => setContactPerson(event.target.value)}
                placeholder="Primary contact"
                value={contactPerson}
              />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input
                className="input-field"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+255 ..."
                value={phone}
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                className="input-field"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="supplier@email.com"
                type="email"
                value={email}
              />
            </label>
            <label className="form-field">
              <span>Location</span>
              <input
                className="input-field"
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City / Region"
                value={location}
              />
            </label>
            <label className="form-field">
              <span>Material Categories</span>
              <input
                className="input-field"
                onChange={(event) => setMaterialCategories(event.target.value)}
                placeholder="Cement, Steel, Fuel..."
                value={materialCategories}
              />
            </label>
            <FinancialInput
              label="Total Purchases"
              onChange={setTotalPurchases}
              placeholder="0"
              value={totalPurchases}
            />
            <FinancialInput
              label="Outstanding Balance"
              onChange={setOutstandingBalance}
              placeholder="0"
              value={outstandingBalance}
            />
            <label className="form-field">
              <span>Status</span>
              <GuiSelect
                className="input-field"
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blacklisted">Blacklisted</option>
              </GuiSelect>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea
                className="input-field min-h-20"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" onClick={resetForm} type="button">
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleSaveSupplier()}
                type="button"
              >
                Save Supplier
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
};
