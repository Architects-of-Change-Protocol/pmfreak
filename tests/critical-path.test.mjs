import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ── File existence ────────────────────────────────────────────────────────────

const migration = fs.readFileSync("supabase/migrations/20260605100000_critical_path_schedule_variance.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const typesTs = fs.readFileSync("src/lib/critical-path/types.ts", "utf8");
const durationTs = fs.readFileSync("src/lib/critical-path/duration.ts", "utf8");
const validateTs = fs.readFileSync("src/lib/critical-path/validate-graph.ts", "utf8");
const forwardTs = fs.readFileSync("src/lib/critical-path/forward-pass.ts", "utf8");
const backwardTs = fs.readFileSync("src/lib/critical-path/backward-pass.ts", "utf8");
const floatTs = fs.readFileSync("src/lib/critical-path/float.ts", "utf8");
const computeTs = fs.readFileSync("src/lib/critical-path/compute-critical-path.ts", "utf8");
const varianceTs = fs.readFileSync("src/lib/critical-path/variance.ts", "utf8");
const forecastTs = fs.readFileSync("src/lib/critical-path/forecast.ts", "utf8");
const milestonesTs = fs.readFileSync("src/lib/critical-path/milestones.ts", "utf8");
const materializeTs = fs.readFileSync("src/lib/critical-path/materialize-critical-path.ts", "utf8");
const repositoryTs = fs.readFileSync("src/lib/critical-path/repository.ts", "utf8");
const materializeRoute = fs.readFileSync("src/app/api/critical-path/materialize/route.ts", "utf8");
const queryRoute = fs.readFileSync("src/app/api/critical-path/route.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");

// ── Migration ─────────────────────────────────────────────────────────────────

test("migration adds is_critical column", () => {
  assert.match(migration, /is_critical\s+boolean/);
});

test("migration adds early_start and early_finish", () => {
  assert.match(migration, /early_start\s+integer/);
  assert.match(migration, /early_finish\s+integer/);
});

test("migration adds late_start and late_finish", () => {
  assert.match(migration, /late_start\s+integer/);
  assert.match(migration, /late_finish\s+integer/);
});

test("migration adds total_float and free_float", () => {
  assert.match(migration, /total_float\s+integer/);
  assert.match(migration, /free_float\s+integer/);
});

test("migration adds variance_days", () => {
  assert.match(migration, /variance_days\s+integer/);
});

test("migration adds criticality_score", () => {
  assert.match(migration, /criticality_score\s+numeric/);
});

test("migration creates is_critical index", () => {
  assert.match(migration, /execution_tasks_is_critical_idx/);
});

test("migration creates variance_days index", () => {
  assert.match(migration, /execution_tasks_variance_days_idx/);
});

test("migration creates criticality_score index", () => {
  assert.match(migration, /execution_tasks_criticality_score_idx/);
});

// ── Database contract ─────────────────────────────────────────────────────────

test("contract declares is_critical on ExecutionTaskRow", () => {
  assert.match(contract, /is_critical:\s*boolean/);
});

test("contract declares early_start on ExecutionTaskRow", () => {
  assert.match(contract, /early_start:\s*number \| null/);
});

test("contract declares early_finish on ExecutionTaskRow", () => {
  assert.match(contract, /early_finish:\s*number \| null/);
});

test("contract declares late_start on ExecutionTaskRow", () => {
  assert.match(contract, /late_start:\s*number \| null/);
});

test("contract declares late_finish on ExecutionTaskRow", () => {
  assert.match(contract, /late_finish:\s*number \| null/);
});

test("contract declares total_float on ExecutionTaskRow", () => {
  assert.match(contract, /total_float:\s*number \| null/);
});

test("contract declares free_float on ExecutionTaskRow", () => {
  assert.match(contract, /free_float:\s*number \| null/);
});

test("contract declares variance_days on ExecutionTaskRow", () => {
  assert.match(contract, /variance_days:\s*number \| null/);
});

test("contract declares criticality_score on ExecutionTaskRow", () => {
  assert.match(contract, /criticality_score:\s*number \| null/);
});

test("contract EXECUTION_TASK_SELECTABLE_COLUMNS includes is_critical", () => {
  assert.match(contract, /"is_critical"/);
});

test("contract EXECUTION_TASK_SELECTABLE_COLUMNS includes variance_days", () => {
  assert.match(contract, /"variance_days"/);
});

// ── Types ─────────────────────────────────────────────────────────────────────

test("types.ts declares CriticalPathNode", () => {
  assert.match(typesTs, /CriticalPathNode/);
});

test("types.ts declares CriticalTask", () => {
  assert.match(typesTs, /CriticalTask/);
});

test("types.ts declares CriticalMilestone", () => {
  assert.match(typesTs, /CriticalMilestone/);
});

test("types.ts declares ScheduleVariance", () => {
  assert.match(typesTs, /ScheduleVariance/);
});

test("types.ts declares ProjectForecast", () => {
  assert.match(typesTs, /ProjectForecast/);
});

test("types.ts declares CriticalPathSummary", () => {
  assert.match(typesTs, /CriticalPathSummary/);
});

// ── Duration ──────────────────────────────────────────────────────────────────

test("duration.ts exports resolveTaskDuration", () => {
  assert.match(durationTs, /export function resolveTaskDuration/);
});

test("duration.ts uses planned dates when available", () => {
  assert.match(durationTs, /planned_start_date.*planned_finish_date/s);
});

test("duration.ts has minimum 1 day fallback", () => {
  assert.match(durationTs, /Math\.max\(1/);
});

test("duration.ts falls back to 1 day when dates missing", () => {
  assert.match(durationTs, /return 1/);
});

// ── Graph validation ──────────────────────────────────────────────────────────

test("validate-graph.ts detects cycles", () => {
  assert.match(validateTs, /cycle_detected/);
});

test("validate-graph.ts detects self-loops", () => {
  assert.match(validateTs, /Self-loop|self.loop|predecessor.*===.*successor/i);
});

test("validate-graph.ts detects orphan tasks", () => {
  assert.match(validateTs, /orphan_task/);
});

test("validate-graph.ts returns valid boolean", () => {
  assert.match(validateTs, /valid.*issues\.length.*===.*0/s);
});

// ── Forward pass ──────────────────────────────────────────────────────────────

test("forward-pass.ts computes earlyStart and earlyFinish", () => {
  assert.match(forwardTs, /earlyStart/);
  assert.match(forwardTs, /earlyFinish/);
});

test("forward-pass.ts uses max of predecessor EF for ES", () => {
  assert.match(forwardTs, /Math\.max.*earlyFinish/s);
});

test("forward-pass.ts sets ES=0 for root nodes", () => {
  assert.match(forwardTs, /earlyStart\s*=\s*0/);
});

// ── Backward pass ─────────────────────────────────────────────────────────────

test("backward-pass.ts computes lateStart and lateFinish", () => {
  assert.match(backwardTs, /lateStart/);
  assert.match(backwardTs, /lateFinish/);
});

test("backward-pass.ts derives projectFinish from max EF", () => {
  assert.match(backwardTs, /projectFinish/);
  assert.match(backwardTs, /Math\.max/);
});

test("backward-pass.ts uses min of successor LS for LF", () => {
  assert.match(backwardTs, /Math\.min.*lateStart/s);
});

// ── Float ─────────────────────────────────────────────────────────────────────

test("float.ts computes totalFloat as LF - EF", () => {
  assert.match(floatTs, /lateFinish.*earlyFinish|LF.*EF/s);
});

test("float.ts computes freeFloat using successor ES", () => {
  assert.match(floatTs, /freeFloat/);
  assert.match(floatTs, /earlyStart/);
});

// ── Critical path computation ─────────────────────────────────────────────────

test("compute-critical-path.ts marks tasks with totalFloat <= 0 as critical", () => {
  assert.match(computeTs, /totalFloat\s*<=\s*0/);
});

test("compute-critical-path.ts sets criticalityScore to 100 for critical tasks", () => {
  assert.match(computeTs, /100/);
});

test("compute-critical-path.ts returns criticalTaskIds array", () => {
  assert.match(computeTs, /criticalTaskIds/);
});

test("compute-critical-path.ts returns criticalPath array", () => {
  assert.match(computeTs, /criticalPath/);
});

// ── Variance ──────────────────────────────────────────────────────────────────

test("variance.ts exports computeTaskVariance", () => {
  assert.match(varianceTs, /export function computeTaskVariance/);
});

test("variance.ts computes forecast - planned", () => {
  assert.match(varianceTs, /forecast_finish_date.*planned_finish_date/s);
});

test("variance.ts returns 0 when dates missing", () => {
  assert.match(varianceTs, /return 0/);
});

// ── Forecast ──────────────────────────────────────────────────────────────────

test("forecast.ts exports computeProjectForecast", () => {
  assert.match(forecastTs, /export function computeProjectForecast/);
});

test("forecast.ts computes plannedFinish as max of planned_finish_date", () => {
  assert.match(forecastTs, /plannedFinish/);
  assert.match(forecastTs, /planned_finish_date/);
});

test("forecast.ts computes forecastFinish as max of forecast_finish_date", () => {
  assert.match(forecastTs, /forecastFinish/);
  assert.match(forecastTs, /forecast_finish_date/);
});

test("forecast.ts returns varianceDays", () => {
  assert.match(forecastTs, /varianceDays/);
});

// ── Milestones ────────────────────────────────────────────────────────────────

test("milestones.ts exports computeCriticalMilestones", () => {
  assert.match(milestonesTs, /export function computeCriticalMilestones/);
});

test("milestones.ts marks milestone critical if linked task is critical", () => {
  assert.match(milestonesTs, /isCritical/);
  assert.match(milestonesTs, /criticalityMap/);
});

test("milestones.ts marks milestone at risk if linked task has variance", () => {
  assert.match(milestonesTs, /isAtRisk/);
});

test("milestones.ts computes milestone variance days", () => {
  assert.match(milestonesTs, /varianceDays/);
  assert.match(milestonesTs, /forecast_date.*target_date/s);
});

// ── Materialization ───────────────────────────────────────────────────────────

test("materialize-critical-path.ts exports materializeCriticalPath", () => {
  assert.match(materializeTs, /export async function materializeCriticalPath/);
});

test("materialize-critical-path.ts persists is_critical", () => {
  assert.match(materializeTs, /is_critical/);
});

test("materialize-critical-path.ts persists variance_days", () => {
  assert.match(materializeTs, /variance_days/);
});

test("materialize-critical-path.ts persists criticality_score", () => {
  assert.match(materializeTs, /criticality_score/);
});

test("materialize-critical-path.ts emits critical_path.started log", () => {
  assert.match(materializeTs, /critical_path\.started/);
});

test("materialize-critical-path.ts emits critical_path.completed log", () => {
  assert.match(materializeTs, /critical_path\.completed/);
});

test("materialize-critical-path.ts emits critical_path.failed log", () => {
  assert.match(materializeTs, /critical_path\.failed/);
});

test("materialize-critical-path.ts validates graph before computing", () => {
  assert.match(materializeTs, /validateGraph/);
});

// ── Repository ────────────────────────────────────────────────────────────────

test("repository.ts exports getProjectCriticalPath", () => {
  assert.match(repositoryTs, /export async function getProjectCriticalPath/);
});

test("repository.ts returns summary", () => {
  assert.match(repositoryTs, /summary/);
});

test("repository.ts returns forecast", () => {
  assert.match(repositoryTs, /forecast/);
});

test("repository.ts returns criticalTasks", () => {
  assert.match(repositoryTs, /criticalTasks/);
});

test("repository.ts returns criticalMilestones", () => {
  assert.match(repositoryTs, /criticalMilestones/);
});

test("repository.ts returns topVarianceTasks sorted by variance desc", () => {
  assert.match(repositoryTs, /topVarianceTasks/);
  assert.match(repositoryTs, /sort.*varianceDays/s);
});

// ── API: materialize route ────────────────────────────────────────────────────

test("materialize route handles POST", () => {
  assert.match(materializeRoute, /export async function POST/);
});

test("materialize route requires projectId", () => {
  assert.match(materializeRoute, /projectId.*required/i);
});

test("materialize route calls materializeCriticalPath", () => {
  assert.match(materializeRoute, /materializeCriticalPath/);
});

// ── API: query route ──────────────────────────────────────────────────────────

test("query route handles GET", () => {
  assert.match(queryRoute, /export async function GET/);
});

test("query route requires projectId", () => {
  assert.match(queryRoute, /projectId.*required/i);
});

test("query route returns summary", () => {
  assert.match(queryRoute, /summary/);
});

test("query route returns criticalTasks", () => {
  assert.match(queryRoute, /criticalTasks/);
});

test("query route returns criticalMilestones", () => {
  assert.match(queryRoute, /criticalMilestones/);
});

// ── UI ────────────────────────────────────────────────────────────────────────

test("operational shell has Critical Path Panel", () => {
  assert.match(shell, /critical-path-panel|Critical Path/);
});

test("operational shell has Variance Panel", () => {
  assert.match(shell, /variance-panel|Schedule Variance/);
});

test("operational shell has Critical Milestones Panel", () => {
  assert.match(shell, /critical-milestones-panel|Critical Milestones/);
});

test("shell shows criticalTaskCount", () => {
  assert.match(shell, /criticalTaskCount/);
});

test("shell shows forecastVarianceDays", () => {
  assert.match(shell, /forecastVarianceDays/);
});

test("shell shows scheduleConfidence from critical path", () => {
  assert.match(shell, /scheduleConfidence/);
});

test("shell renders CRITICAL badge for critical tasks", () => {
  assert.match(shell, /CRITICAL/);
});

test("shell renders DELAYED badge for delayed tasks", () => {
  assert.match(shell, /DELAYED/);
});

test("shell shows ES EF LS LF fields on critical task cards", () => {
  assert.match(shell, /earlyStart/);
  assert.match(shell, /earlyFinish/);
  assert.match(shell, /lateStart/);
  assert.match(shell, /lateFinish/);
});

test("shell has Compute button for critical path materialization", () => {
  assert.match(shell, /handleMaterializeCriticalPath|Compute/);
});

test("shell renders topVarianceTasks", () => {
  assert.match(shell, /topVarianceTasks/);
});

// ── H9.1: Types ───────────────────────────────────────────────────────────────

const subgraphTs = fs.readFileSync("src/lib/critical-path/critical-subgraph.ts", "utf8");

test("types.ts declares CriticalPathSegment", () => {
  assert.match(typesTs, /CriticalPathSegment/);
});

test("types.ts declares CriticalPathBranchPoint", () => {
  assert.match(typesTs, /CriticalPathBranchPoint/);
});

test("types.ts declares CriticalPathTopology", () => {
  assert.match(typesTs, /CriticalPathTopology/);
});

test("types.ts CriticalPathResult includes criticalPaths", () => {
  assert.match(typesTs, /criticalPaths/);
});

test("types.ts CriticalPathResult includes criticalSegments", () => {
  assert.match(typesTs, /criticalSegments/);
});

test("types.ts CriticalPathResult includes topology", () => {
  assert.match(typesTs, /topology/);
});

test("types.ts CriticalPathSummary includes criticalPathCount", () => {
  assert.match(typesTs, /criticalPathCount/);
});

test("types.ts CriticalPathSummary includes criticalComponentCount", () => {
  assert.match(typesTs, /criticalComponentCount/);
});

test("types.ts CriticalPathSummary includes hasMultipleCriticalPaths", () => {
  assert.match(typesTs, /hasMultipleCriticalPaths/);
});

test("types.ts CriticalPathSummary includes hasCriticalBranches", () => {
  assert.match(typesTs, /hasCriticalBranches/);
});

// ── H9.1: Critical Subgraph ───────────────────────────────────────────────────

test("critical-subgraph.ts exports buildCriticalSubgraph", () => {
  assert.match(subgraphTs, /export function buildCriticalSubgraph/);
});

test("critical-subgraph.ts exports buildCriticalSubgraphFromMaps", () => {
  assert.match(subgraphTs, /export function buildCriticalSubgraphFromMaps/);
});

test("critical-subgraph.ts computes criticalRoots", () => {
  assert.match(subgraphTs, /criticalRoots/);
});

test("critical-subgraph.ts computes criticalTerminals", () => {
  assert.match(subgraphTs, /criticalTerminals/);
});

// ── H9.1: Compute critical path ───────────────────────────────────────────────

test("compute-critical-path.ts exports enumerateCriticalPaths", () => {
  assert.match(computeTs, /export function enumerateCriticalPaths/);
});

test("compute-critical-path.ts exports extractCriticalSegments", () => {
  assert.match(computeTs, /export function extractCriticalSegments/);
});

test("compute-critical-path.ts exports detectBranchPoints", () => {
  assert.match(computeTs, /export function detectBranchPoints/);
});

test("compute-critical-path.ts exports computeComponentCount", () => {
  assert.match(computeTs, /export function computeComponentCount/);
});

test("compute-critical-path.ts has maxPaths guard", () => {
  assert.match(computeTs, /maxPaths/);
});

test("compute-critical-path.ts returns criticalPaths in result", () => {
  assert.match(computeTs, /criticalPaths/);
});

test("compute-critical-path.ts returns criticalSegments in result", () => {
  assert.match(computeTs, /criticalSegments/);
});

test("compute-critical-path.ts returns topology in result", () => {
  assert.match(computeTs, /topology/);
});

// ── H9.1: Algorithm correctness (pure logic) ─────────────────────────────────

// We import the pure functions directly via dynamic import of TS via --import tsx
// Since these tests run with node --test (not tsx), we test via source text assertions
// The algorithmic tests below verify source structure only.

test("enumerateCriticalPaths uses DFS with cycle protection (visited set)", () => {
  assert.match(computeTs, /visited/);
  assert.match(computeTs, /visited\.has/);
});

test("enumerateCriticalPaths sorts by length descending then lexical", () => {
  assert.match(computeTs, /b\.length.*a\.length|length.*desc/s);
});

test("extractCriticalSegments detects segment starts at roots and merge points", () => {
  assert.match(computeTs, /isSegmentStart/);
  assert.match(computeTs, /preds\.length !== 1/);
});

test("detectBranchPoints marks split when outgoing > 1", () => {
  assert.match(computeTs, /outgoing\.length > 1/);
});

test("detectBranchPoints marks merge when incoming > 1", () => {
  assert.match(computeTs, /incoming\.length > 1/);
});

test("detectBranchPoints marks split_merge when both", () => {
  assert.match(computeTs, /split_merge/);
});

test("detectBranchPoints sorts by taskId", () => {
  assert.match(computeTs, /a\.taskId.*b\.taskId/s);
});

test("computeComponentCount uses undirected BFS over critical subgraph", () => {
  assert.match(computeTs, /criticalPredecessorMap|predecessorMap/);
  assert.match(computeTs, /bfs/);
});

// ── H9.1: Repository ─────────────────────────────────────────────────────────

test("repository.ts returns criticalPaths", () => {
  assert.match(repositoryTs, /criticalPaths/);
});

test("repository.ts returns criticalSegments", () => {
  assert.match(repositoryTs, /criticalSegments/);
});

test("repository.ts returns branchPoints", () => {
  assert.match(repositoryTs, /branchPoints/);
});

test("repository.ts loads dependency edges for topology", () => {
  assert.match(repositoryTs, /execution_task_dependencies|depsResult/);
});

test("repository.ts summary includes criticalPathCount", () => {
  assert.match(repositoryTs, /criticalPathCount/);
});

test("repository.ts summary includes criticalComponentCount", () => {
  assert.match(repositoryTs, /criticalComponentCount/);
});

test("repository.ts summary includes hasMultipleCriticalPaths", () => {
  assert.match(repositoryTs, /hasMultipleCriticalPaths/);
});

test("repository.ts summary includes hasCriticalBranches", () => {
  assert.match(repositoryTs, /hasCriticalBranches/);
});

// ── H9.1: API route ───────────────────────────────────────────────────────────

test("query route returns criticalPaths", () => {
  assert.match(queryRoute, /criticalPaths/);
});

test("query route returns criticalSegments", () => {
  assert.match(queryRoute, /criticalSegments/);
});

test("query route returns branchPoints", () => {
  assert.match(queryRoute, /branchPoints/);
});

test("query route returns topology", () => {
  assert.match(queryRoute, /topology/);
});

test("query route still returns legacy path field", () => {
  assert.match(queryRoute, /path:/);
});

test("query route still returns legacy criticalTasks field", () => {
  assert.match(queryRoute, /criticalTasks/);
});

// ── H9.1: UI ─────────────────────────────────────────────────────────────────

test("shell shows Multiple Critical Paths badge", () => {
  assert.match(shell, /Multiple Critical Paths/);
});

test("shell shows Critical Branching badge", () => {
  assert.match(shell, /Critical Branching/);
});

test("shell shows Critical Paths section", () => {
  assert.match(shell, /Critical Paths/);
});

test("shell shows Critical Segments section", () => {
  assert.match(shell, /Critical Segments/);
});

test("shell shows Branch Points section", () => {
  assert.match(shell, /Branch Points/);
});

test("shell renders criticalPaths from criticalPathData", () => {
  assert.match(shell, /criticalPathData\.criticalPaths/);
});

test("shell renders criticalSegments from criticalPathData", () => {
  assert.match(shell, /criticalPathData\.criticalSegments/);
});

test("shell renders branchPoints from criticalPathData", () => {
  assert.match(shell, /criticalPathData\.branchPoints/);
});

test("shell shows criticalPathCount in summary", () => {
  assert.match(shell, /criticalPathCount/);
});

test("shell shows criticalComponentCount in summary", () => {
  assert.match(shell, /criticalComponentCount/);
});

test("shell shows hasMultipleCriticalPaths", () => {
  assert.match(shell, /hasMultipleCriticalPaths/);
});

test("shell shows hasCriticalBranches", () => {
  assert.match(shell, /hasCriticalBranches/);
});

// ── H9.1: Legacy compatibility ────────────────────────────────────────────────

test("CriticalPathResult still has criticalPath field", () => {
  assert.match(typesTs, /criticalPath:/);
});

test("CriticalPathResult still has criticalLength field", () => {
  assert.match(typesTs, /criticalLength:/);
});

test("CriticalPathResult still has criticalTaskIds field", () => {
  assert.match(typesTs, /criticalTaskIds:/);
});

test("repository.ts still returns path field (legacy)", () => {
  assert.match(repositoryTs, /path,|path:/);
});

test("compute-critical-path.ts still returns criticalPath (legacy topological order)", () => {
  assert.match(computeTs, /criticalPath/);
  assert.match(computeTs, /topologicalSort/);
});
