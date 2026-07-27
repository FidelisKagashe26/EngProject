/**
 * Every list a user picks from, defined once.
 *
 * Before this existed the same four payment methods were retyped in four
 * places and the same two supply sources in two, which is how they drifted.
 * Two rules keep the lists short:
 *
 * 1. If the system can work the value out — whether a project is over budget,
 *    whether a requirement has been delivered, whether a payment is complete —
 *    it is shown as a computed badge, never offered as a choice.
 * 2. One concept, one word, one list.
 *
 * Mirrors `Backend/src/constants/vocabulary.ts`; keep the two in step.
 */

export const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Mobile Money",
  "Cheque",
] as const;

/**
 * Project states a user may set directly.
 *
 * "Completed"/"Closed" are missing on purpose: closing reconciles the project's
 * books and records who closed it, so it happens through the Close Project
 * action rather than by editing a field. "Over Budget" and "Payment Pending"
 * are missing because both are computed from the project's own figures.
 */
export const PROJECT_STATUSES = ["Draft", "Active", "On Hold"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** States the system sets when a project is closed; never user-selectable. */
export const CLOSED_PROJECT_STATUSES = ["Completed", "Closed"] as const;

export const isClosedProjectStatus = (status: string): boolean =>
  CLOSED_PROJECT_STATUSES.some((closed) => closed === status);

export const MATERIAL_SUPPLY_SOURCES = [
  "Company Purchased",
  "Client Supplied",
] as const;

export const MATERIAL_UNITS = [
  "Bags",
  "Pieces",
  "Lengths",
  "Meters",
  "Kilograms",
  "Liters",
  "Tonnes",
  "Cubic Meters",
  "Square Meters",
  "Rolls",
  "Trips",
  "Gallons",
  "Boxes",
  "Dozens",
] as const;

export const MATERIAL_DELIVERY_STATUSES = [
  "Pending Delivery",
  "Partially Delivered",
  "Delivered",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export const EQUIPMENT_CONDITIONS = [
  "Good",
  "Fair",
  "Needs Repair",
  "Damaged",
] as const;

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

export const PETTY_CASH_RECONCILIATION = ["Pending", "Reconciled"] as const;

export const WORKER_PAYMENT_TYPES = [
  "Hourly",
  "Daily",
  "Weekly",
  "Monthly",
  "Contract",
] as const;
