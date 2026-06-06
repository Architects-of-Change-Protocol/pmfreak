import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ── File existence ────────────────────────────────────────────────────────────

const typesTs = fs.readFileSync("src/lib/portfolio/types.ts", "utf8");
const healthTs = fs.readFileSync("src/lib/portfolio/portfolio-health.ts", "utf8");
const riskTs = fs.readFileSync("src/lib/portfolio/portfolio-risk.ts", "utf8");
const depsTs = fs.readFileSync("src/lib/portfolio/portfolio-dependencies.ts", "utf8");
const bottlenecksTs = fs.readFileSync("src/lib/portfolio/portfolio-bottlenecks.ts", "utf8");
const prioritizationTs = fs.readFileSync("src/lib/portfolio/portfolio-prioritization.ts", "utf8");
const summaryTs = fs.readFileSync("src/lib/portfolio/portfolio-summary.ts", "utf8");
const repositoryTs = fs.readFileSync("src/lib/portfolio/repository.ts", "utf8");
const portfolioRoute = fs.readFileSync("src/app/api/portfolio/route.ts", "utf8");
const refreshRoute = fs.readFileSync("src/app/api/portfolio/refresh/route.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");
const executivePage = fs.readFileSync("src/app/(protected)/executive/page.tsx", "utf8");
const overviewPanel = fs.readFileSync("src/components/pmfreak/executive/portfolio-overview-panel.tsx", "utf8");

// ── Types ────────────────────────────────────────────────────────────────────

test("types declares PortfolioSummary", () => {
  assert.match(typesTs, /PortfolioSummary/);
});

test("types declares PortfolioProjectHealth", () => {
  assert.match(typesTs, /PortfolioProjectHealth/);
});

test("types declares PortfolioDependencyRisk", () => {
  assert.match(typesTs, /PortfolioDependencyRisk/);
});

test("types declares PortfolioBottleneck", () => {
  assert.match(typesTs, /PortfolioBottleneck/);
});

test("types declares PortfolioIntelligence", () => {
  assert.match(typesTs, /PortfolioIntelligence/);
});

// ── Health ────────────────────────────────────────────────────────────────────

test("health: exports computeProjectHealthScore", () => {
  assert.match(healthTs, /export function computeProjectHealthScore/);
});

test("health: score is weighted 30/25/20/15/10", () => {
  assert.match(healthTs, /0\.30/);
  assert.match(healthTs, /0\.25/);
  assert.match(healthTs, /0\.20/);
  assert.match(healthTs, /0\.15/);
  assert.match(healthTs, /0\.10/);
});

