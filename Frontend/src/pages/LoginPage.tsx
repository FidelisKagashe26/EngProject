import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ApiError } from "../services/api";
import { AuthShell } from "./AuthShell";

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const redirectPath =
    typeof (location.state as { from?: unknown } | null)?.from === "string"
      ? ((location.state as { from: string }).from || "/dashboard")
      : "/dashboard";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    try {
      await login({ email, password, remember });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Sign in">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
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

        <label className="form-field">
          <span>Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field pl-10 pr-10"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            {password.length > 0 && (
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
        </label>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              checked={remember}
              className="h-4 w-4 rounded border-slate-300 text-[#0b2a53]"
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            Remember me
          </label>
          <Link className="font-semibold text-[#0b2a53] hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <button className="btn-primary w-full justify-center !py-3 text-sm" disabled={submitting} type="submit">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Login
        </button>
      </form>
    </AuthShell>
  );
};
