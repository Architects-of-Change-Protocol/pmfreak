// Perilla 11 — the beta release gate itself is under contract: the script
// must exist, be wired into package.json, cover every release-blocking
// check, stop on blocking failures, and distinguish blocking from advisory
// gates. (Running the full gate takes minutes and shells out to npm, so this
// is a source contract, not an execution test — the gate's own output is the
// execution evidence, see docs/release/beta-release-gate-results.md.)

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => readFileSync(path.join(repoRoot, relPath), "utf8");

test("check:beta-release is registered in package.json", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["check:beta-release"], "node scripts/check-beta-release.mjs");
  assert.equal(pkg.scripts["check:dependency-security"], "node scripts/check-dependency-security.mjs");
});

test("gate covers every release-blocking check in a sane order", () => {
  const source = read("scripts/check-beta-release.mjs");
  const required = [
    "npm run build:aoc",
    "npm run typecheck",
    "npm run lint",
    "npm test",
    "npm run build",
    "npm run check:governance",
    "npm run check:runtime-hardening",
    "npm run check:production-runtime",
    "npm run check:runtime-contracts",
    "npm run check:db-contract",
    "npm run test:launch-smoke",
    "npm run check:no-local-auth-bypass",
  ];
  let lastIndex = -1;
  for (const command of required) {
    const index = source.indexOf(`"${command}"`);
    assert.ok(index > -1, `gate is missing required command: ${command}`);
    assert.ok(index > lastIndex, `gate command out of expected order: ${command}`);
    lastIndex = index;
  }
  // build:aoc must precede check:governance — package-exports fails on a
  // clean checkout otherwise (found during the Perilla 11 baseline run).
  assert.ok(source.indexOf('"npm run build:aoc"') < source.indexOf('"npm run check:governance"'));
});

test("blocking failures stop the gate and exit 1; advisory gates cannot block", () => {
  const source = read("scripts/check-beta-release.mjs");
  assert.match(source, /severity: "blocking"/);
  assert.match(source, /severity: "advisory"/);
  assert.match(source, /blockingFailure = true/);
  assert.match(source, /break;/, "a blocking failure must stop the run");
  assert.match(source, /process\.exit\(blockingFailure \? 1 : 0\)/, "exit code must reflect ONLY blocking gates");
  assert.doesNotMatch(source, /--skip/, "the gate must not support skipping gates");
});

test("gate prints a GO / CONDITIONAL GO / NO-GO decision", () => {
  const source = read("scripts/check-beta-release.mjs");
  assert.match(source, /"NO-GO"/);
  assert.match(source, /"CONDITIONAL GO"/);
  assert.match(source, /"GO"/);
  assert.match(source, /Decision: \$\{decision\}/);
});

test("dependency security gate distinguishes clean/conditional/unexpected via exit codes", () => {
  const source = read("scripts/check-dependency-security.mjs");
  assert.match(source, /process\.exit\(1\)/);
  assert.match(source, /process\.exit\(accepted > 0 \? 2 : 0\)/);
  // Every accepted finding must be tracked in the residual risk register.
  const register = read("docs/release/residual-risk-register.md");
  for (const id of source.match(/RR-[A-Z-]+/g) ?? []) {
    assert.ok(register.includes(id), `${id} is referenced by the dependency gate but missing from the residual risk register`);
  }
});
