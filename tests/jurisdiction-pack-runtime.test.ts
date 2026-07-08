import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createJurisdictionPack,
  createJurisdictionPackRegistry,
  demoJurisdictionPackCR,
  demoJurisdictionPackUSDE,
} from "../src/features/domain-policy-pack-runtime/jurisdiction";

// Test 1: creates jurisdiction pack with safe metadata
test("createJurisdictionPack forces safe metadata regardless of input", () => {
  const pack = createJurisdictionPack({
    id: "fixture.jurisdiction.minimal.v1",
    name: "Minimal jurisdiction pack",
    version: "1.0.0",
    validationStatus: "demo_baseline",
    jurisdiction: { known: true, countryCode: "CR" },
  });

  assert.equal(pack.metadata.requiredDisclaimer, "not_legal_advice");
  assert.equal(pack.metadata.policyModelStatus, "partial_policy_model");
  assert.equal(pack.metadata.complianceClaimed, false);
  assert.equal(pack.metadata.jurisdictionalComplianceClaimed, false);
  assert.equal(pack.scope.legalAdvice, false);
  assert.equal(pack.scope.complianceCertification, false);
  assert.equal(pack.scope.completenessClaimed, false);
});

// Test 28: registry lookup by country code
test("registry findByCountryCode returns a registered demo pack with no compliance claim", () => {
  const registry = createJurisdictionPackRegistry();
  registry.register(demoJurisdictionPackCR());

  const matches = registry.findByCountryCode("CR");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].jurisdiction.countryCode, "CR");
  assert.equal(matches[0].scope.complianceCertification, false);
  assert.equal(matches[0].metadata.jurisdictionalComplianceClaimed, false);
});

// Test 29: registry lookup by subdivision code
test("registry findBySubdivision returns a registered demo pack with no compliance claim", () => {
  const registry = createJurisdictionPackRegistry();
  registry.register(demoJurisdictionPackUSDE());

  const matches = registry.findBySubdivision("US", "DE");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].jurisdiction.countryCode, "US");
  assert.equal(matches[0].jurisdiction.subdivisionCode, "DE");
  assert.equal(matches[0].scope.complianceCertification, false);
});

// Test 30: deterministic offline execution
test("jurisdiction runtime source contains no network/LLM/OCR/PDF/web-lookup usage", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sourceDir = path.join(here, "..", "src", "features", "domain-policy-pack-runtime");

  const forbiddenPatterns: RegExp[] = [
    /\bfetch\s*\(/i,
    /XMLHttpRequest/,
    /\baxios\b/i,
    /node:https?\b/,
    /require\(\s*["']https?["']\s*\)/,
    /\bwebsocket\b/i,
    /\bopenai\b/i,
    /\banthropic\b/i,
    /\bocr\b/i,
    /tesseract/i,
    /pdf-parse/i,
    /pdfjs/i,
    /puppeteer/i,
    /playwright/i,
    /child_process/,
    /\beval\s*\(/,
    /Date\.now\s*\(/,
    /Math\.random\s*\(/,
  ];

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
    }
  };
  walk(sourceDir);

  assert.ok(files.length > 5, "expected to find jurisdiction pack runtime source files");

  const violations: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`${path.relative(sourceDir, file)} matches forbidden pattern ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("resolveJurisdictionPacks is a pure, deterministic function of its inputs", async () => {
  const { resolveJurisdictionPacks } = await import("../src/features/domain-policy-pack-runtime/jurisdiction");
  const { buildResolutionInput } = await import("./jurisdiction-pack-test-helpers");

  const registry = createJurisdictionPackRegistry();
  registry.register(demoJurisdictionPackCR());

  const input = buildResolutionInput({
    jurisdiction: { known: true, countryCode: "CR" },
    legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
  });

  const first = resolveJurisdictionPacks(input, registry);
  const second = resolveJurisdictionPacks(input, registry);
  assert.deepEqual(first, second);
});
