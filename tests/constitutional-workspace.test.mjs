import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types         = readFileSync('src/lib/constitutional-workspace/types.ts', 'utf8');
const builder       = readFileSync('src/lib/constitutional-workspace/workspace-builder.ts', 'utf8');
const summary       = readFileSync('src/lib/constitutional-workspace/workspace-summary.ts', 'utf8');
const exportFile    = readFileSync('src/lib/constitutional-workspace/workspace-export.ts', 'utf8');
const indexFile     = readFileSync('src/lib/constitutional-workspace/index.ts', 'utf8');
const docs          = readFileSync('docs/constitutional-workspace-foundation.md', 'utf8');
const dbContract    = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Database contract ────────────────────────────────────────────────────────

test('DATABASE_CONTRACT_VERSION preserves all prior keywords', () => {
  assert.match(dbContract, /platform-events/);
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /executive-brief/);
  assert.match(dbContract, /governance-brief/);
  assert.match(dbContract, /operational-brief/);
  assert.match(dbContract, /portfolio-brief/);
  assert.match(dbContract, /constitutional-dashboard/);
});

test('DATABASE_CONTRACT_VERSION includes constitutional-workspace suffix', () => {
  assert.match(dbContract, /constitutional-workspace/);
  const dashIdx = dbContract.indexOf('constitutional-dashboard');
  const wsIdx   = dbContract.indexOf('constitutional-workspace');
  assert.ok(wsIdx > dashIdx, 'constitutional-workspace must appear after constitutional-dashboard');
});

// ─── Types — ConstitutionalWorkspace ─────────────────────────────────────────

