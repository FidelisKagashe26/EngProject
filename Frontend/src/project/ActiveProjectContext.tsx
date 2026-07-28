import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api, type ProjectApiRecord } from "../services/api";

/**
 * The one project the user is currently working inside. Instead of every page
 * carrying its own "filter by project" dropdown that resets on navigation, the
 * choice is made once (in the header switcher) and read from here everywhere.
 *
 * An empty id means "All projects" — the cross-project overview used by the
 * dashboard and reports.
 */
type ActiveProjectContextValue = {
  projects: ProjectApiRecord[];
  loading: boolean;
  /** "" = All projects. */
  activeProjectId: string;
  activeProject: ProjectApiRecord | null;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
};

const STORAGE_KEY = "engicost.activeProjectId";

const readStoredId = (): string => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export const ActiveProjectProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectApiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(readStoredId);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    try {
      if (id) {
        window.localStorage.setItem(STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Persistence is best-effort; the in-memory value still holds for the session.
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      setProjects(await api.getProjects());
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  // Deep links (e.g. a project's "quick access" tiles) arrive with ?projectId=.
  // Adopt it once as the active project, then strip it from the URL so the
  // header switcher stays the single source of truth and this effect can't
  // later fight a manual switch.
  useEffect(() => {
    const param = searchParams.get("projectId");
    if (!param) return;
    setActiveProjectId(param);
    const next = new URLSearchParams(searchParams);
    next.delete("projectId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setActiveProjectId]);

  // If the active project is gone (deleted), drop back to All rather than
  // scoping every page to a project that no longer exists.
  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;
    if (!projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId("");
    }
  }, [activeProjectId, projects, setActiveProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      projects,
      loading,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      refreshProjects,
    }),
    [projects, loading, activeProjectId, activeProject, setActiveProjectId, refreshProjects],
  );

  return (
    <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
  );
};

export const useActiveProject = (): ActiveProjectContextValue => {
  const context = useContext(ActiveProjectContext);
  if (!context) {
    throw new Error("useActiveProject must be used within an ActiveProjectProvider");
  }
  return context;
};
