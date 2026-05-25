import fs from "fs";
import path from "path";
import { Router } from "express";
import PDFDocument from "pdfkit";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

type ReportProjectCostRow = {
  id: string;
  projectName: string;
  contractValue: number;
  amountReceived: number;
  laborCost: number;
  materialCost: number;
  otherExpenses: number;
  totalSpent: number;
  remainingBalance: number;
  estimatedProfitLoss: number;
  pendingClientPayments: number;
  status: string;
  progress: number;
};

type ExpenseCategoryRow = {
  projectId: string | null;
  projectName: string;
  category: string;
  total: number;
  count: number;
};

type LaborDetailRow = {
  workerId: string;
  workerName: string;
  projectId: string | null;
  projectName: string;
  paymentType: string;
  rateAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  status: string;
};

type MaterialPurchaseDetailRow = {
  purchaseId: string;
  projectId: string | null;
  projectName: string;
  materialName: string;
  quantityPurchased: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  supplierName: string;
};

type ReportsPayload = {
  totals: {
    contractValue: number;
    amountReceived: number;
    laborCost: number;
    materialCost: number;
    otherExpenses: number;
    totalSpent: number;
    remainingBalance: number;
    estimatedProfitLoss: number;
  };
  projectCostSummary: ReportProjectCostRow[];
  laborByProject: Array<{
    projectId: string | null;
    projectName: string;
    totalPaid: number;
    outstanding: number;
    workerCount: number;
  }>;
  materialByProject: Array<{
    projectId: string | null;
    projectName: string;
    totalCost: number;
    purchaseCount: number;
  }>;
  laborDetails: LaborDetailRow[];
  materialPurchaseDetails: MaterialPurchaseDetailRow[];
  expenseByProject: Array<{
    projectId: string | null;
    projectName: string;
    totalAmount: number;
    expenseCount: number;
  }>;
  paymentByProject: Array<{
    projectId: string | null;
    projectName: string;
    totalExpected: number;
    totalReceived: number;
    totalBalance: number;
  }>;
  expenseByCategory: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  expenseByCategoryByProject: Array<{
    projectId: string | null;
    projectName: string;
    category: string;
    total: number;
    count: number;
  }>;
  _expenseCategoryRows: ExpenseCategoryRow[];
  monthlyExpenseTrend: Array<{
    month: string;
    total: number;
  }>;
  budgetVariance: Array<{
    projectName: string;
    contractValue: number;
    totalSpent: number;
    variance: number;
    variancePct: number;
  }>;
};

type PdfReportType =
  | "comprehensive"
  | "project-cost-summary"
  | "income-expense"
  | "payments"
  | "labor"
  | "materials"
  | "expenses-by-category"
  | "budget-variance";

type ReportFilters = {
  projectId: string | null;
  category: string | null;
  fromDate: string | null;
  toDate: string | null;
};

type ReportBranding = {
  companyName: string;
  email: string;
  phone: string;
  whatsapp: string;
  location: string;
  websiteUrl: string;
  logoPath: string | null;
};

const VALID_REPORT_TYPES: readonly PdfReportType[] = [
  "comprehensive",
  "project-cost-summary",
  "income-expense",
  "payments",
  "labor",
  "materials",
  "expenses-by-category",
  "budget-variance",
];

const monthIndex: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const PDF_MARGIN = 56;
const PDF_BASE_FONT_SIZE = 12;
const PDF_LINE_GAP = 6; // 12pt with 6pt line gap ~= 1.5 spacing
const FALLBACK_WEBSITE_URL = "https://www.dreggam.co.tz";
const REPORT_COLORS = {
  navy: "#0b2a53",
  accent: "#f28c28",
  slate900: "#0f172a",
  slate700: "#334155",
  slate600: "#475569",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  white: "#ffffff",
} as const;
const REPORT_LOGO_PATH_CANDIDATES = [
  path.resolve(process.cwd(), "..", "Frontend", "public", "EngLogo.png"),
  path.resolve(process.cwd(), "public", "EngLogo.png"),
  path.resolve(process.cwd(), "uploads", "brand", "logo.png"),
  path.resolve(process.cwd(), "uploads", "brand", "logo.jpg"),
  path.resolve(process.cwd(), "uploads", "brand", "logo.jpeg"),
] as const;

const router = Router();

const toQueryString = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }
  return typeof value === "string" ? value.trim() : "";
};

const isIsoDateLiteral = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseReportType = (value: string): PdfReportType => {
  if (VALID_REPORT_TYPES.includes(value as PdfReportType)) {
    return value as PdfReportType;
  }
  return "comprehensive";
};

const formatCurrency = (value: number): string => {
  const amount = new Intl.NumberFormat("en-TZ", {
    maximumFractionDigits: 0,
  }).format(value);
  return `TZS ${amount}`;
};

const toSafeFileToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const sanitizePdfText = (value: string): string =>
  value
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/[�•·▪]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseMonthLabel = (label: string): Date | null => {
  const [monthToken, yearToken] = label.split(" ");
  const month = monthIndex[monthToken ?? ""];
  const year = Number(yearToken);
  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  return new Date(Date.UTC(year, month, 1));
};

const normalizeWebsiteUrl = (value: string | null | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) {
    return FALLBACK_WEBSITE_URL;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
};

const resolveExistingLogoPath = (): string | null => {
  for (const candidatePath of REPORT_LOGO_PATH_CANDIDATES) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
};

