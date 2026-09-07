/**
 * UX-W0 — public-launch blocker guards.
 *
 * Two blockers were cleared and must stay cleared:
 *
 *   UX-P0-01  Ordinary customer context capture records LIVE operational input and never
 *             asks the PM to choose (or silently defaults them onto) the DEMO / FIXTURE
 *             lineage, which can never support an Outcome Observation.
 *
 *   UX-P0-02  The P2-06 / AOC-E Material Action certification panel does not render in
 *             ordinary customer product UX, and the surfaces that do host it are gated on
 *             founder/internal identity — not merely unlinked.
 *
 * The last test is the durable one: it walks the import graph out of every CUSTOMER page
 * entrypoint and fails if internal certification vocabulary is reachable from one. It is
 * deliberately NOT a repository-wide string ban — comments, tests, canonical
 * implementation modules and internal routes may all say these words legitimately. The
 * invariant is customer-facing EXPOSURE, not source-code vocabulary.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ROUTE_GUARD_REGISTRY } from "../src/lib/security/route-guard-registry.ts";

const read = (p) => readFileSync(p, "utf8");

const CUSTOMER_INTAKE_PANEL = "src/modules/workspace/presentation/command-center/vault-intake-panel.tsx";
const CUSTOMER_CAPTURE_MODAL = "src/components/pmfreak/intelligence-inbox/text-capture-modal.tsx";
const CUSTOMER_INBOX = "src/components/pmfreak/intelligence-inbox/project-intelligence-inbox.tsx";
const CAPTURE_PRIMITIVES = "src/modules/workspace/presentation/command-center/operational-data.ts";
const INTERNAL_FIXTURE_PANEL = "src/components/internal/governance-lab/fixture-intake-panel.tsx";
const INTERNAL_LAB_PAGE = "src/app/(protected)/internal/governance-lab/page.tsx";
const LEGACY_LINEAGE_PAGE = "src/app/operational-flow/page.tsx";
const CERTIFICATION_PANEL = "src/components/pmfreak/intelligence-inbox/material-action-panel.tsx";

/**
 * Terminology that must never reach a customer's screen. Each is either an internal
 * certification identifier or a lineage label the customer has no way to act on.
 */
const CUSTOMER_PROHIBITED_TERMS = ["AOC-E", "P2-06", "P2-09", "DEMO / FIXTURE"];

/**
 * Term-scoped exemptions, for the one case the rule cannot distinguish: `DEMO / FIXTURE`
 * is also a canonical DATA VALUE (`fixture_label`), so a module that writes or compares it
 * is naming a row, not addressing a user. Scoped to the exact term and the exact file, so
 * every other prohibited term stays banned in these modules; and only non-presentation
 * modules qualify, checked below.
 */
const CANONICAL_VALUE_EXEMPTIONS = [
  {
    file: "src/lib/operational-flow/operational-flow-service.ts",
    terms: ["DEMO / FIXTURE"],
    reason: "Writes and compares the canonical `fixture_label` value. Renaming it would be a canonical change, not a copy change.",
  },
  {
    file: "src/features/pmfreak-integrations/aoc-governance-request-client/pmfreak-material-action-contract.ts",
    terms: ["DEMO / FIXTURE", "P2-06"],
    reason: "Both appear once, inside a TypeScript type literal on the proposal contract shape. Type-level only, erased at runtime, so neither can reach a screen.",
  },
];

// ─────────────────────────── UX-P0-01 — LIVE customer capture ───────────────────────────

test("UX-P0-01: the customer intake panel has no lineage selector and cannot default to fixture", () => {
  const panel = read(CUSTOMER_INTAKE_PANEL);
  // The selector, its state and its type are gone — not merely hidden behind a flag, which
  // would leave the fixture default one prop away from returning.
  assert.ok(!/useState<IntakeMode>/.test(panel), "the intake mode selector state must be gone");
  assert.ok(!/type IntakeMode/.test(panel), "the intake mode union must be gone from the customer panel");
  assert.ok(!/value: "fixture"/.test(panel), "no fixture option may be offered to a customer");
  assert.ok(!/captureAndDeriveDemoEvidence/.test(panel), "the customer panel must not reach the fixture contract");
});

