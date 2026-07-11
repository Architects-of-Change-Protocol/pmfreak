// Perilla 12 — workbook writer tests (src/lib/spreadsheets/workbook-writer.ts):
// the requirement-matrix export path must produce a valid workbook and must
// neutralize formula/DDE payloads in values derived from uploaded documents.

import test from "node:test";
import assert from "node:assert/strict";
import { createWorkbookBlob, XLSX_MIME_TYPE } from "../src/lib/spreadsheets/workbook-writer";
import { readSpreadsheetWorkbook } from "../src/lib/spreadsheets/workbook-reader";

const MATRIX_COLUMNS = [
  { header: "ID", key: "ID", width: 10 },
  { header: "Requirement", key: "Requirement", width: 72 },
  { header: "Owner", key: "Owner", width: 20 },
];

test("writer produces a valid workbook the reader round-trips", async () => {
  const blob = await createWorkbookBlob({
    sheetName: "Requirement Matrix",
    columns: MATRIX_COLUMNS,
    rows: [
      { ID: "FR-1", Requirement: "The system shall import documents.", Owner: "Product Owner" },
      { ID: "NFR-1", Requirement: "Response time under 2s.", Owner: "Tech Lead" },
    ],
  });
  assert.equal(blob.type, XLSX_MIME_TYPE);

  const workbook = await readSpreadsheetWorkbook(Buffer.from(await blob.arrayBuffer()));
  assert.equal(workbook.sheets[0].name, "Requirement Matrix");
  assert.deepEqual(workbook.sheets[0].rows, [
    ["ID", "Requirement", "Owner"],
    ["FR-1", "The system shall import documents.", "Product Owner"],
    ["NFR-1", "Response time under 2s.", "Tech Lead"],
  ]);
});

test("formula-injection payloads in exported cells are neutralized", async () => {
  const blob = await createWorkbookBlob({
    sheetName: "Matrix",
    columns: MATRIX_COLUMNS,
    rows: [
      { ID: "FR-1", Requirement: "=HYPERLINK(\"https://attacker.example\",\"click\")", Owner: "@SUM(A1)" },
      { ID: "FR-2", Requirement: "+cmd|' /C calc'!A0", Owner: "-2+3+cmd|' /C calc'!A0" },
    ],
  });
  const workbook = await readSpreadsheetWorkbook(Buffer.from(await blob.arrayBuffer()));
  const [, row1, row2] = workbook.sheets[0].rows;
  assert.equal(row1[1], "'=HYPERLINK(\"https://attacker.example\",\"click\")");
  assert.equal(row1[2], "'@SUM(A1)");
  assert.equal(row2[1], "'+cmd|' /C calc'!A0");
  assert.equal(row2[2], "'-2+3+cmd|' /C calc'!A0");
});

test("headers are sanitized too, and non-string values are preserved", async () => {
  const blob = await createWorkbookBlob({
    sheetName: "Edge",
    columns: [
      { header: "=EvilHeader", key: "a" },
      { header: "Count", key: "b" },
    ],
    rows: [{ a: "value", b: 7 }, { a: null, b: true }],
  });
  const workbook = await readSpreadsheetWorkbook(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual(workbook.sheets[0].rows, [
    ["'=EvilHeader", "Count"],
    ["value", "7"],
    ["", "true"],
  ]);
});
