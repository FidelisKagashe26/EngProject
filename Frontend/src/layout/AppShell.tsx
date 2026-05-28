import { GuiSelect } from "../components/ui";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { hasAnyPermission } from "../auth";
import { UnsavedChangesRouteGuard } from "../guards/UnsavedChangesGuard";
import { api, type AuthUser, type CompanyProfile, type ProjectApiRecord } from "../services/api";
import { mainNavItems, quickAddActions, utilityNavItems } from "./navigation";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects / Sites",
  "/projects/new": "Add / Edit Project",
  "/site-operations": "Site Operations",
  "/tenders": "Contracts Governance",
  "/labor": "Labor / Workforce",
  "/materials": "Materials",
  "/expenses": "Expenses",
  "/payments": "Payments & Cash Flow",
  "/reports": "Reports",
  "/suppliers": "Suppliers",
  "/equipment": "Equipment",
  "/petty-cash": "Petty Cash",
  "/users": "Users & Roles",
  "/settings": "Settings",
  "/notifications": "Notifications / Alerts",
  "/activity-log": "Activity Log / Audit Trail",
};

export const AppShell = ({
  company,
  darkMode,
  onToggleDarkMode,
  onLogout,
  user,
}: {
  company: CompanyProfile | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => Promise<void>;
  user: AuthUser | null;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [projectJump, setProjectJump] = useState("");
  const companyLogoAlt =
    company?.name.trim().length ? `${company.name.trim()} logo` : "Company logo";
  const visibleMainNavItems = useMemo(
    () =>
      mainNavItems.filter(
        (item) => !item.permissions || hasAnyPermission(user?.role, item.permissions),
      ),
    [user?.role],
  );
  const visibleUtilityNavItems = useMemo(
    () =>
      utilityNavItems.filter(
        (item) => !item.permissions || hasAnyPermission(user?.role, item.permissions),
      ),
    [user?.role],
  );
  const visibleQuickAddActions = useMemo(
    () =>
      quickAddActions.filter((action) =>
        hasAnyPermission(user?.role, action.permissions),
      ),
    [user?.role],
  );
  const canViewNotifications = hasAnyPermission(user?.role, ["notifications.view"]);

  const breadcrumbTitle = useMemo(() => {
    if (location.pathname.startsWith("/projects/") && location.pathname.endsWith("/edit")) {
      return "Add / Edit Project";
    }
    if (
      location.pathname.startsWith("/projects/") &&
      location.pathname !== "/projects" &&
      !location.pathname.endsWith("/edit")
    ) {
      return "Project Detail";
    }
    return routeTitles[location.pathname] ?? "Dashboard";
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const loadProjects = async () => {
      try {
        const rows = await api.getProjects();
        if (!mounted) {
          return;
        }
        setProjects(rows);
      } catch {
        if (!mounted) {
          return;
        }
        setProjects([]);
      }
    };

    void loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const handleProjectJumpChange = (projectId: string) => {
    setProjectJump(projectId);
    if (projectId.length > 0) {
      navigate(`/projects/${encodeURIComponent(projectId)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <UnsavedChangesRouteGuard />
      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link className="mb-8 flex items-center justify-center" to="/dashboard">
          <img alt={companyLogoAlt} className="h-20 w-auto object-contain" src="/EngLogo.png" />
        </Link>

        <nav className="space-y-1">
          {visibleMainNavItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
              key={item.path}
              to={item.path}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {visibleUtilityNavItems.length > 0 ? (
          <>
            <p className="mb-2 mt-7 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Utility
            </p>
            <nav className="space-y-1">
              {visibleUtilityNavItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                  }
                  key={item.path}
                  to={item.path}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </>
        ) : null}
      </aside>

      <header className="app-header sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur lg:ml-72">
        <div className="flex items-center justify-between gap-2 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="rounded-lg border border-slate-200 p-2 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <Menu className="h-4 w-4 text-slate-700" />
            </button>
            {/* Mobile logo — visible only on mobile */}
            <Link className="flex items-center lg:hidden" to="/dashboard">
              <img alt={companyLogoAlt} className="h-10 w-auto object-contain" src="/EngLogo.png" />
            </Link>
            <div className="relative hidden lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-[#f28c28] focus:outline-none"
                placeholder="Search projects, workers, documents..."
                type="search"
              />
            </div>
            <GuiSelect
              className="hidden w-auto! py-2! text-sm lg:flex"
              fullWidth={false}
              onChange={(event) => handleProjectJumpChange(event.target.value)}
              value={projectJump}
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </GuiSelect>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              onClick={onToggleDarkMode}
              title={darkMode ? "Switch to light mode" : "Preview dark mode"}
              type="button"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {canViewNotifications ? (
              <Link className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" to="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
            ) : null}

            {visibleQuickAddActions.length > 0 ? (
            <div className="relative">
              <button
                className="btn-primary hidden px-3! py-2! text-sm lg:inline-flex"
                onClick={() => setShowQuickAdd((current) => !current)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add New
                <ChevronDown className="h-4 w-4" />
              </button>
              {showQuickAdd && (
                <div className="absolute right-0 mt-2 hidden w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl lg:block">
                  {visibleQuickAddActions.map((action) => (
                    <Link
                      className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      key={action.label}
                      onClick={() => setShowQuickAdd(false)}
                      to={action.path}
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            ) : null}

            <div className="ml-1 hidden items-center gap-2 rounded-xl border border-slate-200 px-2 py-1 lg:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#0b2a53] text-xs font-semibold text-white">
                {(user?.fullName ?? "User")
                  .split(" ")
                  .map((part) => part[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{user?.fullName ?? "User"}</p>
                <p className="text-[11px] text-slate-500">{user?.role ?? "Role"}</p>
              </div>
              <button
                className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                onClick={() => void onLogout()}
                title="Logout"
                type="button"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="lg:hidden">
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                onClick={() => void onLogout()}
                title="Logout"
                type="button"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 pt-5 sm:px-6 lg:ml-72">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Link className="hover:text-[#0b2a53]" to="/dashboard">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-700">{breadcrumbTitle}</span>
        </div>
        <Outlet />
      </main>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/50 lg:hidden">
          <div className="app-mobile-sidebar h-full w-80 max-w-[90%] overflow-y-auto bg-white p-4">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Navigation</p>
              <button className="rounded-lg border border-slate-200 p-1.5" onClick={() => setMobileMenuOpen(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick Access</p>
              <GuiSelect
                className="w-full! py-2! text-sm"
                fullWidth
                onChange={(event) => {
                  handleProjectJumpChange(event.target.value);
                  setMobileMenuOpen(false);
                }}
                value={projectJump}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </GuiSelect>
              {visibleQuickAddActions.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Add New</p>
                  {visibleQuickAddActions.map((action) => (
                    <Link
                      className="sidebar-link"
                      key={`mobile-add-${action.label}`}
                      onClick={() => setMobileMenuOpen(false)}
                      to={action.path}
                    >
                      <Plus className="h-4 w-4" />
                      <span>{action.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              {visibleMainNavItems.concat(visibleUtilityNavItems).map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                  }
                  key={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  to={item.path}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
