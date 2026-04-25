import { FolderOpen, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ConfirmModal, SectionTitle, SuccessToast, SurfaceCard, TablePagination, GuiSelect } from "../components/ui";
import { documentCategories, documents, projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { useTablePagination } from "../hooks/useTablePagination";
import { formatDate } from "../utils/format";

export const DocumentsPage = () => {
  const { markSaved } = useUnsavedChanges();
  const location = useLocation();
  const [viewMode, setViewMode] = useState<"folder" | "table">("folder");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [selectedDocumentName, setSelectedDocumentName] = useState("Document");
  const documentsPagination = useTablePagination(documents);

  useEffect(() => {
    if (location.hash !== "#upload-document") {
      return;
    }
    setViewMode("table");
    setShowUploadModal(true);
  }, [location.hash]);

  return (
    <div className="space-y-6">
      <SectionTitle
        action={
          <button className="btn-primary" onClick={() => setShowUploadModal(true)} type="button">
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        }
        subtitle="Store and manage contracts, BOQ files, receipts, delivery notes and drawings."
        title="Document Storage"
      />

      <SurfaceCard>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="form-field md:col-span-2">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input-field pl-9" placeholder="Document name, project or category..." />
            </div>
          </label>
          <label className="form-field">
            <span>Project</span>
            <GuiSelect className="input-field">
              <option>All Projects</option>
              {projects.map((project) => (
                <option key={`doc-project-${project.id}`}>{project.name}</option>
              ))}
            </GuiSelect>
          </label>
          <label className="form-field">
            <span>Document Type</span>
            <GuiSelect className="input-field">
              <option>All Categories</option>
              {documentCategories.map((category) => (
                <option key={`doc-cat-${category}`}>{category}</option>
              ))}
            </GuiSelect>
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className={viewMode === "folder" ? "btn-primary !py-2 text-xs" : "btn-secondary !py-2 text-xs"}
            onClick={() => setViewMode("folder")}
            type="button"
          >
            Folder/Card View
          </button>
          <button
            className={viewMode === "table" ? "btn-primary !py-2 text-xs" : "btn-secondary !py-2 text-xs"}
            onClick={() => setViewMode("table")}
            type="button"
          >
            Table View
          </button>
        </div>
      </SurfaceCard>

      {viewMode === "folder" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {projects.map((project) => (
            <SurfaceCard key={`folder-${project.id}`} title={project.name}>
              <p className="text-xs text-slate-500">Site: {project.site}</p>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p className="flex items-center justify-between">
                  <span>Contracts</span>
                  <span>2</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Receipts</span>
                  <span>14</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Drawings</span>
                  <span>6</span>
                </p>
              </div>
              <button className="btn-secondary mt-4 w-full justify-center text-xs" type="button">
                <FolderOpen className="h-4 w-4" />
                Open Folder
              </button>
            </SurfaceCard>
          ))}
        </div>
      ) : (
        <SurfaceCard title="Document Table">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Document Name</th>
                  <th>Project</th>
                  <th>Category</th>
                  <th>Uploaded By</th>
                  <th>Upload Date</th>
                  <th>File Type</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documentsPagination.paginatedRows.map((doc, index) => (
                  <tr key={doc.id}>
                    <td>{documentsPagination.startIndex + index + 1}</td>
                    <td>{doc.name}</td>
                    <td>{doc.project}</td>
                    <td>{doc.category}</td>
                    <td>{doc.uploadedBy}</td>
                    <td>{formatDate(doc.uploadDate)}</td>
                    <td>{doc.fileType}</td>
                    <td>{doc.size}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-secondary !px-2 !py-1 text-xs">View</button>
                        <button className="btn-secondary !px-2 !py-1 text-xs">Download</button>
                        <button className="btn-secondary !px-2 !py-1 text-xs">Replace</button>
                        <button
                          className="btn-danger !px-2 !py-1 text-xs"
                          onClick={() => {
                            setSelectedDocumentName(doc.name);
                            setShowDeleteModal(true);
                          }}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            endIndex={documentsPagination.endIndex}
            itemLabel="documents"
            onPageChange={documentsPagination.setPage}
            onPageSizeChange={documentsPagination.setPageSize}
            page={documentsPagination.page}
            pageSize={documentsPagination.pageSize}
            startIndex={documentsPagination.startIndex}
            totalCount={documentsPagination.totalCount}
            totalPages={documentsPagination.totalPages}
          />
        </SurfaceCard>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Upload Document</h3>
            <p className="mt-1 text-sm text-slate-500">
              Select project, category and upload project reference file.
            </p>
            <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" id="upload-document-form">
              <label className="form-field">
                <span>Select Project</span>
                <GuiSelect className="input-field">
                  {projects.map((project) => (
                    <option key={`upload-${project.id}`}>{project.name}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field">
                <span>Document Category</span>
                <GuiSelect className="input-field">
                  {documentCategories.map((category) => (
                    <option key={`upload-cat-${category}`}>{category}</option>
                  ))}
                </GuiSelect>
              </label>
              <label className="form-field sm:col-span-2">
                <span>Document Name</span>
                <input className="input-field" placeholder="Name shown in document table" />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Upload File</span>
                <input
                  className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-[#0b2a53] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
                  type="file"
                />
              </label>
              <label className="form-field sm:col-span-2">
                <span>Notes</span>
                <textarea className="input-field min-h-20" />
              </label>
            </form>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)} type="button">
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  markSaved();
                  setShowUploadModal(false);
                  setShowToast(true);
                  window.setTimeout(() => setShowToast(false), 2200);
                }}
                type="button"
              >
                Upload Document
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        description={`This action will permanently delete "${selectedDocumentName}".`}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={() => {
          setShowDeleteModal(false);
          setShowToast(true);
          window.setTimeout(() => setShowToast(false), 2200);
        }}
        open={showDeleteModal}
        title="Delete Document?"
      />

      <SuccessToast
        message="Your document action has been completed successfully."
        onClose={() => setShowToast(false)}
        open={showToast}
        title="Success"
      />
    </div>
  );
};


