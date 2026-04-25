import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../services/api";
import { AuthShell } from "./AuthShell";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const resetToken = searchParams.get("resetToken")?.trim() ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (email.length === 0 || resetToken.length === 0) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate, resetToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (newPassword.length < 8) {
      setErrorMessage("New password must have at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.resetPasswordByOtp({
        resetToken,
        newPassword,
      });
      setSuccessMessage(response.message);
      window.setTimeout(() => navigate("/", { replace: true }), 1000);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to reset password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      subtitle={`Set a new password for ${email || "your account"}.`}
      title="Reset password"
      footer={<Link className="font-semibold text-[#0b2a53] hover:underline" to="/">Back to Sign in</Link>}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <label className="form-field">
          <span>New Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-10 pr-10"
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
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
          <span>Confirm Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-10 pr-10"
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
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

        <button className="btn-primary w-full justify-center !py-3 text-sm" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Reset Password
        </button>
      </form>
    </AuthShell>
  );
};
