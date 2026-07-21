// Guided Workspace Onboarding — Zero State UX guardrails.
//
// Source-level checks that keep the onboarding system honest and prevent the
// fabrication patterns removed by the Zero State UX refactor from
// reappearing through this feature. Scoped to the onboarding/activation
// files (not a fragile global grep): production code here must never invent
// progress, metrics, owners, or SLAs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const DOMAIN_FILES = [
  "src/lib/workspace-activation/types.ts",
  "src/lib/workspace-activation/activation-rules.ts",
  "src/lib/workspace-activation/evaluate-workspace-activation.ts",
  "src/lib/workspace-activation/onboarding-preferences.ts",
];

const UI_FILES = [
  "src/components/pmfreak/onboarding/workspace-onboarding-panel.tsx",
  "src/components/pmfreak/onboarding/workspace-onboarding-copy.ts",
  "src/components/pmfreak/onboarding/mark-insights-viewed.tsx",
];

const API_FILE = "src/app/api/workspace-activation/route.ts";
const MIGRATION_FILE = "supabase/migrations/20260829000000_workspace_onboarding_preferences.sql";

// Fabrication signatures eliminated by the Zero State UX sprint. They must
// never appear in the onboarding/activation surface.
const FORBIDDEN_FABRICATION_STRINGS = [
  "Dashboard source data unavailable",
  "Portfolio Health Unavailable",
  "PMO Director",
  "Resolution 24h",
  "Escalation required",
  "Recommended Action: Yes",
  "Portfolio Confidence",
  "Events indexed",
];

test("onboarding surface contains no resurrected fabrication strings", () => {
  for (const file of [...DOMAIN_FILES, ...UI_FILES, API_FILE]) {
    const src = read(file);
    for (const forbidden of FORBIDDEN_FABRICATION_STRINGS) {
      assert.ok(!src.includes(forbidden), `${file} must not contain "${forbidden}"`);
    }
  }
});

test("activation domain derives progress deterministically (no randomness, no clock-based completion)", () => {
  for (const file of DOMAIN_FILES) {
    const src = read(file);
    assert.ok(!src.includes("Math.random"), `${file} must not use Math.random`);
  }
  // The pure rules module must not even construct dates — completion is a
  // function of evidence alone.
  assert.ok(!read("src/lib/workspace-activation/activation-rules.ts").includes("new Date"));
});

test("no manual onboardingComplete flag exists anywhere in the feature", () => {
  for (const file of [...DOMAIN_FILES, ...UI_FILES, API_FILE]) {
    const src = read(file);
    assert.ok(!/onboardingComplete\s*[:=]/.test(src), `${file} must not define onboardingComplete`);
  }
});

test("preferences migration stores display state only — never derived progress", () => {
  const sql = read(MIGRATION_FILE);
  // Match actual column DEFINITIONS (name + sql type), not prose comments.
  for (const forbiddenColumn of ["completed_step", "progress", "stage", "activation_state"]) {
    const columnDefinition = new RegExp(
      `^\\s*${forbiddenColumn}\\w*\\s+(text|jsonb|integer|boolean|numeric|timestamptz)`,
      "mi",
    );
    assert.ok(
      !columnDefinition.test(sql),
      `migration must not persist derived progress (found "${forbiddenColumn}" column)`,
    );
  }
  assert.ok(sql.includes("enable row level security"), "preferences table must enable RLS");
  assert.ok(sql.includes("is_workspace_member"), "RLS must require workspace membership");
  assert.ok(sql.includes("user_id = auth.uid()"), "RLS must scope rows to the owning user");
  assert.ok(
    sql.includes("unique (workspace_id, user_id)"),
    "preferences must be unique per workspace and user",
  );
});

test("activation API verifies membership server-side and never trusts workspaceId input", () => {
  const src = read(API_FILE);
  assert.ok(src.includes("workspace_memberships"), "route must check real membership");
  assert.ok(src.includes("resolvePreferredWorkspace"), "route must resolve canonical workspace");
  assert.ok(src.includes("status: 403"), "route must deny non-members");
  assert.ok(src.includes("status: 401"), "route must deny unauthenticated callers");
});

test("evidence probes are workspace-scoped", () => {
  const src = read("src/lib/workspace-activation/evaluate-workspace-activation.ts");
  const scopedProbes = src.match(/eq\("workspace_id", workspaceId\)/g) ?? [];
  assert.ok(scopedProbes.length >= 10, "every evidence probe must filter by workspace_id");
  assert.ok(
    src.includes('neq("status", "archived")'),
    "project evidence must exclude archived projects",
  );
  assert.ok(src.includes('eq("role", "user")'), "conversation evidence must require a user message");
});

test("panel communicates progress as text, never as an unlabeled bar", () => {
  const src = read("src/components/pmfreak/onboarding/workspace-onboarding-panel.tsx");
  assert.ok(
    src.includes("essential steps completed"),
    "panel must render the textual progress fraction",
  );
  assert.ok(!src.includes("progressbar"), "panel must not rely on a graphical progress bar");
  // No client-side path may mark a step completed: the only writes are
  // display preferences.
  for (const forbidden of ["mark_complete", "markComplete", "completeStep", "setCompleted"]) {
    assert.ok(!src.includes(forbidden), `panel must not contain ${forbidden}`);
  }
});

test("empty states keep the honest restricted-role fallback", () => {
  const src = read("src/components/pmfreak/empty-states/workspace-empty-state.tsx");
  assert.ok(
    src.includes("A workspace administrator or project manager must create the first project."),
    "restricted note must exist for viewers",
  );
  assert.ok(
    src.includes("Create a project before adding execution work."),
    "execution empty state must explain the project dependency",
  );
});
