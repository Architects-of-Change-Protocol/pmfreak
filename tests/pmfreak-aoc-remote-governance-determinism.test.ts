import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createRemoteHttpPMFreakAocGovernanceTransport,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  createSuccessfulAocRemoteGovernanceFetchMock,
  createPMFreakAocGovernanceRequestClientConfig,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const MODULE_DIR = path.resolve(process.cwd(), "src/features/pmfreak-integrations/aoc-governance-request-client");

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Date.now()", pattern: /Date\.now\s*\(/ },
  { label: "Math.random()", pattern: /Math\.random\s*\(/ },
  { label: "crypto.randomUUID()", pattern: /crypto\.randomUUID\s*\(/ },
  { label: "axios", pattern: /\baxios\b/ },
  { label: "XMLHttpRequest", pattern: /XMLHttpRequest/ },
  { label: "openai", pattern: /\bopenai\b/i },
  { label: "anthropic", pattern: /\banthropic\b/i },
  { label: "OCR", pattern: /\bocr\b/i },
  { label: "pdf-parse", pattern: /pdf-parse/i },
  { label: "tesseract", pattern: /tesseract/i },
  { label: "new Date() (argless)", pattern: /new Date\(\s*\)/ },
  // Literal `fetch(` call syntax is only permitted through the injected
  // `fetchImpl` identifier (never a bare global `fetch(...)` call) — the
  // transport module never contains this exact substring.
  { label: "bare fetch( call", pattern: /(?<!\w)fetch\s*\(/ },
];

function listRemoteGovernanceModuleFiles(): string[] {
  return fs
    .readdirSync(MODULE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^pmfreak-aoc-remote-governance-.*\.ts$/.test(entry.name))
    .map((entry) => path.join(MODULE_DIR, entry.name));
}

test("remote governance transport module contains no non-deterministic or bare network/AI-calling APIs", () => {
  const files = listRemoteGovernanceModuleFiles();
  assert.ok(files.length > 0, "expected to find remote governance transport source files");

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

test("fetchImpl is used explicitly, not a bare global fetch(...) call, in the transport implementation", () => {
  const transportFile = fs.readFileSync(path.join(MODULE_DIR, "pmfreak-aoc-remote-governance-transport.ts"), "utf8");
  assert.match(transportFile, /fetchImpl\(/);
  assert.doesNotMatch(transportFile, /(?<!\w)fetch\s*\(/);
});

test("evaluating the same demo request twice through an injected fetchImpl mock is deterministic", async () => {
  const buildTransport = () =>
    createRemoteHttpPMFreakAocGovernanceTransport(
      { aocBaseUrl: "https://aoc.example.com" },
      { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
    );
  const clientConfig = createPMFreakAocGovernanceRequestClientConfig();

  const first = await buildTransport().evaluateGovernanceRequest(demoPMFreakAocBillingAllowedRequest(), clientConfig);
  const second = await buildTransport().evaluateGovernanceRequest(demoPMFreakAocBillingAllowedRequest(), clientConfig);

  assert.deepEqual(first, second);
});
