import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute, hasAnyPermission, type AppPermission, useAuth } from "./auth";
import { useCompanySettings } from "./company/CompanySettingsContext";
import { ActiveProjectProvider } from "./project/ActiveProjectContext";
import { GlobalLoader } from "./components/GlobalLoader";
import { TopToastHost } from "./components/TopToastHost";
import { UnsavedChangesProvider } from "./guards/UnsavedChangesGuard";
import { AboutPage } from "./landing/AboutPage";
import { ContactPage } from "./landing/ContactPage";
import { GalleryPage } from "./landing/GalleryPage";
import { HomePage } from "./landing/HomePage";
import { LandingLayout } from "./landing/LandingLayout";
import { ServicesPage } from "./landing/ServicesPage";
import { WebsiteSettingsProvider } from "./landing/WebsiteSettingsContext";
import { AppShell } from "./layout/AppShell";
import { ActivityLogPage } from "./pages/ActivityLogPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeletedItemsPage } from "./pages/DeletedItemsPage";
import { ForgotPasswordOtpPage } from "./pages/ForgotPasswordOtpPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectFormPage } from "./pages/ProjectFormPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SiteOperationsPage } from "./pages/SiteOperationsPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { UsersRolesPage } from "./pages/UsersRolesPage";

const THEME_STORAGE_KEY = "engpm:theme";

const readInitialDarkMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark") {
      return true;
    }
    if (storedTheme === "light") {
      return false;
    }
  } catch {
    // Fall back to system preference.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
};

const LegacyOperationsRedirect = ({ tab }: { tab: string }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", tab);
  return <Navigate replace to={`/site-operations?${params.toString()}`} />;
};

const PublicThemeEnforcer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }, []);

  return <>{children}</>;
};

const siteOperationPermissions = [
  "site.labor",
  "site.materials",
  "site.expenses",
  "site.equipment",
  "site.pettyCash",
] as const satisfies readonly AppPermission[];

const PermissionOnly = ({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions: readonly AppPermission[];
}) => {
  const { user } = useAuth();

  if (!hasAnyPermission(user?.role, permissions)) {
    return <Navigate replace to="/dashboard" />;
  }

  return <>{children}</>;
};

const ProtectedAppLayout = () => {
  const { user, logout } = useAuth();
  const { company } = useCompanySettings();
  const [darkMode, setDarkMode] = useState(readInitialDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    root.style.colorScheme = darkMode ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
    } catch {
      // Ignore storage write errors.
    }
  }, [darkMode]);

  return (
    <ActiveProjectProvider>
      <AppShell
        company={company}
        darkMode={darkMode}
        onLogout={logout}
        onToggleDarkMode={() => setDarkMode((current) => !current)}
        user={user}
      />
    </ActiveProjectProvider>
  );
};

