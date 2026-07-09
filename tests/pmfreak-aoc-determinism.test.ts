import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createLocalMockPMFreakAocGovernanceTransport,
  createPMFreakAocGovernanceRequestClientConfig,
  demoPMFreakAocBillingMissingEvidenceRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

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
  { label: "new Date() (argless)", pattern: /new Date\(\s*\)/ },
];

function listModuleFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.ts$/.test(entry.name)) files.push(full);
    }
  };
  walk(MODULE_DIR);
  return files;
}

test("module contains no non-deterministic or network/AI-calling APIs", () => {
  const files = listModuleFiles();
  assert.ok(files.length > 0, "expected to find source files in the AOC governance request client module");

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

test("evaluating the same demo request twice through the local mock transport is deterministic", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const config = createPMFreakAocGovernanceRequestClientConfig();

  const first = await transport.evaluateGovernanceRequest(demoPMFreakAocBillingMissingEvidenceRequest(), config);
  const second = await transport.evaluateGovernanceRequest(demoPMFreakAocBillingMissingEvidenceRequest(), config);

  assert.deepEqual(first, second);
});
