import { GuiSelect } from "../components/ui";
import { useMemo, useState } from "react";
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
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { projects } from "../data/mockData";
import { UnsavedChangesRouteGuard } from "../guards/UnsavedChangesGuard";
import type { AuthUser, CompanyProfile } from "../services/api";
import { mainNavItems, quickAddActions, utilityNavItems } from "./navigation";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects / Sites",
  "/projects/new": "Add / Edit Project",
  "/tenders": "Tenders & Contracts",
  "/labor": "Labor / Workforce",
  "/materials": "Materials",
  "/expenses": "Expenses",
  "/payments": "Payments & Cash Flow",
  "/documents": "Documents",
  "/reports": "Reports & Analytics",
  "/suppliers": "Suppliers",
  "/equipment": "Equipment",
  "/petty-cash": "Petty Cash",
  "/users": "Users & Roles",
  "/settings": "Settings",
  "/notifications": "Notifications / Alerts",
  "/mobile-supervisor": "Mobile Supervisor View",
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const companyName =
    company?.name.trim().length ? company.name.trim() : "EngiCost Manager";
  const companySubtitle =
    company?.location.trim().length
      ? company.location.trim()
      : "Engineering Cost Control";
  const companyInitials = companyName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <UnsavedChangesRouteGuard />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link className="mb-8 flex items-center gap-3" to="/dashboard">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0b2a53] text-white">
            <span className="text-lg font-bold">{companyInitials || "EC"}</span>
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{companyName}</p>
            <p className="text-xs text-slate-500">{companySubtitle}</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {mainNavItems.map((item) => (
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

        <p className="mb-2 mt-7 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Utility
        </p>
        <nav className="space-y-1">
          {utilityNavItems.map((item) => (
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
      </aside>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur lg:ml-72">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="rounded-lg border border-slate-200 p-2 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <Menu className="h-4 w-4 text-slate-700" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-[#f28c28] focus:outline-none"
                placeholder="Search projects, workers, documents..."
                type="search"
              />
            </div>
            <GuiSelect className="input-field !w-auto !py-2 text-xs sm:text-sm" fullWidth={false}>
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

            <Link className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" to="/notifications">
              <Bell className="h-4 w-4" />
            </Link>

            <div className="relative">
              <button
                className="btn-primary !px-3 !py-2 text-xs sm:text-sm"
                onClick={() => setShowQuickAdd((current) => !current)}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add New
                <ChevronDown className="h-4 w-4" />
              </button>
              {showQuickAdd && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {quickAddActions.map((action) => (
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

            <div className="ml-1 hidden items-center gap-2 rounded-xl border border-slate-200 px-2 py-1 sm:flex">
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
            <div className="sm:hidden">
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

      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-72 lg:pb-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Link className="hover:text-[#0b2a53]" to="/dashboard">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-slate-700">{breadcrumbTitle}</span>
        </div>
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav lg:hidden">
        <NavLink className="mobile-tab" to="/dashboard">
          Dashboard
        </NavLink>
        <NavLink className="mobile-tab" to="/projects">
          Projects
        </NavLink>
        <button className="mobile-tab mobile-tab-add" onClick={() => setShowQuickAdd((current) => !current)} type="button">
          + Add
        </button>
        <NavLink className="mobile-tab" to="/notifications">
          Alerts
        </NavLink>
        <button className="mobile-tab" onClick={() => setMobileMenuOpen(true)} type="button">
          Menu
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 lg:hidden">
          <div className="h-full w-80 max-w-[90%] overflow-y-auto bg-white p-4">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Navigation</p>
              <button className="rounded-lg border border-slate-200 p-1.5" onClick={() => setMobileMenuOpen(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {mainNavItems.concat(utilityNavItems).map((item) => (
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


