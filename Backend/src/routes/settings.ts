import { Router } from "express";
import { z } from "zod";
import { getSingleTenantCompanyId } from "../db/init";
import { db } from "../db/pool";
import { handleAsync } from "./utils";

const router = Router();

const companySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  location: z.string().min(2),
  currency: z.string().min(2).default("TZS"),
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
    }>(
      `
      SELECT id, name, email, phone, location, currency
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
      },
      expenseCategories,
      materialUnits,
      paymentMethods,
    });
  }),
);

router.put(
  "/company",
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
    }>(
      `
      UPDATE engicost.companies
      SET
        name = $2,
        email = $3,
        phone = $4,
        location = $5,
        currency = $6
      WHERE id = $1
      RETURNING id, name, email, phone, location, currency
      `,
      [
        companyId,
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.location,
        parsed.currency,
      ],
    );

    res.json({
      id: updated.rows[0].id,
      name: updated.rows[0].name,
      email: updated.rows[0].email ?? "",
      phone: updated.rows[0].phone ?? "",
      location: updated.rows[0].location ?? "",
      currency: updated.rows[0].currency,
    });
  }),
);

export default router;