const buildReportBranding = async (companyId: number): Promise<ReportBranding> => {
  const [companyResult, websiteSettingsResult] = await Promise.all([
    db.query<{
      name: string;
      email: string | null;
      phone: string | null;
      location: string | null;
    }>(
      `
      SELECT name, email, phone, location
      FROM engicost.companies
      WHERE id = $1
      LIMIT 1
      `,
      [companyId],
    ),
    db.query<{ key: string; value: string }>(
      `
      SELECT key, value
      FROM engicost.website_settings
      WHERE company_id = $1
        AND key IN ('email_main', 'phone_main', 'phone_whatsapp', 'location', 'website_url')
      `,
      [companyId],
    ),
  ]);

  const company = companyResult.rows[0];
  const websiteSettings = new Map<string, string>();
  websiteSettingsResult.rows.forEach((row) => {
    websiteSettings.set(row.key, row.value);
  });

  return {
    companyName: company?.name?.trim() || "DREGGAM Company Limited",
    email: websiteSettings.get("email_main")?.trim() || company?.email?.trim() || "info@dreggam.co.tz",
    phone: websiteSettings.get("phone_main")?.trim() || company?.phone?.trim() || "+255 000 000 000",
    whatsapp: websiteSettings.get("phone_whatsapp")?.trim() || "",
    location: websiteSettings.get("location")?.trim() || company?.location?.trim() || "Dar es Salaam, Tanzania",
    websiteUrl: normalizeWebsiteUrl(websiteSettings.get("website_url")),
    logoPath: resolveExistingLogoPath(),
  };
};

