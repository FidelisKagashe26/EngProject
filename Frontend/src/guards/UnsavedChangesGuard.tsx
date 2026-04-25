import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConfirmModal } from "../components/ui";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  markDirty: () => void;
  markSaved: () => void;
  setDirty: (dirty: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);
const RELOAD_TOKEN = "__reload__";

export const UnsavedChangesProvider = ({ children }: { children: ReactNode }) => {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const markDirtyFromFormEvent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const form = target.closest("form");
      if (!form) {
        return;
      }

      if (target instanceof HTMLInputElement && target.type === "hidden") {
        return;
      }

      setIsDirty(true);
    };

    document.addEventListener("input", markDirtyFromFormEvent, true);
    document.addEventListener("change", markDirtyFromFormEvent, true);

    return () => {
      document.removeEventListener("input", markDirtyFromFormEvent, true);
      document.removeEventListener("change", markDirtyFromFormEvent, true);
    };
  }, []);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      isDirty,
      markDirty: () => setIsDirty(true),
      markSaved: () => setIsDirty(false),
      setDirty: (dirty: boolean) => setIsDirty(dirty),
    }),
    [isDirty],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
};

export const useUnsavedChanges = (): UnsavedChangesContextValue => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider.");
  }
  return context;
};

export const UnsavedChangesRouteGuard = () => {
  const { isDirty, markSaved } = useUnsavedChanges();
  const navigate = useNavigate();
  const location = useLocation();
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const bypassGuardRef = useRef(false);
  const stablePathRef = useRef(
    `${location.pathname}${location.search}${location.hash}`,
  );

  useEffect(() => {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;

    if (bypassGuardRef.current) {
      bypassGuardRef.current = false;
      stablePathRef.current = nextPath;
      return;
    }

    if (isDirty && nextPath !== stablePathRef.current) {
      setPendingPath(nextPath);
      setPromptOpen(true);
      bypassGuardRef.current = true;
      navigate(stablePathRef.current, { replace: true });
      return;
    }

    stablePathRef.current = nextPath;
  }, [isDirty, location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    const handleRefreshShortcut = (event: KeyboardEvent) => {
      if (!isDirty) {
        return;
      }

      const isReloadKey =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r");

      if (!isReloadKey) {
        return;
      }

      event.preventDefault();
      setPendingPath(RELOAD_TOKEN);
      setPromptOpen(true);
    };

    window.addEventListener("keydown", handleRefreshShortcut);
    return () => {
      window.removeEventListener("keydown", handleRefreshShortcut);
    };
  }, [isDirty]);

  const stayOnPage = () => {
    setPromptOpen(false);
    setPendingPath(null);
  };

  const isReloadRequest = pendingPath === RELOAD_TOKEN;

  const leavePage = () => {
    setPromptOpen(false);
    markSaved();
    if (pendingPath === RELOAD_TOKEN) {
      window.location.reload();
      return;
    }
    if (pendingPath) {
      bypassGuardRef.current = true;
      navigate(pendingPath);
    }
    setPendingPath(null);
  };

  return (
    <ConfirmModal
      cancelLabel="No, keep editing"
      confirmClassName="btn-danger"
      confirmLabel={isReloadRequest ? "Yes, reload" : "Yes, leave"}
      description={
        isReloadRequest
          ? "You have unsaved changes. Reloading now will discard everything you entered."
          : "You have unsaved changes. Leaving now will discard everything you entered."
      }
      onCancel={stayOnPage}
      onConfirm={leavePage}
      open={promptOpen}
      title={isReloadRequest ? "Reload without saving?" : "Leave without saving?"}
    />
  );
};
