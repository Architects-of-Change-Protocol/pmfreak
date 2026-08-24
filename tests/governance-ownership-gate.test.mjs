/**
 * P0-PKG-05 — negative controls for the governance ownership boundary gates.
 *
 * The P0-PKG-04 gate proved the canonical packages could not resolve to local
 * source. These gates prove the layer that replaced the pseudo-upstream trees
 * cannot silently regress: the trees cannot come back, a canonical name cannot be
 * redefined locally, and the ownership record cannot go stale or ambiguous.
 *
 * Same discipline as tests/packaged-aoc-artifact-gate.test.mjs: build a synthetic
 * repository root, poison exactly one thing, assert the rejection actually fires.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { identityChecks } from "../scripts/check-aoc-packages.mjs";
import { collisionChecks } from "../scripts/check-governance-collisions.mjs";
import { ownershipChecks } from "../scripts/check-governance-ownership.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const write = (root, rel, contents) => {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof contents === "string" ? contents : JSON.stringify(contents, null, 2));
};

/** A synthetic root that mirrors the real repository's healthy shape. */
function identityFixture(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "governance-identity-"));
  const realManifest = readJson(path.join(repositoryRoot, "package.json"));
  const state = {
    root,
    manifest: {
      name: "pmfreak-fixture",
      dependencies: {
        "@aoc/protocol": realManifest.dependencies["@aoc/protocol"],
        "@aoc-enterprise/runtime": realManifest.dependencies["@aoc-enterprise/runtime"],
      },
    },
    tsconfig: { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
    extraFiles: {},
  };
  mutate(state);
  write(root, "package.json", state.manifest);
  write(root, "tsconfig.json", state.tsconfig);
  for (const [rel, contents] of Object.entries(state.extraFiles)) write(root, rel, contents);
  return root;
}

const identityFailures = (mutate) => identityChecks(identityFixture(mutate)).failures.join("\n");

test("POSITIVE CONTROL: a healthy root passes every identity check", () => {
  assert.equal(identityFailures(() => {}), "");
});

test("NEGATIVE CONTROL: recreating src/aoc/protocol fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.extraFiles["src/aoc/protocol/index.ts"] = "export type WorkspaceId = string;\n";
  });
  assert.match(failures, /pseudo-upstream tree still present: src\/aoc\/protocol/);
});

test("NEGATIVE CONTROL: recreating src/aoc/enterprise fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.extraFiles["src/aoc/enterprise/index.ts"] = "export const x = 1;\n";
  });
  assert.match(failures, /pseudo-upstream tree still present: src\/aoc\/enterprise/);
});

test("NEGATIVE CONTROL: a local manifest reclaiming a canonical name fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.extraFiles["src/aoc/protocol-copy/package.json"] = { name: "@aoc/protocol", version: "0.2.0-rc.0" };
  });
  assert.match(failures, /impersonates canonical package "@aoc\/protocol"/);
});

test("NEGATIVE CONTROL: reintroducing a @pmfreak/aoc-*-internal manifest fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.extraFiles["src/aoc/legacy/package.json"] = { name: "@pmfreak/aoc-protocol-internal", version: "0.1.0" };
  });
  assert.match(failures, /removed pseudo-upstream package name "@pmfreak\/aoc-protocol-internal" reintroduced/);
});

test("NEGATIVE CONTROL: reintroducing a @pmfreak/aoc-*-internal tsconfig alias fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.tsconfig.compilerOptions.paths["@pmfreak/aoc-protocol-internal"] = ["./src/lib/governance/authority/index.ts"];
  });
  assert.match(failures, /removed pseudo-upstream alias "@pmfreak\/aoc-protocol-internal" reintroduced/);
});

test("NEGATIVE CONTROL: a tsconfig alias resolving into a removed tree fails the identity gate", () => {
  const failures = identityFailures((state) => {
    state.tsconfig.compilerOptions.paths["@/governance/*"] = ["./src/aoc/protocol/*"];
  });
  assert.match(failures, /resolves into removed tree "\.\/src\/aoc\/protocol\/\*"/);
});

test("NEGATIVE CONTROL: a canonical dependency that is not a pinned tarball fails the identity gate", () => {
  assert.match(
    identityFailures((state) => { state.manifest.dependencies["@aoc/protocol"] = "^0.2.0-rc.0"; }),
    /must resolve to a pinned vendor tarball, got "\^0\.2\.0-rc\.0"/,
  );
  assert.match(
    identityFailures((state) => { state.manifest.dependencies["@aoc/protocol"] = "file:src/aoc/protocol"; }),
    /must resolve to a pinned vendor tarball, got "file:src\/aoc\/protocol"/,
  );
});

test("NEGATIVE CONTROL: a workspaces field fails the identity gate", () => {
  assert.match(identityFailures((state) => { state.manifest.workspaces = ["src/aoc/*"]; }),
    /workspaces must not reintroduce local AOC packages/);
});

// ---------------------------------------------------------------------------
// Semantic collision guard
// ---------------------------------------------------------------------------

function collisionFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "governance-collision-"));
  for (const [rel, contents] of Object.entries(files)) write(root, rel, contents);
  return root;
}
const collisionNames = (files) => collisionChecks(collisionFixture(files)).violations.map((v) => v.name);

test("POSITIVE CONTROL: importing a canonical name from @aoc/protocol is allowed", () => {
  assert.deepEqual(
    collisionNames({ "src/x.ts": 'import type { PolicyDecision, WorkspaceId } from "@aoc/protocol";\nexport type { PolicyDecision, WorkspaceId };\n' }),
    [],
  );
});

