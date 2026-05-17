import type { Response } from "express";
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
  category: string;
  total: number;
  count: number;
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

const parseMonthLabel = (label: string): Date | null => {
  const [monthToken, yearToken] = label.split(" ");
  const month = monthIndex[monthToken ?? ""];
  const year = Number(yearToken);
  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  return new Date(Date.UTC(year, month, 1));
};

const buildReportsPayload = async (companyId: number): Promise<ReportsPayload> => {
  const [
    projectSummaryResult,
    laborSummaryResult,
    materialSummaryResult,
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
    db.query<{ project_id: string | null; category: string; total: string; count: string }>(
      `
      SELECT
        project_id,
        category,
        COALESCE(SUM(amount), 0)::text AS total,
        COUNT(*)::text AS count
      FROM engicost.expenses
      WHERE company_id = $1
      GROUP BY project_id, category
      ORDER BY SUM(amount) DESC
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
  filters: {
    projectId: string | null;
    category: string | null;
    fromDate: string | null;
    toDate: string | null;
  },
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
    expenseByProject: payload.expenseByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    paymentByProject: payload.paymentByProject.filter((row) =>
      matchProject(row.projectId, row.projectName)),
    expenseByCategory,
    _expenseCategoryRows: expenseByCategoryRows,
    monthlyExpenseTrend,
    budgetVariance: payload.budgetVariance.filter((row) =>
      projectName ? row.projectName === projectName : true),
  };
};

const ensureRoom = (doc: PDFKit.PDFDocument, requiredHeight = 22): void => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
  }
};

const writeSectionTitle = (doc: PDFKit.PDFDocument, title: string): void => {
  ensureRoom(doc, 28);
  doc
    .moveDown(0.4)
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#0b2a53")
    .text(title)
    .moveDown(0.15);
};

const writeLine = (doc: PDFKit.PDFDocument, text: string): void => {
  ensureRoom(doc, 18);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#1e293b")
    .text(text, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
};

const writeNoData = (doc: PDFKit.PDFDocument): void => {
  writeLine(doc, "No data available for the selected criteria.");
};

const renderSummaryBlock = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Income & Expense Summary");
  writeLine(doc, `Total Contract Value: ${formatCurrency(payload.totals.contractValue)}`);
  writeLine(doc, `Total Income Received: ${formatCurrency(payload.totals.amountReceived)}`);
  writeLine(doc, `Total Expenses: ${formatCurrency(payload.totals.totalSpent)}`);
  writeLine(doc, `Estimated Profit/Loss: ${formatCurrency(payload.totals.estimatedProfitLoss)}`);
  writeLine(doc, `Outstanding Balance: ${formatCurrency(payload.totals.remainingBalance)}`);
};

const renderProjectCostSummary = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Project Cost Summary");
  if (payload.projectCostSummary.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.projectCostSummary.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} (${row.id}) | Income: ${formatCurrency(row.amountReceived)} | Expenses: ${formatCurrency(row.totalSpent)} | Profit/Loss: ${formatCurrency(row.estimatedProfitLoss)} | Status: ${row.status}`,
    );
  });
};

const renderIncomeExpense = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Income vs Expense Statement");
  if (payload.projectCostSummary.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.projectCostSummary.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} | Income: ${formatCurrency(row.amountReceived)} | Expenses: ${formatCurrency(row.totalSpent)} | Net: ${formatCurrency(row.estimatedProfitLoss)}`,
    );
  });
  if (payload.monthlyExpenseTrend.length > 0) {
    writeSectionTitle(doc, "Monthly Expense Trend");
    payload.monthlyExpenseTrend.forEach((row) => {
      writeLine(doc, `${row.month}: ${formatCurrency(row.total)}`);
    });
  }
};

const renderPayments = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Client Payment Collection Report");
  if (payload.paymentByProject.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.paymentByProject.forEach((row, index) => {
    const rate =
      row.totalExpected > 0
        ? `${Math.round((row.totalReceived / row.totalExpected) * 100)}%`
        : "0%";
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} | Expected: ${formatCurrency(row.totalExpected)} | Received: ${formatCurrency(row.totalReceived)} | Balance: ${formatCurrency(row.totalBalance)} | Collection Rate: ${rate}`,
    );
  });
};

const renderLabor = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Labor Cost Report");
  if (payload.laborByProject.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.laborByProject.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} | Workers: ${row.workerCount} | Paid: ${formatCurrency(row.totalPaid)} | Outstanding: ${formatCurrency(row.outstanding)}`,
    );
  });
};

const renderMaterials = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Material Purchase Report");
  if (payload.materialByProject.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.materialByProject.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} | Purchases: ${row.purchaseCount} | Total Cost: ${formatCurrency(row.totalCost)}`,
    );
  });
};

const renderExpenseCategories = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Expense Category Report");
  if (payload.expenseByCategory.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.expenseByCategory.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.category} | Entries: ${row.count} | Total: ${formatCurrency(row.total)}`,
    );
  });
};

const renderBudgetVariance = (doc: PDFKit.PDFDocument, payload: ReportsPayload): void => {
  writeSectionTitle(doc, "Budget Variance Report");
  if (payload.budgetVariance.length === 0) {
    writeNoData(doc);
    return;
  }
  payload.budgetVariance.forEach((row, index) => {
    writeLine(
      doc,
      `${index + 1}. ${row.projectName} | Contract: ${formatCurrency(row.contractValue)} | Spent: ${formatCurrency(row.totalSpent)} | Variance: ${formatCurrency(row.variance)} | Used: ${row.variancePct}%`,
    );
  });
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

const renderPdfReport = (
  res: Response,
  reportType: PdfReportType,
  payload: ReportsPayload,
  filters: {
    projectId: string | null;
    category: string | null;
    fromDate: string | null;
    toDate: string | null;
  },
): void => {
  const timestamp = new Date();
  const dateToken = timestamp.toISOString().slice(0, 10);
  const reportToken = toSafeFileToken(getReportTypeTitle(reportType));
  const projectScopeLabel = filters.projectId
    ? payload.projectCostSummary[0]?.projectName ?? filters.projectId
    : "All Projects";
  const scopeToken = filters.projectId
    ? toSafeFileToken(projectScopeLabel)
    : "all-projects";
  const filename = `report-${reportToken}-${scopeToken}-${dateToken}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 42 });
  doc.pipe(res);

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#0b2a53")
    .text("Nexivo Engineering Project Report");
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#334155")
    .text(`Report Type: ${getReportTypeTitle(reportType)}`)
    .text(`Generated: ${timestamp.toISOString()}`)
    .text(`Project Scope: ${projectScopeLabel}`);
  if (filters.category) {
    doc.text(`Category Filter: ${filters.category}`);
  }
  if (filters.fromDate || filters.toDate) {
    doc.text(`Date Window: ${filters.fromDate ?? "N/A"} to ${filters.toDate ?? "N/A"}`);
  }

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
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#64748b")
    .text("End of report");

  doc.end();
};

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
    const payload = await buildReportsPayload(companyId);
    const filtered = applyReportFilters(payload, {
      projectId: projectIdRaw.length > 0 ? projectIdRaw : null,
      category: categoryRaw.length > 0 ? categoryRaw : null,
      fromDate,
      toDate,
    });

    renderPdfReport(res, reportType, filtered, {
      projectId: projectIdRaw.length > 0 ? projectIdRaw : null,
      category: categoryRaw.length > 0 ? categoryRaw : null,
      fromDate,
      toDate,
    });
  }),
);

export default router;
