// Perilla 12 — env-configurable spreadsheet processing limits.
//
// Same contract as src/lib/ai/runtime-limits.ts: conservative defaults, hard
// clamping, and no way to disable a bound via env — an unparsable or
// out-of-range value falls back to the default instead of widening the limit.
// Enforcement lives in security.ts / workbook-reader.ts.
// Tests: tests/spreadsheet-security-boundary.test.ts.

export type SpreadsheetLimits = {
  /** Maximum accepted file size in bytes (pre-parse check). */
  maxFileBytes: number;
  /** Maximum number of worksheets per workbook. */
  maxSheets: number;
  /** Maximum rows per worksheet. */
  maxRowsPerSheet: number;
  /** Maximum columns per worksheet. */
  maxColumns: number;
  /** Maximum characters kept per cell. */
  maxCellLength: number;
  /** Upper bound on total decompressed archive size (zip-bomb defense). */
  maxDecompressedBytes: number;
  /** Parse deadline in milliseconds. */
  parseTimeoutMs: number;
};

type EnvRecord = Record<string, string | undefined>;

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export const SPREADSHEET_LIMIT_DEFAULTS: SpreadsheetLimits = {
  maxFileBytes: 10 * 1024 * 1024, // matches UPLOAD_MAX_FILE_SIZE_BYTES default
  maxSheets: 20,
  maxRowsPerSheet: 10_000,
  maxColumns: 256,
  maxCellLength: 8_192,
  maxDecompressedBytes: 100 * 1024 * 1024,
  parseTimeoutMs: 10_000,
};

export function resolveSpreadsheetLimits(env: EnvRecord = process.env): SpreadsheetLimits {
  const d = SPREADSHEET_LIMIT_DEFAULTS;
  return {
    maxFileBytes: clampInt(env.SPREADSHEET_MAX_FILE_BYTES, d.maxFileBytes, 1_024, 50 * 1024 * 1024),
    maxSheets: clampInt(env.SPREADSHEET_MAX_SHEETS, d.maxSheets, 1, 100),
    maxRowsPerSheet: clampInt(env.SPREADSHEET_MAX_ROWS_PER_SHEET, d.maxRowsPerSheet, 1, 200_000),
    maxColumns: clampInt(env.SPREADSHEET_MAX_COLUMNS, d.maxColumns, 1, 16_384),
    maxCellLength: clampInt(env.SPREADSHEET_MAX_CELL_LENGTH, d.maxCellLength, 16, 32_767),
    maxDecompressedBytes: clampInt(env.SPREADSHEET_MAX_DECOMPRESSED_BYTES, d.maxDecompressedBytes, 1024 * 1024, 1024 * 1024 * 1024),
    parseTimeoutMs: clampInt(env.SPREADSHEET_PARSE_TIMEOUT_MS, d.parseTimeoutMs, 500, 120_000),
  };
}
