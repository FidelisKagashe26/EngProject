import type { PoolClient } from "pg";
import { makeId } from "../db/ids";
import { nextInvoiceNumber } from "./invoiceNumber";

const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Add a just-recorded material purchase to the project's open DRAFT auto-invoice
 * as a billing line, or start a fresh draft when there isn't an open one for
 * that day. Design choices (deliberate):
 *
 *  • Grouping is by project + purchase date: materials bought together (same
 *    day) land on one draft; a new day starts a new draft. Only unpaid drafts
 *    are appended to, so a paid one is never reopened.
 *  • The client price starts at the material's cost as a placeholder — the user
 *    edits it before sending. Cost and revenue stay separate; no payment is
 *    recorded here.
 *  • The line carries NO requirement_id, so paying the invoice never re-books
 *    the material: its cost is already on the project from the purchase itself.
 *
 * Runs inside the caller's transaction; never called for Client-Supplied
 * materials (there is nothing to bill the client for those).
 */
export const appendPurchaseToAutoInvoice = async (
  client: PoolClient,
  params: {
    companyId: number;
    projectId: string;
    materialName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    purchaseDate: string;
    createdBy: string;
  },
): Promise<void> => {
  const { companyId, projectId, materialName, quantity, unit, unitCost, purchaseDate, createdBy } =
    params;
  const lineAmount = round2(quantity * unitCost);
  const day = purchaseDate.slice(0, 10);

  // Find the project's open (unpaid) draft auto-invoice for this purchase day.
  const existing = await client.query<{
    id: string;
    discount_amount: string;
    vat_rate: string;
  }>(
    `
    SELECT i.id, i.discount_amount::text, i.vat_rate::text
    FROM engicost.invoices i
    WHERE i.company_id = $1 AND i.project_id = $2
      AND i.type = 'Invoice' AND i.status = 'Draft'
      AND i.auto_generated = TRUE AND i.is_deleted = FALSE
      AND i.issue_date = $3
      AND COALESCE((
        SELECT SUM(cp.amount_received) FROM engicost.client_payments cp
        WHERE cp.invoice_id = i.id AND cp.is_deleted = FALSE
      ), 0) = 0
    ORDER BY i.created_at DESC
    LIMIT 1
    `,
    [companyId, projectId, day],
  );

  let invoiceId: string;
  let discount = 0;
  let vatRate = 0;

  if (existing.rowCount && existing.rows[0]) {
    invoiceId = existing.rows[0].id;
    discount = Number(existing.rows[0].discount_amount) || 0;
    vatRate = Number(existing.rows[0].vat_rate) || 0;
  } else {
    // Start a fresh draft, pulling client details from the project.
    const proj = await client.query<{
      client_name: string;
      client_phone: string;
      client_email: string;
      client_tin: string;
    }>(
      `SELECT client_name, client_phone, client_email, client_tin
       FROM engicost.projects WHERE company_id = $1 AND id = $2`,
      [companyId, projectId],
    );
    const p = proj.rows[0];
    const clientContact = [p?.client_phone, p?.client_email]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" · ");

    const company = await client.query<{ currency: string; invoice_tax_prefix: string }>(
      `SELECT currency, invoice_tax_prefix FROM engicost.companies WHERE id = $1`,
      [companyId],
    );
    const currency = company.rows[0]?.currency || "TZS";
    const prefix = company.rows[0]?.invoice_tax_prefix || "INV";
    const year = Number(day.slice(0, 4)) || new Date().getUTCFullYear();
    const number = await nextInvoiceNumber(client, companyId, "Invoice", prefix, year);
    invoiceId = makeId("INV");

    await client.query(
      `
      INSERT INTO engicost.invoices (
        id, company_id, project_id, type, number, status,
        client_name, client_address, client_contact, client_tin,
        issue_date, currency, subtotal, discount_amount, vat_rate, vat_amount, total,
        notes, terms, auto_generated, materials_received, created_by
      ) VALUES (
        $1, $2, $3, 'Invoice', $4, 'Draft',
        $5, '', $6, $7,
        $8, $9, 0, 0, 0, 0, 0,
        '', '', TRUE, FALSE, $10
      )
      `,
      [
        invoiceId,
        companyId,
        projectId,
        number,
        p?.client_name ?? "",
        clientContact,
        p?.client_tin ?? "",
        day,
        currency,
        createdBy,
      ],
    );
  }

  // Append the billing line. No requirement_id → paying never re-books the cost.
  const sortResult = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM engicost.invoice_items WHERE company_id = $1 AND invoice_id = $2`,
    [companyId, invoiceId],
  );
  const sort = Number(sortResult.rows[0]?.n) || 0;

  await client.query(
    `
    INSERT INTO engicost.invoice_items
      (id, company_id, invoice_id, description, quantity, unit, unit_price, amount, sort_order, requirement_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
    `,
    [makeId("INL"), companyId, invoiceId, materialName, quantity, unit, unitCost, lineAmount, sort],
  );

  // Recompute the invoice money from all its lines (keeping any discount/VAT).
  const sums = await client.query<{ subtotal: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS subtotal
     FROM engicost.invoice_items WHERE company_id = $1 AND invoice_id = $2`,
    [companyId, invoiceId],
  );
  const subtotal = round2(Number(sums.rows[0]?.subtotal) || 0);
  const taxable = Math.max(subtotal - discount, 0);
  const vatAmount = vatRate > 0 ? round2((taxable * vatRate) / 100) : 0;
  const total = round2(taxable + vatAmount);

  await client.query(
    `
    UPDATE engicost.invoices
    SET subtotal = $3, vat_amount = $4, total = $5, updated_at = NOW()
    WHERE company_id = $1 AND id = $2
    `,
    [companyId, invoiceId, subtotal, vatAmount, total],
  );
};
