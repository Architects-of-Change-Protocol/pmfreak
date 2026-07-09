import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { demoPMFreakAocGateResultUIPassedDisplayModel } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const MODULE_DIR = path.resolve(process.cwd(), "src/features/pmfreak-integrations/aoc-governance-request-client");

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Date.now()", pattern: /Date\.now\s*\(/ },
  { label: "Math.random()", pattern: /Math\.random\s*\(/ },
  { label: "crypto.randomUUID()", pattern: /crypto\.randomUUID\s*\(/ },
  { label: "fetch(", pattern: /\bfetch\s*\(/ },
  { label: "axios", pattern: /\baxios\b/ },
  { label: "XMLHttpRequest", pattern: /XMLHttpRequest/ },
  { label: "openai", pattern: /\bopenai\b/i },
  { label: "anthropic", pattern: /\banthropic\b/i },
  { label: "OCR", pattern: /\bocr\b/i },
  { label: "pdf-parse", pattern: /pdf-parse/i },
  { label: "tesseract", pattern: /tesseract/i },
  { label: "web lookup", pattern: /WebFetch|WebSearch/ },
  { label: "new Date() (argless)", pattern: /new Date\(\s*\)/ },
];

function listUIFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("pmfreak-aoc-gate-result-ui") && entry.name.endsWith(".ts"))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("gate result UI module contains no non-deterministic or network/AI-calling APIs", () => {
  const files = listUIFiles();
  assert.ok(files.length > 0, "expected to find gate result UI source files");

  const violations: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${path.relative(process.cwd(), file)}: ${label}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("evaluating the same demo fixture twice is deterministic", async () => {
  const first = await demoPMFreakAocGateResultUIPassedDisplayModel();
  const second = await demoPMFreakAocGateResultUIPassedDisplayModel();
  assert.deepEqual(first, second);
});
