import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../services/api";
import { AuthShell } from "./AuthShell";

const OTP_LENGTH = 6;

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

export const ForgotPasswordOtpPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (email.length === 0) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate]);

  const setDigitAt = (index: number, value: string) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, "").slice(-1);
    setDigitAt(index, value);
    setErrorMessage("");

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && digits[index].length === 0 && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length === 0) {
      return;
    }

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    setErrorMessage("");

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const otp = digits.join("");
    if (otp.length !== OTP_LENGTH) {
      setErrorMessage("Enter the full 6-digit OTP code.");
      return;
    }

    setVerifying(true);
    try {
      const response = await api.verifyPasswordResetOtp({
        email,
        otp,
      });
      navigate(
        `/forgot-password/reset?email=${encodeURIComponent(email)}&resetToken=${encodeURIComponent(response.resetToken)}`,
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to verify OTP. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage("");
    setInfoMessage("");
    setResending(true);
    try {
      const response = await api.requestPasswordResetOtp({ email });
      setDigits(Array(OTP_LENGTH).fill(""));
      setInfoMessage(response.message);
      inputRefs.current[0]?.focus();
    } catch (error) {
      if (error instanceof ApiError) {
        const errorCode = getApiErrorCode(error);
        if (errorCode === "SMTP_NOT_CONFIGURED") {
          setErrorMessage("Password reset email service is not available. Contact administrator.");
        } else if (errorCode === "SMTP_DELIVERY_FAILED") {
          setErrorMessage("Unable to resend OTP right now. Please try again shortly.");
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage("Unable to resend OTP. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      subtitle={`Enter the 6-digit OTP sent to ${email || "your email"}.`}
      title="Verify OTP"
      footer={<Link className="font-semibold text-[#0b2a53] hover:underline" to="/forgot-password">Change email</Link>}
    >
      <form className="space-y-5" onSubmit={handleVerify}>
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

        <div className="space-y-2">
          <label className="form-field">
            <span>OTP Code</span>
          </label>
          <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={`otp-${index}`}
                className="h-12 w-12 rounded-lg border border-slate-300 text-center text-lg font-semibold outline-none focus:border-[#f28c28] focus:ring-2 focus:ring-orange-100"
                inputMode="numeric"
                maxLength={1}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleDigitKeyDown(index, event)}
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                type="text"
                value={digit}
              />
            ))}
          </div>
        </div>

        <button className="btn-primary w-full justify-center !py-3 text-sm" disabled={verifying} type="submit">
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Verify OTP
        </button>
      </form>

      <button
        className="mt-3 w-full text-sm font-semibold text-[#0b2a53] hover:underline disabled:opacity-50"
        disabled={resending}
        onClick={() => void handleResendOtp()}
        type="button"
      >
        {resending ? "Resending OTP..." : "Resend OTP"}
      </button>
    </AuthShell>
  );
};
