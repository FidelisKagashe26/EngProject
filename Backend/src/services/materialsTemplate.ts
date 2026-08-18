import ExcelJS from "exceljs";
import { MATERIAL_SUPPLY_SOURCES, PRIORITIES } from "../constants/vocabulary";

/**
 * Bulk material-requirement import via Excel. One sheet, one row per material a
 * project needs. The header labels below are the contract: the parser matches
 * columns by these (normalised) names, so a user can reorder columns freely.
 */
export const REQUIREMENT_COLUMNS = [
  "Material Name",
  "Required Quantity",
  "Unit",
  "Estimated Unit Cost",
  "Supply Source",
  "Priority",
  "Needed By Date (YYYY-MM-DD)",
  "Notes",
] as const;

export type RawRequirementRow = {
  materialName: string;
  requiredQuantity: number;
  unit: string;
  estimatedUnitCost: number;
  supplySource: string;
  priority: string;
  neededByDate: string;
  notes: string;
};

const normalise = (value: unknown): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Build the blank template (headers + two example rows + a guidance note). */
export const buildRequirementsTemplate = async (): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Materials");

  sheet.columns = REQUIREMENT_COLUMNS.map((header) => ({
    header,
    key: header,
    width: header.length < 14 ? 16 : header.length + 4,
  }));

  // Bold header row.
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };

  // Two example rows so the expected shape is obvious.
  sheet.addRow([
    "Cement (Simenti)", 100, "Bags", 18000, "Company Purchased", "High", "", "Structural works",
  ]);
  sheet.addRow([
    "Electrical Wire (Waya)", 200, "Meters", 1500, "Client Supplied", "Low", "", "",
  ]);

  // A second sheet documenting the allowed values.
  const guide = workbook.addWorksheet("Guide");
  guide.addRow(["Column", "Notes / allowed values"]);
  guide.getRow(1).font = { bold: true };
  guide.addRow(["Material Name", "Required. The material's name."]);
  guide.addRow(["Required Quantity", "Required. A number, e.g. 100."]);
  guide.addRow(["Unit", "Required, e.g. Bags, Pieces, Meters, Trips."]);
  guide.addRow(["Estimated Unit Cost", "Optional. Your cost per unit (not the client price). Used to book spend when invoiced."]);
  guide.addRow(["Supply Source", MATERIAL_SUPPLY_SOURCES.join(" | ")]);
  guide.addRow(["Priority", PRIORITIES.join(" | ")]);
  guide.addRow(["Needed By Date", "Optional. Format YYYY-MM-DD, e.g. 2026-09-30."]);
  guide.addRow(["Notes", "Optional free text."]);
  guide.columns = [{ width: 22 }, { width: 70 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
};

/**
 * Parse an uploaded workbook into raw rows keyed by our column names. Columns
 * are matched by header (case/spacing-insensitive); empty rows are skipped.
 * Validation/coercion happens in the route so it can report per-row errors.
 */
export const parseRequirementsWorkbook = async (
  buffer: Buffer,
): Promise<RawRequirementRow[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  // Map each wanted column to its 1-based position from the header row.
  const headerRow = sheet.getRow(1);
  const wanted: Record<keyof RawRequirementRow, string> = {
    materialName: "Material Name",
    requiredQuantity: "Required Quantity",
    unit: "Unit",
    estimatedUnitCost: "Estimated Unit Cost",
    supplySource: "Supply Source",
    priority: "Priority",
    neededByDate: "Needed By Date (YYYY-MM-DD)",
    notes: "Notes",
  };
  const colIndex: Partial<Record<keyof RawRequirementRow, number>> = {};
  headerRow.eachCell((cell, col) => {
    const key = normalise(cell.value);
    for (const [field, label] of Object.entries(wanted) as [keyof RawRequirementRow, string][]) {
      // Match on a normalised prefix so "Needed By Date (YYYY-MM-DD)" still maps.
      if (key === normalise(label) || key.startsWith(normalise(field))) {
        colIndex[field] = col;
      }
    }
  });

  const cellText = (row: ExcelJS.Row, field: keyof RawRequirementRow): string => {
    const idx = colIndex[field];
    if (!idx) return "";
    const value = row.getCell(idx).value;
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "object" && "text" in (value as { text?: unknown })) {
      return String((value as { text?: unknown }).text ?? "");
    }
    if (typeof value === "object" && "result" in (value as { result?: unknown })) {
      return String((value as { result?: unknown }).result ?? "");
    }
    return String(value);
  };

  const num = (text: string): number => {
    const cleaned = text.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const rows: RawRequirementRow[] = [];
  const lastRow = sheet.rowCount;
  for (let r = 2; r <= lastRow; r += 1) {
    const row = sheet.getRow(r);
    const materialName = cellText(row, "materialName").trim();
    // Skip fully-blank rows.
    if (!materialName && !cellText(row, "requiredQuantity").trim() && !cellText(row, "unit").trim()) {
      continue;
    }
    rows.push({
      materialName,
      requiredQuantity: num(cellText(row, "requiredQuantity")),
      unit: cellText(row, "unit").trim(),
      estimatedUnitCost: num(cellText(row, "estimatedUnitCost")),
      supplySource: cellText(row, "supplySource").trim(),
      priority: cellText(row, "priority").trim(),
      neededByDate: cellText(row, "neededByDate").trim(),
      notes: cellText(row, "notes").trim(),
    });
  }
  return rows;
};
