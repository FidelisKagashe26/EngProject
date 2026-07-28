import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isClosedProjectStatus } from "../constants/options";
import { useActiveProject } from "../project/ActiveProjectContext";

const itemClass = (selected: boolean): string =>
  [
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
    selected
      ? "bg-[#3b82f6]/10 text-[#3b82f6]"
      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5",
  ].join(" ");

/**
 * The single control for the project the user is working inside. Searchable so
 * it scales past a handful of projects, and it drives the shared
 * ActiveProjectContext rather than navigating anywhere — every scoped page
 * reads the choice from there.
 */
export const ProjectSwitcher = ({ className = "" }: { className?: string }) => {
  const { projects, activeProject, activeProjectId, setActiveProjectId } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(q) ||
        project.clientName.toLowerCase().includes(q) ||
        project.siteLocation.toLowerCase().includes(q),
    );
  }, [projects, query]);

  const choose = (id: string) => {
    setActiveProjectId(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={[
          "flex h-10 w-full items-center gap-2 rounded-lg border px-3",
          "text-sm font-semibold transition",
          "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
          "dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10",
        ].join(" ")}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Building2 className="h-4 w-4 shrink-0 text-[#f28c28]" />
        <span className="min-w-0 flex-1 truncate text-left">
          {activeProject?.name ?? "All Projects"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-[95] mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#0b1220]">
          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-[#f28c28] dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects..."
              ref={inputRef}
              type="search"
              value={query}
            />
          </label>

          <div className="max-h-72 overflow-auto">
            <button className={itemClass(activeProjectId === "")} onClick={() => choose("")} type="button">
              <span className="min-w-0 flex-1 truncate text-left">All Projects</span>
              {activeProjectId === "" && <Check className="h-4 w-4 shrink-0 text-[#3b82f6]" />}
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                No projects match your search.
              </p>
            ) : (
              filtered.map((project) => {
                const selected = project.id === activeProjectId;
                const closed = isClosedProjectStatus(project.status);
                return (
                  <button
                    className={itemClass(selected)}
                    key={project.id}
                    onClick={() => choose(project.id)}
                    type="button"
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className={`block truncate ${closed ? "text-slate-400" : ""}`}>
                        {project.name}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {project.clientName}
                        {closed ? " · Closed" : ""}
                      </span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[#3b82f6]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
