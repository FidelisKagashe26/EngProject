import { Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCompanySettings } from "../company/CompanySettingsContext";
import { pushTopToast } from "../components/topToast";
import {
  ConfirmModal,
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
import { PAYMENT_METHODS } from "../constants/options";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { useActiveProject } from "../project/ActiveProjectContext";
import {
  api,
  type InvoiceApiRecord,
  type InvoiceItem,
  type InvoiceType,
  type MaterialRequirementApiRecord,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

const todayStr = (): string => new Date().toISOString().slice(0, 10);

type ItemDraft = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  requirementId: string;
};

const emptyItem = (): ItemDraft => ({
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
  requirementId: "",
});

const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

export const InvoicesPage = () => {
  const { markSaved } = useUnsavedChanges();
  const { activeProjectId, activeProject, projects } = useActiveProject();
  const { company } = useCompanySettings();

  const [invoices, setInvoices] = useState<InvoiceApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | InvoiceType>("All");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [viewInvoice, setViewInvoice] = useState<InvoiceApiRecord | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<InvoiceApiRecord | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceApiRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  // Form state
  const [formType, setFormType] = useState<InvoiceType>("Invoice");
  const [formProjectId, setFormProjectId] = useState(activeProjectId);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientTin, setClientTin] = useState("");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayStr());
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Material requirements for the form's project (source of invoice line items)
  const [formMaterials, setFormMaterials] = useState<MaterialRequirementApiRecord[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [picks, setPicks] = useState<Record<string, string>>({}); // requirementId -> quantity string

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.getInvoices(
        activeProjectId ? { projectId: activeProjectId } : undefined,
      );
      setInvoices(response.rows);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const filtered = useMemo(
    () => (typeFilter === "All" ? invoices : invoices.filter((row) => row.type === typeFilter)),
    [invoices, typeFilter],
  );
  const pagination = useTablePagination(filtered);

  const summary = useMemo(() => {
    return invoices.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.paid += row.amountPaid;
        acc.outstanding += row.type === "Invoice" ? row.balance : 0;
        return acc;
      },
      { total: 0, paid: 0, outstanding: 0 },
    );
  }, [invoices]);

  // Live totals for the form preview (backend remains authoritative).
  const draftTotals = useMemo(() => {
    const subtotal = round2(
      items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
    );
    const disc = Math.min(round2(Number(discount) || 0), subtotal);
    const taxable = Math.max(subtotal - disc, 0);
    const rate = Number(vatRate) || 0;
    const vat = rate > 0 ? round2((taxable * rate) / 100) : 0;
    return { subtotal, disc, vat, rate, total: round2(taxable + vat) };
  }, [items, discount, vatRate]);

  // Load the chosen project's material requirements whenever the form's project changes.
  useEffect(() => {
    if (!showForm || !formProjectId) {
      setFormMaterials([]);
      return;
    }
    let active = true;
    setLoadingMaterials(true);
    api
      .getMaterials()
      .then((res) => {
        if (!active) return;
        setFormMaterials(res.requirements.filter((r) => r.projectId === formProjectId));
      })
      .catch(() => { if (active) setFormMaterials([]); })
      .finally(() => { if (active) setLoadingMaterials(false); });
    return () => { active = false; };
  }, [showForm, formProjectId]);

  const addPickedToItems = () => {
    const picked = formMaterials.filter((mat) => (Number(picks[mat.id]) || 0) > 0);
    if (picked.length === 0) return;
    const newRows: ItemDraft[] = picked.map((mat) => ({
      description: mat.materialName,
      quantity: String(Number(picks[mat.id]) || 1),
      unit: mat.unit,
      unitPrice: mat.estimatedUnitCost > 0 ? String(mat.estimatedUnitCost) : "",
      requirementId: mat.id,
    }));
    setItems((prev) => {
      // Drop the single empty starter row if the user hasn't touched it.
      const base = prev.length === 1 && prev[0].description.trim() === "" ? [] : prev;
      return [...base, ...newRows];
    });
    setPicks({});
  };

  // Client contact string an invoice shows, built from the project's phone/email.
  const contactFromProject = (proj?: { clientPhone?: string; clientEmail?: string } | null): string =>
    [proj?.clientPhone, proj?.clientEmail].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");

  // Pull a project's saved client details into the invoice form (still editable).
  const fillClientFromProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId) ?? null;
    setClientName(proj?.clientName ?? "");
    setClientContact(contactFromProject(proj));
    setClientTin(proj?.clientTin ?? "");
  };

  const resetForm = (type: InvoiceType) => {
    setEditingId("");
    setFormType(type);
    const startProjectId = activeProjectId || projects[0]?.id || "";
    setFormProjectId(startProjectId);
    fillClientFromProject(startProjectId);
    setClientAddress("");
    setIssueDate(todayStr());
    setDueDate("");
    setDiscount("");
    setVatRate("");
    setNotes(company?.defaultInvoiceNotes ?? "");
    setTerms(activeProject?.paymentTerms || company?.defaultPaymentTerms || "");
    setItems([emptyItem()]);
    setPicks({});
  };

  const openCreate = (type: InvoiceType) => {
    resetForm(type);
    setShowForm(true);
  };

  const openEdit = (invoice: InvoiceApiRecord) => {
    setEditingId(invoice.id);
    setFormType(invoice.type);
    setFormProjectId(invoice.projectId);
    setClientName(invoice.clientName);
    setClientAddress(invoice.clientAddress);
    setClientContact(invoice.clientContact);
    setClientTin(invoice.clientTin);
    setIssueDate(invoice.issueDate);
    setDueDate(invoice.dueDate ?? "");
    setDiscount(invoice.discountAmount > 0 ? String(invoice.discountAmount) : "");
    setVatRate(invoice.vatRate > 0 ? String(invoice.vatRate) : "");
    setNotes(invoice.notes);
    setTerms(invoice.terms);
    setItems(
      invoice.items.length > 0
        ? invoice.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
            requirementId: item.requirementId ?? "",
          }))
        : [emptyItem()],
    );
    setShowForm(true);
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleSave = async () => {
    const cleanItems: InvoiceItem[] = items
      .filter((item) => item.description.trim().length > 0)
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unit: item.unit.trim(),
        unitPrice: Number(item.unitPrice) || 0,
        requirementId: item.requirementId || undefined,
      }));

    if (formProjectId.trim().length === 0 || clientName.trim().length < 2) {
      setError("Please select a project and enter the client name.");
      return;
    }
    if (cleanItems.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        projectId: formProjectId,
        clientName: clientName.trim(),
        clientAddress: clientAddress.trim(),
        clientContact: clientContact.trim(),
        clientTin: clientTin.trim(),
        issueDate,
        dueDate: dueDate || undefined,
        discountAmount: Number(discount) || 0,
        vatRate: Number(vatRate) || 0,
        notes: notes.trim(),
        terms: terms.trim(),
        items: cleanItems,
      };
      if (editingId) {
        await api.updateInvoice(editingId, payload);
      } else {
        await api.createInvoice({ ...payload, type: formType });
      }
      await load();
      markSaved();
      setShowForm(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (invoice: InvoiceApiRecord) => {
    setBusyId(invoice.id);
    try {
      const { blob, filename } = await api.downloadInvoicePdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      pushTopToast({
        tone: "error",
        title: "Invoice",
        message: downloadError instanceof Error ? downloadError.message : "Failed to download PDF.",
      });
    } finally {
      setBusyId("");
    }
  };

  const handleRecordPayment = async () => {
    if (!payingInvoice) return;
    const amount = Number(payAmount) || 0;
    if (amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    setSavingPayment(true);
    setError("");
    try {
      const updated = await api.recordInvoicePayment(payingInvoice.id, {
        amountReceived: amount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim(),
      });
      await load();
      markSaved();
      setPayingInvoice(null);
      setViewInvoice(updated);
      setPayAmount("");
      setPayRef("");
      const becameInvoice = payingInvoice.type === "Proforma" && updated.type === "Invoice";
      pushTopToast({
        tone: "success",
        title: "Payment",
        message: becameInvoice
          ? `Proforma became ${updated.number} and the payment was recorded.`
          : "Payment recorded against the invoice.",
      });
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await api.deleteInvoice(invoiceToDelete.id);
      await load();
      markSaved();
      setInvoiceToDelete(null);
    } catch (deleteError) {
      pushTopToast({
        tone: "error",
        title: "Invoice",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete.",
      });
      setInvoiceToDelete(null);
    }
  };

  const openPayment = (invoice: InvoiceApiRecord) => {
    setPayingInvoice(invoice);
    setPayAmount(invoice.balance > 0 ? String(invoice.balance) : "");
    setPayDate(todayStr());
    setPayMethod("Cash");
    setPayRef("");
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle={
          activeProject
            ? `Proforma and invoices for ${activeProject.name}.`
            : "Proforma and invoices across all projects."
        }
        title="Invoices"
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurfaceCard title="Total invoiced">
          <p className="text-2xl font-bold text-slate-900">{formatTzs(summary.total)}</p>
        </SurfaceCard>
        <SurfaceCard title="Total received">
          <p className="text-2xl font-bold text-emerald-700">{formatTzs(summary.paid)}</p>
        </SurfaceCard>
        <SurfaceCard title="Outstanding on invoices">
          <p className="text-2xl font-bold text-amber-700">{formatTzs(summary.outstanding)}</p>
        </SurfaceCard>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-52">
          <GuiSelect
            className="h-10"
            onChange={(event) => setTypeFilter(event.target.value as "All" | InvoiceType)}
            value={typeFilter}
          >
            <option value="All">All types</option>
            <option value="Proforma">Proforma</option>
            <option value="Invoice">Invoice</option>
          </GuiSelect>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-secondary h-10 justify-center whitespace-nowrap" onClick={() => openCreate("Proforma")} type="button">
            <Plus className="h-4 w-4" /> New Proforma
          </button>
          <button className="btn-primary h-10 justify-center whitespace-nowrap" onClick={() => openCreate("Invoice")} type="button">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>

      <SurfaceCard title="Invoices List">
        {error && !showForm && !payingInvoice ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState description="No invoices yet for this scope." title="No invoices" />
        ) : (
          <>
            <div className="ops-table-wrap">
              <table className="data-table ops-table min-w-[1040px]">
                <thead>
                  <tr>
                    <th className="ops-sticky-sn">S/N</th>
                    <th>Number</th>
                    <th>Type</th>
                    <th>Client</th>
                    <th>Issue Date</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th className="ops-sticky-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((invoice, index) => (
                    <tr key={invoice.id}>
                      <td className="ops-sticky-sn">{pagination.startIndex + index + 1}</td>
                      <td>
                        <span className="ops-cell-strong">{invoice.number}</span>
                        {invoice.autoGenerated ? (
                          <span className="ml-2 rounded bg-[#0b2a53]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0b2a53] dark:bg-white/10 dark:text-blue-300">
                            Auto
                          </span>
                        ) : null}
                      </td>
                      <td>{invoice.type === "Proforma" ? "Proforma Invoice" : "Invoice"}</td>
                      <td><span className="ops-cell-text">{invoice.clientName}</span></td>
                      <td>{formatDate(invoice.issueDate)}</td>
                      <td>{formatTzs(invoice.total)}</td>
                      <td className={invoice.type === "Invoice" && invoice.balance > 0 ? "text-amber-700" : "text-emerald-700"}>
                        {invoice.type === "Invoice" ? formatTzs(invoice.balance) : "-"}
                      </td>
                      <td><StatusBadge status={invoice.displayStatus} /></td>
                      <td className="ops-sticky-actions">
                        <div className="ops-actions-row">
                          <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setViewInvoice(invoice)} type="button">View</button>
                          <button
                            className="btn-secondary py-1 px-3 text-xs"
                            disabled={busyId === invoice.id}
                            onClick={() => void handleDownload(invoice)}
                            type="button"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </button>
                          {invoice.balance > 0 && invoice.status !== "Cancelled" ? (
                            <button className="btn-primary py-1 px-3 text-xs" onClick={() => openPayment(invoice)} type="button">Pay</button>
                          ) : null}
                          {invoice.amountPaid === 0 && !invoice.materialsReceived ? (
                            <button className="btn-secondary py-1 px-3 text-xs" onClick={() => openEdit(invoice)} type="button">Edit</button>
                          ) : null}
                          {invoice.amountPaid === 0 && !invoice.materialsReceived ? (
                            <button className="btn-danger py-1 px-3 text-xs" onClick={() => setInvoiceToDelete(invoice)} type="button">Delete</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              endIndex={pagination.endIndex}
              itemLabel="invoices"
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

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <SurfaceCard
            className="my-8 w-full max-w-3xl"
            title={`${editingId ? "Edit" : "New"} ${formType === "Proforma" ? "Proforma Invoice" : "Invoice"}`}
          >
            {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => {
                    const id = e.target.value;
                    setFormProjectId(id);
                    // Re-pull the newly chosen project's client details (create only).
                    if (!editingId) fillClientFromProject(id);
                  }}
                  value={formProjectId}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Client Name</span>
                <input className="input-field" onChange={(e) => setClientName(e.target.value)} placeholder="Client / company" value={clientName} />
              </label>
              <label className="form-field">
                <span>Client Contact</span>
                <input className="input-field" onChange={(e) => setClientContact(e.target.value)} placeholder="Phone · email (from project)" value={clientContact} />
              </label>
              <label className="form-field">
                <span>Client TIN (Optional)</span>
                <input className="input-field" onChange={(e) => setClientTin(e.target.value)} placeholder="TIN (from project)" value={clientTin} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-field">
                  <span>Issue Date</span>
                  <input className="input-field" onChange={(e) => setIssueDate(e.target.value)} type="date" value={issueDate} />
                </label>
                <label className="form-field">
                  <span>Due Date</span>
                  <input className="input-field" min={issueDate} onChange={(e) => setDueDate(e.target.value)} type="date" value={dueDate} />
                </label>
              </div>
            </div>

            {/* Pull line items from the project's material requirements */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Add from Materials{formMaterials.length > 0 ? ` (${formMaterials.length})` : ""}
                </p>
                {formMaterials.length > 0 ? (
                  <button className="btn-primary py-1 px-3 text-xs" onClick={addPickedToItems} type="button">
                    Add selected
                  </button>
                ) : null}
              </div>
              {loadingMaterials ? (
                <p className="py-4 text-center text-sm text-slate-400">Loading materials…</p>
              ) : formMaterials.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  No materials recorded for this project yet. Add them in the Materials module, or type line items manually below.
                </p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-auto">
                  {formMaterials.map((mat) => {
                    // Only what is still needed (required − received) can be
                    // invoiced; a fully-received material is shown but locked.
                    const remaining = Math.max(mat.remainingQuantity, 0);
                    const received = mat.deliveredQuantity;
                    const exhausted = remaining <= 0;
                    return (
                      <div className={`flex items-center gap-2 text-sm ${exhausted ? "opacity-50" : ""}`} key={mat.id}>
                        <input
                          checked={(Number(picks[mat.id]) || 0) > 0}
                          disabled={exhausted}
                          onChange={(e) =>
                            setPicks((prev) => ({ ...prev, [mat.id]: e.target.checked ? String(remaining) : "" }))
                          }
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {mat.materialName}
                          <span className="text-slate-400">
                            {" · "}
                            {mat.estimatedUnitCost > 0 ? formatTzs(mat.estimatedUnitCost) : "no cost set"}
                            {mat.unit ? ` / ${mat.unit}` : ""}
                            {exhausted
                              ? " · received in full"
                              : ` · needed: ${remaining}${received > 0 ? ` (of ${mat.requiredQuantity})` : ""}`}
                          </span>
                        </span>
                        <input
                          aria-label="Quantity"
                          className="input-field h-8 w-20"
                          disabled={exhausted}
                          onChange={(e) => setPicks((prev) => ({ ...prev, [mat.id]: e.target.value }))}
                          placeholder="Qty"
                          type="number"
                          value={picks[mat.id] ?? ""}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Line Items</p>
                <button className="btn-secondary py-1 px-3 text-xs" onClick={() => setItems((prev) => [...prev, emptyItem()])} type="button">
                  <Plus className="h-3.5 w-3.5" /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div className="grid grid-cols-12 gap-2" key={index}>
                    <input
                      className="input-field col-span-12 sm:col-span-5"
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                      placeholder="Description"
                      value={item.description}
                    />
                    <input
                      className="input-field col-span-4 sm:col-span-2"
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      placeholder="Qty"
                      type="number"
                      value={item.quantity}
                    />
                    <input
                      className="input-field col-span-4 sm:col-span-2"
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      placeholder="Unit"
                      value={item.unit}
                    />
                    <input
                      className="input-field col-span-4 sm:col-span-2"
                      onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                      placeholder="Unit price"
                      type="number"
                      value={item.unitPrice}
                    />
                    <button
                      aria-label="Remove row"
                      className="col-span-12 flex items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 sm:col-span-1 dark:border-white/10"
                      onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Discount / VAT / totals */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-3">
                <FinancialInput label="Discount (Optional)" onChange={setDiscount} placeholder="0" value={discount} />
                <label className="form-field">
                  <span>VAT Rate % (Optional — leave blank to hide)</span>
                  <input className="input-field" onChange={(e) => setVatRate(e.target.value)} placeholder="e.g. 18" type="number" value={vatRate} />
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Subtotal</span><span>{formatTzs(draftTotals.subtotal)}</span></div>
                {draftTotals.disc > 0 ? (
                  <div className="flex justify-between py-0.5"><span className="text-slate-500">Discount</span><span>- {formatTzs(draftTotals.disc)}</span></div>
                ) : null}
                {draftTotals.rate > 0 ? (
                  <div className="flex justify-between py-0.5"><span className="text-slate-500">VAT ({draftTotals.rate}%)</span><span>{formatTzs(draftTotals.vat)}</span></div>
                ) : null}
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-bold text-slate-900 dark:border-white/10"><span>Total</span><span>{formatTzs(draftTotals.total)}</span></div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Payment Terms (Optional)</span>
                <textarea className="input-field min-h-16" onChange={(e) => setTerms(e.target.value)} value={terms} />
              </label>
              <label className="form-field">
                <span>Notes (Optional)</span>
                <textarea className="input-field min-h-16" onChange={(e) => setNotes(e.target.value)} value={notes} />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setShowForm(false); setError(""); }} type="button">Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={() => void handleSave()} type="button">
                {saving ? "Saving..." : editingId ? "Update" : `Create ${formType === "Proforma" ? "Proforma" : "Invoice"}`}
              </button>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── View ── */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <SurfaceCard className="my-8 w-full max-w-2xl" title={`${viewInvoice.type === "Proforma" ? "Proforma Invoice" : "Invoice"} ${viewInvoice.number}`}>
            <div className="flex items-center justify-between">
              <StatusBadge status={viewInvoice.displayStatus} />
              <span className="text-sm text-slate-500">{formatDate(viewInvoice.issueDate)}{viewInvoice.dueDate ? ` · due ${formatDate(viewInvoice.dueDate)}` : ""}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bill To</p>
                <p className="font-semibold text-slate-800">{viewInvoice.clientName}</p>
                {viewInvoice.clientAddress ? <p className="text-slate-500">{viewInvoice.clientAddress}</p> : null}
                {viewInvoice.clientContact ? <p className="text-slate-500">{viewInvoice.clientContact}</p> : null}
                {viewInvoice.clientTin ? <p className="text-slate-500">TIN: {viewInvoice.clientTin}</p> : null}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Project</p>
                <p className="font-semibold text-slate-800">{viewInvoice.projectName}</p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="data-table min-w-[520px]">
                <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
                <tbody>
                  {viewInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td>{item.description}</td>
                      <td>{item.quantity}{item.unit ? ` ${item.unit}` : ""}</td>
                      <td>{formatTzs(item.unitPrice)}</td>
                      <td>{formatTzs(item.amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatTzs(viewInvoice.subtotal)}</span></div>
              {viewInvoice.discountAmount > 0 ? <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>- {formatTzs(viewInvoice.discountAmount)}</span></div> : null}
              {viewInvoice.vatRate > 0 ? <div className="flex justify-between"><span className="text-slate-500">VAT ({viewInvoice.vatRate}%)</span><span>{formatTzs(viewInvoice.vatAmount)}</span></div> : null}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900 dark:border-white/10"><span>Total</span><span>{formatTzs(viewInvoice.total)}</span></div>
              {viewInvoice.type === "Invoice" ? (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-700">{formatTzs(viewInvoice.amountPaid)}</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-slate-500">Balance</span><span className={viewInvoice.balance > 0 ? "text-amber-700" : "text-emerald-700"}>{formatTzs(viewInvoice.balance)}</span></div>
                </>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
              <button className="btn-secondary" disabled={busyId === viewInvoice.id} onClick={() => void handleDownload(viewInvoice)} type="button">
                <Download className="h-4 w-4" /> Download PDF
              </button>
              {viewInvoice.balance > 0 && viewInvoice.status !== "Cancelled" ? (
                <button className="btn-primary" onClick={() => { const inv = viewInvoice; setViewInvoice(null); openPayment(inv); }} type="button">
                  {viewInvoice.type === "Proforma" ? "Pay & Convert to Invoice" : "Record Payment"}
                </button>
              ) : null}
              <button className="btn-secondary" onClick={() => setViewInvoice(null)} type="button">Close</button>
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── Record payment ── */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-md" title={`${payingInvoice.type === "Proforma" ? "Pay Proforma" : "Record Payment"} — ${payingInvoice.number}`}>
            {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
            {!payingInvoice.materialsReceived ? (
              <p className="mb-3 rounded-lg bg-[#0b2a53]/5 px-3 py-2 text-sm text-[#0b2a53] dark:bg-white/5 dark:text-blue-300">
                {payingInvoice.type === "Proforma"
                  ? "Recording this payment converts the proforma into a full invoice, marks its materials received, and books their cost to the project."
                  : "Recording this payment marks this invoice's materials received and books their cost to the project."}
              </p>
            ) : null}
            <p className="mb-3 text-sm text-slate-500">{payingInvoice.type === "Proforma" ? "Amount payable" : "Outstanding balance"}: <span className="font-semibold text-amber-700">{formatTzs(payingInvoice.balance)}</span></p>
            <div className="space-y-3">
              <FinancialInput label="Amount Received" onChange={setPayAmount} placeholder="0" value={payAmount} />
              <label className="form-field">
                <span>Payment Date</span>
                <input className="input-field" onChange={(e) => setPayDate(e.target.value)} type="date" value={payDate} />
              </label>
              <label className="form-field">
                <span>Payment Method</span>
                <GuiSelect className="input-field" onChange={(e) => setPayMethod(e.target.value)} value={payMethod}>
                  {options(PAYMENT_METHODS)}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Reference (Optional)</span>
                <input className="input-field" onChange={(e) => setPayRef(e.target.value)} placeholder="Txn / cheque number" value={payRef} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { setPayingInvoice(null); setError(""); }} type="button">Cancel</button>
              <button className="btn-primary" disabled={savingPayment} onClick={() => void handleRecordPayment()} type="button">
                {savingPayment ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </SurfaceCard>
        </div>
      )}

      <ConfirmModal
        cancelLabel="Cancel"
        confirmClassName="btn-danger"
        confirmLabel="Delete"
        description={invoiceToDelete ? `Delete ${invoiceToDelete.number}? This cannot be undone from here.` : ""}
        onCancel={() => setInvoiceToDelete(null)}
        onConfirm={() => void handleDelete()}
        open={invoiceToDelete !== null}
        title="Delete Invoice"
      />
    </div>
  );
};