test('ConstitutionalWorkspace has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'generatedAt', 'workspaceSummary', 'evidenceSummary',
    'knowledgeSummary', 'briefSummary', 'dashboardSummary', 'governanceSummary',
    'contradictions', 'unknowns', 'lineage', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ConstitutionalWorkspace missing field: ${field}`);
  }
});

// ─── Types — ConstitutionalWorkspaceSummary ───────────────────────────────────

test('ConstitutionalWorkspaceSummary has all required fields', () => {
  for (const field of [
    'evidenceCount', 'memoryCount', 'patternCount', 'effectivenessCount',
    'contextPackageCount', 'briefCount', 'dashboardCount',
    'contradictionCount', 'unknownCount',
  ]) {
    assert.match(types, new RegExp(field), `ConstitutionalWorkspaceSummary missing: ${field}`);
  }
});

// ─── Types — WorkspaceKnowledgeSummary ───────────────────────────────────────

test('WorkspaceKnowledgeSummary has all required fields', () => {
  for (const field of [
    'memoryCount', 'organizationalMemoryCount', 'personalMemoryCount',
    'patternCount', 'organizationalPatternCount', 'personalPatternCount',
    'effectivenessCount', 'organizationalEffectivenessCount', 'personalEffectivenessCount',
  ]) {
    assert.match(types, new RegExp(field), `WorkspaceKnowledgeSummary missing: ${field}`);
  }
});

// ─── Types — WorkspaceBriefSummary ───────────────────────────────────────────

test('WorkspaceBriefSummary has all required fields', () => {
  for (const field of [
    'constitutionalBriefCount', 'executiveBriefCount', 'governanceBriefCount',
    'operationalBriefCount', 'portfolioBriefCount',
  ]) {
    assert.match(types, new RegExp(field), `WorkspaceBriefSummary missing: ${field}`);
  }
});

// ─── Types — WorkspaceDashboardSummary ───────────────────────────────────────

test('WorkspaceDashboardSummary has all required fields', () => {
  for (const field of [
    'executiveDashboardCount', 'governanceDashboardCount', 'operationalDashboardCount',
    'portfolioDashboardCount', 'workspaceDashboardCount', 'mixedDashboardCount',
  ]) {
    assert.match(types, new RegExp(field), `WorkspaceDashboardSummary missing: ${field}`);
  }
});

// ─── Types — WorkspaceGovernanceSummary ──────────────────────────────────────

test('WorkspaceGovernanceSummary has all required fields', () => {
  for (const field of [
    'authorityArtifactCount', 'delegationArtifactCount', 'capabilityArtifactCount',
    'trustArtifactCount', 'policyArtifactCount',
  ]) {
    assert.match(types, new RegExp(field), `WorkspaceGovernanceSummary missing: ${field}`);
  }
});

// ─── Types — WorkspaceLineage ─────────────────────────────────────────────────

test('WorkspaceLineage has all required fields', () => {
  for (const field of ['artifactType', 'artifactId', 'sourceType', 'sourceId', 'reasonIncluded']) {
    assert.match(types, new RegExp(field), `WorkspaceLineage missing: ${field}`);
  }
});

// ─── Types — WorkspaceHealth ──────────────────────────────────────────────────

test('WorkspaceHealth has all required fields', () => {
  for (const field of [
    'evidenceCount', 'memoryCount', 'patternCount', 'effectivenessCount',
    'briefCount', 'dashboardCount', 'contradictionCount', 'unknownCount', 'coverageMetrics',
  ]) {
    assert.match(types, new RegExp(field), `WorkspaceHealth missing: ${field}`);
  }
});

// ─── Types — Audit events ─────────────────────────────────────────────────────

test('all audit event types are declared', () => {
  assert.match(types, /CONSTITUTIONAL_WORKSPACE_GENERATED/);
  assert.match(types, /CONSTITUTIONAL_WORKSPACE_EXPLAINED/);
  assert.match(types, /CONSTITUTIONAL_WORKSPACE_EXPORTED/);
});

// ─── Builder — workspace creation ────────────────────────────────────────────

test('buildConstitutionalWorkspace is exported', () => {
  assert.match(builder, /buildConstitutionalWorkspace/);
  assert.match(indexFile, /buildConstitutionalWorkspace/);
});

test('buildConstitutionalWorkspace accepts expected inputs', () => {
  assert.match(builder, /evidence/);
  assert.match(builder, /memories/);
  assert.match(builder, /patterns/);
  assert.match(builder, /effectivenessRecords/);
  assert.match(builder, /contextPackages/);
  assert.match(builder, /briefs/);
  assert.match(builder, /dashboards/);
});

// ─── Summary builders ─────────────────────────────────────────────────────────

test('all summary builders are present', () => {
  for (const fn of [
    'buildWorkspaceSummary', 'buildKnowledgeSummary', 'buildEvidenceSummary',
    'buildBriefSummary', 'buildDashboardSummary', 'buildGovernanceSummary',
  ]) {
    assert.match(summary, new RegExp(fn), `Missing summary builder: ${fn}`);
    assert.match(indexFile, new RegExp(fn), `Missing index export: ${fn}`);
  }
});

test('buildKnowledgeSummary splits memories by org/personal', () => {
  assert.match(summary, /organizationalMemoryCount/);
  assert.match(summary, /personalMemoryCount/);
  assert.match(summary, /organizationalPatternCount/);
  assert.match(summary, /personalPatternCount/);
  assert.match(summary, /organizationalEffectivenessCount/);
  assert.match(summary, /personalEffectivenessCount/);
});

test('buildBriefSummary counts all 5 brief types', () => {
  for (const t of ['constitutional', 'executive', 'governance', 'operational', 'portfolio']) {
    assert.match(summary, new RegExp(t), `Missing brief type in summary: ${t}`);
  }
});

test('buildDashboardSummary counts all 6 dashboard types', () => {
  for (const t of ['executive', 'governance', 'operational', 'portfolio', 'workspace', 'mixed']) {
    assert.match(summary, new RegExp(t), `Missing dashboard type in summary: ${t}`);
  }
});

test('buildGovernanceSummary counts all 5 governance types', () => {
  for (const t of ['authority', 'delegation', 'capability', 'trust', 'policy']) {
    assert.match(summary, new RegExp(t), `Missing governance type in summary: ${t}`);
  }
});

// ─── Contradictions ───────────────────────────────────────────────────────────

test('contradictions are collected from briefs and dashboards, not created', () => {
  assert.match(builder, /contradictions/);
  // must not invent contradictions — it flatMaps from supplied artifacts
  assert.match(builder, /flatMap.*contradictions|contradictions.*flatMap/s);
  // must not resolve contradictions
  assert.doesNotMatch(builder, /resolveContradiction|resolve_contradiction/);
});

// ─── Unknowns ─────────────────────────────────────────────────────────────────

test('unknowns are collected from briefs and dashboards, not inferred', () => {
  assert.match(builder, /unknowns/);
  assert.match(builder, /flatMap.*unknowns|unknowns.*flatMap/s);
  assert.doesNotMatch(builder, /inferUnknown|infer_unknown/);
});

// ─── Lineage ──────────────────────────────────────────────────────────────────

test('lineage is built for every artifact type', () => {
  assert.match(builder, /buildEvidenceLineage/);
  assert.match(builder, /buildMemoryLineage/);
  assert.match(builder, /buildPatternLineage/);
  assert.match(builder, /buildEffectivenessLineage/);
  assert.match(builder, /buildContextPackageLineage/);
  assert.match(builder, /buildBriefLineage/);
  assert.match(builder, /buildDashboardLineage/);
  assert.match(builder, /buildGovernanceLineage/);
});

test('lineage entries include reasonIncluded', () => {
  assert.match(builder, /reasonIncluded/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportConstitutionalWorkspace is exported', () => {
  assert.match(exportFile, /exportConstitutionalWorkspace/);
  assert.match(indexFile, /exportConstitutionalWorkspace/);
});

test('export includes workspace, summaries, contradictions, unknowns, lineage', () => {
  assert.match(exportFile, /workspace/);
  assert.match(exportFile, /summaries/);
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
  assert.match(exportFile, /lineage/);
});

test('export format is json only', () => {
  assert.match(exportFile, /"json"/);
  // must not contain pdf generation — only JSON
  assert.doesNotMatch(exportFile, /\.pdf|toPdf|generatePdf|pdfExport/i);
});

test('export emits CONSTITUTIONAL_WORKSPACE_EXPORTED event', () => {
  assert.match(exportFile, /CONSTITUTIONAL_WORKSPACE_EXPORTED/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainConstitutionalWorkspace is exported', () => {
  assert.match(builder, /explainConstitutionalWorkspace/);
  assert.match(indexFile, /explainConstitutionalWorkspace/);
});

test('explanation includes workspaceSummary, artifactReasons, lineage, contradictions, unknowns', () => {
  assert.match(builder, /workspaceSummary/);
  assert.match(builder, /artifactReasons/);
  assert.match(builder, /lineage/);
  assert.match(builder, /contradictions/);
  assert.match(builder, /unknowns/);
});

test('explanation emits CONSTITUTIONAL_WORKSPACE_EXPLAINED event', () => {
  assert.match(builder, /CONSTITUTIONAL_WORKSPACE_EXPLAINED/);
});

// ─── Health ───────────────────────────────────────────────────────────────────

test('getWorkspaceHealth is exported', () => {
  assert.match(builder, /getWorkspaceHealth/);
  assert.match(indexFile, /getWorkspaceHealth/);
});

test('getWorkspaceHealth returns coverageMetrics without scores', () => {
  assert.match(builder, /coverageMetrics/);
  assert.doesNotMatch(builder, /score|Score/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('builder emits CONSTITUTIONAL_WORKSPACE_GENERATED', () => {
  assert.match(builder, /CONSTITUTIONAL_WORKSPACE_GENERATED/);
});

test('audit events have learningEligible=false', () => {
  assert.match(builder, /learningEligible: false/);
  assert.match(exportFile, /learningEligible: false/);
});

test('audit events have eventCategory governance', () => {
  assert.match(builder, /eventCategory.*governance/);
  assert.match(exportFile, /eventCategory.*governance/);
});

test('audit events have visibility workspace', () => {
  assert.match(builder, /visibility.*workspace/);
  assert.match(exportFile, /visibility.*workspace/);
});

test('audit events reference rawReferenceTable constitutional_workspace', () => {
  assert.match(builder, /rawReferenceTable.*constitutional_workspace/);
  assert.match(exportFile, /rawReferenceTable.*constitutional_workspace/);
});

// ─── No AI / no scoring / no prediction ──────────────────────────────────────

test('no AI in types', () => {
  // must not call AI services or use AI APIs
  assert.doesNotMatch(types, /openai\.|anthropic\.|\.embed\(|vectorSearch|semanticSearch|callLLM|callGPT/i);
});

test('no recommendations in builder', () => {
  assert.doesNotMatch(builder, /recommend|Recommend/);
});

test('no scoring in builder', () => {
  assert.doesNotMatch(builder, /\bscore\b|\bScore\b/);
});

test('no ranking in builder', () => {
  assert.doesNotMatch(builder, /\brank\b|\bRank\b/);
});

test('no prioritization in builder', () => {
  assert.doesNotMatch(builder, /prioriti[sz]e|Prioriti[sz]e/);
});

test('no prediction in builder', () => {
  assert.doesNotMatch(builder, /predictOutcome|makePrediction|predictScore/i);
});

test('no persistence in builder — no table creation or SQL', () => {
  assert.doesNotMatch(builder, /CREATE TABLE|INSERT INTO|supabase\.from\(/);
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports all workspace brief types constant', () => {
  assert.match(indexFile, /ALL_WORKSPACE_BRIEF_TYPES/);
});

test('index exports all workspace dashboard types constant', () => {
  assert.match(indexFile, /ALL_WORKSPACE_DASHBOARD_TYPES/);
});

test('index exports all governance artifact types constant', () => {
  assert.match(indexFile, /ALL_GOVERNANCE_ARTIFACT_TYPES/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs explain what Constitutional Workspace is', () => {
  assert.match(docs, /Constitutional Workspace/);
});

test('docs explain what it is not', () => {
  assert.match(docs, /not/i);
  assert.match(docs, /AI|artificial intelligence/i);
});

test('docs include the artifact hierarchy diagram', () => {
  assert.match(docs, /Evidence/);
  assert.match(docs, /Memory|Memories/);
  assert.match(docs, /Pattern/);
  assert.match(docs, /Effectiveness/);
  assert.match(docs, /Context/);
  assert.match(docs, /Brief/);
  assert.match(docs, /Dashboard/);
  assert.match(docs, /Constitutional Workspace/);
});

test('docs mention lineage', () => {
  assert.match(docs, /[Ll]ineage/);
});

test('docs mention auditability', () => {
  assert.match(docs, /audit|Audit/);
});
