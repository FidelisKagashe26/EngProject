import {
  ArrowLeft,
  Calendar,
  DollarSign,
  HardHat,
  Package,
  Paperclip,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { pushTopToast } from "../components/topToast";
import {
  EmptyState,
  ProgressBar,
  SectionTitle,
  SkeletonCards,
  SkeletonTable,
  SurfaceCard,
} from "../components/ui";
import { isClosedProjectStatus } from "../constants/options";
import {
  api,
  type DocumentApiRecord,
  type ProjectApiRecord,
  type ProjectClosureSummary,
} from "../services/api";
import { formatDate, formatTzs } from "../utils/format";
import { resolveUploadUrl } from "../utils/uploads";

// ─── Quick Link tile ──────────────────────────────────────────────────────────

type QuickLinkProps = {
  icon: React.ReactNode;
  label: string;
  to: string;
  color: string;
};

const QuickLink = ({ icon, label, to, color }: QuickLinkProps) => (
  <Link
    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-slate-300 hover:shadow-md"
    to={to}
  >
    <span className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>{icon}</span>
    <span className="text-xs font-semibold text-slate-700">{label}</span>
  </Link>
);

// ─── Status badge helper ──────────────────────────────────────────────────────

const projectDocumentCategories = [
  "Project Documents",
  "Worker Documents",
  "Contracts",
  "Invoices",
  "Receipts",
  "Drawings",
  "Other Documents",
];

type InlineProjectDocumentsProps = {
  project: ProjectApiRecord;
  uploadedByName: string;
};

const InlineProjectDocuments = ({ project, uploadedByName }: InlineProjectDocumentsProps) => {
  const [documents, setDocuments] = useState<DocumentApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [category, setCategory] = useState("Project Documents");
  const [notes, setNotes] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const rows = await api.getDocuments({ projectId: project.id });
      setDocuments(rows);
    } catch (error) {
      pushTopToast({
        tone: "error",
        title: "Load Failed",
        message: error instanceof Error ? error.message : "Failed to load project documents.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setPendingFiles((previousFiles) => {
      const unique = new Map(
        previousFiles.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]),
      );
      for (const file of files) {
        unique.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      }
      return Array.from(unique.values());
    });

    event.target.value = "";
  };

  const handleRemovePendingFile = (indexToRemove: number) => {
    setPendingFiles((previousFiles) =>
      previousFiles.filter((_, currentIndex) => currentIndex !== indexToRemove),
    );
  };

  const handleUploadDocuments = async () => {
    if (pendingFiles.length === 0) {
      pushTopToast({
        tone: "info",
        title: "No Files Selected",
        message: "Choose at least one file before uploading.",
      });
      return;
    }

    const filesToUpload = [...pendingFiles];
    setUploading(true);
    try {
      await Promise.all(
        filesToUpload.map(async (file) => {
          const uploaded = await api.uploadDocumentFile(file, { notifySuccess: false });
          await api.createDocument({
            projectId: project.id,
            category: category.trim().length > 0 ? category.trim() : "Project Documents",
            documentName: file.name,
            fileType: file.type || uploaded.mimetype,
            fileSize: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            fileReference: uploaded.url,
            uploadedBy: uploadedByName,
            notes: notes.trim(),
          });
        }),
      );

      setPendingFiles([]);
      setNotes("");
      await loadDocuments();
      pushTopToast({
        tone: "success",
        title: "Success",
        message: `${filesToUpload.length} document${filesToUpload.length === 1 ? "" : "s"} uploaded successfully.`,
      });
    } catch (error) {
      pushTopToast({
        tone: "error",
        title: "Upload Failed",
        message: error instanceof Error ? error.message : "Failed to upload one or more documents.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentRow: DocumentApiRecord) => {
    const confirmed = window.confirm(
      `Delete "${documentRow.documentName}" from this project documents list?`,
    );
    if (!confirmed) return;

    setDeletingId(documentRow.id);
    try {
      await api.deleteDocument(documentRow.id);
      await loadDocuments();
      pushTopToast({
        tone: "success",
        title: "Success",
        message: "Document deleted successfully.",
      });
    } catch (error) {
      pushTopToast({
        tone: "error",
        title: "Delete Failed",
        message: error instanceof Error ? error.message : "Failed to delete document.",
      });
    } finally {
      setDeletingId("");
    }
  };

  return (
    <SurfaceCard title={`Project Documents (${documents.length})`}>
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        <label className="form-field">
          <span>Category</span>
          <select
            className="input-field"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {projectDocumentCategories.map((option) => (
              <option key={`doc-category-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Notes (Optional)</span>
          <input
            className="input-field"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="E.g. worker contracts, approvals, receipts."
            value={notes}
          />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <input
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
            className="hidden"
            multiple
            onChange={handleFilesSelected}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className="h-4 w-4" />
            Select Documents
          </button>
          <button
            className="btn-primary"
            disabled={uploading || pendingFiles.length === 0}
            onClick={() => void handleUploadDocuments()}
            type="button"
          >
            {uploading ? "Uploading..." : "Upload Selected"}
          </button>
        </div>
        {pendingFiles.length > 0 && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ready to Upload ({pendingFiles.length})
            </p>
            <ul className="mt-2 space-y-2">
              {pendingFiles.map((file, index) => (
                <li className="flex items-center justify-between text-sm text-slate-700" key={`${file.name}:${file.size}:${file.lastModified}`}>
                  <span>{file.name}</span>
                  <button
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                    onClick={() => handleRemovePendingFile(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <SkeletonTable rows={3} />
        ) : documents.length === 0 ? (
          <EmptyState
            description="No documents uploaded for this project yet."
            title="No Project Documents"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>Size</th>
                  <th>File</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((documentRow, index) => (
                  <tr key={documentRow.id}>
                    <td>{index + 1}</td>
                    <td className="font-medium text-slate-900">{documentRow.documentName}</td>
                    <td>{documentRow.category}</td>
                    <td>{documentRow.uploadedBy}</td>
                    <td>{formatDate(documentRow.createdAt)}</td>
                    <td>{documentRow.fileSize || "-"}</td>
                    <td>
                      {documentRow.fileReference ? (
                        <a
                          className="text-sm font-semibold text-[#0b2a53] hover:underline"
                          href={resolveUploadUrl(documentRow.fileReference)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          View File
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <button
                        className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:text-red-700"
                        disabled={deletingId === documentRow.id}
                        onClick={() => void handleDeleteDocument(documentRow)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === documentRow.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
};

export function ProjectDetailPage() {
  const { user } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [closureSummary, setClosureSummary] = useState<ProjectClosureSummary | null>(null);
  const [loadingClosure, setLoadingClosure] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let mounted = true;

    const load = async () => {
      try {
        const data = await api.getProjectById(projectId);
        if (mounted) { setProject(data); setError(""); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load project.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [projectId]);

  const reloadProject = async () => {
    if (!projectId) return;
    setProject(await api.getProjectById(projectId));
  };

  // Show what closing would reconcile to before doing it, so the decision is
  // made with the outstanding items on screen rather than after the fact.
  const openClosureModal = async () => {
    if (!projectId) return;
    setLoadingClosure(true);
    try {
      setClosureSummary(await api.getProjectClosureSummary(projectId));
    } catch (err) {
      pushTopToast({ tone: "error", title: "Project", message: err instanceof Error ? err.message : "Failed to check project." });
    } finally {
      setLoadingClosure(false);
    }
  };

  const handleClose = async (force: boolean) => {
    if (!projectId) return;
    setClosing(true);
    try {
      const result = await api.closeProject(projectId, force);
      pushTopToast({ tone: "success", title: "Project", message: result.message });
      setClosureSummary(null);
      await reloadProject();
    } catch (err) {
      pushTopToast({ tone: "error", title: "Project", message: err instanceof Error ? err.message : "Failed to close project." });
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!projectId) return;
    setReopening(true);
    try {
      const result = await api.reopenProject(projectId);
      pushTopToast({ tone: "success", title: "Project", message: result.message });
      await reloadProject();
    } catch (err) {
      pushTopToast({ tone: "error", title: "Project", message: err instanceof Error ? err.message : "Failed to reopen project." });
    } finally {
      setReopening(false);
    }
  };

  if (loading) return <div className="space-y-6"><SkeletonCards /></div>;

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Link>
        <SurfaceCard>
          <p className="text-sm text-red-700">{error || "Project not found."}</p>
        </SurfaceCard>
      </div>
    );
  }

  const uploadedByName = user?.fullName?.trim().length ? user.fullName : "Project Manager";

  const quickLinks: QuickLinkProps[] = [
    {
      icon: <Users className="h-5 w-5 text-emerald-700" />,
      label: "Labour",
      to: `/site-operations?tab=labor&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-emerald-50",
    },
    {
      icon: <Package className="h-5 w-5 text-amber-700" />,
      label: "Materials",
      to: `/site-operations?tab=materials&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-amber-50",
    },
    {
      icon: <DollarSign className="h-5 w-5 text-purple-700" />,
      label: "Payments",
      to: `/payments?projectId=${encodeURIComponent(project.id)}`,
      color: "bg-purple-50",
    },
    {
      icon: <TrendingUp className="h-5 w-5 text-orange-700" />,
      label: "Expenses",
      to: `/site-operations?tab=expenses&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-orange-50",
    },
    {
      icon: <HardHat className="h-5 w-5 text-slate-700" />,
      label: "Equipment",
      to: `/site-operations?tab=equipment&projectId=${encodeURIComponent(project.id)}`,
      color: "bg-slate-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Edit + Close/Reopen */}
      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {isClosedProjectStatus(project.status) ? (
            <button
              className="btn-secondary"
              disabled={reopening}
              onClick={() => void handleReopen()}
              type="button"
            >
              {reopening ? "Reopening..." : "Reopen Project"}
            </button>
          ) : (
            <button
              className="btn-secondary"
              disabled={loadingClosure}
              onClick={() => void openClosureModal()}
              type="button"
            >
              {loadingClosure ? "Checking..." : "Close Project"}
            </button>
          )}
          <Link
            className="btn-primary"
            to={`/projects/${encodeURIComponent(project.id)}/edit`}
          >
            Edit Project
          </Link>
        </div>
      </div>

      {isClosedProjectStatus(project.status) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This project is <span className="font-semibold">{project.status}</span>
          {project.closedBy ? ` — closed by ${project.closedBy}` : ""}
          {project.closedAt ? ` on ${formatDate(project.closedAt.slice(0, 10))}` : ""}.
          No new spend can be recorded against it until it is reopened.
        </div>
      )}

      <SectionTitle
        subtitle={`${project.siteLocation} - ${project.contractNumber}`}
        title={project.name}
      />

      {/* Project Info + Progress */}
      <SurfaceCard>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Project Details
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Client</dt>
                <dd className="font-medium text-slate-900">{project.clientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span
                    className={
                      project.status === "Active"
                        ? "font-semibold text-emerald-700"
                        : project.status === "Completed"
                          ? "font-semibold text-blue-700"
                          : project.status === "On Hold"
                            ? "font-semibold text-amber-700"
                            : project.status === "Over Budget"
                              ? "font-semibold text-red-600"
                              : "font-semibold text-slate-500"
                    }
                  >
                    {project.status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Start
                </dt>
                <dd className="font-medium">{formatDate(project.startDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Completion
                </dt>
                <dd className="font-medium">{formatDate(project.expectedCompletionDate)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Work Progress
            </p>
            <ProgressBar value={project.progress} />

            {/* Budget consumed sits next to work done rather than replacing it:
                progress is the engineer's judgement, and the gap between the two
                is the early warning — 70% of the money against 30% of the work. */}
            <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Budget Consumed
            </p>
            <ProgressBar value={Math.min(project.costConsumedPct, 100)} />
            <p
              className={`mt-2 text-xs ${
                project.costConsumedPct > project.progress
                  ? "text-amber-700"
                  : "text-slate-500"
              }`}
            >
              {project.costConsumedPct}% of budget spent for {project.progress}% of
              work
              {project.costConsumedPct > project.progress
                ? " — spending is ahead of delivery."
                : "."}
            </p>

            {project.description && (
              <p className="mt-4 text-xs text-slate-500">{project.description}</p>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* Financial Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Contract Value", value: project.contractValue, color: "text-slate-900" },
          { label: "Amount Received", value: project.amountReceived, color: "text-emerald-700" },
          { label: "Total Spent", value: project.totalSpent, color: "text-slate-900" },
          {
            label: "Balance",
            value: project.remainingBalance,
            color: project.remainingBalance >= 0 ? "text-emerald-700" : "text-red-700",
          },
          {
            label: "Profit / Loss",
            value: project.profitLossEstimate,
            color: project.profitLossEstimate >= 0 ? "text-emerald-700" : "text-red-700",
          },
          { label: "Pending Client Payments", value: project.pendingClientPayments, color: "text-amber-700" },
        ].map((card) => (
          <SurfaceCard key={card.label}>
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.color}`}>{formatTzs(card.value)}</p>
          </SurfaceCard>
        ))}
      </div>

      <InlineProjectDocuments project={project} uploadedByName={uploadedByName} />

      {/* Quick Access — other modules */}
      <SurfaceCard title="Quick Access">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          {quickLinks.map((link) => (
            <QuickLink key={link.label} {...link} />
          ))}
        </div>
      </SurfaceCard>

      {/* Notes */}
      {project.notes && (
        <SurfaceCard title="Additional Notes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{project.notes}</p>
        </SurfaceCard>
      )}

      {closureSummary && (
        <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">
              Close {closureSummary.projectName}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Figures below are recalculated from this project's transactions.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
              {[
                { label: "Contract Value", value: formatTzs(closureSummary.contractValue) },
                { label: "Amount Received", value: formatTzs(closureSummary.amountReceived) },
                { label: "Total Spent", value: formatTzs(closureSummary.totalSpent) },
                { label: "Labour", value: formatTzs(closureSummary.laborSpent) },
                { label: "Materials", value: formatTzs(closureSummary.materialSpent) },
                { label: "Operational", value: formatTzs(closureSummary.operationalSpent) },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-800">{row.value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Final Profit / Loss
                </dt>
                <dd
                  className={`mt-0.5 text-sm font-semibold ${
                    closureSummary.profitLoss >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {formatTzs(closureSummary.profitLoss)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outstanding Items
              </p>
              {closureSummary.readyToClose ? (
                <p className="text-sm text-emerald-700">
                  Nothing outstanding — this project is ready to close.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-amber-700">
                  {closureSummary.outstanding.clientBalance > 0 && (
                    <li>
                      Client still owes {formatTzs(closureSummary.outstanding.clientBalance)}
                    </li>
                  )}
                  {closureSummary.outstanding.workerOutstanding > 0 && (
                    <li>
                      Unpaid worker balances:{" "}
                      {formatTzs(closureSummary.outstanding.workerOutstanding)}
                    </li>
                  )}
                  {closureSummary.outstanding.unreconciledPettyCash > 0 && (
                    <li>
                      Petty cash not yet reconciled:{" "}
                      {formatTzs(closureSummary.outstanding.unreconciledPettyCash)}
                    </li>
                  )}
                  {closureSummary.outstanding.pendingApprovals > 0 && (
                    <li>
                      {closureSummary.outstanding.pendingApprovals} transaction(s) awaiting
                      approval
                    </li>
                  )}
                  {closureSummary.outstanding.undeliveredRequirements > 0 && (
                    <li>
                      {closureSummary.outstanding.undeliveredRequirements} material
                      requirement(s) not fully delivered
                    </li>
                  )}
                </ul>
              )}
            </div>

            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Closing locks the project against new spend. Existing records can still
              be corrected, and the project can be reopened.
            </p>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                className="btn-secondary"
                onClick={() => setClosureSummary(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={closing}
                onClick={() => void handleClose(!closureSummary.readyToClose)}
                type="button"
              >
                {closing
                  ? "Closing..."
                  : closureSummary.readyToClose
                    ? "Close Project"
                    : "Close Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

