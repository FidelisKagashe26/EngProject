import { Info, Loader2, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FinancialInput, SectionTitle, SuccessToast, SurfaceCard, GuiSelect } from "../components/ui";
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

const toFingerprint = (values: {
  projectName: string;
  siteLocation: string;
  clientName: string;
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
  profitMargin: string;
  paymentTerms: string;
  notes: string;
}) => JSON.stringify(values);

const toPayload = (values: {
  projectName: string;
  siteLocation: string;
  clientName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  contractValue: string;
  initialAdvance: string;
  status: string;
  description: string;
  notes: string;
}): CreateProjectPayload => {
  const contractVal = Number(values.contractValue) || 0;
  const advance = Number(values.initialAdvance) || 0;
  return {
    name: values.projectName,
    siteLocation: values.siteLocation,
    clientName: values.clientName,
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
    description: values.description,
    notes: values.notes,
  };
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
  const { markSaved, setDirty } = useUnsavedChanges();
  const isEditMode = useMemo(() => Boolean(projectId), [projectId]);
  const baselineFingerprintRef = useRef("");
  const dirtyCheckReadyRef = useRef(false);

  // ── Manual fields ──
  const [projectName, setProjectName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [contractValue, setContractValue] = useState("");
  // "initialAdvance" = amount received at project creation (first payment from client)
  // In edit mode this is replaced by the live running total from the DB
  const [initialAdvance, setInitialAdvance] = useState("");
  const [laborBudget, setLaborBudget] = useState("");
  const [materialBudget, setMaterialBudget] = useState("");
  const [operationalBudget, setOperationalBudget] = useState("");
  const [profitMargin, setProfitMargin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");

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

  // ── Dirty tracking ──
  const currentFingerprint = useMemo(
    () =>
      toFingerprint({
        projectName, siteLocation, clientName, contractNumber,
        startDate, endDate, description, status, contractValue,
        initialAdvance, laborBudget, materialBudget, operationalBudget,
        profitMargin, paymentTerms, notes,
      }),
    [
      projectName, siteLocation, clientName, contractNumber,
      startDate, endDate, description, status, contractValue,
      initialAdvance, laborBudget, materialBudget, operationalBudget,
      profitMargin, paymentTerms, notes,
    ],
  );

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
        setContractNumber(row.contractNumber);
        setStartDate(row.startDate);
        setEndDate(row.expectedCompletionDate);
        setDescription(row.description ?? "");
        setStatus(row.status);
        setContractValue(String(row.contractValue));
        // Live running totals — shown as read-only
        setLiveAmountReceived(row.amountReceived);
        setLiveTotalSpent(row.totalSpent);
        setNotes(row.notes ?? "");

        const fp = toFingerprint({
          projectName: row.name, siteLocation: row.siteLocation,
          clientName: row.clientName, contractNumber: row.contractNumber,
          startDate: row.startDate, endDate: row.expectedCompletionDate,
          description: row.description ?? "", status: row.status,
          contractValue: String(row.contractValue),
          initialAdvance: "", laborBudget, materialBudget,
          operationalBudget, profitMargin, paymentTerms,
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
            : "Imeshindwa kupakia taarifa za mradi.",
        );
        baselineFingerprintRef.current = currentFingerprint;
        dirtyCheckReadyRef.current = true;
        setDirty(false);
      } finally {
        if (mounted) setLoadingProject(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [
    currentFingerprint, isEditMode, laborBudget, materialBudget,
    notes, operationalBudget, profitMargin, paymentTerms, projectId, setDirty,
  ]);

  const validateRequired = (): boolean =>
    projectName.trim().length > 0 &&
    siteLocation.trim().length > 0 &&
    clientName.trim().length > 0 &&
    contractNumber.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    status.trim().length > 0 &&
    contractValue.trim().length > 0;

  const triggerSave = async (mode: SaveMode) => {
    if (mode === "draft") {
      setSaveMode("draft");
      window.setTimeout(() => setSaveMode(null), 2200);
      return;
    }

    if (!validateRequired()) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
    setSubmitting(true);
    setSubmitError("");

    try {
      let savedProject: ProjectApiRecord;

      if (isEditMode && projectId) {
        // Edit: only update fields the user can change — never overwrite live totals
        savedProject = await api.updateProject(projectId, {
          name: projectName,
          siteLocation,
          clientName,
          contractNumber,
          startDate,
          expectedCompletionDate: endDate,
          contractValue: Number(contractValue) || 0,
          status,
          description,
          notes,
          // pendingClientPayments recalculated from live data
          pendingClientPayments: Math.max((Number(contractValue) || 0) - liveAmountReceived, 0),
        });
      } else {
        savedProject = await api.createProject(
          toPayload({
            projectName, siteLocation, clientName, contractNumber,
            startDate, endDate, contractValue, initialAdvance,
            status, description, notes,
          }),
        );
      }

      markSaved();
      setSaveMode("project");
      window.setTimeout(() => {
        setSaveMode(null);
        navigate(`/projects/${encodeURIComponent(savedProject.id)}`);
      }, 1500);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Imeshindwa kuhifadhi mradi.",
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
        subtitle="Sajili miradi mipya pamoja na taarifa za mkataba, bajeti, na maelezo."
        title={isEditMode ? "Hariri Mradi" : "Ongeza Mradi Mpya"}
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
        <SurfaceCard className="xl:col-span-2" title="A. Taarifa za Msingi za Mradi">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="form-field sm:col-span-2">
              <span>Jina la Mradi <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(projectName)}`}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="mfano: Ujenzi wa Barabara ya Dodoma"
                value={projectName}
              />
            </label>

            <label className="form-field">
              <span>Eneo / Site <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(siteLocation)}`}
                onChange={(e) => setSiteLocation(e.target.value)}
                placeholder="Dodoma Urban"
                value={siteLocation}
              />
            </label>

            <label className="form-field">
              <span>Jina la Mteja <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(clientName)}`}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Halmashauri ya Manispaa ya Dodoma"
                value={clientName}
              />
            </label>

            <label className="form-field">
              <span>Namba ya Mkataba / Tender <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(contractNumber)}`}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="DMC-DRN-2026-01"
                value={contractNumber}
              />
            </label>

            <label className="form-field">
              <span>Tarehe ya Kuanza <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(startDate)}`}
                onChange={(e) => setStartDate(e.target.value)}
                type="date"
                value={startDate}
              />
            </label>

            <label className="form-field">
              <span>Tarehe ya Kukamilika <span className="text-red-600">*</span></span>
              <input
                className={`input-field ${err(endDate)}`}
                onChange={(e) => setEndDate(e.target.value)}
                type="date"
                value={endDate}
              />
            </label>

            <label className="form-field sm:col-span-2">
              <span>Maelezo ya Mradi</span>
              <textarea
                className="input-field min-h-24"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Upeo wa kazi, matokeo yanayotarajiwa, hatua kuu..."
                value={description}
              />
            </label>

            <label className="form-field">
              <span>Hali ya Sasa <span className="text-red-600">*</span></span>
              <GuiSelect
                className={`input-field ${err(status)}`}
                onChange={(e) => setStatus(e.target.value)}
                value={status}
              >
                <option disabled value="">Chagua hali</option>
                <option>Active</option>
                <option>Pending</option>
                <option>Completed</option>
                <option>On Hold</option>
                <option>Over Budget</option>
                <option>Payment Pending</option>
                <option>Closed</option>
              </GuiSelect>
            </label>
          </div>
        </SurfaceCard>

        {/* ── B. Financial Details ── */}
        <SurfaceCard title="B. Taarifa za Fedha">
          <div className="space-y-3">

            {/* Manual: contract value — the only truly manual financial field */}
            <FinancialInput
              label="Thamani ya Mkataba (TZS) *"
              onChange={setContractValue}
              placeholder="120000000"
              required
              value={contractValue}
            />

            {/* New project: enter initial advance; edit mode: show live total */}
            {isEditMode ? (
              <AutoField
                color="text-emerald-700"
                hint="Inasasishwa kiotomatiki kila wakati malipo ya mteja yanapoingizwa kwenye moduli ya Malipo."
                label="Kilichopokelewa (TZS)"
                value={formatTzs(liveAmountReceived)}
              />
            ) : (
              <FinancialInput
                label="Malipo ya Awali / Advance (TZS)"
                onChange={setInitialAdvance}
                placeholder="0"
                value={initialAdvance}
              />
            )}

            {/* Auto: total spent — updated by labor, materials, expenses */}
            <AutoField
              hint="Inajumlishwa kiotomatiki kutoka: malipo ya wafanyakazi, ununuzi wa vifaa, na matumizi mengine."
              label="Jumla Iliyotumika (TZS)"
              value={isEditMode ? formatTzs(liveTotalSpent) : "TZS 0 (itaanza baada ya shughuli)"}
            />

            {/* Auto: remaining balance */}
            <AutoField
              color={remainingBalance >= 0 ? "text-emerald-700" : "text-red-700"}
              hint="Hesabu: Thamani ya Mkataba − Jumla Iliyotumika"
              label="Salio Linalobaki (TZS)"
              value={formatTzs(remainingBalance)}
            />

            {/* Auto: pending client payments */}
            <AutoField
              color="text-amber-700"
              hint="Hesabu: Thamani ya Mkataba − Kilichopokelewa. Inasasishwa kila wakati malipo mapya yanapoingizwa."
              label="Malipo Yanayosubiri (TZS)"
              value={formatTzs(pendingPayments)}
            />

            {/* Auto: profit/loss estimate */}
            <AutoField
              color={profitLossEstimate >= 0 ? "text-emerald-700" : "text-red-700"}
              hint="Hesabu: Kilichopokelewa − Jumla Iliyotumika"
              label="Makadirio ya Faida / Hasara (TZS)"
              value={formatTzs(profitLossEstimate)}
            />

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Bajeti za Mipango
              </p>
              <FinancialInput
                label="Bajeti ya Wafanyakazi"
                onChange={setLaborBudget}
                placeholder="32000000"
                value={laborBudget}
              />
              <FinancialInput
                label="Bajeti ya Vifaa"
                onChange={setMaterialBudget}
                placeholder="42000000"
                value={materialBudget}
              />
              <FinancialInput
                label="Bajeti ya Uendeshaji"
                onChange={setOperationalBudget}
                placeholder="18000000"
                value={operationalBudget}
              />
              <label className="form-field">
                <span>Kiwango cha Faida Kinachotarajiwa (%)</span>
                <input
                  className="input-field"
                  onChange={(e) => setProfitMargin(e.target.value)}
                  placeholder="18"
                  type="number"
                  value={profitMargin}
                />
              </label>
              <label className="form-field">
                <span>Masharti ya Malipo</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Advance 30%, malipo ya hatua kila siku 30..."
                  value={paymentTerms}
                />
              </label>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* ── C. Notes & Documents ── */}
      <SurfaceCard title="C. Maelezo ya Ziada na Nyaraka za Awali">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="form-field">
            <span>Maelezo</span>
            <textarea
              className="input-field min-h-24"
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hatari, mawazo, utegemezi, maelezo mengine..."
              value={notes}
            />
          </label>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Ambatisha Nyaraka za Awali</p>
            <p className="mt-1 text-xs text-slate-500">
              Pakia rasimu ya mkataba, BOQ, michoro ya ubunifu, nukuu.
            </p>
            <button className="btn-secondary mt-4" type="button">
              <Paperclip className="h-4 w-4" />
              Pakia Faili
            </button>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Sticky footer ── */}
      <div className="sticky bottom-18 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(0,0,0,0.08)] lg:bottom-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button className="btn-secondary" onClick={() => navigate("/projects")} type="button">
            Ghairi
          </button>
          <button
            className="btn-secondary"
            disabled={submitting}
            onClick={() => void triggerSave("draft")}
            type="button"
          >
            Hifadhi Rasimu
          </button>
          <button
            className="btn-primary"
            disabled={submitting}
            onClick={() => void triggerSave("project")}
            type="button"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEditMode ? "Sasisha Mradi" : "Hifadhi Mradi"}
          </button>
        </div>
      </div>

      <SuccessToast
        message={
          saveMode === "draft"
            ? "Rasimu imehifadhiwa."
            : "Taarifa za mradi zimehifadhiwa."
        }
        onClose={() => setSaveMode(null)}
        open={saveMode !== null}
        title={
          saveMode === "draft"
            ? "Rasimu Imesasishwa"
            : isEditMode
              ? "Mradi Umesasishwa"
              : "Mradi Umehifadhiwa"
        }
      />
    </div>
  );
};
