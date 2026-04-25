import { Camera, ClipboardPlus, FileUp, PackagePlus, Receipt, Smartphone } from "lucide-react";
import { type FormEvent } from "react";
import { SectionTitle, StatusBadge, SurfaceCard, GuiSelect } from "../components/ui";
import { projects } from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { formatTzs } from "../utils/format";

const assignedProjects = [projects[0], projects[1], projects[3]];

export const MobileSupervisorPage = () => {
  const { markSaved } = useUnsavedChanges();

  const handleQuickSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    markSaved();
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        subtitle="Responsive field-focused UI for site supervisors using mobile phones."
        title="Mobile Responsive Site Supervisor View"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SurfaceCard title="1. Mobile Dashboard">
          <div className="phone-frame">
            <p className="text-xs text-slate-500">Today at Site</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Assigned Sites</p>
                <p className="text-sm font-bold text-slate-900">3</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[11px] text-slate-500">Pending Tasks</p>
                <p className="text-sm font-bold text-amber-700">5</p>
              </div>
            </div>
            <button className="btn-primary mt-3 w-full justify-center text-xs">View Site Summary</button>
          </div>
        </SurfaceCard>

        <SurfaceCard title="2. My Assigned Projects">
          <div className="phone-frame">
            <div className="space-y-2">
              {assignedProjects.map((project) => (
                <div className="rounded-lg border border-slate-200 px-2 py-2" key={`mobile-${project.id}`}>
                  <p className="text-xs font-semibold text-slate-900">{project.name}</p>
                  <p className="text-[11px] text-slate-500">{project.site}</p>
                  <div className="mt-1">
                    <StatusBadge status={project.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

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
            </GuiSelect>
            <button className="btn-accent mt-3 w-full justify-center text-xs" type="submit">
              Save
            </button>
          </form>
        </SurfaceCard>

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
            <button className="btn-primary mt-2 w-full justify-center text-xs">Attach File</button>
          </div>
        </SurfaceCard>

        <SurfaceCard title="6. View Project Summary">
          <div className="phone-frame">
            <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
              <p>Contract: {formatTzs(120_000_000)}</p>
              <p>Spent: {formatTzs(48_500_000)}</p>
              <p className="text-emerald-700">Balance: {formatTzs(71_500_000)}</p>
            </div>
            <button className="btn-secondary mt-3 w-full justify-center text-xs" type="button">
              <ClipboardPlus className="h-4 w-4" />
              Add Daily Note
            </button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Mobile UX Notes">
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Large buttons for fast field actions.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Minimal typing with dropdowns and defaults.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Quick upload flow using camera.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Bottom navigation for one-thumb access.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Clear status badges and priority highlights.
          </li>
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Works on low-connectivity field conditions.
          </li>
        </ul>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          <Smartphone className="h-4 w-4 text-[#0b2a53]" />
          Mobile-first forms are optimized for site supervisors and store keepers.
        </p>
      </SurfaceCard>
    </div>
  );
};


