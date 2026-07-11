// Perilla 12 — contract tests for the internal workbook reader
// (src/lib/spreadsheets/workbook-reader.ts). These pin the normalized shape
// the rest of the system (evidence extraction) depends on, so the underlying
// library can change again without behavioral drift.

import test from "node:test";
import assert from "node:assert/strict";
import { readSpreadsheetWorkbook, normalizeCellValue } from "../src/lib/spreadsheets/workbook-reader";
import { SpreadsheetSecurityError } from "../src/lib/spreadsheets/security";
import { buildSingleSheetBuffer, buildWorkbookBuffer } from "./spreadsheet-test-helpers";

test("valid single-sheet workbook: headers and rows preserved in order", async () => {
  const buffer = await buildSingleSheetBuffer("Budget", [
    ["ID", "Item", "Cost"],
    ["1", "Design", 1200],
    ["2", "Build", 3400.5],
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.equal(workbook.sheets.length, 1);
  assert.equal(workbook.sheets[0].name, "Budget");
  assert.deepEqual(workbook.sheets[0].rows, [
    ["ID", "Item", "Cost"],
    ["1", "Design", "1200"],
    ["2", "Build", "3400.5"],
  ]);
});

test("multi-sheet workbook: sheet order and names preserved", async () => {
  const buffer = await buildWorkbookBuffer([
    { name: "Alpha", rows: [["a"]] },
    { name: "Beta", rows: [["b"]] },
    { name: "Gamma", rows: [["c"]] },
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.deepEqual(workbook.sheets.map((sheet) => sheet.name), ["Alpha", "Beta", "Gamma"]);
});

test("empty sheet and headers-only sheet are handled", async () => {
  const buffer = await buildWorkbookBuffer([
    { name: "Empty", rows: [] },
    { name: "HeadersOnly", rows: [["Col A", "Col B"]] },
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.deepEqual(workbook.sheets[0].rows, []);
  assert.deepEqual(workbook.sheets[1].rows, [["Col A", "Col B"]]);
});

test("mixed value types normalize deterministically", async () => {
  const buffer = await buildSingleSheetBuffer("Mixed", [
    [42, true, false, "texto único ✓", new Date(Date.UTC(2026, 0, 15))],
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.deepEqual(workbook.sheets[0].rows, [["42", "true", "false", "texto único ✓", "2026-01-15"]]);
});

test("date-time cells keep their time component as ISO-8601", () => {
  assert.equal(normalizeCellValue(new Date(Date.UTC(2026, 0, 15, 9, 30, 0))), "2026-01-15T09:30:00.000Z");
  assert.equal(normalizeCellValue(new Date(Date.UTC(2026, 0, 15))), "2026-01-15");
});

test("empty cells become empty strings; blank rows are omitted", async () => {
  const buffer = await buildSingleSheetBuffer("Sparse", [
    ["a", null, "c"],
    [null, null, null],
    ["d"],
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.deepEqual(workbook.sheets[0].rows, [
    ["a", "", "c"],
    ["d"],
  ]);
});

test("formula cells contribute only the cached result — never an evaluation", async () => {
  const buffer = await buildSingleSheetBuffer("Formulas", [
    [{ formula: "1+1", result: 2 }, { formula: "SUM(A1:A9)" }],
  ]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  // Cached result "2" is used; the uncached formula yields "" (not an evaluated value).
  assert.deepEqual(workbook.sheets[0].rows, [["2", ""]]);
});

test("hyperlink cells yield their display text; the target URL is never fetched", () => {
  assert.equal(
    normalizeCellValue({ text: "PMFreak", hyperlink: "https://attacker.example/exfil" }),
    "PMFreak",
  );
});

test("rich-text cells concatenate their runs", () => {
  assert.equal(normalizeCellValue({ richText: [{ text: "Hello " }, { text: "World" }] }), "Hello World");
});

test("long-but-valid text survives intact", async () => {
  const longText = "x".repeat(4_000);
  const buffer = await buildSingleSheetBuffer("Long", [[longText]]);
  const workbook = await readSpreadsheetWorkbook(buffer);
  assert.equal(workbook.sheets[0].rows[0][0], longText);
});

test("malformed file (not a zip) is rejected with a safe typed error", async () => {
  await assert.rejects(readSpreadsheetWorkbook(Buffer.from("this is just text, not a workbook")), (error: unknown) => {
    assert.ok(error instanceof SpreadsheetSecurityError);
    assert.equal(error.code, "not_a_spreadsheet");
    return true;
  });
});

test("truncated workbook is rejected with a safe typed error", async () => {
  const valid = await buildSingleSheetBuffer();
  await assert.rejects(readSpreadsheetWorkbook(valid.subarray(0, 128)), (error: unknown) => {
    assert.ok(error instanceof SpreadsheetSecurityError);
    return true;
  });
});

test("subsequent valid parses still work after a rejected file", async () => {
  await assert.rejects(readSpreadsheetWorkbook(Buffer.from("garbage-not-a-workbook")));
  const workbook = await readSpreadsheetWorkbook(await buildSingleSheetBuffer("After", [["ok"]]));
  assert.deepEqual(workbook.sheets[0].rows, [["ok"]]);
});
