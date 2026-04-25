import { SectionTitle, StatusBadge, SurfaceCard, TablePagination } from "../components/ui";
import { suppliers } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatTzs } from "../utils/format";

export const SuppliersPage = () => {
  const { markSaved } = useUnsavedChanges();
  const selectedSupplier = suppliers[0];
  const suppliersPagination = useTablePagination(suppliers);

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Monitor supplier relationships, balances, and delivery records."
        title="Supplier Management"
      />

      <SurfaceCard title="Supplier Table">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px]">
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
              </tr>
            </thead>
            <tbody>
              {suppliersPagination.paginatedRows.map((supplier, index) => (
                <tr key={supplier.id}>
                  <td>{suppliersPagination.startIndex + index + 1}</td>
                  <td>{supplier.name}</td>
                  <td>{supplier.contactPerson}</td>
                  <td>{supplier.phone}</td>
                  <td>{supplier.location}</td>
                  <td>{supplier.materials}</td>
                  <td>{formatTzs(supplier.totalPurchases)}</td>
                  <td className={supplier.outstandingBalance > 0 ? "text-amber-700" : "text-emerald-700"}>
                    {formatTzs(supplier.outstandingBalance)}
                  </td>
                  <td>
                    <StatusBadge status={supplier.status} />
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
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SurfaceCard title="Supplier Detail">
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier Profile</p>
              <p className="mt-1 font-semibold text-slate-900">{selectedSupplier.name}</p>
              <p>{selectedSupplier.contactPerson} | {selectedSupplier.phone}</p>
              <p>{selectedSupplier.location}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase History</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>Cement - TZS 12,500,000</li>
                <li>Aggregates - TZS 9,800,000</li>
                <li>Sand - TZS 6,100,000</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Notes</p>
              <p className="mt-1">DN-2026-118, DN-2026-121, DN-2026-132</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Records</p>
              <p className="mt-1">Paid: {formatTzs(32_700_000)} | Outstanding: {formatTzs(5_800_000)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p>
              <p className="mt-1">Contract, Delivery Receipts, Tax Invoice Files</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Add Supplier">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-field">
              <span>Supplier Name</span>
              <input className="input-field" placeholder="Supplier legal name" />
            </label>
            <label className="form-field">
              <span>Contact Person</span>
              <input className="input-field" placeholder="Primary contact" />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input className="input-field" placeholder="+255 ..." />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input className="input-field" placeholder="supplier@email.com" type="email" />
            </label>
            <label className="form-field">
              <span>Location</span>
              <input className="input-field" placeholder="City / Region" />
            </label>
            <label className="form-field">
              <span>Material Categories</span>
              <input className="input-field" placeholder="Cement, Steel, Fuel..." />
            </label>
            <label className="form-field sm:col-span-2">
              <span>Notes</span>
              <textarea className="input-field min-h-20" />
            </label>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-secondary" type="button">
                Cancel
              </button>
              <button className="btn-primary" onClick={markSaved} type="button">
                Save Supplier
              </button>
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
};
