/**
 * Honest dashboard labeling (M-01) + Zero State UX contract.
 *
 * The dashboard must never present numbers under "Live" / "Workspace-Derived" /
 * "Real Time" labeling unless they derive from real workspace data, and the
 * no-data path must yield an explicit empty state (null data, no fabricated
 * DTO, no placeholder numbers to disclaim).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveDashboardPresentation } from "../src/lib/dashboard/consumption/dashboard-honest-labels";
import { runDashboardApiRuntime } from "../src/lib/dashboard/api-runtime";
import { runDashboardConsumptionRuntime } from "../src/lib/dashboard/consumption";

const MISLEADING = [/\blive\b/i, /workspace[- ]derived/i, /real[- ]time/i];

function assertHonest(labels: { operationalStateLabel: string; snapshotHeading: string }) {
  for (const pattern of MISLEADING) {
    assert.ok(!pattern.test(labels.operationalStateLabel), `misleading operational-state label: ${labels.operationalStateLabel}`);
    assert.ok(!pattern.test(labels.snapshotHeading), `misleading snapshot heading: ${labels.snapshotHeading}`);
  }
}

test("non-real-data statuses never claim Live / Workspace-Derived / Real Time", () => {
  for (const status of ["empty", "idle", "loading", "error"] as const) {
    const presentation = deriveDashboardPresentation({ status });
    assert.equal(presentation.isWorkspaceDerived, false, `${status} must not claim workspace derivation`);
    assertHonest(presentation);
  }
});

test("degraded statuses (loading/error) carry an explanatory notice", () => {
  for (const status of ["loading", "error"] as const) {
    const presentation = deriveDashboardPresentation({ status });
    assert.ok(presentation.fallbackNotice, `${status} must carry an explanatory notice`);
  }
});

test("empty/idle carry no notice — nothing fabricated is rendered to disclaim", () => {
  for (const status of ["empty", "idle"] as const) {
    const presentation = deriveDashboardPresentation({ status });
    assert.equal(presentation.fallbackNotice, null, `${status} renders a dedicated empty state, not disclaimed placeholders`);
    assert.ok(!/placeholder/i.test(presentation.snapshotHeading));
  }
});

test("error notice reads as a technical failure, never as absence of data", () => {
  const presentation = deriveDashboardPresentation({ status: "error" });
  assert.ok(/unable to load/i.test(presentation.fallbackNotice ?? ""), "error notice must state a load failure");
});

test("ready status may claim Live and workspace derivation, with no fallback notice", () => {
  const presentation = deriveDashboardPresentation({ status: "ready" });
  assert.equal(presentation.isWorkspaceDerived, true);
  assert.equal(presentation.operationalStateLabel, "Live");
  assert.equal(presentation.fallbackNotice, null);
});

test("partial status discloses partiality", () => {
  const presentation = deriveDashboardPresentation({ status: "partial" });
  assert.equal(presentation.isWorkspaceDerived, true);
  assert.notEqual(presentation.operationalStateLabel, "Live");
  assert.ok(presentation.fallbackNotice);
});

test("end-to-end: the page's real no-source-data path yields a true empty state", () => {
  // Exactly what src/app/(protected)/dashboard/page.tsx does for a brand-new
  // workspace: no preloaded source data → status 'empty' with null data.
  const apiResponse = runDashboardApiRuntime({ tenantId: "tenant-1", userId: "user-1", includeMetadata: true });
  assert.equal(apiResponse.status, "empty", "no-source-data path should be an explicit empty state");
  assert.equal(apiResponse.data, null, "empty state must never carry a fabricated DTO");
  const viewModel = runDashboardConsumptionRuntime({ apiResponse });
  assert.equal(viewModel.status, "empty");
  assert.equal(viewModel.alertsCount, 0, "empty state must not fabricate alerts");
  assert.equal(viewModel.hasCriticalAttention, false, "empty state must never look critical");
  assert.deepEqual(viewModel.warnings, [], "empty state must not surface diagnostics as content");
  const presentation = deriveDashboardPresentation(viewModel);
  assert.equal(presentation.isWorkspaceDerived, false);
  assertHonest(presentation);
});

test("dashboard page renders states from the presentation module, not hardcoded claims", () => {
  const src = readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
  assert.ok(src.includes("deriveDashboardPresentation"), "page must derive labels from the honest-labels module");
  assert.ok(!/value:\s*"Live"/.test(src), 'page must not hardcode Operational State: "Live"');
  assert.ok(!/>\s*Workspace-Derived Portfolio Snapshot\s*</.test(src), "page must not hardcode a Workspace-Derived heading");
  assert.ok(src.includes("presentation.fallbackNotice"), "page must render the fallback notice on degraded states");
  assert.ok(src.includes("EmptyDashboard"), "page must render the dedicated empty state for empty workspaces");
});