const buildReportsPayload = async (companyId: number): Promise<ReportsPayload> => {
  const [
    projectSummaryResult,
    laborSummaryResult,
    materialSummaryResult,
    laborDetailResult,
    materialDetailResult,
    expenseSummaryResult,
    paymentSummaryResult,
    expenseByCategoryResult,
    monthlyExpenseResult,
    budgetVarianceResult,
  ] = await Promise.all([
    db.query<{
      id: string;
      name: string;
      contract_value: string;
      amount_received: string;
      total_spent: string;
      pending_client_payments: string;
      status: string;
      progress: number;
    }>(
      `
      SELECT
        id,
        name,
        contract_value::text,
        amount_received::text,
        total_spent::text,
        pending_client_payments::text,
        status,
        progress
      FROM engicost.projects
      WHERE company_id = $1
      ORDER BY contract_value DESC
      `,
      [companyId],
    ),
    db.query<{
      project_id: string | null;
      project_name: string;
      total_paid: string;
      outstanding: string;
      worker_count: string;
    }>(
      `
      SELECT
        w.assigned_project_id AS project_id,
        p.name AS project_name,
        COALESCE(SUM(w.total_paid), 0)::text AS total_paid,
        COALESCE(SUM(w.outstanding_amount), 0)::text AS outstanding,
        COUNT(w.id)::text AS worker_count
      FROM engicost.workers w
      LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
      WHERE w.company_id = $1
      GROUP BY w.assigned_project_id, p.name
      ORDER BY SUM(w.total_paid) DESC
      `,
      [companyId],
    ),
    db.query<{
      project_id: string | null;
      project_name: string;
      total_cost: string;
      purchase_count: string;
    }>(
      `
      SELECT
        mp.project_id,
        p.name AS project_name,
        COALESCE(SUM(mp.total_cost), 0)::text AS total_cost,
        COUNT(mp.id)::text AS purchase_count
      FROM engicost.material_purchases mp
      LEFT JOIN engicost.projects p ON p.id = mp.project_id
      WHERE mp.company_id = $1
      GROUP BY mp.project_id, p.name
      ORDER BY SUM(mp.total_cost) DESC
      `,
      [companyId],
    ),
    db.query<{
      worker_id: string;
      worker_name: string;
      project_id: string | null;
      project_name: string | null;
      payment_type: string;
      rate_amount: string;
      total_paid: string;
      outstanding_amount: string;
      status: string;
    }>(
      `
      SELECT
        w.id AS worker_id,
        w.full_name AS worker_name,
        w.assigned_project_id AS project_id,
        p.name AS project_name,
        w.payment_type,
        w.rate_amount::text AS rate_amount,
        w.total_paid::text AS total_paid,
        w.outstanding_amount::text AS outstanding_amount,
        w.status
      FROM engicost.workers w
      LEFT JOIN engicost.projects p ON p.id = w.assigned_project_id
      WHERE w.company_id = $1
      ORDER BY w.full_name ASC
      `,
      [companyId],
    ),
    db.query<{
      purchase_id: string;
      project_id: string | null;
      project_name: string | null;
      material_name: string;
      quantity_purchased: string;
      unit_cost: string;
      total_cost: string;
      purchase_date: string;
      supplier_name: string;
    }>(
      `
      SELECT
        mp.id AS purchase_id,
        mp.project_id,
        p.name AS project_name,
        mp.material_name,
        mp.quantity_purchased::text AS quantity_purchased,
        mp.unit_cost::text AS unit_cost,
        mp.total_cost::text AS total_cost,
        mp.purchase_date::text AS purchase_date,
        mp.supplier_name
      FROM engicost.material_purchases mp
      LEFT JOIN engicost.projects p ON p.id = mp.project_id
      WHERE mp.company_id = $1
      ORDER BY mp.purchase_date DESC, mp.created_at DESC
      `,
      [companyId],
    ),
    db.query<{
      project_id: string | null;
      project_name: string;
      total_amount: string;
      expense_count: string;
    }>(
      `
      SELECT
        e.project_id,
        p.name AS project_name,
        COALESCE(SUM(e.amount), 0)::text AS total_amount,
        COUNT(e.id)::text AS expense_count
      FROM engicost.expenses e
      LEFT JOIN engicost.projects p ON p.id = e.project_id
      WHERE e.company_id = $1
      GROUP BY e.project_id, p.name
      ORDER BY SUM(e.amount) DESC
      `,
      [companyId],
    ),
    db.query<{
      project_id: string | null;
      project_name: string;
      total_expected: string;
      total_received: string;
      total_balance: string;
    }>(
      `
      SELECT
        cp.project_id,
        p.name AS project_name,
        COALESCE(SUM(cp.amount_expected), 0)::text AS total_expected,
        COALESCE(SUM(cp.amount_received), 0)::text AS total_received,
        COALESCE(SUM(cp.amount_expected - cp.amount_received), 0)::text AS total_balance
      FROM engicost.client_payments cp
      LEFT JOIN engicost.projects p ON p.id = cp.project_id
      WHERE cp.company_id = $1
      GROUP BY cp.project_id, p.name
      ORDER BY SUM(cp.amount_expected) DESC
      `,
      [companyId],
    ),
    db.query<{ project_id: string | null; project_name: string | null; category: string; total: string; count: string }>(
      `
      SELECT
        e.project_id,
        p.name AS project_name,
        e.category,
        COALESCE(SUM(e.amount), 0)::text AS total,
        COUNT(*)::text AS count
      FROM engicost.expenses e
      LEFT JOIN engicost.projects p ON p.id = e.project_id
      WHERE e.company_id = $1
      GROUP BY e.project_id, p.name, e.category
      ORDER BY SUM(e.amount) DESC
      `,
      [companyId],
    ),
    db.query<{ month: string; total: string }>(
      `
      WITH months AS (
        SELECT
          DATE_TRUNC('month', CURRENT_DATE) - (INTERVAL '1 month' * month_offset) AS month_start
        FROM generate_series(11, 0, -1) AS month_offset
      )
      SELECT
        TO_CHAR(months.month_start, 'Mon YYYY') AS month,
        COALESCE(SUM(expenses.amount), 0)::text AS total
      FROM months
      LEFT JOIN engicost.expenses AS expenses
        ON expenses.company_id = $1
        AND DATE_TRUNC('month', expenses.expense_date) = months.month_start
      GROUP BY months.month_start
      ORDER BY months.month_start ASC
      `,
      [companyId],
    ),
    db.query<{
      id: string;
      name: string;
      contract_value: string;
      total_spent: string;
      variance: string;
      variance_pct: string;
    }>(
      `
      SELECT
        id,
        name,
        contract_value::text,
        total_spent::text,
        (contract_value - total_spent)::text AS variance,
        CASE
          WHEN contract_value > 0
          THEN ROUND(((total_spent / contract_value) * 100)::numeric, 1)::text
          ELSE '0'
        END AS variance_pct
      FROM engicost.projects
      WHERE company_id = $1
      ORDER BY (total_spent / NULLIF(contract_value, 0)) DESC
      `,
      [companyId],
    ),
  ]);

  const laborMap = new Map(
    laborSummaryResult.rows.map((row) => [row.project_id, Number(row.total_paid)]),
  );
  const materialMap = new Map(
    materialSummaryResult.rows.map((row) => [row.project_id, Number(row.total_cost)]),
  );
  const expenseMap = new Map(
    expenseSummaryResult.rows.map((row) => [row.project_id, Number(row.total_amount)]),
  );

  const projectCostSummary: ReportProjectCostRow[] = projectSummaryResult.rows.map((row) => {
    const laborCost = laborMap.get(row.id) ?? 0;
    const materialCost = materialMap.get(row.id) ?? 0;
    const otherExpenses = expenseMap.get(row.id) ?? 0;
    const contractValue = Number(row.contract_value);
    const amountReceived = Number(row.amount_received);
    const totalSpent = Number(row.total_spent);
    return {
      id: row.id,
      projectName: row.name,
      contractValue,
      amountReceived,
      laborCost,
      materialCost,
      otherExpenses,
      totalSpent,
      remainingBalance: contractValue - totalSpent,
      estimatedProfitLoss: amountReceived - totalSpent,
      pendingClientPayments: Number(row.pending_client_payments),
      status: row.status,
      progress: row.progress,
    };
  });

  const totals = projectCostSummary.reduce(
    (acc, row) => ({
      contractValue: acc.contractValue + row.contractValue,
      amountReceived: acc.amountReceived + row.amountReceived,
      laborCost: acc.laborCost + row.laborCost,
      materialCost: acc.materialCost + row.materialCost,
      otherExpenses: acc.otherExpenses + row.otherExpenses,
      totalSpent: acc.totalSpent + row.totalSpent,
      remainingBalance: acc.remainingBalance + row.remainingBalance,
      estimatedProfitLoss: acc.estimatedProfitLoss + row.estimatedProfitLoss,
    }),
    {
      contractValue: 0,
      amountReceived: 0,
      laborCost: 0,
      materialCost: 0,
      otherExpenses: 0,
      totalSpent: 0,
      remainingBalance: 0,
      estimatedProfitLoss: 0,
    },
  );

  const expenseCategoryRows: ExpenseCategoryRow[] = expenseByCategoryResult.rows.map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name ?? "Unassigned",
    category: row.category,
    total: Number(row.total),
    count: Number(row.count),
  }));

  const expenseCategoryMap = new Map<string, { total: number; count: number }>();
  expenseCategoryRows.forEach((row) => {
    const current = expenseCategoryMap.get(row.category);
    if (current) {
      current.total += row.total;
      current.count += row.count;
      return;
    }
    expenseCategoryMap.set(row.category, { total: row.total, count: row.count });
  });

  return {
    totals,
    projectCostSummary,
    laborByProject: laborSummaryResult.rows.map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      totalPaid: Number(row.total_paid),
      outstanding: Number(row.outstanding),
      workerCount: Number(row.worker_count),
    })),
    materialByProject: materialSummaryResult.rows.map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      totalCost: Number(row.total_cost),
      purchaseCount: Number(row.purchase_count),
    })),
    laborDetails: laborDetailResult.rows.map((row) => ({
      workerId: row.worker_id,
      workerName: row.worker_name,
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      paymentType: row.payment_type,
      rateAmount: Number(row.rate_amount),
      totalPaid: Number(row.total_paid),
      outstandingAmount: Number(row.outstanding_amount),
      status: row.status,
    })),
    materialPurchaseDetails: materialDetailResult.rows.map((row) => ({
      purchaseId: row.purchase_id,
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      materialName: row.material_name,
      quantityPurchased: Number(row.quantity_purchased),
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.total_cost),
      purchaseDate: row.purchase_date,
      supplierName: row.supplier_name,
    })),
    expenseByProject: expenseSummaryResult.rows.map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      totalAmount: Number(row.total_amount),
      expenseCount: Number(row.expense_count),
    })),
    paymentByProject: paymentSummaryResult.rows.map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name ?? "Unassigned",
      totalExpected: Number(row.total_expected),
      totalReceived: Number(row.total_received),
      totalBalance: Number(row.total_balance),
    })),
    expenseByCategory: Array.from(expenseCategoryMap.entries())
      .map(([category, totalsByCategory]) => ({
        category,
        total: totalsByCategory.total,
        count: totalsByCategory.count,
      }))
      .sort((a, b) => b.total - a.total),
    expenseByCategoryByProject: expenseCategoryRows.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      category: row.category,
      total: row.total,
      count: row.count,
    })),
    _expenseCategoryRows: expenseCategoryRows,
    monthlyExpenseTrend: monthlyExpenseResult.rows.map((row) => ({
      month: row.month,
      total: Number(row.total),
    })),
    budgetVariance: budgetVarianceResult.rows.map((row) => ({
      projectName: row.name,
      contractValue: Number(row.contract_value),
      totalSpent: Number(row.total_spent),
      variance: Number(row.variance),
      variancePct: Number(row.variance_pct),
    })),
  };
};

