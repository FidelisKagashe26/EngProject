import { Camera, ClipboardPlus, FileUp, PackagePlus, Receipt, Smartphone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { SectionTitle, SurfaceCard, GuiSelect } from "../components/ui";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { api, type ProjectApiRecord } from "../services/api";
import { formatTzs } from "../utils/format";

export const MobileSupervisorPage = () => {
  const { markSaved } = useUnsavedChanges();
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getProjects().then((rows) => {
      if (!mounted) return;
      setProjects(rows);
      if (rows.length > 0) setSelectedProjectId(rows[0].id);
    }).catch(() => {/* silent */});
    return () => { mounted = false; };
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const handleQuickSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    markSaved();
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Responsive field-focused UI for site supervisors using mobile phones."
        title="Mobile Supervisor View"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 1. Mobile Dashboard */}
        <SurfaceCard title="1. Mobile Dashboard">
          <div className="phone-frame">
            <p className="text-xs text-slate-500">Today at Site</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Assigned Sites</p>
                <p className="text-sm font-bold text-slate-900">{projects.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Active Sites</p>
                <p className="text-sm font-bold text-amber-700">
                  {projects.filter((p) => p.status === "Active").length}
                </p>
              </div>
            </div>
            <button className="btn-primary mt-3 w-full justify-center text-xs">View Site Summary</button>
          </div>
        </SurfaceCard>

        {/* 2. My Assigned Projects */}
        <SurfaceCard title="2. My Assigned Projects">
          <div className="phone-frame">
            <div className="space-y-2">
              {projects.slice(0, 3).map((project) => (
                <div className="rounded-lg border border-slate-200 px-2 py-2" key={`mobile-${project.id}`}>
                  <p className="text-xs font-semibold text-slate-900">{project.name}</p>
                  <p className="text-[11px] text-slate-500">{project.siteLocation}</p>
                  <p className={`mt-1 text-xs font-medium ${
                    project.status === "Active" ? "text-emerald-700"
                    : project.status === "On Hold" ? "text-amber-700"
                    : "text-slate-500"
                  }`}>
                    {project.status}
                  </p>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-xs text-slate-500">No projects assigned.</p>
              )}
            </div>
          </div>
        </SurfaceCard>

        {/* 3. Add Site Expense */}
        <SurfaceCard title="3. Add Site Expense">
          <form className="phone-frame" onSubmit={handleQuickSave}>
            <button className="mobile-quick-btn" type="button">
              <Receipt className="h-4 w-4" />
              Add Expense
            </button>
            <input className="input-field mt-2 text-xs" placeholder="Amount (TZS)" />
            <GuiSelect className="input-field mt-2 text-xs">
              <option>Fuel</option>
              <option>Transport</option>
              <option>Food Allowance</option>
              <option>Machine Rental</option>
              <option>Miscellaneous</option>
            </GuiSelect>
            <button className="btn-accent mt-3 w-full justify-center text-xs" type="submit">
              Save
            </button>
          </form>
        </SurfaceCard>

        {/* 4. Add Material Delivery Update */}
        <SurfaceCard title="4. Add Material Delivery Update">
          <form className="phone-frame" onSubmit={handleQuickSave}>
            <button className="mobile-quick-btn" type="button">
              <PackagePlus className="h-4 w-4" />
              Delivery Update
            </button>
            <input className="input-field mt-2 text-xs" placeholder="Material name" />
            <input className="input-field mt-2 text-xs" placeholder="Quantity delivered" />
            <button className="btn-primary mt-3 w-full justify-center text-xs" type="submit">
              Submit
            </button>
          </form>
        </SurfaceCard>

        {/* 5. Upload Receipt / Document */}
        <SurfaceCard title="5. Upload Receipt / Document">
          <div className="phone-frame">
            <button className="mobile-quick-btn" type="button">
              <FileUp className="h-4 w-4" />
              Upload Document
            </button>
            <button className="btn-secondary mt-2 w-full justify-center text-xs" type="button">
              <Camera className="h-4 w-4" />
              Capture from Camera
            </button>
            <button className="btn-primary mt-2 w-full justify-center text-xs" type="button">
              Attach File
            </button>
          </div>
        </SurfaceCard>

        {/* 6. View Project Summary */}
        <SurfaceCard title="6. View Project Summary">
          <div className="phone-frame">
            {selectedProject ? (
              <>
                <div className="mb-2">
                  <GuiSelect
                    className="input-field text-xs"
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    value={selectedProjectId}
                  >
                    {projects.map((p) => (
                      <option key={`sum-${p.id}`} value={p.id}>{p.name}</option>
                    ))}
                  </GuiSelect>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700 space-y-1">
                  <p>Contract: {formatTzs(selectedProject.contractValue)}</p>
                  <p>Spent: {formatTzs(selectedProject.totalSpent)}</p>
                  <p className={selectedProject.remainingBalance >= 0 ? "text-emerald-700" : "text-red-700"}>
                    Balance: {formatTzs(selectedProject.remainingBalance)}
                  </p>
                  <p className="text-slate-500">Progress: {selectedProject.progress}%</p>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Loading project data...</p>
            )}
            <button className="btn-secondary mt-3 w-full justify-center text-xs" type="button">
              <ClipboardPlus className="h-4 w-4" />
              Add Daily Note
            </button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Mobile UX Notes">
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Large buttons for fast field actions.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Minimal typing with dropdowns and defaults.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Quick upload flow using camera.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Bottom navigation for one-thumb access.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Clear status badges and priority highlights.</li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Works on low-connectivity field conditions.</li>
        </ul>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          <Smartphone className="h-4 w-4 text-[#0b2a53]" />
          Mobile-first forms are optimized for site supervisors and store keepers.
        </p>
      </SurfaceCard>
    </div>
  );
};
