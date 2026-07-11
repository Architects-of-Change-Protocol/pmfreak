// Perilla 12 — security tests for the spreadsheet processing boundary
// (docs/security/spreadsheet-processing-boundary.md): configurable limits,
// hostile-archive rejection (macros, external links, OLE, zip bombs),
// prototype-pollution hygiene, and error sanitization.

import test from "node:test";
import assert from "node:assert/strict";
import { readSpreadsheetWorkbook } from "../src/lib/spreadsheets/workbook-reader";
import { SpreadsheetSecurityError, sanitizeCellForExport } from "../src/lib/spreadsheets/security";
import { SPREADSHEET_LIMIT_DEFAULTS, resolveSpreadsheetLimits } from "../src/lib/spreadsheets/limits";
import {
  buildDecompressionBombBuffer,
  buildGarbageWorkbookBuffer,
  buildSingleSheetBuffer,
  buildWorkbookBuffer,
  withExtraZipEntry,
} from "./spreadsheet-test-helpers";

const expectRejection = async (promise: Promise<unknown>, code: string) => {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SpreadsheetSecurityError, `expected SpreadsheetSecurityError, got ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  });
};

// ── limit configuration ─────────────────────────────────────────────────────

test("limits: defaults are conservative and env-resolution falls back safely", () => {
  assert.deepEqual(resolveSpreadsheetLimits({}), SPREADSHEET_LIMIT_DEFAULTS);
  // Unparsable, negative, fractional, and out-of-range values fall back to
  // the default instead of widening or disabling a bound.
  const hostile = resolveSpreadsheetLimits({
    SPREADSHEET_MAX_FILE_BYTES: "not-a-number",
    SPREADSHEET_MAX_SHEETS: "-1",
    SPREADSHEET_MAX_ROWS_PER_SHEET: "0",
    SPREADSHEET_MAX_COLUMNS: "1.5",
    SPREADSHEET_MAX_CELL_LENGTH: "99999999999",
    SPREADSHEET_MAX_DECOMPRESSED_BYTES: "",
    SPREADSHEET_PARSE_TIMEOUT_MS: "Infinity",
  });
  assert.deepEqual(hostile, SPREADSHEET_LIMIT_DEFAULTS);
});

test("limits: valid in-range env values are honored", () => {
  const limits = resolveSpreadsheetLimits({
    SPREADSHEET_MAX_FILE_BYTES: "2048",
    SPREADSHEET_MAX_SHEETS: "2",
    SPREADSHEET_MAX_ROWS_PER_SHEET: "50",
    SPREADSHEET_MAX_COLUMNS: "8",
    SPREADSHEET_MAX_CELL_LENGTH: "64",
    SPREADSHEET_PARSE_TIMEOUT_MS: "1500",
  });
  assert.equal(limits.maxFileBytes, 2048);
  assert.equal(limits.maxSheets, 2);
  assert.equal(limits.maxRowsPerSheet, 50);
  assert.equal(limits.maxColumns, 8);
  assert.equal(limits.maxCellLength, 64);
  assert.equal(limits.parseTimeoutMs, 1500);
});

// ── pre-parse rejection ─────────────────────────────────────────────────────

test("empty buffer is rejected before any parsing", async () => {
  await expectRejection(readSpreadsheetWorkbook(Buffer.alloc(0)), "empty_file");
});

test("oversized file is rejected before any parsing", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_FILE_BYTES: "1024" });
  await expectRejection(readSpreadsheetWorkbook(Buffer.alloc(2048), limits), "file_too_large");
});

test("non-zip content is rejected by magic-byte check", async () => {
  await expectRejection(readSpreadsheetWorkbook(Buffer.from("%PDF-1.7 pretending")), "not_a_spreadsheet");
});

test("zip that is not a workbook is rejected", async () => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("readme.txt", "hello");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await expectRejection(readSpreadsheetWorkbook(buffer), "not_a_spreadsheet");
});

// ── hostile archive content ─────────────────────────────────────────────────

test("macro-enabled workbook (vbaProject.bin) is rejected", async () => {
  const hostile = await withExtraZipEntry(await buildSingleSheetBuffer(), "xl/vbaProject.bin", Buffer.from([0x01]));
  await expectRejection(readSpreadsheetWorkbook(hostile), "macro_content_rejected");
});

test("workbook with external workbook links is rejected", async () => {
  const hostile = await withExtraZipEntry(
    await buildSingleSheetBuffer(),
    "xl/externalLinks/externalLink1.xml",
    "<externalLink/>",
  );
  await expectRejection(readSpreadsheetWorkbook(hostile), "external_links_rejected");
});

test("workbook with OLE embeddings is rejected", async () => {
  const hostile = await withExtraZipEntry(
    await buildSingleSheetBuffer(),
    "xl/embeddings/oleObject1.bin",
    Buffer.from([0x01]),
  );
  await expectRejection(readSpreadsheetWorkbook(hostile), "embedded_objects_rejected");
});

test("decompression bomb is rejected from zip metadata without inflating", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_DECOMPRESSED_BYTES: String(1024 * 1024) });
  const bomb = await buildDecompressionBombBuffer(4 * 1024 * 1024);
  assert.ok(bomb.length < 64 * 1024, "the bomb fixture itself must be small");
  await expectRejection(readSpreadsheetWorkbook(bomb, limits), "decompressed_size_limit");
});

// ── post-parse structural limits ────────────────────────────────────────────

test("sheet count limit is enforced", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_SHEETS: "1" });
  const buffer = await buildWorkbookBuffer([
    { name: "One", rows: [["a"]] },
    { name: "Two", rows: [["b"]] },
  ]);
  await expectRejection(readSpreadsheetWorkbook(buffer, limits), "sheet_limit_exceeded");
});

test("row limit is enforced", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_ROWS_PER_SHEET: "5" });
  const rows = Array.from({ length: 6 }, (_, index) => [`row ${index}`]);
  await expectRejection(readSpreadsheetWorkbook(await buildSingleSheetBuffer("Rows", rows), limits), "row_limit_exceeded");
});

test("column limit is enforced", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_COLUMNS: "3" });
  const wide = [["a", "b", "c", "d"]];
  await expectRejection(readSpreadsheetWorkbook(await buildSingleSheetBuffer("Wide", wide), limits), "column_limit_exceeded");
});

test("cell length limit is enforced", async () => {
  const limits = resolveSpreadsheetLimits({ SPREADSHEET_MAX_CELL_LENGTH: "16" });
  const buffer = await buildSingleSheetBuffer("Cells", [["x".repeat(64)]]);
  await expectRejection(readSpreadsheetWorkbook(buffer, limits), "cell_length_limit_exceeded");
});

// ── prototype pollution & runtime hygiene ───────────────────────────────────

test("workbook carrying __proto__/constructor strings parses without polluting the runtime", async () => {
  const buffer = await buildSingleSheetBuffer("__proto__", [
    ["__proto__", "constructor", "prototype"],
    ["polluted", "polluted", "polluted"],
  ]);
  const before = new Set(Object.getOwnPropertyNames(Object.prototype));
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.equal(workbook.sheets[0].rows[0][0], "__proto__");
  const after = Object.getOwnPropertyNames(Object.prototype);
  assert.deepEqual(after.filter((name) => !before.has(name)), [], "Object.prototype must remain unchanged");
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("a rejected hostile file does not poison subsequent parses", async () => {
  const hostile = await withExtraZipEntry(await buildSingleSheetBuffer(), "xl/vbaProject.bin", Buffer.from([0x01]));
  await assert.rejects(readSpreadsheetWorkbook(hostile));
  const workbook = await readSpreadsheetWorkbook(await buildSingleSheetBuffer("Clean", [["still works"]]));
  assert.deepEqual(workbook.sheets[0].rows, [["still works"]]);
});

// ── error sanitization ──────────────────────────────────────────────────────

test("parse errors never expose library internals, stacks, or file content", async () => {
  const marker = "SECRET_CELL_CONTENT_9f3a";
  const garbage = await buildGarbageWorkbookBuffer(marker);
  try {
    await readSpreadsheetWorkbook(garbage);
    assert.fail("expected rejection");
  } catch (error) {
    assert.ok(error instanceof SpreadsheetSecurityError);
    assert.equal(error.code, "malformed_workbook");
    assert.ok(!error.message.includes(marker), "error message must not leak file content");
    assert.ok(!/at\s+\S+\(/.test(error.message), "error message must not embed a stack trace");
    assert.ok(!/exceljs|jszip|sax/i.test(error.message), "error message must not name library internals");
  }
});

// ── formula / CSV injection (shared sanitizer) ─────────────────────────────

test("export sanitizer neutralizes formula-injection trigger characters", () => {
  assert.equal(sanitizeCellForExport("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(sanitizeCellForExport("+SUM(A1)"), "'+SUM(A1)");
  assert.equal(sanitizeCellForExport("-2+3+cmd"), "'-2+3+cmd");
  assert.equal(sanitizeCellForExport("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(sanitizeCellForExport("\t=payload"), "'\t=payload");
  assert.equal(sanitizeCellForExport("\r=payload"), "'\r=payload");
  assert.equal(sanitizeCellForExport("plain text"), "plain text");
  assert.equal(sanitizeCellForExport("a=b is fine"), "a=b is fine");
  assert.equal(sanitizeCellForExport(""), "");
});
