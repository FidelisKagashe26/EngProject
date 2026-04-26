import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, setApiAuthToken, type AuthUser } from "../services/api";

const LOCAL_TOKEN_KEY = "engicost_auth_token";
const SESSION_TOKEN_KEY = "engicost_auth_token_session";

const getStoredToken = (): string | null => {
  const localToken = localStorage.getItem(LOCAL_TOKEN_KEY);
  if (localToken) return localToken;
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
};

const persistToken = (token: string, remember: boolean): void => {
  if (remember) {
    localStorage.setItem(LOCAL_TOKEN_KEY, token);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }

  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.removeItem(LOCAL_TOKEN_KEY);
};

const clearTokenStorage = (): void => {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
};

interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUser: (nextUser: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const resetAuth = useCallback(() => {
    clearTokenStorage();
    setApiAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const token = getStoredToken();
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      setApiAuthToken(token);
      try {
        const me = await api.me();
        if (mounted) {
          setUser(me.user);
        }
      } catch {
        if (mounted) {
          resetAuth();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [resetAuth]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await api.login({
        email: input.email.trim(),
        password: input.password,
      });

      setApiAuthToken(response.token);
      persistToken(response.token, input.remember);
      setUser(response.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        // Ignore logout API errors and always clear local session
      }
    } finally {
      resetAuth();
    }
  }, [resetAuth]);

  const updateCurrentUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      login,
      logout,
      updateCurrentUser,
    }),
    [user, loading, login, logout, updateCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
