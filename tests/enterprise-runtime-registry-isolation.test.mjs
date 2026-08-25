import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const sourceFilePattern = /\.(ts|tsx|js|mjs)$/;

function collectSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(filePath));
    } else if (stats.isFile() && sourceFilePattern.test(filePath)) {
      files.push(filePath);
    }
  }

  return files;
}

const enterpriseFiles = collectSourceFiles(path.join("src", "lib", "governance", "authority"));
const runtimeCompositionRoot = path.join("src", "lib", "governance", "authority", "runtime", "composition.ts");

test("governance registry access is isolated to the runtime composition root", () => {
  const violations = [];
  for (const file of enterpriseFiles) {
    const source = readFileSync(file, "utf8");
    if (source.includes("getAocAdapter(") && file !== runtimeCompositionRoot) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});

test("governance orchestration modules consume RuntimeContext explicitly", () => {
  for (const file of [
    "src/lib/governance/authority/runtime/governance-core.ts",
    "src/lib/governance/authority/runtime/execution-grants.ts",
    "src/lib/governance/authority/runtime/delegated-capabilities.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /RuntimeContext/, `${file} should depend on RuntimeContext`);
    assert.doesNotMatch(source, /getAocAdapter\(/, `${file} must not fetch registry adapters directly`);
  }
});

test("runtime context exposes canonical dependency groups for orchestration", () => {
  const source = readFileSync("src/lib/governance/authority/runtime/context.ts", "utf8");
  assert.match(source, /export interface RuntimeContext/);
  assert.match(source, /RuntimeSecurityContext/);
  assert.match(source, /RuntimeGovernanceContext/);
  assert.match(source, /RuntimeCapabilityContext/);
  assert.match(source, /RuntimeAuditContext/);
});
