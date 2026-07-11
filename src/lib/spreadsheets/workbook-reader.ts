// Perilla 12 — server-side workbook reader (the only untrusted-XLSX parse
// path in the codebase).
//
// Replaces the vulnerable xlsx@0.18.5 parser with exceljs behind the
// internal SpreadsheetWorkbook contract (types.ts). Order of operations:
//
//   1. buffer bounds + zip signature      (security.assertSpreadsheetBuffer)
//   2. archive inspection — macros, external links, OLE, zip-bomb cap
//      (security.inspectSpreadsheetArchive; nothing is inflated yet)
//   3. exceljs parse inside the prototype-pollution canary and a deadline
//   4. normalization with sheet/row/column/cell-length caps
//
// Formulas are NEVER evaluated: a formula cell contributes only the cached
// result stored in the file. Hyperlink targets are never fetched. Errors
// surface as SpreadsheetSecurityError only — library internals stay here.

import ExcelJS from "exceljs";
import {
  PrototypePollutionError,
  withPrototypePollutionGuardAsync,
} from "@/lib/security/prototype-pollution-guard";
import { resolveSpreadsheetLimits, type SpreadsheetLimits } from "./limits";
import {
  SpreadsheetSecurityError,
  assertSpreadsheetBuffer,
  inspectSpreadsheetArchive,
  toSafeSpreadsheetError,
} from "./security";
import type { SpreadsheetSheet, SpreadsheetWorkbook } from "./types";

type CellValue = ExcelJS.CellValue;

const isRichText = (value: object): value is ExcelJS.CellRichTextValue => "richText" in value;
const isHyperlink = (value: object): value is ExcelJS.CellHyperlinkValue => "hyperlink" in value;
const isFormula = (value: object): value is ExcelJS.CellFormulaValue | ExcelJS.CellSharedFormulaValue =>
  "formula" in value || "sharedFormula" in value;
const isErrorValue = (value: object): value is ExcelJS.CellErrorValue => "error" in value;

// Normalize a cell to display text. Dates → ISO-8601 (dates without a time
// component keep only the date part); formulas → cached result only.
export function normalizeCellValue(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof value === "object") {
    if (isRichText(value)) return value.richText.map((run) => run.text).join("");
    if (isFormula(value)) {
      const cached = (value as { result?: CellValue }).result;
      if (cached && typeof cached === "object" && "error" in cached) return String(cached.error);
      return normalizeCellValue(cached as CellValue);
    }
    if (isHyperlink(value)) return typeof value.text === "string" ? value.text : normalizeCellValue(value.text);
    if (isErrorValue(value)) return String(value.error);
  }
  return "";
}

function normalizeSheet(worksheet: ExcelJS.Worksheet, limits: SpreadsheetLimits): SpreadsheetSheet {
  if (worksheet.rowCount > limits.maxRowsPerSheet) throw new SpreadsheetSecurityError("row_limit_exceeded");
  if (worksheet.columnCount > limits.maxColumns) throw new SpreadsheetSecurityError("column_limit_exceeded");

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as CellValue[]; // 1-based sparse array from exceljs
    const cells: string[] = [];
    for (let column = 1; column < values.length; column += 1) {
      const text = normalizeCellValue(values[column]);
      if (text.length > limits.maxCellLength) throw new SpreadsheetSecurityError("cell_length_limit_exceeded");
      cells.push(text);
    }
    if (cells.some((cell) => cell.trim().length > 0)) rows.push(cells);
  });
  return { name: worksheet.name, rows };
}

async function parseWithDeadline(buffer: Buffer, limits: SpreadsheetLimits): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SpreadsheetSecurityError("parse_timeout")), limits.parseTimeoutMs);
  });
  try {
    await Promise.race([workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer), deadline]);
  } finally {
    clearTimeout(timer);
  }
  return workbook;
}

/**
 * Parse an untrusted XLSX buffer into the normalized internal shape.
 * Throws SpreadsheetSecurityError (safe message + code) or
 * PrototypePollutionError; never a raw library error.
 */
export async function readSpreadsheetWorkbook(
  buffer: Buffer,
  limits: SpreadsheetLimits = resolveSpreadsheetLimits(),
): Promise<SpreadsheetWorkbook> {
  assertSpreadsheetBuffer(buffer, limits);
  await inspectSpreadsheetArchive(buffer, limits);

  try {
    return await withPrototypePollutionGuardAsync("spreadsheet_workbook_read", async () => {
      const workbook = await parseWithDeadline(buffer, limits);
      if (workbook.worksheets.length > limits.maxSheets) throw new SpreadsheetSecurityError("sheet_limit_exceeded");
      return { sheets: workbook.worksheets.map((worksheet) => normalizeSheet(worksheet, limits)) };
    });
  } catch (error) {
    if (error instanceof PrototypePollutionError) throw error;
    throw toSafeSpreadsheetError(error);
  }
}
