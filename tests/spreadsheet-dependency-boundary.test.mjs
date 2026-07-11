// Perilla 12 — dependency boundary for spreadsheet processing.
//
// RR-XLSX closure guarantees, enforced permanently:
//   1. the vulnerable `xlsx` package must never reappear (manifest, lockfile,
//      or source imports), and
//   2. the replacement engine (exceljs) is only imported inside the internal
//      abstraction (src/lib/spreadsheets/) — product code depends on the
//      SpreadsheetWorkbook contract, never on the vendor API.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"]);
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".next"]);

function walkSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      out.push(...walkSourceFiles(fullPath));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

const XLSX_IMPORT_PATTERNS = [
  /from\s+['"]xlsx['"]/,
  /require\(\s*['"]xlsx['"]\s*\)/,
  /import\(\s*['"]xlsx['"]\s*\)/,
];

const EXCELJS_IMPORT_PATTERNS = [
  /from\s+['"]exceljs['"]/,
  /require\(\s*['"]exceljs['"]\s*\)/,
  /import\(\s*['"]exceljs['"]\s*\)/,
];

test("package.json carries no xlsx dependency", () => {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    assert.ok(!(manifest[section] ?? {}).xlsx, `package.json ${section} must not contain xlsx`);
  }
});

test("package-lock.json carries no xlsx package", () => {
  const lock = JSON.parse(readFileSync(path.join(repoRoot, "package-lock.json"), "utf8"));
  const offenders = Object.keys(lock.packages ?? {}).filter(
    (name) => name === "node_modules/xlsx" || name.endsWith("/node_modules/xlsx"),
  );
  assert.deepEqual(offenders, [], "the vulnerable xlsx package must not be in the dependency tree");
});

test("no source file imports the removed xlsx package", () => {
  const offenders = [];
  for (const file of walkSourceFiles(path.join(repoRoot, "src"))) {
    const content = readFileSync(file, "utf8");
    if (XLSX_IMPORT_PATTERNS.some((pattern) => pattern.test(content))) {
      offenders.push(path.relative(repoRoot, file));
    }
  }
  assert.deepEqual(offenders, [], "no module may import xlsx");
});

test("exceljs is imported only inside src/lib/spreadsheets/", () => {
  const allowedDir = path.join(repoRoot, "src/lib/spreadsheets") + path.sep;
  const offenders = [];
  for (const file of walkSourceFiles(path.join(repoRoot, "src"))) {
    if (file.startsWith(allowedDir)) continue;
    const content = readFileSync(file, "utf8");
    if (EXCELJS_IMPORT_PATTERNS.some((pattern) => pattern.test(content))) {
      offenders.push(path.relative(repoRoot, file));
    }
  }
  assert.deepEqual(offenders, [], "product code must use src/lib/spreadsheets/, never the vendor API directly");
});

test("the dependency-security gate forbids xlsx from returning", () => {
  const gate = readFileSync(path.join(repoRoot, "scripts/check-dependency-security.mjs"), "utf8");
  assert.match(gate, /FORBIDDEN_PACKAGES\s*=\s*\[\s*"xlsx"/, "check:dependency-security must keep xlsx forbidden");
  assert.ok(!/package:\s*"xlsx"/.test(gate), "the old xlsx allowlist exception must stay removed");
});