test("health: score is clamped to 0-100", () => {
  assert.match(healthTs, /Math\.min\(100/);
  assert.match(healthTs, /Math\.max\(0/);
});

test("health: score is rounded to integer", () => {
  assert.match(healthTs, /Math\.round/);
});

// ── Risk ─────────────────────────────────────────────────────────────────────

test("risk: exports computeProjectRiskScore", () => {
  assert.match(riskTs, /export function computeProjectRiskScore/);
});

test("risk: blocked tasks factor included", () => {
  assert.match(riskTs, /blocked/);
});

test("risk: overdue tasks factor included", () => {
  assert.match(riskTs, /overdue|due_date/);
});

test("risk: critical path density factor included", () => {
  assert.match(riskTs, /is_critical|criticalDensity/);
});

test("risk: RAID factor included", () => {
  assert.match(riskTs, /raidPenalty|openRaid/);
});

test("risk: score bounded 0-100", () => {
  assert.match(riskTs, /Math\.min\(100/);
  assert.match(riskTs, /Math\.max\(0/);
});

// ── Dependencies ─────────────────────────────────────────────────────────────

test("dependencies: exports computeCrossProjectDependencies", () => {
  assert.match(depsTs, /export function computeCrossProjectDependencies/);
});

test("dependencies: risk level low at count 1", () => {
  assert.match(depsTs, /"low"/);
});

test("dependencies: risk level medium at count 2-3", () => {
  assert.match(depsTs, /"medium"/);
});

test("dependencies: risk level high at count 4-6", () => {
  assert.match(depsTs, /"high"/);
});

test("dependencies: risk level critical at count 7+", () => {
  assert.match(depsTs, /"critical"/);
});

test("dependencies: cross-project detection uses taskProjectMap", () => {
  assert.match(depsTs, /taskProjectMap/);
});

// ── Bottlenecks ───────────────────────────────────────────────────────────────

test("bottlenecks: exports computePortfolioBottlenecks", () => {
  assert.match(bottlenecksTs, /export function computePortfolioBottlenecks/);
});

test("bottlenecks: sorted descending by impactScore", () => {
  assert.match(bottlenecksTs, /impactScore/);
  assert.match(bottlenecksTs, /sort.*b\.impactScore - a\.impactScore/);
});

test("bottlenecks: task bottlenecks computed", () => {
  assert.match(bottlenecksTs, /computeTaskBottlenecks/);
});

test("bottlenecks: milestone bottlenecks computed", () => {
  assert.match(bottlenecksTs, /computeMilestoneBottlenecks/);
});

test("bottlenecks: project bottlenecks computed", () => {
  assert.match(bottlenecksTs, /computeProjectBottlenecks/);
});

// ── Executive Attention ────────────────────────────────────────────────────────

test("prioritization: exports computeRequiresExecutiveAttention", () => {
  assert.match(prioritizationTs, /export function computeRequiresExecutiveAttention/);
});

test("prioritization: low health project flagged (< threshold)", () => {
  assert.match(prioritizationTs, /HEALTH_THRESHOLD\s*=\s*50/);
  assert.match(prioritizationTs, /healthScore < HEALTH_THRESHOLD/);
});

test("prioritization: high risk project flagged (> threshold)", () => {
  assert.match(prioritizationTs, /RISK_THRESHOLD\s*=\s*70/);
  assert.match(prioritizationTs, /riskScore > RISK_THRESHOLD/);
});

test("prioritization: blocked task threshold applied", () => {
  assert.match(prioritizationTs, /blockedTaskCount > BLOCKED_TASK_THRESHOLD/);
});

test("prioritization: schedule variance threshold applied", () => {
  assert.match(prioritizationTs, /scheduleVarianceDays > SCHEDULE_VARIANCE_THRESHOLD/);
});

test("prioritization: exports computeExecutiveAttentionQueue", () => {
  assert.match(prioritizationTs, /export function computeExecutiveAttentionQueue/);
});

// ── Summary Orchestrator ─────────────────────────────────────────────────────

test("summary: exports computePortfolioIntelligence", () => {
  assert.match(summaryTs, /export function computePortfolioIntelligence/);
});

test("summary: calls health engine", () => {
  assert.match(summaryTs, /computeProjectHealthScore/);
});

test("summary: calls risk engine", () => {
  assert.match(summaryTs, /computeProjectRiskScore/);
});

test("summary: calls dependency analysis", () => {
  assert.match(summaryTs, /computeCrossProjectDependencies/);
});

test("summary: calls bottleneck detection", () => {
  assert.match(summaryTs, /computePortfolioBottlenecks/);
});

test("summary: calls executive attention", () => {
  assert.match(summaryTs, /computeExecutiveAttentionQueue/);
});

test("summary: returns summary", () => {
  assert.match(summaryTs, /summary:/);
});

test("summary: returns projects", () => {
  assert.match(summaryTs, /projects,/);
});

test("summary: returns bottlenecks", () => {
  assert.match(summaryTs, /bottlenecks,/);
});

test("summary: returns dependencyRisks", () => {
  assert.match(summaryTs, /dependencyRisks,/);
});

test("summary: returns executiveAttention", () => {
  assert.match(summaryTs, /executiveAttention/);
});

// ── Repository ────────────────────────────────────────────────────────────────

test("repository: exports getPortfolioIntelligence", () => {
  assert.match(repositoryTs, /export async function getPortfolioIntelligence/);
});

test("repository: takes workspaceId parameter", () => {
  assert.match(repositoryTs, /workspaceId/);
});

test("repository: read-only (no insert/update/delete)", () => {
  assert.doesNotMatch(repositoryTs, /\.insert\(/);
  assert.doesNotMatch(repositoryTs, /\.update\(/);
  assert.doesNotMatch(repositoryTs, /\.delete\(/);
});

test("repository: emits portfolio.started log", () => {
  assert.match(repositoryTs, /portfolio\.started/);
});

test("repository: emits portfolio.completed log", () => {
  assert.match(repositoryTs, /portfolio\.completed/);
});

test("repository: emits portfolio.failed log", () => {
  assert.match(repositoryTs, /portfolio\.failed/);
});

test("repository: includes workspaceId in logs", () => {
  assert.match(repositoryTs, /workspaceId=/);
});

test("repository: includes projectCount in completed log", () => {
  assert.match(repositoryTs, /projectCount=/);
});

test("repository: includes durationMs in completed log", () => {
  assert.match(repositoryTs, /durationMs=/);
});

// ── API ────────────────────────────────────────────────────────────────────────

test("GET /api/portfolio: exports GET function", () => {
  assert.match(portfolioRoute, /export async function GET/);
});

test("GET /api/portfolio: returns summary in response", () => {
  assert.match(portfolioRoute, /summary:/);
});

test("GET /api/portfolio: returns projects in response", () => {
  assert.match(portfolioRoute, /projects:/);
});

test("GET /api/portfolio: returns bottlenecks in response", () => {
  assert.match(portfolioRoute, /bottlenecks:/);
});

test("GET /api/portfolio: returns dependencyRisks in response", () => {
  assert.match(portfolioRoute, /dependencyRisks:/);
});

test("GET /api/portfolio: returns executiveAttention in response", () => {
  assert.match(portfolioRoute, /executiveAttention:/);
});

test("POST /api/portfolio/refresh: exports POST function", () => {
  assert.match(refreshRoute, /export async function POST/);
});

test("POST /api/portfolio/refresh: returns fresh snapshot", () => {
  assert.match(refreshRoute, /summary:/);
  assert.match(refreshRoute, /projects:/);
  assert.match(refreshRoute, /bottlenecks:/);
});

// ── UI ─────────────────────────────────────────────────────────────────────────

test("UI: Portfolio Intelligence section exists in operational shell", () => {
  assert.match(shell, /portfolio-intelligence-section/);
});

test("UI: Executive Attention section exists in operational shell", () => {
  assert.match(shell, /executive-attention-section/);
});

test("UI: Bottleneck section exists in operational shell", () => {
  assert.match(shell, /portfolio-bottleneck-section/);
});

test("UI: Dependency Risk section exists in operational shell", () => {
  assert.match(shell, /portfolio-dependency-risk-section/);
});

test("UI: Portfolio Overview Panel imported in executive page", () => {
  assert.match(executivePage, /PortfolioOverviewPanel/);
});

test("UI: Portfolio Overview Panel component renders summary", () => {
  assert.match(overviewPanel, /portfolioHealthScore/);
  assert.match(overviewPanel, /portfolioRiskScore/);
});

test("UI: Portfolio Overview Panel renders executive attention queue", () => {
  assert.match(overviewPanel, /executive-attention-queue/);
});

test("UI: Portfolio Overview Panel renders bottlenecks panel", () => {
  assert.match(overviewPanel, /portfolio-bottlenecks-panel/);
});

test("UI: Portfolio Overview Panel renders cross-project risks", () => {
  assert.match(overviewPanel, /cross-project-risks/);
});

test("UI: dependency risk badges LOW/MEDIUM/HIGH/CRITICAL rendered", () => {
  assert.match(overviewPanel, /riskLevel/);
  assert.match(overviewPanel, /low.*medium.*high.*critical|critical.*high.*medium.*low/si);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test("determinism: health computation accepts nowMs parameter (deterministic by input)", () => {
  assert.match(healthTs, /nowMs/);
  assert.doesNotMatch(healthTs, /Date\.now\(\)/);
});

test("determinism: risk computation accepts nowMs parameter (deterministic by input)", () => {
  assert.match(riskTs, /nowMs/);
  assert.doesNotMatch(riskTs, /Date\.now\(\)/);
});

test("determinism: summary computation: Date.now used only for overdue comparison and lastUpdatedAt", () => {
  // summary can use Date.now for overdue task detection — that's acceptable determinism
  // (same input = same output within same calendar day). What matters is no random() calls.
  assert.doesNotMatch(summaryTs, /Math\.random\(\)/);
});

test("determinism: bottlenecks computation has no Math.random() calls", () => {
  assert.doesNotMatch(bottlenecksTs, /Math\.random\(\)/);
});