function App() {
  const { isAuthenticated, loading } = useAuth();

  // While checking stored token, show nothing to avoid flash of wrong page
  if (loading) {
    return <GlobalLoader />;
  }

  return (
    <>
      <GlobalLoader />
      <TopToastHost />
      <ScrollToTop />
      <Routes>
        {/* ── Public landing routes ── */}
        <Route
          element={
            <PublicThemeEnforcer>
              <WebsiteSettingsProvider>
                <LandingLayout />
              </WebsiteSettingsProvider>
            </PublicThemeEnforcer>
          }
        >
          <Route element={<HomePage />} path="/" />
          <Route element={<ServicesPage />} path="/services" />
          <Route element={<AboutPage />} path="/about" />
          <Route element={<GalleryPage />} path="/gallery" />
          <Route element={<ContactPage />} path="/contact" />
        </Route>

        {/* ── Auth routes ── */}
        <Route
          element={
            isAuthenticated ? (
              <Navigate replace to="/dashboard" />
            ) : (
              <PublicThemeEnforcer>
                <LoginPage />
              </PublicThemeEnforcer>
            )
          }
          path="/login"
        />
        <Route
          element={
            isAuthenticated ? (
              <Navigate replace to="/dashboard" />
            ) : (
              <PublicThemeEnforcer>
                <ForgotPasswordPage />
              </PublicThemeEnforcer>
            )
          }
          path="/forgot-password"
        />
        <Route
          element={
            isAuthenticated ? (
              <Navigate replace to="/dashboard" />
            ) : (
              <PublicThemeEnforcer>
                <ForgotPasswordOtpPage />
              </PublicThemeEnforcer>
            )
          }
          path="/forgot-password/verify"
        />
        <Route
          element={
            isAuthenticated ? (
              <Navigate replace to="/dashboard" />
            ) : (
              <PublicThemeEnforcer>
                <ResetPasswordPage />
              </PublicThemeEnforcer>
            )
          }
          path="/forgot-password/reset"
        />

        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <UnsavedChangesProvider>
                <ProtectedAppLayout />
              </UnsavedChangesProvider>
            }
          >
            <Route
              element={
                <PermissionOnly permissions={["dashboard.view"]}>
                  <DashboardPage />
                </PermissionOnly>
              }
              path="/dashboard"
            />
            <Route
              element={
                <PermissionOnly permissions={["projects.view"]}>
                  <ProjectsPage />
                </PermissionOnly>
              }
              path="/projects"
            />
            <Route
              element={
                <PermissionOnly permissions={["projects.manage"]}>
                  <ProjectFormPage />
                </PermissionOnly>
              }
              path="/projects/new"
            />
            <Route
              element={
                <PermissionOnly permissions={["projects.view"]}>
                  <ProjectDetailPage />
                </PermissionOnly>
              }
              path="/projects/:projectId"
            />
            <Route
              element={
                <PermissionOnly permissions={["projects.manage"]}>
                  <ProjectFormPage />
                </PermissionOnly>
              }
              path="/projects/:projectId/edit"
            />
            <Route element={<Navigate replace to="/projects" />} path="/tenders" />
            <Route
              element={
                <PermissionOnly permissions={siteOperationPermissions}>
                  <SiteOperationsPage />
                </PermissionOnly>
              }
              path="/site-operations"
            />
            <Route
              element={
                <PermissionOnly permissions={["site.labor"]}>
                  <LegacyOperationsRedirect tab="labor" />
                </PermissionOnly>
              }
              path="/labor"
            />
            <Route
              element={
                <PermissionOnly permissions={["site.materials"]}>
                  <LegacyOperationsRedirect tab="materials" />
                </PermissionOnly>
              }
              path="/materials"
            />
            <Route
              element={
                <PermissionOnly permissions={["site.expenses"]}>
                  <LegacyOperationsRedirect tab="expenses" />
                </PermissionOnly>
              }
              path="/expenses"
            />
            <Route
              element={
                <PermissionOnly permissions={["payments.view"]}>
                  <PaymentsPage />
                </PermissionOnly>
              }
              path="/payments"
            />
            <Route
              element={
                <PermissionOnly permissions={["payments.view"]}>
                  <InvoicesPage />
                </PermissionOnly>
              }
              path="/invoices"
            />
            <Route element={<Navigate replace to="/projects" />} path="/documents" />
            <Route
              element={
                <PermissionOnly permissions={["reports.view"]}>
                  <ReportsPage />
                </PermissionOnly>
              }
              path="/reports"
            />
            <Route
              element={
                <PermissionOnly permissions={["suppliers.view"]}>
                  <SuppliersPage />
                </PermissionOnly>
              }
              path="/suppliers"
            />
            <Route
              element={
                <PermissionOnly permissions={["site.equipment"]}>
                  <LegacyOperationsRedirect tab="equipment" />
                </PermissionOnly>
              }
              path="/equipment"
            />
            <Route
              element={
                <PermissionOnly permissions={["site.pettyCash"]}>
                  <LegacyOperationsRedirect tab="petty-cash" />
                </PermissionOnly>
              }
              path="/petty-cash"
            />
            <Route
              element={
                <PermissionOnly permissions={["users.manage"]}>
                  <UsersRolesPage />
                </PermissionOnly>
              }
              path="/users"
            />
            <Route
              element={
                <PermissionOnly permissions={["settings.manage"]}>
                  <SettingsPage />
                </PermissionOnly>
              }
              path="/settings"
            />
            <Route
              element={
                <PermissionOnly permissions={["notifications.view"]}>
                  <NotificationsPage />
                </PermissionOnly>
              }
              path="/notifications"
            />
            <Route
              element={
                <PermissionOnly permissions={["audit.view"]}>
                  <ActivityLogPage />
                </PermissionOnly>
              }
              path="/activity-log"
            />
            <Route
              element={
                <PermissionOnly permissions={["deleted.restore"]}>
                  <DeletedItemsPage />
                </PermissionOnly>
              }
              path="/deleted-items"
            />
          </Route>
        </Route>

        <Route
          element={<Navigate replace to={isAuthenticated ? "/dashboard" : "/"} />}
          path="*"
        />
      </Routes>
    </>
  );
}

export default App;
