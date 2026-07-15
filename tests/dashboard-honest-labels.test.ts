/**
 * Pilot Gate Sprint 01 — Task 5 (M-01, honest dashboard labeling).
 *
 * The dashboard must never present fallback-DTO numbers under "Live" /
 * "Workspace-Derived" / "Real Time" labeling. Covers the pure presentation
 * derivation and the real end-to-end fallback path the /dashboard page
 * exercises today (no preloaded source data → fallback DTO → 'empty').
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

test("fallback statuses never claim Live / Workspace-Derived / Real Time", () => {
  for (const status of ["empty", "idle", "loading", "error"] as const) {
    const presentation = deriveDashboardPresentation({ status });
    assert.equal(presentation.isWorkspaceDerived, false, `${status} must not claim workspace derivation`);
    assert.ok(presentation.fallbackNotice, `${status} must carry an explanatory notice`);
    assertHonest(presentation);
  }
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

test("end-to-end: the page's real no-source-data path yields fallback labeling", () => {
  // Exactly what src/app/(protected)/dashboard/page.tsx does today: no
  // preloaded source data → every report resolves undefined → fallback DTO.
  const apiResponse = runDashboardApiRuntime({ tenantId: "tenant-1", userId: "user-1", includeMetadata: true });
  assert.equal(apiResponse.status, "empty", "no-source-data path should produce the fallback DTO");
  const viewModel = runDashboardConsumptionRuntime({ apiResponse });
  assert.equal(viewModel.status, "empty");
  const presentation = deriveDashboardPresentation(viewModel);
  assert.equal(presentation.isWorkspaceDerived, false);
  assert.ok(presentation.fallbackNotice);
  assertHonest(presentation);
});

test("dashboard page renders labels from the presentation module, not hardcoded claims", () => {
  const src = readFileSync("src/app/(protected)/dashboard/page.tsx", "utf8");
  assert.ok(src.includes("deriveDashboardPresentation"), "page must derive labels from the honest-labels module");
  assert.ok(!/value:\s*"Live"/.test(src), 'page must not hardcode Operational State: "Live"');
  assert.ok(!/>\s*Workspace-Derived Portfolio Snapshot\s*</.test(src), "page must not hardcode a Workspace-Derived heading");
  assert.ok(src.includes("presentation.fallbackNotice"), "page must render the fallback notice");
});
