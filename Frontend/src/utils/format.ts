const COMPANY_CURRENCY_STORAGE_KEY = "engicost_company_currency";
const DEFAULT_CURRENCY = "TZS";

let appCurrency = DEFAULT_CURRENCY;

if (typeof window !== "undefined") {
  const stored = window.localStorage.getItem(COMPANY_CURRENCY_STORAGE_KEY);
  if (stored && stored.trim().length > 0) {
    appCurrency = stored.trim().toUpperCase();
  }
}

const normalizeCurrency = (value: string | null | undefined): string => {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized.length !== 3) {
    return DEFAULT_CURRENCY;
  }
  return normalized;
};

export const setAppCurrency = (currency: string): void => {
  appCurrency = normalizeCurrency(currency);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COMPANY_CURRENCY_STORAGE_KEY, appCurrency);
  }
};

export const getAppCurrency = (): string => appCurrency;

export const formatTzs = (value: number): string => {
  const currency = getAppCurrency();
  const formatter = new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(value);

  if (currency === "TZS") {
    return formatted.replace("TSh", "TZS");
  }

  return formatted;
};

export const formatPercent = (value: number): string => `${value}%`;

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(value);

export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString("en-TZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
