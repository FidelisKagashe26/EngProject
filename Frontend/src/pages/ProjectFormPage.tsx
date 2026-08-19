import { Info, Loader2, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { FinancialInput, SectionTitle, SuccessToast, SurfaceCard, GuiSelect, options } from "../components/ui";
import { PROJECT_STATUSES, isClosedProjectStatus } from "../constants/options";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { api, type CreateProjectPayload, type ProjectApiRecord } from "../services/api";
import { formatTzs } from "../utils/format";

type SaveMode = "project" | "draft" | null;

// ─── Fields that are manually entered ────────────────────────────────────────
// totalSpent        → auto: updated by labor payments, material purchases, expenses
// amountReceived    → auto: updated by client payments module
// remainingBalance  → auto: contractValue - totalSpent  (backend)
// profitLossEst     → auto: amountReceived - totalSpent (backend)
// pendingPayments   → auto: contractValue - amountReceived

// Planned profit is whatever the contract value has left after the three budget
// lines. The margin % is derived from it, never typed — so it can't drift from
// the numbers above it. (Petty cash is a float spent from the operational
// budget, so it is not counted again here.)
const computeExpectedProfit = (
  contractValue: number,
  laborBudget: number,
  materialBudget: number,
  operationalBudget: number,
) => {
  const plannedCost = laborBudget + materialBudget + operationalBudget;
  const expectedProfit = contractValue - plannedCost;
  const marginPct =
    contractValue > 0 ? Math.round((expectedProfit / contractValue) * 10000) / 100 : 0;
  return { plannedCost, expectedProfit, marginPct };
};

const toFingerprint = (values: {
  projectName: string;
  siteLocation: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientTin: string;
  pettyCash: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  description: string;
  status: string;
  contractValue: string;
  initialAdvance: string;
  laborBudget: string;
  materialBudget: string;
  operationalBudget: string;
  paymentTerms: string;
  notes: string;
}) => JSON.stringify(values);

const toPayload = (values: {
  projectName: string;
  siteLocation: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientTin: string;
  pettyCash: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  contractValue: string;
  initialAdvance: string;
  status: string;
  laborBudget: string;
  materialBudget: string;
  operationalBudget: string;
  paymentTerms: string;
  description: string;
  notes: string;
}): CreateProjectPayload => {
  const contractVal = Number(values.contractValue) || 0;
  const advance = Number(values.initialAdvance) || 0;
  const laborBudget = Number(values.laborBudget) || 0;
  const materialBudget = Number(values.materialBudget) || 0;
  const operationalBudget = Number(values.operationalBudget) || 0;
  const expectedProfitMarginPct = computeExpectedProfit(
    contractVal,
    laborBudget,
    materialBudget,
    operationalBudget,
  ).marginPct;
  return {
    name: values.projectName,
    siteLocation: values.siteLocation,
    clientName: values.clientName,
    clientPhone: values.clientPhone,
    clientEmail: values.clientEmail,
    clientTin: values.clientTin,
    pettyCash: Number(values.pettyCash) || 0,
    contractNumber: values.contractNumber,
    startDate: values.startDate,
    expectedCompletionDate: values.endDate,
    contractValue: contractVal,
    // On create: amountReceived = initial advance entered
    // On edit: backend keeps the running total — we don't overwrite it
    amountReceived: advance,
    totalSpent: 0,           // always starts at 0; updated by transactions
    status: values.status,
    progress: 0,
    pendingClientPayments: Math.max(contractVal - advance, 0),
    laborBudget,
    materialBudget,
    operationalBudget,
    expectedProfitMarginPct,
    paymentTerms: values.paymentTerms,
    description: values.description,
    notes: values.notes,
  };
};

const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const toFileType = (file: File): string => {
  const dotIndex = file.name.lastIndexOf(".");
  if (dotIndex >= 0 && dotIndex < file.name.length - 1) {
    return file.name.slice(dotIndex + 1).toUpperCase();
  }
  if (file.type.includes("/")) {
    return file.type.split("/")[1].toUpperCase();
  }
  return "FILE";
};

// ─── Small helper: read-only auto field ──────────────────────────────────────
const AutoField = ({
  label,
  value,
  hint,
  color = "text-slate-700",
}: {
  label: string;
  value: string;
  hint: string;
  color?: string;
}) => (
  <div className="form-field">
    <span className="flex items-center gap-1">
      {label}
      <span title={hint}>
        <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
      </span>
    </span>
    <div
      className={`input-field flex items-center bg-slate-50 select-none cursor-not-allowed ${color}`}
      title={hint}
    >
      <span className="font-semibold">{value}</span>
      <span className="ml-auto text-xs text-slate-400 italic">Auto</span>
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ProjectFormPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { markSaved, setDirty } = useUnsavedChanges();
  const isEditMode = useMemo(() => Boolean(projectId), [projectId]);
  const baselineFingerprintRef = useRef("");
  const dirtyCheckReadyRef = useRef(false);
  const initialDocsInputRef = useRef<HTMLInputElement>(null);

  // ── Manual fields ──
  const [projectName, setProjectName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientTin, setClientTin] = useState("");
  const [pettyCash, setPettyCash] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const isProjectClosed = isClosedProjectStatus(status);
  const [contractValue, setContractValue] = useState("");
  // "initialAdvance" = amount received at project creation (first payment from client)
  // In edit mode this is replaced by the live running total from the DB
  const [initialAdvance, setInitialAdvance] = useState("");
  const [laborBudget, setLaborBudget] = useState("");
  const [materialBudget, setMaterialBudget] = useState("");
  const [operationalBudget, setOperationalBudget] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [initialDocuments, setInitialDocuments] = useState<File[]>([]);

  // ── Read-only live values (edit mode only) ──
  const [liveAmountReceived, setLiveAmountReceived] = useState(0);
  const [liveTotalSpent, setLiveTotalSpent] = useState(0);

  // ── UI state ──
  const [showErrors, setShowErrors] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Derived / auto-calculated values ──
  const contractVal = Number(contractValue) || 0;
  const advanceVal = isEditMode ? liveAmountReceived : (Number(initialAdvance) || 0);
  const spentVal = isEditMode ? liveTotalSpent : 0;
  const remainingBalance = contractVal - spentVal;
  const pendingPayments = Math.max(contractVal - advanceVal, 0);
  const profitLossEstimate = advanceVal - spentVal;
  // Expected profit & margin — derived from the contract value and the three
  // budgets, shown read-only (not typed).
  const expected = computeExpectedProfit(
    contractVal,
    Number(laborBudget) || 0,
    Number(materialBudget) || 0,
    Number(operationalBudget) || 0,
  );

  // ── Dirty tracking ──
  const currentFingerprint = useMemo(
    () =>
      toFingerprint({
        projectName, siteLocation, clientName, clientPhone, clientEmail, clientTin, pettyCash, contractNumber,
        startDate, endDate, description, status, contractValue,
        initialAdvance, laborBudget, materialBudget, operationalBudget,
        paymentTerms, notes,
      }),
    [
      projectName, siteLocation, clientName, clientPhone, clientEmail, clientTin, contractNumber,
      startDate, endDate, description, status, contractValue,
      initialAdvance, laborBudget, materialBudget, operationalBudget,
      paymentTerms, notes,
    ],
  );
  const currentFingerprintRef = useRef(currentFingerprint);

  useEffect(() => {
    currentFingerprintRef.current = currentFingerprint;
  }, [currentFingerprint]);

  useEffect(() => {
    if (isEditMode || dirtyCheckReadyRef.current) return;
    baselineFingerprintRef.current = currentFingerprint;
    dirtyCheckReadyRef.current = true;
    setDirty(false);
  }, [currentFingerprint, isEditMode, setDirty]);

  useEffect(() => {
    if (!dirtyCheckReadyRef.current) return;
    setDirty(currentFingerprint !== baselineFingerprintRef.current);
  }, [currentFingerprint, setDirty]);

  // ── Load existing project (edit mode) ──
  useEffect(() => {
    if (!isEditMode || !projectId) return;
    let mounted = true;

    const load = async () => {
      setLoadingProject(true);
      setSubmitError("");
      try {
        const row = await api.getProjectById(projectId);
        if (!mounted) return;

        setProjectName(row.name);
        setSiteLocation(row.siteLocation);
        setClientName(row.clientName);
        setClientPhone(row.clientPhone ?? "");
        setClientEmail(row.clientEmail ?? "");
        setClientTin(row.clientTin ?? "");
        setPettyCash(row.pettyCash > 0 ? String(row.pettyCash) : "");
        setContractNumber(row.contractNumber);
        setStartDate(row.startDate);
        setEndDate(row.expectedCompletionDate);
        setDescription(row.description ?? "");
        setStatus(row.status);
        setContractValue(String(row.contractValue));
        setLaborBudget(row.laborBudget > 0 ? String(row.laborBudget) : "");
        setMaterialBudget(row.materialBudget > 0 ? String(row.materialBudget) : "");
        setOperationalBudget(row.operationalBudget > 0 ? String(row.operationalBudget) : "");
        setPaymentTerms(row.paymentTerms ?? "");
        // Live running totals — shown as read-only
        setLiveAmountReceived(row.amountReceived);
        setLiveTotalSpent(row.totalSpent);
        setNotes(row.notes ?? "");

        const fp = toFingerprint({
          projectName: row.name, siteLocation: row.siteLocation,
          clientName: row.clientName, clientPhone: row.clientPhone ?? "",
          clientEmail: row.clientEmail ?? "", clientTin: row.clientTin ?? "",
          pettyCash: row.pettyCash > 0 ? String(row.pettyCash) : "",
          contractNumber: row.contractNumber,
          startDate: row.startDate, endDate: row.expectedCompletionDate,
          description: row.description ?? "", status: row.status,
          contractValue: String(row.contractValue),
          initialAdvance: "",
          laborBudget: row.laborBudget > 0 ? String(row.laborBudget) : "",
          materialBudget: row.materialBudget > 0 ? String(row.materialBudget) : "",
          operationalBudget: row.operationalBudget > 0 ? String(row.operationalBudget) : "",
          paymentTerms: row.paymentTerms ?? "",
          notes: row.notes ?? "",
        });
        baselineFingerprintRef.current = fp;
        dirtyCheckReadyRef.current = true;
        setDirty(false);
      } catch (error) {
        if (!mounted) return;
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to load project details.",
        );
        baselineFingerprintRef.current = currentFingerprintRef.current;
        dirtyCheckReadyRef.current = true;
        setDirty(false);
      } finally {
        if (mounted) setLoadingProject(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [isEditMode, projectId, setDirty]);

  const validateRequired = (mode: SaveMode): boolean =>
    projectName.trim().length > 0 &&
    siteLocation.trim().length > 0 &&
    clientName.trim().length > 0 &&
    clientPhone.trim().length > 0 &&
    contractNumber.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    contractValue.trim().length > 0 &&
    (mode === "draft" || status.trim().length > 0);

  const handlePickInitialDocuments = () => {
    initialDocsInputRef.current?.click();
  };

  const handleInitialDocumentsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setInitialDocuments((prev) => {
      const byKey = new Map(
        prev.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]),
      );
      for (const file of files) {
        byKey.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      }
      return Array.from(byKey.values());
    });
    event.target.value = "";
  };

  const removeInitialDocument = (indexToRemove: number) => {
    setInitialDocuments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const attachInitialDocuments = async (savedProjectId: string) => {
    if (initialDocuments.length === 0) return;
    const uploadedBy = user?.fullName?.trim().length ? user.fullName : "Project Manager";
    const uploadedFiles = await Promise.all(
      initialDocuments.map((file) =>
        api.uploadDocumentFile(file, { notifySuccess: false }).then((uploaded) => ({
          file,
          uploaded,
        })),
      ),
    );

    await Promise.all(
      uploadedFiles.map(({ file, uploaded }) =>
        api.createDocument({
          projectId: savedProjectId,
          category: "Other Documents",
          documentName: file.name,
          fileType: toFileType(file),
          fileSize: formatBytes(file.size),
          fileReference: uploaded.url,
          uploadedBy,
          notes: "Uploaded from Project Form initial documents.",
        }),
      ),
    );
    setInitialDocuments([]);
  };

  const triggerSave = async (mode: SaveMode) => {
    if (!mode) return;

    if (!validateRequired(mode)) {
      setShowErrors(true);
      return;
    }

    if (endDate < startDate) {
      setShowErrors(true);
      setSubmitError("Completion date must be on or after the start date.");
      return;
    }

    setShowErrors(false);
    setSubmitting(true);
    setSubmitError("");

    const statusToSave = mode === "draft" ? "Draft" : status;

    try {
      let savedProject: ProjectApiRecord;

      if (isEditMode && projectId) {
        // Edit: only update fields the user can change — never overwrite live totals
        savedProject = await api.updateProject(projectId, {
          name: projectName,
          siteLocation,
          clientName,
          clientPhone,
          clientEmail,
          clientTin,
          pettyCash: Number(pettyCash) || 0,
          contractNumber,
          startDate,
          expectedCompletionDate: endDate,
          contractValue: Number(contractValue) || 0,
          // A closed project keeps its status: reopening it is a deliberate
          // action, not a side effect of editing the contract number.
          ...(isProjectClosed ? {} : { status: statusToSave }),
          laborBudget: Number(laborBudget) || 0,
          materialBudget: Number(materialBudget) || 0,
          operationalBudget: Number(operationalBudget) || 0,
          expectedProfitMarginPct: expected.marginPct,
          paymentTerms,
          description,
          notes,
        });
      } else {
        savedProject = await api.createProject(
          toPayload({
            projectName,
            siteLocation,
            clientName,
            clientPhone,
            clientEmail,
            clientTin,
            pettyCash,
            contractNumber,
            startDate,
            endDate,
            contractValue,
            initialAdvance,
            status: statusToSave,
            laborBudget,
            materialBudget,
            operationalBudget,
            paymentTerms,
            description,
            notes,
          }),
        );
      }

      let attachmentSaveError = "";
      try {
        await attachInitialDocuments(savedProject.id);
      } catch (error) {
        attachmentSaveError =
          error instanceof Error ? error.message : "Initial documents were not saved.";
      }
      markSaved();
      setSaveMode(mode);
      if (attachmentSaveError.length > 0) {
        setSubmitError(
          `${attachmentSaveError} Project was saved. You can upload the documents again.`,
        );
      }
      window.setTimeout(() => {
        setSaveMode(null);
        if (mode === "project") {
          navigate(`/projects/${encodeURIComponent(savedProject.id)}`);
          return;
        }
        if (!isEditMode) {
          navigate(`/projects/${encodeURIComponent(savedProject.id)}/edit`);
        }
      }, 1500);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to save project.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const err = (val: string) =>
    showErrors && val.trim().length === 0 ? "!border-red-300 !bg-red-50" : "";

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Create or update core project records."
        title={isEditMode ? "Edit Project" : "Add New Project"}
      />

      {submitError && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{submitError}</p>
        </SurfaceCard>
      )}

      {loadingProject && (
        <SurfaceCard>
          <div className="flex items-center justify-center py-6">
            <div className="global-loader-shell" aria-hidden="true">
              <span className="global-loader-ring global-loader-ring-a" />
              <span className="global-loader-ring global-loader-ring-b" />
              <span className="global-loader-core" />
            </div>
          </div>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* ── A. Basic Details ── */}
        <SurfaceCard className="xl:col-span-2" title="A. Basic Project Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="form-field sm:col-span-2">
              <span>Project Name <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(projectName)}`}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Example: Dodoma Ring Road Construction"
                value={projectName}
              />
            </label>

            <label className="form-field">
              <span>Site Location <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(siteLocation)}`}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="Dodoma Urban"
                value={siteLocation}
              />
            </label>

            <label className="form-field">
              <span>Client Name <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(clientName)}`}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Dodoma Municipal Council"
                value={clientName}
              />
            </label>

            <label className="form-field">
              <span>Client Phone <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(clientPhone)}`}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 0712 345 678"
                value={clientPhone}
              />
            </label>

            <label className="form-field">
              <span>Client Email (Optional)</span>
              <input
                className="input-field"
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. client@company.co.tz"
                type="email"
                value={clientEmail}
              />
            </label>

            <label className="form-field">
              <span>Client TIN (Optional)</span>
              <input
                className="input-field"
                onChange={(e) => setClientTin(e.target.value)}
                placeholder="e.g. 123-456-789"
                value={clientTin}
              />
            </label>

            <label className="form-field">
              <span>Contract / Tender Number <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(contractNumber)}`}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="DMC-DRN-2026-01"
                value={contractNumber}
              />
            </label>

            <label className="form-field">
              <span>Start Date <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(startDate)}`}
                onChange={(e) => setStartDate(e.target.value)}
                type="date"
                value={startDate}
              />
            </label>

            <label className="form-field">
              <span>Completion Date <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(endDate)}`}
                onChange={(e) => setEndDate(e.target.value)}
                type="date"
                value={endDate}
              />
            </label>

            <label className="form-field sm:col-span-2">
              <span>Project Description</span>
              <textarea
                className="input-field min-h-24"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope, expected outputs, and key milestones..."
                value={description}
              />
            </label>

            <label className="form-field">
              <span>Current Status <span className="text-red-600">*</span></span>
              {isProjectClosed ? (
                <>
                  <input className="input-field bg-slate-50" readOnly value={status} />
                  <span className="text-xs font-normal normal-case tracking-normal text-slate-500">
                    Reopen the project from its detail page to record new spend
                    against it.
                  </span>
                </>
              ) : (
                <GuiSelect
                  className={`input-field ${err(status)}`}
                  onChange={(e) => setStatus(e.target.value)}
                  value={status}
                >
                  <option disabled value="">Select status</option>
                  {/* "Completed"/"Closed" are set by the Close Project action,
                      which reconciles the books first. "Over Budget" and
                      "Payment Pending" were removed because the system already
                      works both out from the project's own figures. */}
                  {options(PROJECT_STATUSES)}
                </GuiSelect>
              )}
            </label>
          </div>
        </SurfaceCard>

        {/* ── B. Financial Details ── */}
        <SurfaceCard title="B. Financial Details">
          <div className="space-y-3">

            {/* Manual: contract value — the only truly manual financial field */}
            <FinancialInput
              label="Contract Value (TZS) *"
              onChange={setContractValue}
              placeholder="120000000"
              required
              value={contractValue}
            />

            {/* New project: enter initial advance; edit mode: show live total */}
            {isEditMode ? (
              <AutoField
                color="text-emerald-700"
                hint="Automatically updated from payments recorded in the Payments module."
                label="Amount Received (TZS)"
                value={formatTzs(liveAmountReceived)}
              />
            ) : (
              <FinancialInput
                label="Initial Advance (TZS)"
                onChange={setInitialAdvance}
                placeholder="0"
                value={initialAdvance}
              />
            )}

            {/* Auto: total spent — updated by labor, materials, expenses */}
            <AutoField
              hint="Automatically summed from labour, materials, and other expenses."
              label="Total Spent (TZS)"
              value={isEditMode ? formatTzs(liveTotalSpent) : "TZS 0 (starts after activity)"}
            />

            {/* Auto: remaining balance */}
            <AutoField
              color={remainingBalance >= 0 ? "text-emerald-700" : "text-red-700"}
              hint="Formula: Contract Value - Total Spent"
              label="Remaining Balance (TZS)"
              value={formatTzs(remainingBalance)}
            />

            {/* Auto: pending client payments */}
            <AutoField
              color="text-amber-700"
              hint="Formula: Contract Value - Amount Received."
              label="Pending Client Payments (TZS)"
              value={formatTzs(pendingPayments)}
            />

            {/* Auto: profit/loss estimate */}
            <AutoField
              color={profitLossEstimate >= 0 ? "text-emerald-700" : "text-red-700"}
              hint="Formula: Amount Received - Total Spent"
              label="Estimated Profit / Loss (TZS)"
              value={formatTzs(profitLossEstimate)}
            />

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Planned Budgets
              </p>
              <FinancialInput
                label="Labour Budget"
                onChange={setLaborBudget}
                placeholder="32000000"
                value={laborBudget}
              />
              <FinancialInput
                label="Materials Budget"
                onChange={setMaterialBudget}
                placeholder="42000000"
                value={materialBudget}
              />
              <FinancialInput
                label="Operational Budget"
                onChange={setOperationalBudget}
                placeholder="18000000"
                value={operationalBudget}
              />
              <div>
                <FinancialInput
                  label="Petty Cash Float"
                  onChange={setPettyCash}
                  placeholder="500000"
                  value={pettyCash}
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  This project's petty-cash allocation. Cash-out on the Petty Cash tab can't exceed it.
                </p>
              </div>
              <label className="form-field">
                <span>Expected Profit (TZS) <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">Auto</span></span>
                <input
                  className={`input-field bg-slate-50 font-semibold ${expected.expectedProfit < 0 ? "text-red-700" : "text-emerald-700"}`}
                  readOnly
                  value={`TZS ${Math.round(expected.expectedProfit).toLocaleString("en-TZ")}`}
                />
              </label>
              <label className="form-field">
                <span>Expected Profit Margin (%) <span className="text-[10px] font-normal normal-case tracking-normal text-slate-400">Auto</span></span>
                <input
                  className="input-field bg-slate-50 font-semibold text-[#0b2a53]"
                  readOnly
                  value={`${expected.marginPct}%`}
                />
                <span className="mt-1 text-[10px] text-slate-400">
                  Contract Value − (Labour + Materials + Operational). Fill those above and this updates itself.
                </span>
              </label>
              <label className="form-field">
                <span>Payment Terms</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="30% advance, milestone payments every 30 days..."
                  value={paymentTerms}
                />
              </label>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ── C. Notes & Documents ── */}
      <SurfaceCard title="C. Additional Notes and Initial Documents">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="form-field">
            <span>Notes</span>
            <textarea
              className="input-field min-h-24"
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Risks, dependencies, and additional notes..."
              value={notes}
            />
          </label>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Attach Initial Documents</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload draft contracts, BOQ, design drawings, or quotations.
            </p>
            <input
              className="hidden"
              multiple
              onChange={handleInitialDocumentsChange}
              ref={initialDocsInputRef}
              type="file"
            />
            <button className="btn-secondary mt-4" onClick={handlePickInitialDocuments} type="button">
              <Paperclip className="h-4 w-4" />
              Upload File
            </button>
            {initialDocuments.length > 0 && (
              <div className="mt-3 space-y-2">
                {initialDocuments.map((file, index) => (
                  <div
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                    key={`${file.name}-${file.lastModified}-${file.size}`}
                  >
                    <p className="truncate pr-3">
                      {file.name}
                      {file.size > 0 ? ` (${formatBytes(file.size)})` : ""}
                    </p>
                    <button
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeInitialDocument(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-18 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(0,0,0,0.08)] lg:bottom-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button className="btn-secondary" onClick={() => navigate("/projects")} type="button">
            Cancel
          </button>
          <button
            className="btn-secondary"
            disabled={submitting}
            onClick={() => void triggerSave("draft")}
            type="button"
          >
            Save Draft
          </button>
          <button
            className="btn-primary"
            disabled={submitting}
            onClick={() => void triggerSave("project")}
            type="button"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEditMode ? "Update Project" : "Save Project"}
          </button>
        </div>
      </div>

      <SuccessToast
        message={
          saveMode === "draft"
            ? "Draft saved."
            : "Project details saved."
        }
        onClose={() => setSaveMode(null)}
        open={saveMode !== null}
        title={
          saveMode === "draft"
            ? "Draft Updated"
            : isEditMode
              ? "Project Updated"
              : "Project Saved"
        }
      />
    </div>
  );
};
