import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/execution-augmentation/types.ts', 'utf8');
const builder     = readFileSync('src/lib/execution-augmentation/augmentation-builder.ts', 'utf8');
const resolver    = readFileSync('src/lib/execution-augmentation/augmentation-resolver.ts', 'utf8');
const exportFile  = readFileSync('src/lib/execution-augmentation/augmentation-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/execution-augmentation/index.ts', 'utf8');
const docs        = readFileSync('docs/execution-augmentation-layer.md', 'utf8');
const dbContract  = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Database contract ────────────────────────────────────────────────────────

test('DATABASE_CONTRACT_VERSION preserves prior keywords', () => {
  assert.match(dbContract, /constitutional-workspace/);
  assert.match(dbContract, /intelligence-bridge/);
  assert.match(dbContract, /platform-events/);
  assert.match(dbContract, /constitutional-brief/);
});

test('DATABASE_CONTRACT_VERSION includes execution-augmentation suffix', () => {
  assert.match(dbContract, /execution-augmentation/);
});

// ─── Types: ExecutionAugmentation ─────────────────────────────────────────────

test('ExecutionAugmentation has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'artifactType', 'artifactId', 'generatedAt',
    'contextArtifacts', 'evidenceArtifacts', 'memoryArtifacts',
    'patternArtifacts', 'effectivenessArtifacts', 'briefArtifacts',
    'dashboardArtifacts', 'contradictions', 'unknowns', 'lineage', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ExecutionAugmentation missing field: ${field}`);
  }
});

test('AugmentationArtifact has all required fields', () => {
  for (const field of [
    'artifactType', 'artifactId', 'title', 'summary',
    'reasonIncluded', 'evidenceCount', 'lineage',
  ]) {
    assert.match(types, new RegExp(field), `AugmentationArtifact missing field: ${field}`);
  }
});

test('all 10 execution artifact types are declared', () => {
  for (const t of [
    'task', 'decision', 'milestone', 'dependency', 'risk',
    'blocker', 'escalation', 'stakeholder', 'project', 'portfolio',
  ]) {
    assert.match(types, new RegExp(`"${t}"`), `ExecutionArtifactType missing: ${t}`);
  }
});

test('AugmentationHealth has all required metrics', () => {
  for (const field of [
    'artifactCount', 'evidenceCount', 'memoryCount', 'patternCount',
    'effectivenessCount', 'briefCount', 'dashboardCount',
    'contradictionCount', 'unknownCount',
  ]) {
    assert.match(types, new RegExp(field), `AugmentationHealth missing: ${field}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /EXECUTION_AUGMENTATION_GENERATED/);
  assert.match(types, /EXECUTION_AUGMENTATION_EXPLAINED/);
  assert.match(types, /EXECUTION_AUGMENTATION_EXPORTED/);
});

// ─── Task augmentation ────────────────────────────────────────────────────────

test('buildTaskAugmentation is defined', () => {
  assert.match(builder, /buildTaskAugmentation/);
});

test('task augmentation includes evidence, memories, patterns, effectiveness, briefs', () => {
  assert.match(builder, /buildTaskAugmentation[\s\S]*?evidenceArtifacts/);
  assert.match(builder, /buildTaskAugmentation[\s\S]*?memoryArtifacts/);
  assert.match(builder, /buildTaskAugmentation[\s\S]*?patternArtifacts/);
  assert.match(builder, /buildTaskAugmentation[\s\S]*?effectivenessArtifacts/);
  assert.match(builder, /buildTaskAugmentation[\s\S]*?briefArtifacts/);
});

test('task augmentation uses correct reasonIncluded values', () => {
  assert.match(builder, /Linked by evidence/);
  assert.match(builder, /Linked by constitutional memory/);
  assert.match(builder, /Linked by pattern source/);
  assert.match(builder, /Linked by effectiveness lineage/);
});

// ─── Decision augmentation ────────────────────────────────────────────────────

test('buildDecisionAugmentation is defined', () => {
  assert.match(builder, /buildDecisionAugmentation/);
});

test('decision augmentation uses decision lineage reasonIncluded', () => {
  assert.match(builder, /Linked by decision lineage/);
});

