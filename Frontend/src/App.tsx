import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, useAuth } from "./auth";
import { useCompanySettings } from "./company/CompanySettingsContext";
import { GlobalLoader } from "./components/GlobalLoader";
import { UnsavedChangesProvider } from "./guards/UnsavedChangesGuard";
import { AboutPage } from "./landing/AboutPage";
import { ContactPage } from "./landing/ContactPage";
import { GalleryPage } from "./landing/GalleryPage";
import { HomePage } from "./landing/HomePage";
import { LandingLayout } from "./landing/LandingLayout";
import { ServicesPage } from "./landing/ServicesPage";
import { WebsiteSettingsProvider } from "./landing/WebsiteSettingsContext";
import { AppShell } from "./layout/AppShell";

import {
  ActivityLogPage,
  DashboardPage,
  DocumentsPage,
  EquipmentPage,
  ExpensesPage,
  ForgotPasswordOtpPage,
  ForgotPasswordPage,
  LaborPage,
  LoginPage,
  MaterialsPage,
  MobileSupervisorPage,
  NotificationsPage,
  PaymentsPage,
  PettyCashPage,
  ProjectDetailPage,
  ProjectFormPage,
  ProjectsPage,
  ReportsPage,
  ResetPasswordPage,
  SettingsPage,
  SuppliersPage,
  UsersRolesPage,
  WorkOrdersPage,
} from "./pages";

const ProtectedAppLayout = () => {
  const { user, logout } = useAuth();
  const { company } = useCompanySettings();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    return () => {
      root.classList.remove("dark");
    };
  }, [darkMode]);

  return (
    <AppShell
      company={company}
      darkMode={darkMode}
      onLogout={logout}
      onToggleDarkMode={() => setDarkMode((current) => !current)}
      user={user}
    />
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
      <Routes>
        {/* ── Public landing routes ── */}
        <Route element={<WebsiteSettingsProvider><LandingLayout /></WebsiteSettingsProvider>}>
          <Route element={<HomePage />} path="/" />
          <Route element={<ServicesPage />} path="/services" />
          <Route element={<AboutPage />} path="/about" />
          <Route element={<GalleryPage />} path="/gallery" />
          <Route element={<ContactPage />} path="/contact" />
        </Route>

        {/* ── Auth routes ── */}
        <Route
          element={isAuthenticated ? <Navigate replace to="/dashboard" /> : <LoginPage />}
          path="/login"
        />
        <Route
          element={isAuthenticated ? <Navigate replace to="/dashboard" /> : <ForgotPasswordPage />}
          path="/forgot-password"
        />
        <Route
          element={
            isAuthenticated ? <Navigate replace to="/dashboard" /> : <ForgotPasswordOtpPage />
          }
          path="/forgot-password/verify"
        />
        <Route
          element={isAuthenticated ? <Navigate replace to="/dashboard" /> : <ResetPasswordPage />}
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
            <Route element={<DashboardPage />} path="/dashboard" />
            <Route element={<ProjectsPage />} path="/projects" />
            <Route element={<ProjectFormPage />} path="/projects/new" />
            <Route element={<ProjectDetailPage />} path="/projects/:projectId" />
            <Route element={<ProjectFormPage />} path="/projects/:projectId/edit" />
            <Route element={<Navigate replace to="/projects" />} path="/tenders" />
            <Route element={<WorkOrdersPage />} path="/work-orders" />
            <Route element={<LaborPage />} path="/labor" />
            <Route element={<MaterialsPage />} path="/materials" />
            <Route element={<ExpensesPage />} path="/expenses" />
            <Route element={<PaymentsPage />} path="/payments" />
            <Route element={<DocumentsPage />} path="/documents" />
            <Route element={<ReportsPage />} path="/reports" />
            <Route element={<SuppliersPage />} path="/suppliers" />
            <Route element={<EquipmentPage />} path="/equipment" />
            <Route element={<PettyCashPage />} path="/petty-cash" />
            <Route element={<UsersRolesPage />} path="/users" />
            <Route element={<SettingsPage />} path="/settings" />
            <Route element={<NotificationsPage />} path="/notifications" />
            <Route element={<MobileSupervisorPage />} path="/mobile-supervisor" />
            <Route element={<ActivityLogPage />} path="/activity-log" />
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
