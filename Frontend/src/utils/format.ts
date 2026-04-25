export const formatTzs = (value: number): string => {
  const formatted = new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(value);

  return formatted.replace("TSh", "TZS");
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
