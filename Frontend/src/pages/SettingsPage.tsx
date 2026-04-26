import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useCompanySettings } from "../company/CompanySettingsContext";
import { AppToast, GuiSelect, SectionTitle, SurfaceCard } from "../components/ui";
import {
  expenseCategories as fallbackExpenseCategories,
  materialUnits as fallbackMaterialUnits,
  paymentMethods as fallbackPaymentMethods,
} from "../data/mockData";
import { useUnsavedChanges } from "../guards/UnsavedChangesGuard";
import { api, ApiError, type SmtpStatusResponse } from "../services/api";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SettingsSection = "my-profile" | "system-settings" | "change-password";
type ToastTone = "success" | "error" | "info";

const sectionOptions: Array<{
  id: SettingsSection;
  label: string;
}> = [
  {
    id: "my-profile",
    label: "My Profile",
  },
  {
    id: "system-settings",
    label: "System Settings",
  },
  {
    id: "change-password",
    label: "Change Password",
  },
];

export const SettingsPage = () => {
  const { user, updateCurrentUser } = useAuth();
  const { markSaved } = useUnsavedChanges();
  const {
    company,
    expenseCategories,
    materialUnits,
    paymentMethods,
    loading: companySettingsLoading,
    errorMessage: companySettingsErrorMessage,
    saveCompanyProfile,
  } = useCompanySettings();

  const [activeSection, setActiveSection] = useState<SettingsSection>("my-profile");
  const [myFullName, setMyFullName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myAccountSaving, setMyAccountSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyCurrency, setCompanyCurrency] = useState("TZS");
  const [companySaving, setCompanySaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastTone, setToastTone] = useState<ToastTone>("success");
  const [toastTitle, setToastTitle] = useState("Done");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (tone: ToastTone, title: string, message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastTone(tone);
    setToastTitle(title);
    setToastMessage(message);
    setToastOpen(true);
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false);
    }, 2600);
  };

  const resolvedExpenseCategories =
    expenseCategories.length > 0 ? expenseCategories : fallbackExpenseCategories;
  const resolvedMaterialUnits =
    materialUnits.length > 0 ? materialUnits : fallbackMaterialUnits;
  const resolvedPaymentMethods =
    paymentMethods.length > 0 ? paymentMethods : fallbackPaymentMethods;

  useEffect(() => {
    let mounted = true;

    const loadSmtpStatus = async () => {
      setSmtpLoading(true);

      try {
        const response = await api.getSmtpStatus();
        if (mounted) {
          setSmtpStatus(response);
        }
      } catch (error) {
        if (mounted) {
          if (error instanceof ApiError) {
            showToast("error", "SMTP", error.message);
          } else {
            showToast("error", "SMTP", "Unable to load SMTP settings.");
          }
        }
      } finally {
        if (mounted) {
          setSmtpLoading(false);
        }
      }
    };

    void loadSmtpStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (companySettingsErrorMessage) {
      showToast("error", "Settings", companySettingsErrorMessage);
    }
  }, [companySettingsErrorMessage]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user?.email && smtpTestEmail.trim().length === 0) {
      setSmtpTestEmail(user.email);
    }
  }, [smtpTestEmail, user?.email]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setMyFullName(user.fullName);
    setMyEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!company) {
      return;
    }
    setCompanyName(company.name);
    setCompanyEmail(company.email);
    setCompanyPhone(company.phone);
    setCompanyLocation(company.location);
    setCompanyCurrency(company.currency);
  }, [company]);

  const handleSimpleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    markSaved();
    showToast("success", "Saved", "Changes saved.");
  };

  const handleMyAccountSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      fullName: myFullName.trim(),
      email: myEmail.trim().toLowerCase(),
    };

    if (payload.fullName.length < 2) {
      showToast("error", "My Account", "Full name must have at least 2 characters.");
      return;
    }

    if (!emailPattern.test(payload.email)) {
      showToast("error", "My Account", "Enter a valid email address.");
      return;
    }

    setMyAccountSaving(true);
    try {
      const response = await api.updateMyProfile(payload);
      updateCurrentUser(response.user);
      setMyFullName(response.user.fullName);
      setMyEmail(response.user.email);
      markSaved();
      showToast("success", "My Account", "Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "My Account", error.message);
      } else {
        showToast("error", "My Account", "Failed to update profile.");
      }
    } finally {
      setMyAccountSaving(false);
    }
  };

  const handleCompanyProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: companyName.trim(),
      email: companyEmail.trim().toLowerCase(),
      phone: companyPhone.trim(),
      location: companyLocation.trim(),
      currency: companyCurrency.trim().toUpperCase(),
    };

    if (payload.name.length < 2) {
      showToast("error", "Company", "Company name must have at least 2 characters.");
      return;
    }
    if (!emailPattern.test(payload.email)) {
      showToast("error", "Company", "Enter a valid company email.");
      return;
    }
    if (payload.phone.length < 7) {
      showToast("error", "Company", "Phone number must have at least 7 characters.");
      return;
    }
    if (payload.location.length < 2) {
      showToast("error", "Company", "Location must have at least 2 characters.");
      return;
    }
    if (payload.currency.length !== 3) {
      showToast("error", "Company", "Currency must be a 3-letter code.");
      return;
    }

    setCompanySaving(true);
    try {
      const updated = await saveCompanyProfile(payload);
      setCompanyName(updated.name);
      setCompanyEmail(updated.email);
      setCompanyPhone(updated.phone);
      setCompanyLocation(updated.location);
      setCompanyCurrency(updated.currency);
      markSaved();
      showToast("success", "Company", "Profile updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "Company", error.message);
      } else {
        showToast("error", "Company", "Failed to save profile.");
      }
    } finally {
      setCompanySaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 8) {
      showToast("error", "Password", "New password must have at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("error", "Password", "New password and confirm password do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.changePassword({
        oldPassword,
        newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      markSaved();
      showToast("success", "Password", "Password updated.");
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "Password", error.message);
      } else {
        showToast("error", "Password", "Failed to update password.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSmtpTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const recipient = smtpTestEmail.trim().toLowerCase();
    if (!emailPattern.test(recipient)) {
      showToast("error", "SMTP", "Enter a valid recipient email.");
      return;
    }

    setSmtpTesting(true);
    try {
      const response = await api.sendSmtpTestEmail({ to: recipient });
      markSaved();
      showToast("success", "SMTP", response.message);
    } catch (error) {
      if (error instanceof ApiError) {
        showToast("error", "SMTP", error.message);
      } else {
        showToast("error", "SMTP", "Failed to send SMTP test email.");
      }
    } finally {
      setSmtpTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Settings" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
        <SurfaceCard className="hidden h-fit lg:block" title="Menu">
          <div className="space-y-2">
            {sectionOptions.map((option) => {
              const isActive = option.id === activeSection;
              return (
                <button
                  className={`relative w-full rounded-xl border px-3 py-2 text-left transition ${
                    isActive
                      ? "text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  key={option.id}
                  onClick={() => setActiveSection(option.id)}
                  style={
                    isActive
                      ? {
                          backgroundColor: "var(--primary)",
                          borderColor: "var(--accent)",
                        }
                      : undefined
                  }
                  type="button"
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
                      style={{ backgroundColor: "var(--accent)" }}
                    />
                  )}
                  <p className="text-sm font-semibold">{option.label}</p>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard className="lg:hidden" title="Menu">
            <label className="form-field">
              <span>Section</span>
              <GuiSelect
                className="input-field"
                onChange={(event) =>
                  setActiveSection(event.target.value as SettingsSection)
                }
                value={activeSection}
              >
                {sectionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </GuiSelect>
            </label>
          </SurfaceCard>

          {activeSection === "my-profile" && (
            <>
              <SurfaceCard title="My Account">
                <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={handleMyAccountSave}>
                  <label className="form-field">
                    <span>Full Name</span>
                    <input
                      className="input-field"
                      disabled={myAccountSaving}
                      onChange={(event) => setMyFullName(event.target.value)}
                      required
                      value={myFullName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      className="input-field"
                      disabled={myAccountSaving}
                      onChange={(event) => setMyEmail(event.target.value)}
                      required
                      type="email"
                      value={myEmail}
                    />
                  </label>
                  <label className="form-field">
                    <span>Role</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      value={user?.role ?? ""}
                    />
                  </label>
                  <label className="form-field">
                    <span>Status</span>
                    <input
                      className="input-field bg-slate-50"
                      readOnly
                      value={user?.status ?? ""}
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button className="btn-primary" disabled={myAccountSaving} type="submit">
                      {myAccountSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                </form>
              </SurfaceCard>

              <SurfaceCard title="Company Profile">
                <form
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  onSubmit={handleCompanyProfileSave}
                >
                  {companySettingsLoading && !company && (
                    <div className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  )}
                  <label className="form-field">
                    <span>Company Name</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyName(event.target.value)}
                      required
                      value={companyName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyEmail(event.target.value)}
                      required
                      type="email"
                      value={companyEmail}
                    />
                  </label>
                  <label className="form-field">
                    <span>Phone</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyPhone(event.target.value)}
                      required
                      value={companyPhone}
                    />
                  </label>
                  <label className="form-field">
                    <span>Location</span>
                    <input
                      className="input-field"
                      disabled={companySettingsLoading || companySaving}
                      onChange={(event) => setCompanyLocation(event.target.value)}
                      required
                      value={companyLocation}
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      className="btn-primary"
                      disabled={companySettingsLoading || companySaving}
                      type="submit"
                    >
                      {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
                    </button>
                  </div>
                </form>
              </SurfaceCard>
            </>
          )}

          {activeSection === "system-settings" && (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Currency Settings">
                  <form
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    onSubmit={handleCompanyProfileSave}
                  >
                    <label className="form-field">
                      <span>Default Currency</span>
                      <GuiSelect
                        className="input-field"
                        disabled={companySettingsLoading || companySaving}
                        onChange={(event) => setCompanyCurrency(event.target.value)}
                        value={companyCurrency}
                      >
                        <option value="TZS">TZS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="KES">KES</option>
                        <option value="UGX">UGX</option>
                      </GuiSelect>
                    </label>
                    <label className="form-field">
                      <span>Number Format</span>
                      <GuiSelect className="input-field" disabled>
                        <option>{`${companyCurrency || "TZS"} 1,000,000`}</option>
                        <option>{`${companyCurrency || "TZS"} 1 000 000`}</option>
                      </GuiSelect>
                    </label>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        className="btn-primary"
                        disabled={companySettingsLoading || companySaving}
                        type="submit"
                      >
                        {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save
                      </button>
                    </div>
                  </form>
                </SurfaceCard>

                <SurfaceCard title="Notification Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Overspending alerts</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Pending client payments</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Outstanding labor payments</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Project deadline reminders</span>
                      <input type="checkbox" />
                    </label>
                    <button className="btn-primary" type="submit">
                      Save
                    </button>
                  </form>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Expense Categories">
                  <div className="space-y-2">
                    {resolvedExpenseCategories.map((category) => (
                      <label className="form-field" key={`set-exp-${category}`}>
                        <span>{category}</span>
                        <input className="input-field" defaultValue={category} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Material Units">
                  <div className="space-y-2">
                    {resolvedMaterialUnits.map((unit) => (
                      <label className="form-field" key={`set-unit-${unit}`}>
                        <span>{unit}</span>
                        <input className="input-field" defaultValue={unit} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="Payment Methods">
                  <div className="space-y-2">
                    {resolvedPaymentMethods.map((method) => (
                      <label className="form-field" key={`set-pay-${method}`}>
                        <span>{method}</span>
                        <input className="input-field" defaultValue={method} />
                      </label>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Security Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Two-factor authentication</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Enforce strong password policy</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <span>Session timeout (30 mins)</span>
                      <input defaultChecked type="checkbox" />
                    </label>
                    <button className="btn-primary" type="submit">
                      Save
                    </button>
                  </form>
                </SurfaceCard>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SurfaceCard title="SMTP Email">
                  <div className="space-y-3 text-sm text-slate-700">
                    {smtpLoading ? (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                          <span>Status</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              smtpStatus?.configured
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {smtpStatus?.configured ? "Configured" : "Not configured"}
                          </span>
                        </div>
                        <label className="form-field">
                          <span>SMTP Host</span>
                          <input className="input-field bg-slate-50" readOnly value={smtpStatus?.host ?? ""} />
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="form-field">
                            <span>Port</span>
                            <input
                              className="input-field bg-slate-50"
                              readOnly
                              value={smtpStatus ? String(smtpStatus.port) : ""}
                            />
                          </label>
                          <label className="form-field">
                            <span>Secure</span>
                            <input
                              className="input-field bg-slate-50"
                              readOnly
                              value={smtpStatus?.secure ? "Yes" : "No"}
                            />
                          </label>
                        </div>
                        <label className="form-field">
                          <span>From Email</span>
                          <input className="input-field bg-slate-50" readOnly value={smtpStatus?.fromEmail ?? ""} />
                        </label>
                      </>
                    )}

                    <form className="space-y-3 border-t border-slate-200 pt-3" onSubmit={handleSmtpTest}>
                      <label className="form-field">
                        <span>Test Recipient Email</span>
                        <input
                          className="input-field"
                          onChange={(event) => setSmtpTestEmail(event.target.value)}
                          placeholder="admin@company.com"
                          type="email"
                          value={smtpTestEmail}
                        />
                      </label>
                      <button
                        className="btn-primary w-full justify-center"
                        disabled={smtpTesting || smtpLoading}
                        type="submit"
                      >
                        {smtpTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Send Test
                      </button>
                    </form>
                  </div>
                </SurfaceCard>

                <SurfaceCard title="Backup Settings">
                  <form className="space-y-3 text-sm text-slate-700" onSubmit={handleSimpleSave}>
                    <p>Auto backup: Daily 23:00</p>
                    <p>Last: 23 Apr 2026 23:01</p>
                    <div className="flex gap-2">
                      <button className="btn-secondary" type="button">
                        Run Backup Now
                      </button>
                      <button className="btn-primary" type="submit">
                        Save
                      </button>
                    </div>
                  </form>
                </SurfaceCard>
              </div>
            </>
          )}

          {activeSection === "change-password" && (
            <SurfaceCard title="Change Password">
              <form className="space-y-3" onSubmit={handlePasswordChange}>
                <label className="form-field">
                  <span>Current Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      onChange={(event) => setOldPassword(event.target.value)}
                      required
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                    />
                    {oldPassword.length > 0 && (
                      <button
                        aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowOldPassword((current) => !current)}
                        type="button"
                      >
                        {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <label className="form-field">
                  <span>New Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      minLength={8}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                    />
                    {newPassword.length > 0 && (
                      <button
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowNewPassword((current) => !current)}
                        type="button"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <label className="form-field">
                  <span>Confirm New Password</span>
                  <div className="relative">
                    <input
                      className="input-field pr-10"
                      minLength={8}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                    />
                    {confirmPassword.length > 0 && (
                      <button
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        type="button"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </label>
                <button className="btn-primary w-full justify-center" disabled={passwordSaving} type="submit">
                  {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Update Password
                </button>
              </form>
            </SurfaceCard>
          )}
        </div>
      </div>

      <AppToast
        message={toastMessage}
        onClose={() => setToastOpen(false)}
        open={toastOpen}
        title={toastTitle}
        tone={toastTone}
      />
    </div>
  );
};