// ─── Dependency augmentation ──────────────────────────────────────────────────

test('buildDependencyAugmentation is defined', () => {
  assert.match(builder, /buildDependencyAugmentation/);
});

test('dependency augmentation includes evidence, patterns, effectiveness', () => {
  const section = builder.slice(builder.indexOf('buildDependencyAugmentation'));
  assert.match(section, /evidenceArtifacts/);
  assert.match(section, /patternArtifacts/);
  assert.match(section, /effectivenessArtifacts/);
});

// ─── Risk augmentation ────────────────────────────────────────────────────────

test('buildRiskAugmentation is defined', () => {
  assert.match(builder, /buildRiskAugmentation/);
});

test('risk augmentation does not score risk or predict impact', () => {
  assert.doesNotMatch(builder, /riskScore/i);
  assert.doesNotMatch(builder, /predictImpact/i);
  assert.doesNotMatch(builder, /impactScore/i);
});

test('risk augmentation includes evidence, memories, patterns, effectiveness', () => {
  const section = builder.slice(builder.indexOf('buildRiskAugmentation'));
  assert.match(section, /evidenceArtifacts/);
  assert.match(section, /memoryArtifacts/);
  assert.match(section, /patternArtifacts/);
  assert.match(section, /effectivenessArtifacts/);
});

// ─── Milestone augmentation ───────────────────────────────────────────────────

test('buildMilestoneAugmentation is defined', () => {
  assert.match(builder, /buildMilestoneAugmentation/);
});

test('milestone augmentation includes evidence and effectiveness', () => {
  const section = builder.slice(builder.indexOf('buildMilestoneAugmentation'));
  assert.match(section, /evidenceArtifacts/);
  assert.match(section, /effectivenessArtifacts/);
});

// ─── Blocker augmentation ─────────────────────────────────────────────────────

test('buildBlockerAugmentation is defined', () => {
  assert.match(builder, /buildBlockerAugmentation/);
});

test('blocker augmentation includes evidence and patterns', () => {
  const section = builder.slice(builder.indexOf('buildBlockerAugmentation'));
  assert.match(section, /evidenceArtifacts/);
  assert.match(section, /patternArtifacts/);
});

// ─── Escalation augmentation ──────────────────────────────────────────────────

test('buildEscalationAugmentation is defined', () => {
  assert.match(builder, /buildEscalationAugmentation/);
});

test('escalation augmentation includes evidence and briefs', () => {
  const section = builder.slice(builder.indexOf('buildEscalationAugmentation'));
  assert.match(section, /evidenceArtifacts/);
  assert.match(section, /briefArtifacts/);
});

// ─── Project augmentation ─────────────────────────────────────────────────────

test('buildProjectAugmentation is defined', () => {
  assert.match(builder, /buildProjectAugmentation/);
});

test('project augmentation includes briefs, dashboards, patterns, effectiveness', () => {
  const section = builder.slice(builder.indexOf('buildProjectAugmentation'));
  assert.match(section, /briefArtifacts/);
  assert.match(section, /dashboardArtifacts/);
  assert.match(section, /patternArtifacts/);
  assert.match(section, /effectivenessArtifacts/);
});

test('project augmentation includes workspace lineage', () => {
  const section = builder.slice(builder.indexOf('buildProjectAugmentation'));
  assert.match(section, /lineage/);
});

// ─── Portfolio augmentation ───────────────────────────────────────────────────

test('buildPortfolioAugmentation is defined', () => {
  assert.match(builder, /buildPortfolioAugmentation/);
});

test('portfolio augmentation includes portfolio briefs, dashboards, cross-project patterns', () => {
  const section = builder.slice(builder.indexOf('buildPortfolioAugmentation'));
  assert.match(section, /briefArtifacts/);
  assert.match(section, /dashboardArtifacts/);
  assert.match(section, /patternArtifacts/);
});

// ─── ReasonIncluded enforcement ───────────────────────────────────────────────

