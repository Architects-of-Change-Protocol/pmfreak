// Perilla 12 — workbook writer for internally generated exports.
//
// Used from the browser (requirement-matrix download) but kept DOM-free
// except for triggerWorkbookDownload so tests can exercise the blob path
// under Node. exceljs is loaded lazily so the export engine stays out of
// the initial client bundle.
//
// Security: every string cell (headers included) passes through
// sanitizeCellForExport — exported values derived from uploaded documents
// must never open as live formulas/DDE payloads in a desktop spreadsheet
// (docs/security/spreadsheet-processing-boundary.md).

import { sanitizeCellForExport } from "./security";
import type { SpreadsheetExportInput } from "./types";

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const sanitizeValue = (value: string | number | boolean | null | undefined) =>
  typeof value === "string" ? sanitizeCellForExport(value) : value ?? "";

export async function createWorkbookBlob(input: SpreadsheetExportInput): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(input.sheetName);

  worksheet.columns = input.columns.map((column) => ({
    header: sanitizeCellForExport(column.header),
    key: column.key,
    width: column.width,
  }));

  for (const row of input.rows) {
    worksheet.addRow(
      Object.fromEntries(input.columns.map((column) => [column.key, sanitizeValue(row[column.key])])),
    );
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([arrayBuffer], { type: XLSX_MIME_TYPE });
}

/** Browser-only: build the workbook and trigger a file download. */
export async function downloadWorkbook(fileName: string, input: SpreadsheetExportInput): Promise<void> {
  const blob = await createWorkbookBlob(input);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
