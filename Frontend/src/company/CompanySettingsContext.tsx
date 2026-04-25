import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth";
import {
  api,
  ApiError,
  type CompanyProfile,
  type UpdateCompanyProfilePayload,
} from "../services/api";
import { setAppCurrency } from "../utils/format";

type CompanySettingsContextValue = {
  company: CompanyProfile | null;
  expenseCategories: string[];
  materialUnits: string[];
  paymentMethods: string[];
  loading: boolean;
  errorMessage: string;
  refresh: () => Promise<void>;
  saveCompanyProfile: (
    payload: UpdateCompanyProfilePayload,
  ) => Promise<CompanyProfile>;
};

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(
  null,
);

export const CompanySettingsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [materialUnits, setMaterialUnits] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const clearState = useCallback(() => {
    setCompany(null);
    setExpenseCategories([]);
    setMaterialUnits([]);
    setPaymentMethods([]);
    setLoading(false);
    setErrorMessage("");
    setAppCurrency("TZS");
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      clearState();
      return;
    }

    setLoading(true);
    try {
      const response = await api.getSettings();
      setCompany(response.company);
      setExpenseCategories(response.expenseCategories);
      setMaterialUnits(response.materialUnits);
      setPaymentMethods(response.paymentMethods);
      setErrorMessage("");
      setAppCurrency(response.company.currency);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to load company profile settings.");
      }
    } finally {
      setLoading(false);
    }
  }, [clearState, isAuthenticated]);

  const saveCompanyProfile = useCallback(
    async (
      payload: UpdateCompanyProfilePayload,
    ): Promise<CompanyProfile> => {
      const updated = await api.updateCompanyProfile(payload);
      setCompany(updated);
      setAppCurrency(updated.currency);
      setErrorMessage("");
      return updated;
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CompanySettingsContextValue>(
    () => ({
      company,
      expenseCategories,
      materialUnits,
      paymentMethods,
      loading,
      errorMessage,
      refresh,
      saveCompanyProfile,
    }),
    [
      company,
      expenseCategories,
      materialUnits,
      paymentMethods,
      loading,
      errorMessage,
      refresh,
      saveCompanyProfile,
    ],
  );

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
};

export const useCompanySettings = (): CompanySettingsContextValue => {
  const context = useContext(CompanySettingsContext);
  if (!context) {
    throw new Error(
      "useCompanySettings must be used within CompanySettingsProvider.",
    );
  }
  return context;
};