test('reasonIncluded values are explicit and traceable', () => {
  assert.match(builder, /Linked by evidence/);
  assert.match(builder, /Linked by decision lineage/);
  assert.match(builder, /Linked by constitutional memory/);
  assert.match(builder, /Linked by pattern source/);
  assert.match(builder, /Linked by effectiveness lineage/);
  assert.match(builder, /Linked by constitutional brief/);
  assert.match(builder, /Linked by workspace lineage/);
});

test('reasonIncluded never uses vague language', () => {
  assert.doesNotMatch(builder, /Probably related/i);
  assert.doesNotMatch(builder, /Likely relevant/i);
  assert.doesNotMatch(builder, /May be useful/i);
});

// ─── Contradictions reuse ─────────────────────────────────────────────────────

test('contradictions are reused from available, not created', () => {
  assert.match(builder, /contradictions: available\.contradictions/);
  assert.doesNotMatch(builder, /createContradiction/i);
  assert.doesNotMatch(builder, /resolveContradiction/i);
});

// ─── Unknowns reuse ───────────────────────────────────────────────────────────

test('unknowns are reused from available, not inferred', () => {
  assert.match(builder, /unknowns: available\.unknowns/);
  assert.doesNotMatch(builder, /inferUnknown/i);
  assert.doesNotMatch(builder, /createUnknown/i);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportExecutionAugmentation is defined', () => {
  assert.match(exportFile, /exportExecutionAugmentation/);
});

test('export includes augmentation, artifacts, contradictions, unknowns, lineage', () => {
  assert.match(exportFile, /augmentation/);
  assert.match(exportFile, /artifacts/);
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
  assert.match(exportFile, /lineage/);
});

test('export format is json only', () => {
  assert.match(exportFile, /"json"/);
  assert.doesNotMatch(exportFile, /pdfkit|puppeteer|jspdf|generatePdf/i);
});