const applyReportFilters = (
  payload: ReportsPayload,
  filters: ReportFilters,
): ReportsPayload => {
  const projectId = filters.projectId;
  const projectRow = projectId
    ? payload.projectCostSummary.find((row) => row.id === projectId) ?? null
    : null;
  const projectName = projectRow?.projectName ?? null;

  const projectCostSummary = projectId
    ? payload.projectCostSummary.filter((row) => row.id === projectId)
    : payload.projectCostSummary;

  const totals = projectCostSummary.reduce(
    (acc, row) => ({
      contractValue: acc.contractValue + row.contractValue,
      amountReceived: acc.amountReceived + row.amountReceived,
      laborCost: acc.laborCost + row.laborCost,
      materialCost: acc.materialCost + row.materialCost,
      otherExpenses: acc.otherExpenses + row.otherExpenses,
      totalSpent: acc.totalSpent + row.totalSpent,
      remainingBalance: acc.remainingBalance + row.remainingBalance,
      estimatedProfitLoss: acc.estimatedProfitLoss + row.estimatedProfitLoss,
    }),
    {
      contractValue: 0,
      amountReceived: 0,
      laborCost: 0,
      materialCost: 0,
      otherExpenses: 0,
      totalSpent: 0,
      remainingBalance: 0,
      estimatedProfitLoss: 0,
    },
  );

  const matchProject = (rowProjectId: string | null, rowProjectName: string): boolean => {
    if (!projectId) {
      return true;
    }
    if (rowProjectId && rowProjectId === projectId) {
      return true;
    }
    return projectName !== null && rowProjectName === projectName;
  };

  const categoryToken = filters.category?.toLowerCase() ?? "";
  const expenseByCategoryRows = payload._expenseCategoryRows.filter((row) => {
    if (projectId && row.projectId !== projectId) {
      return false;
    }
    if (categoryToken.length > 0 && !row.category.toLowerCase().includes(categoryToken)) {
      return false;
    }
    return true;
  });
  const expenseByCategoryMap = new Map<string, { total: number; count: number }>();
  expenseByCategoryRows.forEach((row) => {
    const current = expenseByCategoryMap.get(row.category);
    if (current) {
      current.total += row.total;
      current.count += row.count;
      return;
    }
    expenseByCategoryMap.set(row.category, { total: row.total, count: row.count });
  });
  const expenseByCategory = Array.from(expenseByCategoryMap.entries())
    .map(([category, summary]) => ({
      category,
      total: summary.total,
      count: summary.count,
    }))
    .sort((a, b) => b.total - a.total);

  const fromBoundary = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00.000Z`) : null;
  const toBoundary = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999Z`) : null;
  const isWithinDateWindow = (dateText: string): boolean => {
    if (!fromBoundary && !toBoundary) {
      return true;
    }
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateText)
      ? `${dateText}T00:00:00.000Z`
      : dateText;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return true;
    }
    if (fromBoundary && parsed < fromBoundary) {
      return false;
    }
    if (toBoundary && parsed > toBoundary) {
      return false;
    }
    return true;
  };

  const monthlyExpenseTrend = payload.monthlyExpenseTrend.filter((row) => {
    const monthDate = parseMonthLabel(row.month);
    if (!monthDate) {
      return true;
    }
    if (fromBoundary && monthDate < fromBoundary) {
      return false;
    }
    if (toBoundary && monthDate > toBoundary) {
      return false;
    }
    return true;
  });

  return {
    totals,
    projectCostSummary,
    laborByProject: payload.laborByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    materialByProject: payload.materialByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    laborDetails: payload.laborDetails.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    materialPurchaseDetails: payload.materialPurchaseDetails.filter((row) =>
      matchProject(row.projectId, row.projectName) && isWithinDateWindow(row.purchaseDate)),
    expenseByProject: payload.expenseByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    paymentByProject: payload.paymentByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    expenseByCategory,
    expenseByCategoryByProject: expenseByCategoryRows
      .filter((row) => matchProject(row.projectId, row.projectName))
      .map((row) => ({
        projectId: row.projectId,
        projectName: row.projectName,
        category: row.category,
        total: row.total,
        count: row.count,
      })),
    _expenseCategoryRows: expenseByCategoryRows,
    monthlyExpenseTrend,
    budgetVariance: payload.budgetVariance.filter((row) =>
      projectName ? row.projectName === projectName : true),
  };
};

