// Perilla 12 — spreadsheet security boundary.
//
// Every untrusted workbook goes through these checks before and after the
// actual parse (see workbook-reader.ts). Policy reference:
// docs/security/spreadsheet-processing-boundary.md.
//
//  * pre-parse:  size cap, zip magic, archive inspection (macros, external
//    workbook links, OLE embeddings, zip-bomb decompressed-size cap)
//  * post-parse: sheet/row/column/cell-length caps
//  * export:     formula-injection neutralization for cells that a desktop
//    spreadsheet application would otherwise interpret as executable
//
// Errors thrown here are safe to surface: a stable machine-readable code and
// a fixed message per code — never library internals, stack fragments, or
// file content.

import JSZip from "jszip";
import type { SpreadsheetLimits } from "./limits";

export type SpreadsheetSecurityCode =
  | "empty_file"
  | "file_too_large"
  | "not_a_spreadsheet"
  | "macro_content_rejected"
  | "external_links_rejected"
  | "embedded_objects_rejected"
  | "decompressed_size_limit"
  | "sheet_limit_exceeded"
  | "row_limit_exceeded"
  | "column_limit_exceeded"
  | "cell_length_limit_exceeded"
  | "parse_timeout"
  | "malformed_workbook";

const MESSAGE_BY_CODE: Record<SpreadsheetSecurityCode, string> = {
  empty_file: "The uploaded file is empty.",
  file_too_large: "The spreadsheet exceeds the maximum allowed file size.",
  not_a_spreadsheet: "The file is not a valid XLSX spreadsheet.",
  macro_content_rejected: "Macro-enabled workbooks are not supported.",
  external_links_rejected: "Workbooks with external workbook links are not supported.",
  embedded_objects_rejected: "Workbooks with embedded objects are not supported.",
  decompressed_size_limit: "The spreadsheet expands beyond the allowed size.",
  sheet_limit_exceeded: "The workbook contains too many sheets.",
  row_limit_exceeded: "A worksheet contains too many rows.",
  column_limit_exceeded: "A worksheet contains too many columns.",
  cell_length_limit_exceeded: "A cell exceeds the maximum allowed length.",
  parse_timeout: "The spreadsheet took too long to process.",
  malformed_workbook: "The spreadsheet could not be read. It may be corrupted.",
};

export class SpreadsheetSecurityError extends Error {
  readonly code: SpreadsheetSecurityCode;
  constructor(code: SpreadsheetSecurityCode) {
    super(MESSAGE_BY_CODE[code]);
    this.name = "SpreadsheetSecurityError";
    this.code = code;
  }
}

// XLSX files are ZIP archives: PK\x03\x04.
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const hasZipMagic = (buffer: Buffer): boolean =>
  buffer.length >= ZIP_MAGIC.length && ZIP_MAGIC.every((byte, index) => buffer[index] === byte);

/** Pre-parse buffer validation: bounds and format signature only. */
export function assertSpreadsheetBuffer(buffer: Buffer, limits: SpreadsheetLimits): void {
  if (buffer.length === 0) throw new SpreadsheetSecurityError("empty_file");
  if (buffer.length > limits.maxFileBytes) throw new SpreadsheetSecurityError("file_too_large");
  if (!hasZipMagic(buffer)) throw new SpreadsheetSecurityError("not_a_spreadsheet");
}

// Archive entries that must never be processed. VBA macros, external
// workbook links, and OLE embeddings are rejected outright rather than
// silently ignored — an untrusted workbook carrying them is treated as
// hostile (docs/security/spreadsheet-processing-boundary.md).
const REJECTED_ENTRY_PATTERNS: Array<{ pattern: RegExp; code: SpreadsheetSecurityCode }> = [
  { pattern: /vbaProject\.bin$/i, code: "macro_content_rejected" },
  { pattern: /^xl\/externalLinks\//i, code: "external_links_rejected" },
  { pattern: /^xl\/embeddings\//i, code: "embedded_objects_rejected" },
  { pattern: /oleObject/i, code: "embedded_objects_rejected" },
];

type ZipEntryInternals = { _data?: { uncompressedSize?: number } };

/**
 * Inspect the archive's central directory before any worksheet XML is
 * parsed: reject macro/external-link/OLE content and enforce the total
 * decompressed-size cap using the sizes declared in the zip metadata (a
 * zip bomb is rejected without ever being inflated).
 */
export async function inspectSpreadsheetArchive(buffer: Buffer, limits: SpreadsheetLimits): Promise<void> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new SpreadsheetSecurityError("not_a_spreadsheet");
  }

  const entryNames = Object.keys(zip.files);
  if (!entryNames.some((name) => name === "[Content_Types].xml") || !entryNames.some((name) => /^xl\//.test(name))) {
    throw new SpreadsheetSecurityError("not_a_spreadsheet");
  }

  let totalDeclaredBytes = 0;
  for (const name of entryNames) {
    for (const { pattern, code } of REJECTED_ENTRY_PATTERNS) {
      if (pattern.test(name)) throw new SpreadsheetSecurityError(code);
    }
    const declaredSize = (zip.files[name] as unknown as ZipEntryInternals)._data?.uncompressedSize;
    if (typeof declaredSize === "number" && declaredSize > 0) {
      totalDeclaredBytes += declaredSize;
      if (declaredSize > limits.maxDecompressedBytes || totalDeclaredBytes > limits.maxDecompressedBytes) {
        throw new SpreadsheetSecurityError("decompressed_size_limit");
      }
    }
  }
}

// Formula-injection defense for exports (CSV/XLSX opened in desktop apps):
// a leading =, +, -, @, tab, or CR makes spreadsheet applications interpret
// the cell as a formula/DDE payload. Neutralize with a leading apostrophe
// (Excel's own "treat as text" marker).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function sanitizeCellForExport(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

/**
 * Map any error raised during parsing to a safe SpreadsheetSecurityError.
 * Library-specific errors (exceljs, zip internals) never reach callers.
 */
export function toSafeSpreadsheetError(error: unknown): SpreadsheetSecurityError {
  if (error instanceof SpreadsheetSecurityError) return error;
  return new SpreadsheetSecurityError("malformed_workbook");
}
