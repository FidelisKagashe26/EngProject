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
import { api, type DocumentApiRecord, type ProjectApiRecord } from "../services/api";
import { formatDate, formatTzs } from "../utils/format";

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
                          href={documentRow.fileReference}
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
      {/* Back + Edit */}
      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary inline-flex items-center gap-2" to="/projects">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Link
          className="btn-primary"
          to={`/projects/${encodeURIComponent(project.id)}/edit`}
        >
          Edit Project
        </Link>
      </div>

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
              Progress
            </p>
            <ProgressBar value={project.progress} />
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
    </div>
  );
}

