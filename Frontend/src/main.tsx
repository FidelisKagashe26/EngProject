import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import App from "./App";
import { CompanySettingsProvider } from "./company/CompanySettingsContext";
import { UnsavedChangesProvider } from "./guards/UnsavedChangesGuard";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <UnsavedChangesProvider>
          <CompanySettingsProvider>
            <App />
          </CompanySettingsProvider>
        </UnsavedChangesProvider>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
