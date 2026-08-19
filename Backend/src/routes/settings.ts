import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
import { requireAdmin } from "../middleware/auth";
import { handleAsync } from "./utils";

const router = Router();

const companySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  location: z.string().min(2),
  currency: z.string().min(2).default("TZS"),
  // When on, a project cannot be charged beyond what the client has actually
  // paid in. Off by default — see the column comment in db/init.
  enforceCashLimit: z.boolean().optional(),
  // Billing identity + bank details printed on invoices. All optional; blank
  // fields are simply omitted from the printed invoice.
  tin: z.string().optional(),
  vrn: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranch: z.string().optional(),
  bankSwift: z.string().optional(),
  invoiceProformaPrefix: z.string().max(12).optional(),
  invoiceTaxPrefix: z.string().max(12).optional(),
  // Recurring text that auto-fills new invoices.
  defaultPaymentTerms: z.string().optional(),
  defaultInvoiceNotes: z.string().optional(),
  // Notification/Security toggle states, persisted as-is.
  systemPreferences: z.record(z.string(), z.boolean()).optional(),
});

const expenseCategories = [
  "Transport",
  "Fuel",
  "Machine Rental",
  "Accommodation",
  "Food Allowances",
  "Equipment Maintenance",
  "Communication",
  "Permits",
  "Miscellaneous",
];

const materialUnits = ["Bags", "Pieces", "Tonnes", "Litres", "Lengths", "Cubic Meter"];

const paymentMethods = ["Cash", "Bank Transfer", "Mobile Money", "Cheque", "Other"];

type CompanyRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  currency: string;
  enforce_cash_limit: boolean;
  tin: string;
  vrn: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  bank_swift: string;
  invoice_proforma_prefix: string;
  invoice_tax_prefix: string;
  default_payment_terms: string;
  default_invoice_notes: string;
  system_preferences: string;
};

const COMPANY_COLUMNS = `
  id, name, email, phone, location, currency, enforce_cash_limit,
  tin, vrn, bank_name, bank_account_name, bank_account_number, bank_branch, bank_swift,
  invoice_proforma_prefix, invoice_tax_prefix, default_payment_terms, default_invoice_notes,
  system_preferences
`;

const parseSystemPreferences = (raw: string | null): Record<string, boolean> => {
  try {
    const parsed = JSON.parse(raw ?? "{}");
    if (parsed && typeof parsed === "object") {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed)) out[k] = Boolean(v);
      return out;
    }
  } catch {
    /* fall through to empty */
  }
  return {};
};

const mapCompany = (row: CompanyRow) => ({
  id: row.id,
  name: row.name,
  email: row.email ?? "",
  phone: row.phone ?? "",
  location: row.location ?? "",
  currency: row.currency,
  enforceCashLimit: row.enforce_cash_limit,
  tin: row.tin ?? "",
  vrn: row.vrn ?? "",
  bankName: row.bank_name ?? "",
  bankAccountName: row.bank_account_name ?? "",
  bankAccountNumber: row.bank_account_number ?? "",
  bankBranch: row.bank_branch ?? "",
  bankSwift: row.bank_swift ?? "",
  invoiceProformaPrefix: row.invoice_proforma_prefix ?? "PRO",
  invoiceTaxPrefix: row.invoice_tax_prefix ?? "INV",
  defaultPaymentTerms: row.default_payment_terms ?? "",
  defaultInvoiceNotes: row.default_invoice_notes ?? "",
  systemPreferences: parseSystemPreferences(row.system_preferences),
});

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const companyResult = await db.query<CompanyRow>(
      `SELECT ${COMPANY_COLUMNS} FROM engicost.companies WHERE id = $1 LIMIT 1`,
      [companyId],
    );

    res.json({
      singleTenantMode: true,
      company: mapCompany(companyResult.rows[0]),
      expenseCategories,
      materialUnits,
      paymentMethods,
    });
  }),
);

router.put(
  "/company",
  requireAdmin,
  handleAsync(async (req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const parsed = companySchema.parse(req.body);

    const updated = await db.query<CompanyRow>(
      `
      UPDATE engicost.companies
      SET
        name = $2,
        email = $3,
        phone = $4,
        location = $5,
        currency = $6,
        enforce_cash_limit = COALESCE($7, enforce_cash_limit),
        tin = COALESCE($8, tin),
        vrn = COALESCE($9, vrn),
        bank_name = COALESCE($10, bank_name),
        bank_account_name = COALESCE($11, bank_account_name),
        bank_account_number = COALESCE($12, bank_account_number),
        bank_branch = COALESCE($13, bank_branch),
        bank_swift = COALESCE($14, bank_swift),
        invoice_proforma_prefix = COALESCE(NULLIF($15, ''), invoice_proforma_prefix),
        invoice_tax_prefix = COALESCE(NULLIF($16, ''), invoice_tax_prefix),
        default_payment_terms = COALESCE($17, default_payment_terms),
        default_invoice_notes = COALESCE($18, default_invoice_notes),
        system_preferences = COALESCE($19, system_preferences)
      WHERE id = $1
      RETURNING ${COMPANY_COLUMNS}
      `,
      [
        companyId,
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.location,
        parsed.currency,
        parsed.enforceCashLimit ?? null,
        parsed.tin ?? null,
        parsed.vrn ?? null,
        parsed.bankName ?? null,
        parsed.bankAccountName ?? null,
        parsed.bankAccountNumber ?? null,
        parsed.bankBranch ?? null,
        parsed.bankSwift ?? null,
        parsed.invoiceProformaPrefix ?? "",
        parsed.invoiceTaxPrefix ?? "",
        parsed.defaultPaymentTerms ?? null,
        parsed.defaultInvoiceNotes ?? null,
        parsed.systemPreferences ? JSON.stringify(parsed.systemPreferences) : null,
      ],
    );

    res.json(mapCompany(updated.rows[0]));
  }),
);

export default router;

