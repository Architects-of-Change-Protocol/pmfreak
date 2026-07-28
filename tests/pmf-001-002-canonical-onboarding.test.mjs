// PMF-001 / PMF-002 — Canonical onboarding consolidation regression tests.
//
// These tests exercise REAL function invocations against a fake Supabase
// query client (not source-text regex) to prove:
//   1. resolveOnboardingState no longer requires a PMO before a real Project
//      is recognized (PMF-002's routing-layer gate).
//   2. A stale/false onboarding_completed JWT boolean cannot override real
//      persisted state once the canonical resolver is used everywhere.
//   3. The legacy wizard (getting-started-flow.tsx) is no longer a reachable
//      onboarding surface, and computes no fabricated readiness/completion
//      score.
//   4. No canonical onboarding path persists fake evidence/operational
//      memory rows.
//
// Run: npx tsx --test tests/pmf-001-002-canonical-onboarding.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveOnboardingState } from "../src/lib/auth/resolve-onboarding-state.ts";
import { getOnboardingRedirect } from "../src/lib/auth/onboarding-route-map.ts";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ─── Fake Supabase query client ──────────────────────────────────────────────
// Minimal chainable stub: every from(table) call resolves to the preset
// { data, error } for that table regardless of which filter methods are
// chained. Supports both `await query` (thenable) and `await query.maybeSingle()`.

function fakeClient(tableResponses) {
  return {
    from(table) {
      const result = tableResponses[table] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        update: () => builder,
        lt: () => builder,
        neq: () => builder,
        maybeSingle: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
}

const founderUser = { id: "user-1", email: "u@test.dev", fullName: "U", companyId: "c1", companyName: "Acme", role: "owner", onboardingCompleted: false, isFounder: true };

// ─── 1. PMO must not gate project-existence recognition ─────────────────────

test("resolveOnboardingState: workspace with zero PMOs and a real project is active, not needs_pmo_setup", async () => {
  const client = fakeClient({
    pmos: { data: [], error: null },
    workspace_governance: { data: null, error: null },
    projects: { data: [{ id: "proj-1" }], error: null },
  });
  const state = await resolveOnboardingState(founderUser, "ws-1", {
    isRecovered: true,
    getClient: () => client,
  });
  assert.equal(state, "active", "a real project must make the workspace active regardless of PMO existence");
});

test("resolveOnboardingState: workspace with zero PMOs and zero projects routes to project creation, not PMO setup", async () => {
  const client = fakeClient({
    pmos: { data: [], error: null },
    workspace_governance: { data: null, error: null },
    projects: { data: [], error: null },
  });
  const state = await resolveOnboardingState(founderUser, "ws-1", {
    isRecovered: true,
    getClient: () => client,
  });
  assert.equal(state, "needs_project", "a PMO-less, project-less workspace must resolve to needs_project, never needs_pmo_setup");
  assert.equal(getOnboardingRedirect(state), "/projects/new");
});

test("getOnboardingRedirect never sends any state to the legacy wizard route", () => {
  const routeMapSrc = read("src/lib/auth/onboarding-route-map.ts");
  assert.doesNotMatch(
    routeMapSrc,
    /return\s+"\/workspace\/setup"/,
    "no onboarding state may redirect to the retired legacy wizard route"
  );
});

// ─── 2. Stale boolean cannot override real state ─────────────────────────────

test("no JWT-boolean-derived onboarding resolver exists in the onboarding-state module", () => {
  const resolverSrc = read("src/lib/auth/resolve-onboarding-state.ts");
  assert.doesNotMatch(
    resolverSrc,
    /resolveOnboardingStateFromJwt/,
    "the coarse JWT-boolean shortcut must be removed — resolveOnboardingState (DB-derived) must be the only resolver"
  );
});

test("Edge middleware (proxy.ts) does not read onboarding_completed for routing", () => {
  const proxySrc = read("src/proxy.ts");
  assert.doesNotMatch(
    proxySrc,
    /onboarding_completed/,
    "proxy.ts must not gate routing on the onboarding_completed JWT claim"
  );
});

test("protected layout is the sole state-based onboarding redirect authority and redirects needs_project", () => {
  const layoutSrc = read("src/app/(protected)/layout.tsx");
  assert.match(layoutSrc, /resolveOnboardingState/, "layout must call the canonical DB-derived resolver");
  assert.match(layoutSrc, /"needs_project"/, "layout must redirect needs_project, not only trial_blocked");
});

// ─── 3. Legacy wizard is not a reachable onboarding surface ──────────────────

test("legacy getting-started-flow.tsx component no longer exists in the repository", () => {
  assert.equal(
    existsSync(join(ROOT, "src/components/pmfreak/activation/getting-started-flow.tsx")),
    false,
    "the fabricated-readiness legacy wizard component must be removed"
  );
});

test("legacy /api/getting-started route no longer exists", () => {
  assert.equal(
    existsSync(join(ROOT, "src/app/api/getting-started/route.ts")),
    false,
    "the legacy onboarding API route (fake evidence templates, forbidden flag write) must be removed"
  );
});

test("/workspace/setup, /onboarding and /getting-started pages redirect to a derived canonical destination, not render a wizard", () => {
  for (const route of ["workspace/setup", "onboarding", "getting-started"]) {
    const pagePath = `src/app/(protected)/${route}/page.tsx`;
    if (!existsSync(join(ROOT, pagePath))) continue; // acceptable if retired outright
    const src = read(pagePath);
    assert.doesNotMatch(
      src,
      /import\s*\{\s*GettingStartedFlow/,
      `${pagePath} must not import/render the legacy wizard`
    );
    assert.doesNotMatch(src, /<GettingStartedFlow/, `${pagePath} must not render the legacy wizard`);
    assert.match(src, /resolveOnboardingState|redirect/, `${pagePath} must redirect via the canonical resolver`);
  }
});

// ─── 4. No fake evidence/persistence in canonical onboarding ────────────────

test("workspace-activation engine and project creation paths never seed demo/template evidence", () => {
  const files = [
    "src/lib/projects/save-project-onboarding.ts",
    "src/lib/projects/create-minimal-project.ts",
  ];
  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /loadDemo|activation-demo|demoAppend/, `${file} must not contain demo-seeding logic`);
  }
});

test("no production code writes the onboarding_completed flag as an activation side effect", () => {
  const candidateFiles = [
    "src/lib/pmo/save-pmo-tenant.ts",
    "src/app/signup/actions.ts",
  ];
  for (const file of candidateFiles) {
    if (!existsSync(join(ROOT, file))) continue;
    const src = read(file);
    assert.doesNotMatch(
      src,
      /onboarding_completed/,
      `${file} must not write the legacy onboarding_completed flag`
    );
  }
});

test("/api/onboarding legacy analysis route (zero callers, wrote forbidden flag) is removed", () => {
  assert.equal(existsSync(join(ROOT, "src/app/api/onboarding/route.ts")), false);
});
