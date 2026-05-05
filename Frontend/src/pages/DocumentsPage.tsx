import { FileText, FolderOpen, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  GuiSelect,
  SectionTitle,
  SkeletonTable,
  SuccessToast,
  SurfaceCard,
  TablePagination,
} from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import {
  api,
  type DocumentApiRecord,
  type ProjectApiRecord,
} from "../services/api";
import { formatDate } from "../utils/format";

const DOCUMENT_CATEGORIES = [
  "Contracts",
  "Quotations",
  "BOQ Documents",
  "Site Instructions",
  "Invoices",
  "Receipts",
  "Delivery Notes",
  "Payment References",
  "Drawings",
  "Technical Files",
  "Other Documents",
];

export const DocumentsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [documents, setDocuments] = useState<DocumentApiRecord[]>([]);
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"folder" | "table">("folder");

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentApiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Upload form
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [uploadCategory, setUploadCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [uploadDocumentName, setUploadDocumentName] = useState("");
  const [uploadedBy, setUploadedBy] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [docRows, projectRows] = await Promise.all([
          api.getDocuments(),
          api.getProjects(),
        ]);
        if (!mounted) return;
        setDocuments(docRows);
        setProjects(projectRows);
        setError("");
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load documents.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (location.hash !== "#upload-document") return;
    setViewMode("table");
    setShowUploadModal(true);
  }, [location.hash]);

  const refreshDocuments = async () => {
    const rows = await api.getDocuments();
    setDocuments(rows);
  };

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchSearch =
        search.trim().length === 0 ||
        `${doc.documentName} ${doc.projectName} ${doc.category}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchProject =
        projectFilter === "All" || doc.projectId === projectFilter;
      const matchCategory =
        categoryFilter === "All" || doc.category === categoryFilter;
      return matchSearch && matchProject && matchCategory;
    });
  }, [documents, search, projectFilter, categoryFilter]);

  const docPagination = useTablePagination(filteredDocuments);

  // Folder view: group by project
  const folderGroups = useMemo(() => {
    const map = new Map<string, { projectName: string; docs: DocumentApiRecord[] }>();
    for (const doc of documents) {
      const key = doc.projectId ?? "general";
      if (!map.has(key)) {
        map.set(key, { projectName: doc.projectName, docs: [] });
      }
      map.get(key)!.docs.push(doc);
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [documents]);

  const resetUploadForm = () => {
    setUploadProjectId("");
    setUploadCategory(DOCUMENT_CATEGORIES[0]);
    setUploadDocumentName("");
    setUploadedBy("");
    setUploadNotes("");
  };

  const openUploadModal = () => {
    resetUploadForm();
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (uploadDocumentName.trim().length < 2 || uploadedBy.trim().length < 2) {
      setError("Please fill document name and uploaded by.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createDocument({
        projectId: uploadProjectId,
        category: uploadCategory,
        documentName: uploadDocumentName.trim(),
        fileType: "",
        fileSize: "",
        fileReference: "",
        uploadedBy: uploadedBy.trim(),
        notes: uploadNotes.trim(),
      });
      await refreshDocuments();
      markSaved();
      setShowUploadModal(false);
      resetUploadForm();
      setToastMessage("Document uploaded successfully.");
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to upload document.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteDocument(docToDelete.id);
      await refreshDocuments();
      markSaved();
      setDocToDelete(null);
      setToastMessage("Document deleted successfully.");
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document.");
      setDocToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Store and manage contracts, BOQ files, receipts, delivery notes and drawings."
        title="Document Storage"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SurfaceCard title="Total Documents">
          <p className="text-2xl font-bold text-slate-900">{documents.length}</p>
        </SurfaceCard>
        <SurfaceCard title="Projects with Docs">
          <p className="text-2xl font-bold text-[#0b2a53]">
            {new Set(documents.map((d) => d.projectId).filter(Boolean)).size}
          </p>
        </SurfaceCard>
        <SurfaceCard title="Categories Used">
          <p className="text-2xl font-bold text-emerald-700">
            {new Set(documents.map((d) => d.category)).size}
          </p>
        </SurfaceCard>
      </div>

      {/* Upload button - outside card, right aligned */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end sm:gap-3">
        <button className="btn-primary whitespace-nowrap" onClick={openUploadModal} type="button">
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Filters + View toggle */}
      <SurfaceCard>
        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field md:col-span-2">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Document name, project or category..."
                value={search}
              />
            </div>
          </label>
          <label className="form-field">
            <span>Project</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => setProjectFilter(e.target.value)}
              value={projectFilter}
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={`doc-proj-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Category</span>
            <GuiSelect
              className="input-field"
              onChange={(e) => setCategoryFilter(e.target.value)}
              value={categoryFilter}
            >
              <option value="All">All Categories</option>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={`doc-cat-${cat}`} value={cat}>{cat}</option>
              ))}
            </GuiSelect>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className={viewMode === "folder" ? "btn-primary py-1.5 text-xs" : "btn-secondary py-1.5 text-xs"}
            onClick={() => setViewMode("folder")}
            type="button"
          >
            Folder View
          </button>
          <button
            className={viewMode === "table" ? "btn-primary py-1.5 text-xs" : "btn-secondary py-1.5 text-xs"}
            onClick={() => setViewMode("table")}
            type="button"
          >
            Table View
          </button>
        </div>
      </SurfaceCard>

      {/* Folder View */}
      {viewMode === "folder" && (
        loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 h-40" key={i} />
            ))}
          </div>
        ) : folderGroups.length === 0 ? (
          <EmptyState
            description="No documents uploaded yet. Click Upload Document to add the first file."
            title="No documents"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {folderGroups.map((group) => {
              const catCounts = group.docs.reduce<Record<string, number>>((acc, doc) => {
                acc[doc.category] = (acc[doc.category] ?? 0) + 1;
                return acc;
              }, {});
              const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
              return (
                <SurfaceCard key={group.key} title={group.projectName}>
                  <p className="text-xs text-slate-500 mb-3">{group.docs.length} document{group.docs.length !== 1 ? "s" : ""}</p>
                  <div className="space-y-1.5 text-sm text-slate-700">
                    {topCats.map(([cat, count]) => (
                      <p className="flex items-center justify-between" key={cat}>
                        <span className="text-xs text-slate-600">{cat}</span>
                        <span className="text-xs font-semibold">{count}</span>
                      </p>
                    ))}
                  </div>
                  <button
                    className="btn-secondary mt-4 w-full justify-center text-xs"
                    onClick={() => {
                      setProjectFilter(group.key === "general" ? "All" : group.key);
                      setViewMode("table");
                    }}
                    type="button"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Folder
                  </button>
                </SurfaceCard>
              );
            })}
          </div>
        )
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <SurfaceCard title="Document Table">
          {loading ? (
            <SkeletonTable rows={5} />
          ) : filteredDocuments.length === 0 ? (
            <EmptyState
              description="No documents match the current filters."
              title="No documents found"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>S/N</th>
                      <th>Document Name</th>
                      <th>Project</th>
                      <th>Category</th>
                      <th>Uploaded By</th>
                      <th>Upload Date</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docPagination.paginatedRows.map((doc, index) => (
                      <tr key={doc.id}>
                        <td>{docPagination.startIndex + index + 1}</td>
                        <td>
                          <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                            <FileText className="h-4 w-4 text-[#0b2a53] shrink-0" />
                            {doc.documentName}
                          </span>
                        </td>
                        <td>{doc.projectName}</td>
                        <td>{doc.category}</td>
                        <td>{doc.uploadedBy}</td>
                        <td>{formatDate(doc.createdAt)}</td>
                        <td className="text-xs text-slate-500">{doc.notes || "-"}</td>
                        <td>
                          <button
                            className="btn-danger py-1 px-3 text-xs"
                            onClick={() => setDocToDelete(doc)}
                            type="button"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                endIndex={docPagination.endIndex}
                itemLabel="documents"
                onPageChange={docPagination.setPage}
                onPageSizeChange={docPagination.setPageSize}
                page={docPagination.page}
                pageSize={docPagination.pageSize}
                startIndex={docPagination.startIndex}
                totalCount={docPagination.totalCount}
                totalPages={docPagination.totalPages}
              />
            </>
          )}
        </SurfaceCard>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <SurfaceCard className="w-full max-w-xl max-h-[90vh] overflow-y-auto" title="Upload Document">
            <p className="mb-4 text-sm text-slate-500">
              Select project, category and fill document details.
            </p>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="form-field">
                <span>Project (Optional)</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  value={uploadProjectId}
                >
                  <option value="">General / No Project</option>
                  {projects.map((p) => (
                    <option key={`upload-${p.id}`} value={p.id}>{p.name}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Document Category</span>
                <GuiSelect
                  className="input-field"
                  onChange={(e) => setUploadCategory(e.target.value)}
                  value={uploadCategory}
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={`upload-cat-${cat}`} value={cat}>{cat}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Document Name</span>
                <input
                  className="input-field"
                  onChange={(e) => setUploadDocumentName(e.target.value)}
                  placeholder="e.g. Dodoma Contract Signed.pdf"
                  value={uploadDocumentName}
                />
              </label>
              <label className="form-field">
                <span>Uploaded By</span>
                <input
                  className="input-field"
                  onChange={(e) => setUploadedBy(e.target.value)}
                  placeholder="Name or role"
                  value={uploadedBy}
                />
              </label>
              <label className="form-field">
                <span>File (Reference only)</span>
                <input
                  className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-[#0b2a53] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  type="file"
                />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea
                  className="input-field min-h-20"
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Additional notes..."
                  value={uploadNotes}
                />
              </label>
              {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void handleUpload()}
                  type="button"
                >
                  {saving ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        description={docToDelete ? `Delete "${docToDelete.documentName}"? This cannot be undone.` : ""}
        onCancel={() => setDocToDelete(null)}
        onConfirm={() => void handleDelete()}
        open={docToDelete !== null}
        title="Delete Document?"
        confirmLabel={deleting ? "Deleting..." : "Delete"}
      />

      <SuccessToast
        message={toastMessage}
        onClose={() => setShowToast(false)}
        open={showToast}
        title="Success"
      />
    </div>
  );
};
