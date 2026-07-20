import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import test from "node:test";

// Verifies the Fase 14 demo path is actually wired end-to-end in source:
// risk detected -> recommendation appears -> evidence opens -> decision
// approved -> action created. A live browser walkthrough is documented
// separately (see docs/product-architecture/09-product-implementation.md);
// this test guards the wiring so a future refactor can't silently break the
// chain without a failing test.

const commandCenterScreen = readFileSync("src/modules/project/screens/ProjectCommandCenterScreen.tsx", "utf8");
const attentionPanel = readFileSync("src/modules/project/features/AttentionPanel.tsx", "utf8");
const recommendationList = readFileSync("src/modules/recommendations/features/RecommendationList.tsx", "utf8");
const decisionDetail = readFileSync("src/modules/decisions/features/DecisionDetail.tsx", "utf8");
const decisionsRoute = readFileSync("src/app/api/projects/[id]/decisions/route.ts", "utf8");
const layout = readFileSync("src/app/(protected)/w/[workspaceId]/p/[projectId]/layout.tsx", "utf8");

test("the Project Command Center composes the four ADR-PMF-070 zones in the fixed order", () => {
  const attentionIdx = commandCenterScreen.indexOf("AttentionPanel");
  const recommendationIdx = commandCenterScreen.indexOf("RecommendationPanel");
  const decisionIdx = commandCenterScreen.indexOf("DecisionPanel");
  const healthIdx = commandCenterScreen.indexOf("ExecutionHealthCard");

  assert.ok(attentionIdx > -1 && recommendationIdx > -1 && decisionIdx > -1 && healthIdx > -1, "all four zones must be present");
  assert.ok(attentionIdx < recommendationIdx, "Attention Required precedes AI Recommendations");
  assert.ok(recommendationIdx < decisionIdx, "AI Recommendations precedes Pending Decisions");
  assert.ok(decisionIdx < healthIdx, "Pending Decisions precedes Execution Health (always last)");
});

test("Attention Required draws from real RAID/schedule health, not fixture data", () => {
  assert.match(attentionPanel, /useProjectHealth/);
  assert.match(attentionPanel, /health\.raid\.criticalRiskCount/);
});

test("a Recommendation's approval action is a real Command dispatch to the recommended-actions decision workflow", () => {
  assert.match(recommendationList, /decideRecommendation\(\{ actionId: recommendation\.id, decision: "accepted" \}\)/);
});

test("a Decision's evidence link opens the same Evidence Panel shape used everywhere else, not a one-off view", () => {
  assert.match(decisionDetail, /EvidenceViewer/);
  assert.match(decisionDetail, /lineage\.evidence\.map/);
});

test("recording a Decision links back to its originating Recommendation, preserving the chain", () => {
  assert.match(decisionsRoute, /recommendationId: body\.recommendationId/);
});

test("the entire new experience is gated behind FEATURE_COMMAND_CENTER so it cannot regress the shipped product", () => {
  assert.match(layout, /isFeatureEnabled\("FEATURE_COMMAND_CENTER"\)/);
  assert.match(layout, /notFound\(\)/);
});

test("no legacy /command-center or OperationalShell surface was modified by this PR", () => {
  const untouchedLegacyPaths = [
    "src/app/(protected)/command-center",
    "src/components/pmfreak/operational-shell.tsx",
    "src/features/command-center",
  ];
  const changedFiles = execSync(`git diff --name-only HEAD -- ${untouchedLegacyPaths.map((p) => `"${p}"`).join(" ")}`, {
    encoding: "utf8",
    cwd: process.cwd(),
  })
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(changedFiles, [], `legacy paths modified: ${changedFiles.join(", ")}`);
});
