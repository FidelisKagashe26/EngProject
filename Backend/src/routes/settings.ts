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

router.get(
  "/",
  handleAsync(async (_req, res) => {
    const companyId = await getSingleTenantCompanyId();
    const companyResult = await db.query<{
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      location: string | null;
      currency: string;
      enforce_cash_limit: boolean;
    }>(
      `
      SELECT id, name, email, phone, location, currency, enforce_cash_limit
      FROM engicost.companies
      WHERE id = $1
      LIMIT 1
      `,
      [companyId],
    );

    const company = companyResult.rows[0];

    res.json({
      singleTenantMode: true,
      company: {
        id: company.id,
        name: company.name,
        email: company.email ?? "",
        phone: company.phone ?? "",
        location: company.location ?? "",
        currency: company.currency,
        enforceCashLimit: company.enforce_cash_limit,
      },
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

    const updated = await db.query<{
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      location: string | null;
      currency: string;
      enforce_cash_limit: boolean;
    }>(
      `
      UPDATE engicost.companies
      SET
        name = $2,
        email = $3,
        phone = $4,
        location = $5,
        currency = $6,
        enforce_cash_limit = COALESCE($7, enforce_cash_limit)
      WHERE id = $1
      RETURNING id, name, email, phone, location, currency, enforce_cash_limit
      `,
      [
        companyId,
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.location,
        parsed.currency,
        parsed.enforceCashLimit ?? null,
      ],
    );

    res.json({
      id: updated.rows[0].id,
      name: updated.rows[0].name,
      email: updated.rows[0].email ?? "",
      phone: updated.rows[0].phone ?? "",
      location: updated.rows[0].location ?? "",
      currency: updated.rows[0].currency,
      enforceCashLimit: updated.rows[0].enforce_cash_limit,
    });
  }),
);

export default router;