type TableColumn<RowType> = {
  header: string;
  widthRatio: number;
  align?: "left" | "center" | "right";
  value: (row: RowType, index: number) => string;
};

const getContentLeft = (doc: PDFKit.PDFDocument): number => doc.page.margins.left;

const getContentWidth = (doc: PDFKit.PDFDocument): number =>
  doc.page.width - doc.page.margins.left - doc.page.margins.right;

const getBottomLimit = (doc: PDFKit.PDFDocument): number =>
  doc.page.height - doc.page.margins.bottom;

const formatGeneratedAt = (value: Date): string =>
  new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Dar_es_Salaam",
  }).format(value);

const formatDateForReport = (value: string): string => {
  const raw = value.trim();
  if (!raw) {
    return "-";
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(parsed);
};

const ensureRoom = (doc: PDFKit.PDFDocument, requiredHeight = 24): void => {
  if (doc.y + requiredHeight > getBottomLimit(doc)) {
    doc.addPage();
  }
};

const setBodyFont = (doc: PDFKit.PDFDocument): void => {
  doc
    .font("Times-Roman")
    .fontSize(PDF_BASE_FONT_SIZE)
    .fillColor(REPORT_COLORS.slate900);
};

const fitCellText = (doc: PDFKit.PDFDocument, value: string, maxWidth: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }
  if (doc.widthOfString(normalized) <= maxWidth) {
    return normalized;
  }

  let result = normalized;
  while (result.length > 1 && doc.widthOfString(`${result}...`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
};

const writeSectionTitle = (doc: PDFKit.PDFDocument, title: string): void => {
  ensureRoom(doc, 40);
  const x = getContentLeft(doc);
  const width = getContentWidth(doc);
  doc
    .moveDown(0.35)
    .font("Times-Bold")
    .fontSize(13)
    .fillColor(REPORT_COLORS.navy)
    .text(title, x, doc.y, { width, lineGap: 2 });

  const lineY = doc.y + 2;
  doc
    .save()
    .moveTo(x, lineY)
    .lineTo(x + width, lineY)
    .lineWidth(1)
    .strokeColor(REPORT_COLORS.slate300)
    .stroke()
    .restore();
  doc.y = lineY + 8;
};

const writeParagraph = (
  doc: PDFKit.PDFDocument,
  text: string,
  options?: PDFKit.Mixins.TextOptions,
): void => {
  ensureRoom(doc, 24);
  setBodyFont(doc);
  doc.text(text, {
    width: getContentWidth(doc),
    lineGap: PDF_LINE_GAP,
    ...options,
  });
};

const writeNoData = (doc: PDFKit.PDFDocument, message = "No data available for the selected criteria."): void => {
  ensureRoom(doc, 30);
  doc
    .font("Times-Italic")
    .fontSize(PDF_BASE_FONT_SIZE)
    .fillColor(REPORT_COLORS.slate600)
    .text(message, {
      width: getContentWidth(doc),
      lineGap: PDF_LINE_GAP,
    });
};

const writeTable = <RowType>(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: RowType[],
  columns: TableColumn<RowType>[],
): void => {
  writeSectionTitle(doc, title);
  if (rows.length === 0) {
    writeNoData(doc);
    return;
  }

  const tableLeft = getContentLeft(doc);
  const tableWidth = getContentWidth(doc);
  const totalRatio = columns.reduce((sum, column) => sum + column.widthRatio, 0) || 1;
  const columnWidths = columns.map((column) => (tableWidth * column.widthRatio) / totalRatio);
  const headerHeight = 28;
  const rowHeight = 26;
  const cellPaddingX = 4;

  const drawHeader = (): void => {
    ensureRoom(doc, headerHeight + rowHeight + 4);
    const headerY = doc.y;
    doc
      .save()
      .roundedRect(tableLeft, headerY, tableWidth, headerHeight, 5)
      .fillColor(REPORT_COLORS.navy)
      .fill()
      .restore();

    let cursorX = tableLeft;
    columns.forEach((column, index) => {
      const columnWidth = columnWidths[index];
      doc
        .font("Times-Bold")
        .fontSize(11)
        .fillColor(REPORT_COLORS.white)
        .text(column.header, cursorX + cellPaddingX, headerY + 8, {
          width: columnWidth - (cellPaddingX * 2),
          align: column.align ?? "left",
          lineBreak: false,
          ellipsis: true,
        });
      cursorX += columnWidth;
    });

    doc.y = headerY + headerHeight;
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (doc.y + rowHeight > getBottomLimit(doc)) {
      doc.addPage();
      drawHeader();
    }

    const rowY = doc.y;
    const rowFillColor = rowIndex % 2 === 0 ? REPORT_COLORS.white : REPORT_COLORS.slate100;
    doc
      .save()
      .rect(tableLeft, rowY, tableWidth, rowHeight)
      .fillColor(rowFillColor)
      .fill()
      .restore();
    doc
      .save()
      .rect(tableLeft, rowY, tableWidth, rowHeight)
      .lineWidth(0.6)
      .strokeColor(REPORT_COLORS.slate200)
      .stroke()
      .restore();

    let cursorX = tableLeft;
    setBodyFont(doc);
    columns.forEach((column, columnIndex) => {
      const columnWidth = columnWidths[columnIndex];
      const text = fitCellText(
        doc,
        column.value(row, rowIndex),
        Math.max(10, columnWidth - (cellPaddingX * 2)),
      );
      doc
        .font("Times-Roman")
        .fontSize(11)
        .fillColor(REPORT_COLORS.slate900)
        .text(text, cursorX + cellPaddingX, rowY + 7, {
          width: columnWidth - (cellPaddingX * 2),
          align: column.align ?? "left",
          lineBreak: false,
          ellipsis: true,
        });
      cursorX += columnWidth;
    });

    doc.y = rowY + rowHeight;
  });

  doc.moveDown(0.5);
};

const renderReportHeader = (
  doc: PDFKit.PDFDocument,
  branding: ReportBranding,
  reportTypeTitle: string,
  generatedAt: Date,
  projectScopeLabel: string,
  filters: ReportFilters,
): void => {
  const x = getContentLeft(doc);
  const width = getContentWidth(doc);
  const startY = doc.y;
  const contentY = startY + 16;
  const logoWidth = 96;
  const textStartX = x + 16;
  const textWidth = width - 32 - logoWidth - 12;
  const safeCompanyName = sanitizePdfText(branding.companyName) || "Company";
  const safeReportTitle = sanitizePdfText(reportTypeTitle) || "Report";
  const safeProjectScope = sanitizePdfText(projectScopeLabel) || "All Projects";
  const safeCategory = filters.category ? sanitizePdfText(filters.category) : "";
  const safeWebsite = sanitizePdfText(branding.websiteUrl.replace(/^https?:\/\//i, "")) || "-";

  const contactLine = sanitizePdfText(
    [
      `Email: ${branding.email}`,
      `Phone: ${branding.phone}`,
      branding.whatsapp ? `WhatsApp: ${branding.whatsapp}` : "",
    ]
      .filter((part) => part.length > 0)
      .join("  |  "),
  );

  const filterLines = [
    `Generated on: ${formatGeneratedAt(generatedAt)}`,
    `Project: ${safeProjectScope}`,
    safeCategory ? `Category: ${safeCategory}` : "",
    filters.fromDate || filters.toDate
      ? `Date Range: ${filters.fromDate ?? "N/A"} to ${filters.toDate ?? "N/A"}`
      : "",
  ].filter((line) => line.length > 0);

  const measureHeight = (
    fontName: string,
    fontSize: number,
    text: string,
    lineGap: number,
  ): number => {
    doc.font(fontName).fontSize(fontSize);
    return doc.heightOfString(text, { width: textWidth, lineGap });
  };

  const dynamicTextHeight =
    measureHeight("Times-Bold", 18, safeCompanyName, 2) +
    measureHeight("Times-Bold", 12, `${safeReportTitle} Report`, 2) +
    measureHeight("Times-Roman", PDF_BASE_FONT_SIZE, contactLine, PDF_LINE_GAP) +
    measureHeight("Times-Roman", PDF_BASE_FONT_SIZE, `Website: ${safeWebsite}`, PDF_LINE_GAP) +
    filterLines.reduce(
      (sum, line) => sum + measureHeight("Times-Roman", PDF_BASE_FONT_SIZE, line, PDF_LINE_GAP),
      0,
    ) +
    18;
  const headerHeight = Math.max(154, Math.ceil(dynamicTextHeight + (contentY - startY) + 14));

  doc
    .save()
    .roundedRect(x, startY, width, headerHeight, 8)
    .fillColor(REPORT_COLORS.slate100)
    .fill()
    .restore();
  doc
    .save()
    .rect(x, startY, width, 8)
    .fillColor(REPORT_COLORS.accent)
    .fill()
    .restore();
  doc
    .save()
    .roundedRect(x, startY, width, headerHeight, 8)
    .lineWidth(1)
    .strokeColor(REPORT_COLORS.slate200)
    .stroke()
    .restore();

  if (branding.logoPath) {
    try {
      doc.image(branding.logoPath, x + width - logoWidth - 16, contentY, {
        fit: [logoWidth, 56],
        align: "right",
      });
    } catch {
      // skip logo rendering if file is unreadable
    }
  }

  let cursorY = contentY;
  doc
    .font("Times-Bold")
    .fontSize(18)
    .fillColor(REPORT_COLORS.navy)
    .text(safeCompanyName, textStartX, cursorY, {
      width: textWidth,
      lineGap: 2,
    });
  cursorY = doc.y + 2;
  doc
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(REPORT_COLORS.slate700)
    .text(`${safeReportTitle} Report`, textStartX, cursorY, {
      width: textWidth,
      lineGap: 2,
    });
  cursorY = doc.y + 2;

  doc
    .font("Times-Roman")
    .fontSize(PDF_BASE_FONT_SIZE)
    .fillColor(REPORT_COLORS.slate700)
    .text(contactLine, textStartX, cursorY, {
      width: textWidth,
      lineGap: PDF_LINE_GAP,
    });
  cursorY = doc.y + 1;
  doc
    .font("Times-Roman")
    .fontSize(PDF_BASE_FONT_SIZE)
    .fillColor(REPORT_COLORS.navy)
    .text(`Website: ${safeWebsite}`, textStartX, cursorY, {
      width: textWidth,
      lineGap: PDF_LINE_GAP,
      underline: true,
    });
  cursorY = doc.y + 1;

  filterLines.forEach((line) => {
    doc
      .font("Times-Roman")
      .fontSize(PDF_BASE_FONT_SIZE)
      .fillColor(REPORT_COLORS.slate700)
      .text(line, textStartX, cursorY, {
        width: textWidth,
        lineGap: PDF_LINE_GAP,
      });
    cursorY = doc.y + 1;
  });

  doc.y = startY + headerHeight + 8;
};

const renderSummaryBlock = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Executive Summary",
    [
      { metric: "Total Contract Value", value: formatCurrency(payload.totals.contractValue) },
      { metric: "Total Income Received", value: formatCurrency(payload.totals.amountReceived) },
      { metric: "Total Labor Cost", value: formatCurrency(payload.totals.laborCost) },
      { metric: "Total Material Cost", value: formatCurrency(payload.totals.materialCost) },
      { metric: "Total Other Expenses", value: formatCurrency(payload.totals.otherExpenses) },
      { metric: "Total Expenses", value: formatCurrency(payload.totals.totalSpent) },
      { metric: "Estimated Profit / Loss", value: formatCurrency(payload.totals.estimatedProfitLoss) },
      { metric: "Outstanding Balance", value: formatCurrency(payload.totals.remainingBalance) },
    ],
    [
      { header: "Metric", widthRatio: 0.62, value: (row) => row.metric },
      { header: "Value", widthRatio: 0.38, align: "right", value: (row) => row.value },
    ],
  );
};

const renderProjectCostSummary = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Project Cost Summary",
    payload.projectCostSummary,
    [
      { header: "Project", widthRatio: 0.34, value: (row) => row.projectName },
      { header: "Income", widthRatio: 0.19, align: "right", value: (row) => formatCurrency(row.amountReceived) },
      { header: "Expenses", widthRatio: 0.19, align: "right", value: (row) => formatCurrency(row.totalSpent) },
      { header: "Profit/Loss", widthRatio: 0.18, align: "right", value: (row) => formatCurrency(row.estimatedProfitLoss) },
      { header: "Status", widthRatio: 0.10, value: (row) => row.status },
    ],
  );
};