test('export emits EXECUTION_AUGMENTATION_EXPORTED audit event', () => {
  assert.match(exportFile, /EXECUTION_AUGMENTATION_EXPORTED/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainExecutionAugmentation is defined', () => {
  assert.match(exportFile, /explainExecutionAugmentation/);
});

test('explanation returns artifactReasons and lineage', () => {
  assert.match(exportFile, /artifactReasons/);
  assert.match(exportFile, /lineage/);
});

test('explanation returns contradictions and unknowns', () => {
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
});

test('explanation emits EXECUTION_AUGMENTATION_EXPLAINED audit event', () => {
  assert.match(exportFile, /EXECUTION_AUGMENTATION_EXPLAINED/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('audit events use learningEligible: false', () => {
  assert.match(builder, /learningEligible: false/);
  assert.match(exportFile, /learningEligible: false/);
});

test('audit events use eventCategory: governance', () => {
  assert.match(builder, /eventCategory: "governance"/);
  assert.match(exportFile, /eventCategory: "governance"/);
});

test('audit events use visibility: workspace', () => {
  assert.match(builder, /visibility: "workspace"/);
  assert.match(exportFile, /visibility: "workspace"/);
});

test('audit events use rawReferenceTable: execution_augmentation', () => {
  assert.match(builder, /rawReferenceTable: "execution_augmentation"/);
  assert.match(exportFile, /rawReferenceTable: "execution_augmentation"/);
});

test('audit events use rawReferenceId from augmentation.id', () => {
  assert.match(builder, /rawReferenceId: augId/);
  assert.match(exportFile, /rawReferenceId: augmentation\.id/);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test('getAugmentationHealth returns all required metrics', () => {
  assert.match(builder, /getAugmentationHealth/);
  assert.match(builder, /artifactCount/);
  assert.match(builder, /evidenceCount/);
  assert.match(builder, /memoryCount/);
  assert.match(builder, /patternCount/);
  assert.match(builder, /effectivenessCount/);
  assert.match(builder, /briefCount/);
  assert.match(builder, /dashboardCount/);
  assert.match(builder, /contradictionCount/);
  assert.match(builder, /unknownCount/);
});

// ─── No AI / no recommendations ───────────────────────────────────────────────

test('no AI, ML, or embedding imports in any file', () => {
  for (const file of [types, builder, resolver, exportFile, indexFile]) {
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
    assert.doesNotMatch(file, /embeddingSearch/i);
    assert.doesNotMatch(file, /vectorSearch/i);
    assert.doesNotMatch(file, /semanticSearch/i);
    assert.doesNotMatch(file, /import.*openai/i);
  }
});

test('no scoring, ranking, prioritization language as code identifiers', () => {
  for (const file of [builder, resolver, exportFile]) {
    assert.doesNotMatch(file, /\.score\s*[=(<]/i);
    assert.doesNotMatch(file, /\.rank\s*[=(<]/i);
    assert.doesNotMatch(file, /\.prioriti[zs]/i);
    assert.doesNotMatch(file, /recommendationScore/i);
    assert.doesNotMatch(file, /\.predict\s*[=(<]/i);
  }
});

test('no autonomous reasoning or decision language', () => {
  for (const file of [builder, resolver, exportFile]) {
    assert.doesNotMatch(file, /inferScore/i);
    assert.doesNotMatch(file, /autonomousDecision/i);
    assert.doesNotMatch(file, /generateRecommendation/i);
  }
});

test('no persistence, tables, or migrations created', () => {
  for (const file of [builder, resolver, exportFile, indexFile]) {
    assert.doesNotMatch(file, /CREATE TABLE/i);
    assert.doesNotMatch(file, /supabase\.from\(/);
    assert.doesNotMatch(file, /\.insert\(/);
    assert.doesNotMatch(file, /\.upsert\(/);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports ExecutionAugmentation type', () => {
  assert.match(indexFile, /ExecutionAugmentation/);
});

test('index exports buildExecutionAugmentation', () => {
  assert.match(indexFile, /buildExecutionAugmentation/);
});

test('index exports all type-specific builders', () => {
  for (const fn of [
    'buildTaskAugmentation', 'buildDecisionAugmentation',
    'buildDependencyAugmentation', 'buildRiskAugmentation',
    'buildMilestoneAugmentation', 'buildBlockerAugmentation',
    'buildEscalationAugmentation', 'buildStakeholderAugmentation',
    'buildProjectAugmentation', 'buildPortfolioAugmentation',
  ]) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

test('index exports exportExecutionAugmentation', () => {
  assert.match(indexFile, /exportExecutionAugmentation/);
});

test('index exports explainExecutionAugmentation', () => {
  assert.match(indexFile, /explainExecutionAugmentation/);
});

test('index exports getAugmentationHealth', () => {
  assert.match(indexFile, /getAugmentationHealth/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs explain what augmentation is', () => {
  assert.match(docs, /[Aa]ugmentation/);
  assert.match(docs, /constitutional/i);
});

test('docs explain what augmentation is not', () => {
  assert.match(docs, /not/i);
  assert.match(docs, /AI/);
  assert.match(docs, /recommendation/i);
});

test('docs explain artifact types', () => {
  for (const t of ['task', 'decision', 'risk', 'milestone', 'blocker', 'escalation', 'project', 'portfolio']) {
    assert.match(docs, new RegExp(t, 'i'), `docs missing artifact type: ${t}`);
  }
});

test('docs explain reasonIncluded model', () => {
  assert.match(docs, /[Rr]eason[Ii]ncluded|reason included/i);
});

test('docs explain lineage', () => {
  assert.match(docs, /[Ll]ineage/);
});

test('docs explain evidence traceability', () => {
  assert.match(docs, /[Ee]vidence/);
  assert.match(docs, /[Tt]raceable|[Tt]raceability/);
});

test('docs explain contradictions', () => {
  assert.match(docs, /[Cc]ontradiction/);
});

test('docs explain unknowns', () => {
  assert.match(docs, /[Uu]nknown/);
});

test('docs explain auditability', () => {
  assert.match(docs, /[Aa]udit/);
});

test('docs include the constitutional layer diagram', () => {
  assert.match(docs, /Evidence/);
  assert.match(docs, /Memory/);
  assert.match(docs, /Patterns/);
  assert.match(docs, /Effectiveness/);
  assert.match(docs, /Execution Augmentation/);
});
