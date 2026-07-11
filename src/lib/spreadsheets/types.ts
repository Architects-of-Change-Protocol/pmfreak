// Perilla 12 — internal spreadsheet contract.
//
// Everything outside src/lib/spreadsheets/ depends on these shapes, never on
// the underlying library (exceljs). tests/spreadsheet-dependency-boundary
// enforces that no other module imports the vendor package directly, so the
// engine can be swapped again without touching product code.

/** One parsed worksheet: ordered rows of normalized display text. */
export interface SpreadsheetSheet {
  name: string;
  /**
   * Row-major cell text. Formulas are never evaluated — a formula cell
   * contributes its cached result (or "" when none was stored). Dates are
   * normalized to ISO-8601 strings. Blank rows are omitted.
   */
  rows: string[][];
}

export interface SpreadsheetWorkbook {
  /** Sheets in workbook order, names preserved. */
  sheets: SpreadsheetSheet[];
}

/** Column definition for workbook export. */
export interface SpreadsheetExportColumn {
  header: string;
  key: string;
  /** Approximate column width in characters (like Excel's column width). */
  width?: number;
}

export interface SpreadsheetExportInput {
  sheetName: string;
  columns: SpreadsheetExportColumn[];
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
}