const renderIncomeExpense = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Income vs Expense Statement",
    payload.projectCostSummary,
    [
      { header: "Project", widthRatio: 0.36, value: (row) => row.projectName },
      { header: "Income", widthRatio: 0.22, align: "right", value: (row) => formatCurrency(row.amountReceived) },
      { header: "Expenses", widthRatio: 0.22, align: "right", value: (row) => formatCurrency(row.totalSpent) },
      { header: "Net", widthRatio: 0.20, align: "right", value: (row) => formatCurrency(row.estimatedProfitLoss) },
    ],
  );

  if (payload.monthlyExpenseTrend.length > 0) {
    writeTable(
      doc,
      "Monthly Expense Trend",
      payload.monthlyExpenseTrend,
      [
        { header: "Month", widthRatio: 0.48, value: (row) => row.month },
        { header: "Total Expense", widthRatio: 0.52, align: "right", value: (row) => formatCurrency(row.total) },
      ],
    );
  }
};

const renderPayments = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Client Payment Collection Report",
    payload.paymentByProject,
    [
      { header: "Project", widthRatio: 0.27, value: (row) => row.projectName },
      { header: "Expected", widthRatio: 0.19, align: "right", value: (row) => formatCurrency(row.totalExpected) },
      { header: "Received", widthRatio: 0.19, align: "right", value: (row) => formatCurrency(row.totalReceived) },
      { header: "Balance", widthRatio: 0.19, align: "right", value: (row) => formatCurrency(row.totalBalance) },
      {
        header: "Collection",
        widthRatio: 0.16,
        align: "right",
        value: (row) => (row.totalExpected > 0 ? `${Math.round((row.totalReceived / row.totalExpected) * 100)}%` : "0%"),
      },
    ],
  );
};

