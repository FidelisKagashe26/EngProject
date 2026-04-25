import { Loader2, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FinancialInput, SectionTitle, SuccessToast, SurfaceCard, GuiSelect } from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { api, type CreateProjectPayload, type ProjectApiRecord } from "../services/api";

type SaveMode = "project" | "draft" | null;

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
  amountReceived: string;
  totalSpent: string;
  pendingPayments: string;
  laborBudget: string;
  materialBudget: string;
  operationalBudget: string;
  profitMargin: string;
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
  amountReceived: string;
  totalSpent: string;
  status: string;
  pendingPayments: string;
  description: string;
  notes: string;
}): CreateProjectPayload => ({
  name: values.projectName,
  siteLocation: values.siteLocation,
  clientName: values.clientName,
  contractNumber: values.contractNumber,
  startDate: values.startDate,
  expectedCompletionDate: values.endDate,
  contractValue: Number(values.contractValue) || 0,
  amountReceived: Number(values.amountReceived) || 0,
  totalSpent: Number(values.totalSpent) || 0,
  status: values.status,
  progress: 0,
  pendingClientPayments: Number(values.pendingPayments) || 0,
  description: values.description,
  notes: values.notes,
});

export const ProjectFormPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { markSaved, setDirty } = useUnsavedChanges();
  const isEditMode = useMemo(() => Boolean(projectId), [projectId]);
  const baselineFingerprintRef = useRef("");
  const dirtyCheckReadyRef = useRef(false);

  const [projectName, setProjectName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [totalSpent, setTotalSpent] = useState("");
  const [pendingPayments, setPendingPayments] = useState("");
  const [laborBudget, setLaborBudget] = useState("");
  const [materialBudget, setMaterialBudget] = useState("");
  const [operationalBudget, setOperationalBudget] = useState("");
  const [profitMargin, setProfitMargin] = useState("");
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const currentFingerprint = useMemo(
    () =>
      toFingerprint({
        projectName,
        siteLocation,
        clientName,
        contractNumber,
        startDate,
        endDate,
        description,
        status,
        contractValue,
        amountReceived,
        totalSpent,
        pendingPayments,
        laborBudget,
        materialBudget,
        operationalBudget,
        profitMargin,
        notes,
      }),
    [
      amountReceived,
      clientName,
      contractNumber,
      contractValue,
      description,
      endDate,
      laborBudget,
      materialBudget,
      notes,
      operationalBudget,
      pendingPayments,
      profitMargin,
      projectName,
      siteLocation,
      startDate,
      status,
      totalSpent,
    ],
  );

  useEffect(() => {
    if (isEditMode || dirtyCheckReadyRef.current) {
      return;
    }

    baselineFingerprintRef.current = currentFingerprint;
    dirtyCheckReadyRef.current = true;
    setDirty(false);
  }, [currentFingerprint, isEditMode, setDirty]);

  useEffect(() => {
    if (!dirtyCheckReadyRef.current) {
      return;
    }
    setDirty(currentFingerprint !== baselineFingerprintRef.current);
  }, [currentFingerprint, setDirty]);

  useEffect(() => {
    if (!isEditMode || !projectId) {
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoadingProject(true);
      setSubmitError("");
      try {
        const row = await api.getProjectById(projectId);
        if (!mounted) {
          return;
        }

        setProjectName(row.name);
        setSiteLocation(row.siteLocation);
        setClientName(row.clientName);
        setContractNumber(row.contractNumber);
        setStartDate(row.startDate);
        setEndDate(row.expectedCompletionDate);
        setDescription(row.description ?? "");
        setStatus(row.status);
        setContractValue(String(row.contractValue));
        setAmountReceived(String(row.amountReceived));
        setTotalSpent(String(row.totalSpent));
        setPendingPayments(String(row.pendingClientPayments));
        setNotes(row.notes ?? "");
        baselineFingerprintRef.current = toFingerprint({
          projectName: row.name,
          siteLocation: row.siteLocation,
          clientName: row.clientName,
          contractNumber: row.contractNumber,
          startDate: row.startDate,
          endDate: row.expectedCompletionDate,
          description: row.description ?? "",
          status: row.status,
          contractValue: String(row.contractValue),
          amountReceived: String(row.amountReceived),
          totalSpent: String(row.totalSpent),
          pendingPayments: String(row.pendingClientPayments),
          laborBudget,
          materialBudget,
          operationalBudget,
          profitMargin,
          notes: row.notes ?? "",
        });
        dirtyCheckReadyRef.current = true;
        setDirty(false);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to load project details. Please check backend connection.",
        );
        baselineFingerprintRef.current = currentFingerprint;
        dirtyCheckReadyRef.current = true;
        setDirty(false);
      } finally {
        if (mounted) {
          setLoadingProject(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [
    currentFingerprint,
    isEditMode,
    laborBudget,
    materialBudget,
    notes,
    operationalBudget,
    profitMargin,
    projectId,
    setDirty,
  ]);

  const validateRequired = (): boolean => {
    return (
      projectName.trim().length > 0 &&
      siteLocation.trim().length > 0 &&
      clientName.trim().length > 0 &&
      contractNumber.trim().length > 0 &&
      startDate.trim().length > 0 &&
      endDate.trim().length > 0 &&
      status.trim().length > 0 &&
      contractValue.trim().length > 0
    );
  };

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
      const payload = toPayload({
        projectName,
        siteLocation,
        clientName,
        contractNumber,
        startDate,
        endDate,
        contractValue,
        amountReceived,
        totalSpent,
        status,
        pendingPayments,
        description,
        notes,
      });

      const savedProject: ProjectApiRecord =
        isEditMode && projectId
          ? await api.updateProject(projectId, payload)
          : await api.createProject(payload);

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
          : "Unable to save project. Please check backend connection.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Register new projects with contract, budget and supporting notes."
        title={isEditMode ? "Edit Project" : "Add New Project"}
      />

      {submitError && (
        <SurfaceCard>
          <p className="text-sm text-red-700">{submitError}</p>
        </SurfaceCard>
      )}

      {loadingProject ? (
        <SurfaceCard>
          <div className="flex items-center justify-center py-6">
            <div className="global-loader-shell" aria-hidden="true">
              <span className="global-loader-ring global-loader-ring-a" />
              <span className="global-loader-ring global-loader-ring-b" />
              <span className="global-loader-core" />
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SurfaceCard className="xl:col-span-2" title="A. Basic Project Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="form-field sm:col-span-2">
              <span>
                Project Name <span className="text-red-600">*</span>
              </span>
              <input
                className={`input-field ${showErrors && projectName.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Dodoma Drainage Construction"
                required
                value={projectName}
              />
            </label>

            <label className="form-field">
              <span>
                Site / Location <span className="text-red-600">*</span>
              </span>
              <input
                className={`input-field ${showErrors && siteLocation.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setSiteLocation(event.target.value)}
                placeholder="Dodoma Urban"
                value={siteLocation}
              />
            </label>

            <label className="form-field">
              <span>
                Client Name <span className="text-red-600">*</span>
              </span>
              <input
                className={`input-field ${showErrors && clientName.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Dodoma Municipal Council"
                value={clientName}
              />
            </label>

            <label className="form-field">
              <span>
                Contract / Tender Number <span className="text-red-600">*</span>
              </span>
              <input
                className={`input-field ${showErrors && contractNumber.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setContractNumber(event.target.value)}
                placeholder="DMC-DRN-2026-01"
                value={contractNumber}
              />
            </label>

            <label className="form-field">
              <span>Project Start Date</span>
              <input
                className={`input-field ${showErrors && startDate.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>

            <label className="form-field">
              <span>Expected Completion Date</span>
              <input
                className={`input-field ${showErrors && endDate.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </label>

            <label className="form-field sm:col-span-2">
              <span>Project Description</span>
              <textarea
                className="input-field min-h-24"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Scope of work, expected outputs, major milestones..."
                value={description}
              />
            </label>

            <label className="form-field">
              <span>Current Status</span>
              <GuiSelect
                className={`input-field ${showErrors && status.trim().length === 0 ? "!border-red-300 !bg-red-50" : ""}`}
                onChange={(event) => setStatus(event.target.value)}
                value={status}
              >
                <option disabled value="">
                  Select status
                </option>
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

        <SurfaceCard title="B. Financial Details">
          <div className="space-y-3">
            <FinancialInput
              label="Total Contract Value"
              onChange={setContractValue}
              placeholder="120000000"
              required
              value={contractValue}
            />
            <FinancialInput label="Amount Received" onChange={setAmountReceived} placeholder="0" value={amountReceived} />
            <FinancialInput label="Total Spent" onChange={setTotalSpent} placeholder="0" value={totalSpent} />
            <FinancialInput label="Pending Client Payments" onChange={setPendingPayments} placeholder="0" value={pendingPayments} />
            <FinancialInput label="Planned Labor Budget" onChange={setLaborBudget} placeholder="32000000" value={laborBudget} />
            <FinancialInput label="Planned Material Budget" onChange={setMaterialBudget} placeholder="42000000" value={materialBudget} />
            <FinancialInput label="Planned Operational Budget" onChange={setOperationalBudget} placeholder="18000000" value={operationalBudget} />
            <label className="form-field">
              <span>Expected Profit Margin (%)</span>
              <input className="input-field" onChange={(event) => setProfitMargin(event.target.value)} type="number" value={profitMargin} />
            </label>
            <label className="form-field">
              <span>Payment Terms</span>
              <textarea className="input-field min-h-20" placeholder="Advance 30%, milestone billing every 30 days..." />
            </label>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard title="C. Project Notes & Initial Documents">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="form-field">
            <span>Notes</span>
            <textarea
              className="input-field min-h-24"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any project notes, risks, assumptions, dependencies..."
              value={notes}
            />
          </label>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Attach Initial Documents</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload contract draft, BOQ, design drawings, quotations.
            </p>
            <button className="btn-secondary mt-4" type="button">
              <Paperclip className="h-4 w-4" />
              Upload Files
            </button>
          </div>
        </div>
      </SurfaceCard>

      <div className="sticky bottom-18 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_24px_rgba(0,0,0,0.08)] lg:bottom-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button className="btn-secondary" onClick={() => navigate("/projects")} type="button">
            Cancel
          </button>
          <button className="btn-secondary" disabled={submitting} onClick={() => void triggerSave("draft")} type="button">
            Save as Draft
          </button>
          <button className="btn-primary" disabled={submitting} onClick={() => void triggerSave("project")} type="button">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEditMode ? "Update Project" : "Save Project"}
          </button>
        </div>
      </div>

      <SuccessToast
        message={saveMode === "draft" ? "Draft saved successfully." : "Project information saved successfully."}
        onClose={() => setSaveMode(null)}
        open={saveMode !== null}
        title={saveMode === "draft" ? "Draft Updated" : isEditMode ? "Project Updated" : "Project Saved"}
      />
    </div>
  );
};