test("POSITIVE CONTROL: re-exporting a canonical name straight from @aoc/protocol is allowed", () => {
  assert.deepEqual(
    collisionNames({ "src/x.ts": 'export type { WorkspaceId } from "@aoc/protocol";\n' }),
    [],
  );
});

test("POSITIVE CONTROL: a PMFreak concept under its own name is allowed", () => {
  assert.deepEqual(
    collisionNames({ "src/x.ts": 'export type PolicyEvaluationOutcome = "allow" | "deny" | "require_approval";\n' }),
    [],
  );
});

test("NEGATIVE CONTROL: redefining a divergent canonical name locally fails the collision guard", () => {
  for (const name of ["PolicyDecision", "CapabilityPermission", "CapabilityResourceType", "AgentScope", "CapabilityGrant", "CapabilityRequest", "AuditEventEnvelope", "Delegation"]) {
    assert.deepEqual(
      collisionNames({ "src/x.ts": `export type ${name} = "poisoned";\n` }),
      [name],
      `expected a local declaration of ${name} to be rejected`,
    );
  }
});

test("NEGATIVE CONTROL: locally redeclaring a shared canonical identifier fails the collision guard", () => {
  for (const name of ["WorkspaceId", "ProjectId", "AgentId"]) {
    assert.deepEqual(collisionNames({ "src/x.ts": `export type ${name} = string;\n` }), [name]);
  }
});

test("NEGATIVE CONTROL: an interface, enum or class under a canonical name also fails", () => {
  assert.deepEqual(collisionNames({ "src/x.ts": "export interface CapabilityGrant { id: string }\n" }), ["CapabilityGrant"]);
  assert.deepEqual(collisionNames({ "src/x.ts": "export class Delegation {}\n" }), ["Delegation"]);
});

// ---------------------------------------------------------------------------
// Ownership map validation
// ---------------------------------------------------------------------------

function ownershipFixture(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "governance-ownership-"));
  const lock = readJson(path.join(repositoryRoot, "governance-ownership.lock.json"));
  mutate(lock);
  write(root, "governance-ownership.lock.json", lock);
  // Mirror only the definition files the lock points at.
  for (const entry of lock.symbols ?? []) {
    if (!entry.newDefinitionPath?.startsWith("src/")) continue;
    const source = path.join(repositoryRoot, entry.newDefinitionPath);
    if (fs.existsSync(source)) write(root, entry.newDefinitionPath, fs.readFileSync(source, "utf8"));
  }
  return root;
}
const ownershipFailures = (mutate) => ownershipChecks(ownershipFixture(mutate)).failures.join("\n");

test("POSITIVE CONTROL: the real ownership lock validates", () => {
  assert.equal(ownershipFailures(() => {}), "");
});

test("NEGATIVE CONTROL: a missing symbol fails the ownership gate", () => {
  assert.match(ownershipFailures((lock) => {
    lock.symbols.pop();
    lock.totals.TOTAL = lock.symbols.length;
  }), /expected 44 symbols/);
});

test("NEGATIVE CONTROL: an unresolved disposition fails the ownership gate", () => {
  assert.match(ownershipFailures((lock) => { lock.symbols[0].newDisposition = "UNKNOWN"; }),
    /invalid disposition 'UNKNOWN'/);
});

test("NEGATIVE CONTROL: a duplicate entry fails the ownership gate", () => {
  assert.match(ownershipFailures((lock) => {
    lock.symbols.push({ ...lock.symbols[0] });
    lock.totals.TOTAL = lock.symbols.length;
  }), /duplicate entry/);
});

test("NEGATIVE CONTROL: totals that disagree with the entries fail the ownership gate", () => {
  assert.match(ownershipFailures((lock) => { lock.totals.PMFREAK_DOMAIN += 1; }),
    /totals\.PMFREAK_DOMAIN: declared/);
});

test("NEGATIVE CONTROL: a non-zero UNRESOLVED count fails the ownership gate", () => {
  assert.match(ownershipFailures((lock) => { lock.totals.UNRESOLVED = 1; }),
    /totals\.UNRESOLVED is 1, must be 0/);
});

test("NEGATIVE CONTROL: claiming CANONICAL_UPSTREAM without proven compatibility fails", () => {
  assert.match(ownershipFailures((lock) => {
    const entry = lock.symbols.find((s) => s.newDisposition === "CANONICAL_UPSTREAM");
    entry.semanticCompatible = false;
  }), /requires proven shape AND semantic compatibility/);
});

test("NEGATIVE CONTROL: a PMFreak symbol pointing back into a removed tree fails", () => {
  assert.match(ownershipFailures((lock) => {
    const entry = lock.symbols.find((s) => s.newDisposition === "PMFREAK_DOMAIN");
    entry.newDefinitionPath = "src/aoc/protocol/actor-model.ts";
  }), /still points into a removed tree/);
});

test("NEGATIVE CONTROL: a definition path that does not declare its symbol fails", () => {
  assert.match(ownershipFailures((lock) => {
    const entry = lock.symbols.find((s) => s.newDisposition === "PMFREAK_PORT");
    entry.newSymbol = "SymbolThatDoesNotExistAnywhere";
  }), /not found in/);
});

test("NEGATIVE CONTROL: relaxing a declared hard boundary fails the ownership gate", () => {
  assert.match(ownershipFailures((lock) => { lock.boundaries.databaseSchemaChanged = true; }),
    /boundaries\.databaseSchemaChanged is true/);
});