const renderLabor = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Labor Cost Report",
    payload.laborDetails,
    [
      { header: "Worker", widthRatio: 0.23, value: (row) => row.workerName },
      { header: "Project", widthRatio: 0.21, value: (row) => row.projectName },
      { header: "Payment Type", widthRatio: 0.14, value: (row) => row.paymentType },
      { header: "Rate", widthRatio: 0.14, align: "right", value: (row) => formatCurrency(row.rateAmount) },
      { header: "Paid", widthRatio: 0.14, align: "right", value: (row) => formatCurrency(row.totalPaid) },
      { header: "Outstanding", widthRatio: 0.14, align: "right", value: (row) => formatCurrency(row.outstandingAmount) },
    ],
  );
};

const renderMaterials = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Material Purchase Report",
    payload.materialPurchaseDetails,
    [
      { header: "Date", widthRatio: 0.14, value: (row) => formatDateForReport(row.purchaseDate) },
      { header: "Project", widthRatio: 0.18, value: (row) => row.projectName },
      { header: "Material", widthRatio: 0.26, value: (row) => row.materialName },
      { header: "Qty", widthRatio: 0.10, align: "right", value: (row) => row.quantityPurchased.toLocaleString("en-TZ") },
      { header: "Unit Cost", widthRatio: 0.16, align: "right", value: (row) => formatCurrency(row.unitCost) },
      { header: "Total", widthRatio: 0.16, align: "right", value: (row) => formatCurrency(row.totalCost) },
    ],
  );
};