test("UX-P0-01: the customer intake panel records LIVE input through the canonical contract", () => {
  const panel = read(CUSTOMER_INTAKE_PANEL);
  assert.match(panel, /captureAndDeriveLiveEvidence\(/);
  // Observer judgement is still asked for, not fabricated to shorten the form. P2-09
  // Evidence quality rides onto an immutable row an Observation may cite.
  for (const field of ["assertionType", "classification", "confidenceScore", "missingDataState"]) {
    assert.match(panel, new RegExp(`${field}`), `${field} must still be supplied by the observer`);
  }
  // An emptied confidence field is still refused, and an explicit 0 is still valid.
  assert.match(panel, /confidenceEntered !== "" && Number\.isFinite\(confidence\)/);
  assert.match(panel, /confidence >= 0 && confidence <= 1/);
  // One logical submission keeps one identity across an ambiguous retry.
  assert.match(panel, /intakeAttemptKey\(workspaceId, projectId, mode, await sha256Hex\(content\.trim\(\)\)\)/);
  assert.match(panel, /submissionId: attempt\.attemptId,/);
});

test("UX-P0-01: the Project Memory capture modal records LIVE input, and did not merely change its label", () => {
  const modal = read(CUSTOMER_CAPTURE_MODAL);
  // Relabelling alone would have been a lie: the modal wrote the fixture lineage, so its
  // DEMO / FIXTURE badge was accurate. The contract had to change, not the copy.
  assert.match(modal, /captureAndDeriveLiveEvidence\(/);
  assert.ok(!/operation: "capture_input"/.test(modal), "the fixture capture operation must be gone");
  // LIVE writes are Observation-eligible, so an ambiguous retry must reconcile rather than
  // append a second citable assertion.
  assert.match(modal, /intakeAttemptKey\(workspaceId, projectId, "live", await sha256Hex\(content\.trim\(\)\)\)/);
  assert.match(modal, /submissionId: attempt\.attemptId,/);
  assert.match(modal, /clearSubmissionAttempt\(attemptKey\);/);
});

// ─────────────────────── UX-P0-01 — the fixture lineage still exists ────────────────────

test("UX-P0-01: the fixture lineage is preserved, and reachable only from the internal surface", () => {
  // The contract is untouched: the shared primitive still exists and is still exported.
  assert.match(read(CAPTURE_PRIMITIVES), /export async function captureAndDeriveDemoEvidence\(/);
  // The internal panel reuses that primitive rather than restating any canonical write.
  const fixturePanel = read(INTERNAL_FIXTURE_PANEL);
  assert.match(fixturePanel, /captureAndDeriveDemoEvidence\(workspaceId, projectId,/);
  assert.ok(
    !/operation: "capture_input"|operation: "derive_evidence"/.test(fixturePanel),
    "the internal panel must not restate canonical write logic",
  );
  // And it is hosted only by the gated internal page.
  assert.match(read(INTERNAL_LAB_PAGE), /<FixtureIntakePanel/);
});

test("UX-P0-01: nothing promotes fixture Evidence to LIVE", () => {
  for (const file of [CUSTOMER_INTAKE_PANEL, CUSTOMER_CAPTURE_MODAL, INTERNAL_FIXTURE_PANEL, CAPTURE_PRIMITIVES]) {
    const code = codeOnly(read(file));
    assert.ok(
      !/fixture_state["']?\s*[:=]\s*["']LIVE["']/.test(code),
      `${file} must never assign fixture_state = LIVE`,
    );
  }
});

// ──────────────────── UX-P0-02 — certification panel out of customer UX ─────────────────

test("UX-P0-02: the Project Intelligence Inbox no longer renders the certification panel", () => {
  const inbox = read(CUSTOMER_INBOX);
  assert.ok(!/MaterialActionPanel/.test(inbox), "the certification panel must not be in the customer first-run screen");
  assert.ok(!/material-action-panel/.test(inbox), "the certification panel must not be imported by customer UX");
});

test("UX-P0-02: the certification panel is preserved, not deleted", () => {
  assert.ok(existsSync(CERTIFICATION_PANEL), "the panel must survive for internal/certification use");
  assert.match(read(CERTIFICATION_PANEL), /export function MaterialActionPanel/);
});

test("UX-P0-02: every surface hosting the certification panel is gated on founder/internal identity", () => {
  const hosts = hostsOfCertificationPanel();
  assert.ok(hosts.length > 0, "the panel must still be reachable somewhere internal");
  for (const host of hosts) {
    const src = read(host);
    // Server-side identity, resolved from the authenticated user's email — never from
    // `user.role`, which comes from client-writable metadata.
    assert.match(src, /isFounderOrInternalUser/, `${host} must gate on founder/internal identity`);
    assert.match(src, /notFound\(\)/, `${host} must answer notFound() for ordinary customers`);
    // Registered, so tests/route-guard-consistency.test.mjs fails if the guard is removed.
    const entry = ROUTE_GUARD_REGISTRY.find((e) => e.file === host);
    assert.ok(entry, `${host} must be registered in the route guard registry`);
    assert.equal(entry.classification, "founder-internal", `${host} must be classified founder-internal`);
  }
});

// ───────────────────── customer-facing exposure guard (import reachability) ─────────────

test("UX-W0: no internal certification vocabulary is reachable from a customer page", () => {
  const offenders = [];
  for (const [file, terms] of scanCustomerReachableModules()) {
    offenders.push(`${file}: ${terms.join(", ")}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `internal terminology is reachable from customer UX:\n  ${offenders.join("\n  ")}`,
  );
});

test("UX-W0: canonical-value exemptions stay narrow and cannot become a loophole", () => {
  for (const entry of CANONICAL_VALUE_EXEMPTIONS) {
    assert.ok(existsSync(entry.file), `${entry.file} is exempted but does not exist`);
    assert.ok(entry.reason.length > 20, `${entry.file} needs a real justification`);
    // A presentation module renders; a canonical module names rows. Only the latter may be
    // exempted, so an exemption can never be used to hide UI copy.
    assert.ok(!entry.file.endsWith(".tsx"), `${entry.file} renders markup and cannot be exempted`);
    assert.ok(
      !/\/(components|presentation|screens)\//.test(entry.file),
      `${entry.file} is a presentation module and cannot be exempted`,
    );
    // The exemption must still be needed — a stale one is a silent widening of the ban.
    const code = codeOnly(readFileSync(entry.file, "utf8"));
    for (const term of entry.terms) {
      assert.ok(code.includes(term), `${entry.file} no longer contains "${term}" — drop the exemption`);
    }
  }
});

test("UX-W0: the exposure guard actually reaches customer UI modules (it is not vacuous)", () => {
  const reachable = customerReachableModules();
  // Sanity anchors: if the graph walk silently resolved nothing, these would be missing and
  // the guard above would pass for the wrong reason.
  assert.ok(reachable.has(CUSTOMER_INTAKE_PANEL), "the Command Center intake panel must be reachable");
  assert.ok(reachable.has(CUSTOMER_INBOX), "the Project Intelligence Inbox must be reachable");
  assert.ok(reachable.size > 200, `expected a large customer graph, walked ${reachable.size} modules`);
  // And the internal surfaces must be OUTSIDE it.
  assert.ok(!reachable.has(CERTIFICATION_PANEL), "the certification panel must not be customer-reachable");
  assert.ok(!reachable.has(INTERNAL_FIXTURE_PANEL), "the fixture panel must not be customer-reachable");
});

// ─────────────────────────────────── helpers ────────────────────────────────────────────

/** Strips block and line comments so the scan reads executable code and rendered copy,
 *  not the commentary that explains why these terms exist. */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*$/, ""))
    .join("\n");
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.replaceAll("\\", "/"));
  }
  return out;
}

/** Pages classified `founder-internal`, plus anything under an explicitly internal path.
 *  These are NOT customer surfaces, so they are excluded as graph roots. */
function internalRoots() {
  const registered = new Set(
    ROUTE_GUARD_REGISTRY.filter((e) => e.classification === "founder-internal").map((e) => e.file),
  );
  return (file) => registered.has(file) || file.includes("/app/(protected)/internal/");
}

/** Every page/layout/template under src/app that an ordinary customer can render. */
function customerRoots() {
  const isInternal = internalRoots();
  return walk("src/app").filter(
    (f) => /\/(page|layout|template)\.tsx$/.test(f) && !isInternal(f),
  );
}

/** Resolves one import specifier to a repo-relative source file, or null when it is a
 *  package, a stylesheet, or otherwise not part of this graph. */
function resolveSpecifier(specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.join(path.dirname(fromFile), specifier);
  else return null;
  base = base.replaceAll("\\", "/");
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;

/** Transitive closure of static and dynamic imports out of every customer page. */
function customerReachableModules() {
  const seen = new Set();
  const stack = customerRoots();
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of src.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveSpecifier(match[1], file);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return seen;
}

/** [file, offendingTerms] for every customer-reachable module carrying prohibited copy. */
function scanCustomerReachableModules() {
  const exempt = new Map(CANONICAL_VALUE_EXEMPTIONS.map((e) => [e.file, new Set(e.terms)]));
  const results = [];
  for (const file of customerReachableModules()) {
    const code = codeOnly(readFileSync(file, "utf8"));
    const allowed = exempt.get(file) ?? new Set();
    const hits = CUSTOMER_PROHIBITED_TERMS.filter((term) => !allowed.has(term) && code.includes(term));
    if (hits.length > 0) results.push([file, hits]);
  }
  return results;
}

/** Every page under src/app that renders the certification panel. */
function hostsOfCertificationPanel() {
  return walk("src/app")
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => readFileSync(f, "utf8").includes("MaterialActionPanel"));
}
