import { useEffect, useRef, useState } from "react";
import { AppToast } from "./ui";
import { subscribeTopToast, type TopToastPayload } from "./topToast";

const DUPLICATE_WINDOW_MS = 500;

export const TopToastHost = () => {
  const [toast, setToast] = useState<TopToastPayload | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastSignatureRef = useRef("");
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    return subscribeTopToast((nextToast) => {
      const signature = `${nextToast.tone}|${nextToast.title}|${nextToast.message}`;
      const now = Date.now();
      if (
        signature === lastSignatureRef.current &&
        now - lastTimestampRef.current < DUPLICATE_WINDOW_MS
      ) {
        return;
      }

      lastSignatureRef.current = signature;
      lastTimestampRef.current = now;
      setToast(nextToast);
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, toast.durationMs ?? 3200);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [toast]);

  return (
    <AppToast
      message={toast?.message ?? ""}
      onClose={() => setToast(null)}
      open={toast !== null}
      title={toast?.title ?? ""}
      tone={toast?.tone ?? "info"}
    />
  );
};
