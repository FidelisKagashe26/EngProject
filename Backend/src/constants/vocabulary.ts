/**
 * Shared vocabularies for values the user picks from a dropdown.
 *
 * Two rules keep these lists honest, and both exist because breaking them is
 * what made the UI confusing in the first place:
 *
 * 1. A value belongs here only if a human chooses it. Anything the system can
 *    work out for itself — whether a project is over budget, whether a
 *    requirement has been delivered — is derived at read time, never stored and
 *    never offered as an option.
 * 2. One concept, one word. The same list must not be retyped per page with
 *    small differences.
 *
 * The frontend mirrors these in `src/constants/options.ts`; keep the two in
 * step.
 */

/** How a payment left or entered the business. */
export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Mobile Money",
  "Cheque",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Project states a user may set directly.
 *
 * "Completed"/"Closed" are deliberately absent: closing a project reconciles
 * its books and records who closed it and when, so it happens through
 * POST /projects/:id/close rather than by editing a field. "Over Budget" and
 * "Payment Pending" are absent because both are computed from the project's own
 * figures — storing them let a project claim to be on budget while its numbers
 * said otherwise.
 */
export const SELECTABLE_PROJECT_STATUSES = ["Draft", "Active", "On Hold"] as const;

export type SelectableProjectStatus = (typeof SELECTABLE_PROJECT_STATUSES)[number];

export const isSelectableProjectStatus = (value: string): value is SelectableProjectStatus =>
  SELECTABLE_PROJECT_STATUSES.some((status) => status === value);

/** Who pays for the material: us, or the client handing it over on site. */
export const MATERIAL_SUPPLY_SOURCES = ["Company Purchased", "Client Supplied"] as const;

export type MaterialSupplySource = (typeof MATERIAL_SUPPLY_SOURCES)[number];

/** How much of a purchase has physically arrived on site. */
export const MATERIAL_DELIVERY_STATUSES = [
  "Pending Delivery",
  "Partially Delivered",
  "Delivered",
] as const;

export type MaterialDeliveryStatus = (typeof MATERIAL_DELIVERY_STATUSES)[number];

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export const EQUIPMENT_CONDITIONS = ["Good", "Fair", "Needs Repair", "Damaged"] as const;

export const EQUIPMENT_OWNERSHIP = ["Owned", "Rented"] as const;

export const EQUIPMENT_STATUSES = [
  "In Use",
  "Idle",
  "Under Maintenance",
  "Out of Use",
] as const;

export const CLIENT_PAYMENT_TYPES = [
  "Advance",
  "Milestone",
  "Stage",
  "Final",
  "Other",
] as const;

export const PETTY_CASH_TYPES = ["Cash Out", "Cash In"] as const;

/** Whether a petty cash entry has been checked against the physical float. */
export const PETTY_CASH_RECONCILIATION = ["Pending", "Reconciled"] as const;
