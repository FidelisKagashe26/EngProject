import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, useAuth } from "./auth";
import { GlobalLoader } from "./components/GlobalLoader";
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
  TendersPage,
  UsersRolesPage,
} from "./pages";

const ProtectedAppLayout = () => {
  const { user, logout } = useAuth();
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
      darkMode={darkMode}
      onLogout={logout}
      onToggleDarkMode={() => setDarkMode((current) => !current)}
      user={user}
    />
  );
};

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <GlobalLoader />
      <Routes>
        <Route
          element={isAuthenticated ? <Navigate replace to="/dashboard" /> : <LoginPage />}
          path="/"
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
          <Route element={<ProtectedAppLayout />}>
            <Route element={<DashboardPage />} path="/dashboard" />
            <Route element={<ProjectsPage />} path="/projects" />
            <Route element={<ProjectFormPage />} path="/projects/new" />
            <Route element={<ProjectDetailPage />} path="/projects/:projectId" />
            <Route element={<ProjectFormPage />} path="/projects/:projectId/edit" />
            <Route element={<TendersPage />} path="/tenders" />
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
