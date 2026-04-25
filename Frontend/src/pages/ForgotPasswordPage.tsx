import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../services/api";
import { AuthShell } from "./AuthShell";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getApiErrorCode = (error: ApiError): string | null => {
  if (
    typeof error.details === "object" &&
    error.details !== null &&
    "code" in error.details &&
    typeof (error.details as { code?: unknown }).code === "string"
  ) {
    return (error.details as { code: string }).code;
  }

  return null;
};

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.requestPasswordResetOtp({ email: normalizedEmail });
      setInfoMessage(response.message);
      navigate(`/forgot-password/verify?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const errorCode = getApiErrorCode(error);
        if (errorCode === "SMTP_NOT_CONFIGURED") {
          setErrorMessage("Password reset email service is not available. Contact administrator.");
        } else if (errorCode === "SMTP_DELIVERY_FAILED") {
          setErrorMessage("Unable to send OTP email right now. Please try again shortly.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Unable to send OTP. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      subtitle="Enter your account email. We will send a 6-digit OTP code."
      title="Forgot password"
      footer={<Link className="font-semibold text-[#0b2a53] hover:underline" to="/">Back to Sign in</Link>}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        {infoMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {infoMessage}
          </div>
        )}
        <label className="form-field">
          <span>Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-10"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="manager@nexivo.co.tz"
              required
              type="email"
              value={email}
            />
          </div>
        </label>

        <button className="btn-primary w-full justify-center !py-3 text-sm" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Send OTP
        </button>
      </form>
    </AuthShell>
  );
};