const renderExpenseCategories = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Expense Category Report",
    payload.expenseByCategory,
    [
      { header: "Category", widthRatio: 0.46, value: (row) => row.category },
      { header: "Entries", widthRatio: 0.20, align: "right", value: (row) => String(row.count) },
      { header: "Total", widthRatio: 0.34, align: "right", value: (row) => formatCurrency(row.total) },
    ],
  );
};

const renderBudgetVariance = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeTable(
    doc,
    "Budget Variance Report",
    payload.budgetVariance,
    [
      { header: "Project", widthRatio: 0.31, value: (row) => row.projectName },
      { header: "Contract", widthRatio: 0.23, align: "right", value: (row) => formatCurrency(row.contractValue) },
      { header: "Spent", widthRatio: 0.20, align: "right", value: (row) => formatCurrency(row.totalSpent) },
      { header: "Variance", widthRatio: 0.16, align: "right", value: (row) => formatCurrency(row.variance) },
      { header: "Used", widthRatio: 0.10, align: "right", value: (row) => `${row.variancePct}%` },
    ],
  );
};

const getReportTypeTitle = (reportType: PdfReportType): string => {
  switch (reportType) {
    case "project-cost-summary":
      return "Project Cost Summary";
    case "income-expense":
      return "Income vs Expense";
    case "payments":
      return "Payment Collection";
    case "labor":
      return "Labor Cost";
    case "materials":
      return "Material Cost";
    case "expenses-by-category":
      return "Expense by Category";
    case "budget-variance":
      return "Budget Variance";
    default:
      return "Comprehensive Financial";
  }
};

const buildPdfReport = (
  reportType: PdfReportType,
  payload: ReportsPayload,
  branding: ReportBranding,
  filters: ReportFilters,
): Promise<{ filename: string; data: Buffer }> =>
  new Promise((resolve, reject) => {
    const timestamp = new Date();
    const dateToken = timestamp.toISOString().slice(0, 10);
    const reportToken = toSafeFileToken(getReportTypeTitle(reportType));
    const projectScopeLabel = filters.projectId
      ? payload.projectCostSummary[0]?.projectName ?? "Selected Project"
      : "All Projects";
    const scopeToken = filters.projectId
      ? toSafeFileToken(projectScopeLabel)
      : "all-projects";
    const filename = `report-${reportToken}-${scopeToken}-${dateToken}.pdf`;

    const doc = new PDFDocument({ size: "A4", margin: PDF_MARGIN });
    doc.info.Title = `${branding.companyName} ${getReportTypeTitle(reportType)} Report`;
    doc.info.Author = branding.companyName;
    doc.info.Subject = "Project Financial Report";
    doc.info.Keywords = "DREGGAM, Engineering, Project Report";

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => {
      resolve({ filename, data: Buffer.concat(chunks) });
    });
    doc.on("error", (error) => {
      reject(error);
    });

    try {
      renderReportHeader(
        doc,
        branding,
        getReportTypeTitle(reportType),
        timestamp,
        projectScopeLabel,
        filters,
      );

      renderSummaryBlock(doc, payload);

      if (reportType === "comprehensive" || reportType === "project-cost-summary") {
        renderProjectCostSummary(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "income-expense") {
        renderIncomeExpense(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "payments") {
        renderPayments(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "labor") {
        renderLabor(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "materials") {
        renderMaterials(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "expenses-by-category") {
        renderExpenseCategories(doc, payload);
      }
      if (reportType === "comprehensive" || reportType === "budget-variance") {
        renderBudgetVariance(doc, payload);
      }

      doc
        .moveDown(1)
        .font("Times-Italic")
        .fontSize(10)
        .fillColor(REPORT_COLORS.slate600)
        .text("Prepared by DREGGAM Engineering Systems", {
          width: getContentWidth(doc),
          align: "center",
          lineGap: PDF_LINE_GAP,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const payload = await buildReportsPayload(companyId);
    const { _expenseCategoryRows: _omit, ...publicPayload } = payload;
    res.json(publicPayload);
  }),
);

router.get(
  "/pdf",
  handleAsync(async (req, res) => {
    const reportType = parseReportType(toQueryString(req.query.reportType));
    const projectIdRaw = toQueryString(req.query.projectId);
    const categoryRaw = toQueryString(req.query.category);
    const fromDateRaw = toQueryString(req.query.fromDate);
    const toDateRaw = toQueryString(req.query.toDate);

    const fromDate = fromDateRaw.length > 0 ? fromDateRaw : null;
    const toDate = toDateRaw.length > 0 ? toDateRaw : null;

    if (fromDate && !isIsoDateLiteral(fromDate)) {
      res.status(400).json({ message: "fromDate must be in YYYY-MM-DD format." });
      return;
    }
    if (toDate && !isIsoDateLiteral(toDate)) {
      res.status(400).json({ message: "toDate must be in YYYY-MM-DD format." });
      return;
    }

    const companyId = await getSingleTenantCompanyId();
    const branding = await buildReportBranding(companyId);
    const payload = await buildReportsPayload(companyId);
    const filtered = applyReportFilters(payload, {
      projectId: projectIdRaw.length > 0 ? projectIdRaw : null,
      category: categoryRaw.length > 0 ? categoryRaw : null,
      fromDate,
      toDate,
    });

    const filters: ReportFilters = {
      projectId: projectIdRaw.length > 0 ? projectIdRaw : null,
      category: categoryRaw.length > 0 ? categoryRaw : null,
      fromDate,
      toDate,
    };

    const { filename, data } = await buildPdfReport(
      reportType,
      filtered,
      branding,
      filters,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(data.length));
    res.status(200).send(data);
  }),
);

export default router;
