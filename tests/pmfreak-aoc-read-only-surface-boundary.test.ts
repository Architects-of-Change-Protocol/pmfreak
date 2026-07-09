import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const moduleDir = path.join(process.cwd(), "src/features/pmfreak-integrations/aoc-read-only-surface");

function collectModuleFiles(): string[] {
  return fs
    .readdirSync(moduleDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(moduleDir, entry.name));
}

test("surface runtime code never calls the PMFreak governance/scenario/Control-Plane/Narrative-Export layers", () => {
  const forbiddenCalls = [
    "resolvePMFreakAgentPassportAction",
    "runPMFreakProjectGovernanceScenario",
    "createPMFreakDemoControlPlaneViewModel",
    "createPMFreakDemoNarrativeExport",
  ];

  for (const file of collectModuleFiles()) {
    const content = fs.readFileSync(file, "utf8");
    for (const call of forbiddenCalls) {
      assert.equal(content.includes(call), false, `Forbidden call "${call}" found in ${path.relative(process.cwd(), file)}`);
    }
  }
});

test("surface runtime code implements no writeback/mutation behavior", () => {
  // These regexes target actual mutation *implementations* (method calls,
  // function declarations) rather than any lexical occurrence of these
  // words — PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS legitimately
  // contains data strings like "update_project"/"delete_task" as the
  // guarded-against operation names, and disclaimers legitimately say
  // "does not mutate" / "does not accept writeback".
  const mutationCallPatterns = [
    /\.(update|insert|delete|upsert)\s*\(/,
    /\bfunction\s+(writeback|mutate|sendEmail|postToSlack|createInvoice|executeAction)\w*\s*\(/i,
    /\b(writeback|sendEmail|postToSlack|createInvoice|executeAction)\s*\(/,
  ];

  for (const file of collectModuleFiles()) {
    const content = fs.readFileSync(file, "utf8");
    for (const pattern of mutationCallPatterns) {
      assert.equal(
        pattern.test(content),
        false,
        `Mutation-shaped code matching ${pattern} found in ${path.relative(process.cwd(), file)}`
      );
    }
  }
});
