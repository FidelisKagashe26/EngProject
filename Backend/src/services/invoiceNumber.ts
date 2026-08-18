import type { Queryable } from "../db/transaction";

export type InvoiceType = "Proforma" | "Invoice";

/**
 * Allocates the next invoice number for a company, atomically.
 *
 * The bump is a single atomic upsert (`INSERT ... ON CONFLICT DO UPDATE
 * RETURNING`), which locks the counter row for the duration, so two invoices
 * created at the same instant can never be handed the same number.
 *
 * Numbers look like `PRO-2026-0001` / `INV-2026-0001`: the prefix comes from the
 * company (configurable in Settings), then the issue year, then a 4-digit
 * sequence that restarts each year.
 */
export const nextInvoiceNumber = async (
  client: Queryable,
  companyId: number,
  type: InvoiceType,
  prefix: string,
  year: number,
): Promise<string> => {
  const bumped = await client.query<{ last_seq: number }>(
    `
    INSERT INTO engicost.invoice_counters (company_id, type, year, last_seq)
    VALUES ($1, $2, $3, 1)
    ON CONFLICT (company_id, type, year)
    DO UPDATE SET last_seq = engicost.invoice_counters.last_seq + 1
    RETURNING last_seq
    `,
    [companyId, type, year],
  );

  const seq = bumped.rows[0]?.last_seq ?? 1;
  const safePrefix = (prefix || (type === "Proforma" ? "PRO" : "INV")).trim();
  return `${safePrefix}-${year}-${String(seq).padStart(4, "0")}`;
};
