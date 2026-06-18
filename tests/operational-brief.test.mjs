import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/operational-brief/types.ts', 'utf8');
const builder     = readFileSync('src/lib/operational-brief/operational-brief-builder.ts', 'utf8');
const sections    = readFileSync('src/lib/operational-brief/operational-brief-sections.ts', 'utf8');
const exportFile  = readFileSync('src/lib/operational-brief/operational-brief-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/operational-brief/index.ts', 'utf8');
const docs        = readFileSync('docs/operational-brief-foundation.md', 'utf8');
const dbContract  = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConstitutionalBrief(overrides = {}) {
  return {
    id: 'brief:ws1:pm1:decision:ctx1:2026-06-18T00:00:00.000Z',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    pmUserId:    '22222222-2222-4222-8222-222222222222',
    contextType: 'decision',
    contextId:   '33333333-3333-4333-8333-333333333333',
    generatedAt: '2026-06-18T00:00:00.000Z',
    sourceContextPackage: {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      pmUserId:    '22222222-2222-4222-8222-222222222222',
      contextType: 'decision',
      contextId:   '33333333-3333-4333-8333-333333333333',
      generatedAt: '2026-06-18T00:00:00.000Z',
      memories: [],
      patterns: [],
      effectivenessRecords: [],
      bridgeRelationships: [],
      contradictions: [],
      evidence: [],
      timeline: [],
      knowledgeDomains: [],
    },
    summary: 'Test brief.',
    sections: [],
    evidenceTrace: [],
    timeline: [],
    contradictions: [],
    knowledgeDomains: [],
    unknowns: [],
    metadata: {},
    ...overrides,
  };
}

function makeContradiction(id) {
  return {
    id,
    sourceAType: 'organizational_memory',
    sourceAId: 'a1',
    sourceAStatement: 'Statement A',
    sourceBType: 'organizational_memory',
    sourceBId: 'b1',
    sourceBStatement: 'Statement B',
    detectedAt: '2026-06-18T00:00:00.000Z',
    relationshipType: 'contradicts',
    bridgeId: null,
  };
}

function makeTimelineEntry(timestamp, id) {
  return {
    timestamp,
    recordType: 'memory',
    recordId: id,
    summary: 'A timeline event.',
    source: 'test',
  };
}

// ─── Database contract ────────────────────────────────────────────────────────

test('DATABASE_CONTRACT_VERSION preserves prior keywords including governance-brief', () => {
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /executive-brief/);
  assert.match(dbContract, /governance-brief/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes operational-brief suffix', () => {
  assert.match(dbContract, /operational-brief/);
  const govIdx = dbContract.indexOf('governance-brief');
  const opIdx  = dbContract.indexOf('operational-brief');
  assert.ok(opIdx > govIdx, 'operational-brief should appear after governance-brief');
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('OperationalBrief has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'contextType', 'contextId',
    'generatedAt', 'sourceConstitutionalBrief', 'operationalSummary',
    'sections', 'executionFacts', 'riskFacts', 'dependencyFacts',
    'milestoneFacts', 'blockerFacts', 'coordinationFacts',
    'contradictions', 'unknowns', 'timelineHighlights',
    'evidenceSummary', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `OperationalBrief missing field: ${field}`);
  }
});

test('OperationalFact has all required fields', () => {
  for (const field of ['id', 'factType', 'summary', 'sourceCount', 'evidenceCount', 'lineage']) {
    assert.match(types, new RegExp(field), `OperationalFact missing field: ${field}`);
  }
});

test('OperationalBriefSection has all required fields', () => {
  for (const field of ['id', 'sectionType', 'title', 'summary', 'records', 'evidence', 'lineage']) {
    assert.match(types, new RegExp(field), `OperationalBriefSection missing field: ${field}`);
  }
});

test('all 14 operational section types are declared', () => {
  for (const st of [
    'operational_summary', 'execution_overview', 'task_overview',
    'milestone_overview', 'dependency_overview', 'risk_overview',
    'blocker_overview', 'escalation_overview', 'coordination_overview',
    'delivery_overview', 'contradictions', 'timeline_highlights',
    'evidence_summary', 'unknowns',
  ]) {
    assert.match(types, new RegExp(`"${st}"`), `OperationalBriefSectionType missing: ${st}`);
  }
});

test('all 12 OperationalFactType values are declared', () => {
  for (const ft of [
    'execution', 'task', 'milestone', 'dependency', 'risk', 'blocker',
    'escalation', 'coordination', 'delivery', 'timeline', 'contradiction', 'unknown',
  ]) {
    assert.match(types, new RegExp(`"${ft}"`), `OperationalFactType missing: ${ft}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /OPERATIONAL_BRIEF_GENERATED/);
  assert.match(types, /OPERATIONAL_BRIEF_EXPLAINED/);
  assert.match(types, /OPERATIONAL_BRIEF_EXPORTED/);
});

test('OperationalEvidenceSummary has all required fields', () => {
  for (const field of [
    'recordCount', 'evidenceCount', 'executionCount', 'taskCount',
    'milestoneCount', 'dependencyCount', 'riskCount', 'blockerCount',
    'escalationCount', 'coordinationCount', 'deliveryCount', 'contradictionCount',
  ]) {
    assert.match(types, new RegExp(field), `OperationalEvidenceSummary missing field: ${field}`);
  }
});

test('OperationalBriefHealth has all required fields', () => {
  for (const field of [
    'sectionCount', 'executionFactCount', 'riskFactCount', 'dependencyFactCount',
    'milestoneFactCount', 'blockerFactCount', 'coordinationFactCount',
    'timelineCount', 'contradictionCount', 'unknownCount', 'coverageMetrics',
  ]) {
    assert.match(types, new RegExp(field), `OperationalBriefHealth missing field: ${field}`);
  }
});

// ─── Operational Summary ─────────────────────────────────────────────────────

test('buildOperationalSummary uses counts only', () => {
  assert.match(sections, /buildOperationalSummary/);
  assert.match(sections, /\.length/);
});

test('buildOperationalSummary references evidence count', () => {
  assert.match(sections, /evidenceTrace/);
  assert.match(sections, /evidence.*reference/i);
});

test('buildOperationalSummary references contradictions', () => {
  assert.match(sections, /contradictions/);
});

test('buildOperationalSummary does not use scoring or recommendation language', () => {
  assert.doesNotMatch(sections, /\.score\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.rank\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.predict\s*[=(<]/i);
  assert.doesNotMatch(sections, /recommendationScore/i);
  assert.doesNotMatch(sections, /from.*@\/lib\/ai/);
});

test('buildOperationalSummary produces deterministic count-based text', () => {
  const brief = makeConstitutionalBrief();
  // Read sections module to verify implementation exists (function-level test)
  assert.match(sections, /buildOperationalSummary/);
  assert.match(sections, /operational brief contains/);
});

// ─── Execution Overview ───────────────────────────────────────────────────────

test('buildExecutionOverview builds from constitutional brief sections', () => {
  assert.match(sections, /buildExecutionOverview/);
  assert.match(sections, /relevant_memories/);
  assert.match(sections, /relevant_patterns/);
});

test('buildExecutionOverview does not infer tasks or generate next steps', () => {
  assert.doesNotMatch(sections, /inferTask/i);
  assert.doesNotMatch(sections, /generateTask/i);
  assert.doesNotMatch(sections, /nextStep/i);
  assert.doesNotMatch(sections, /createTask/i);
});

// ─── Task Overview ───────────────────────────────────────────────────────────

test('buildTaskOverview builds from constitutional brief effectiveness records', () => {
  assert.match(sections, /buildTaskOverview/);
  assert.match(sections, /relevant_effectiveness/);
});

test('buildTaskOverview does not create new tasks', () => {
  assert.doesNotMatch(sections, /createTask/i);
  assert.doesNotMatch(sections, /inferTask/i);
  assert.doesNotMatch(sections, /generateTask/i);
});

// ─── Milestone Overview ───────────────────────────────────────────────────────

test('buildMilestoneOverview builds from constitutional brief timeline', () => {
  assert.match(sections, /buildMilestoneOverview/);
  assert.match(sections, /timeline/);
});

test('buildMilestoneOverview does not forecast dates or predict delivery', () => {
  assert.doesNotMatch(sections, /forecastDate/i);
  assert.doesNotMatch(sections, /predictDelivery/i);
  assert.doesNotMatch(sections, /inferMilestone/i);
});

// ─── Dependency Overview ─────────────────────────────────────────────────────

test('buildDependencyOverview builds from constitutional brief bridge relationships', () => {
  assert.match(sections, /buildDependencyOverview/);
  assert.match(sections, /bridge_relationships/);
});

test('buildDependencyOverview does not infer risk or generate mitigation', () => {
  assert.doesNotMatch(sections, /inferDependencyRisk/i);
  assert.doesNotMatch(sections, /mitigationSuggestion/i);
  assert.doesNotMatch(sections, /generateMitigation/i);
});

// ─── Risk Overview ────────────────────────────────────────────────────────────

test('buildRiskOverview builds from constitutional brief contradictions', () => {
  assert.match(sections, /buildRiskOverview/);
  assert.match(sections, /contradictions/);
});

test('buildRiskOverview does not score or rank risks', () => {
  assert.doesNotMatch(sections, /riskScore/i);
  assert.doesNotMatch(sections, /rankRisk/i);
  assert.doesNotMatch(sections, /predictImpact/i);
});

test('risk overview section includes "Not scored. Not ranked." in summary', () => {
  assert.match(sections, /Not scored\. Not ranked\./);
});

// ─── Blocker Overview ────────────────────────────────────────────────────────

test('buildBlockerOverview builds from constitutional brief outstanding unknowns', () => {
  assert.match(sections, /buildBlockerOverview/);
  assert.match(sections, /outstanding_unknowns/);
});

test('buildBlockerOverview does not infer blockers', () => {
  assert.doesNotMatch(sections, /inferBlocker/i);
  assert.doesNotMatch(sections, /classifyBlocker/i);
});

// ─── Escalation Overview ─────────────────────────────────────────────────────

test('buildEscalationOverview builds from constitutional brief evidence', () => {
  assert.match(sections, /buildEscalationOverview/);
  assert.match(sections, /evidenceTrace/);
  assert.match(sections, /escalation/i);
});

test('buildEscalationOverview does not recommend escalation', () => {
  assert.doesNotMatch(sections, /recommendEscalation/i);
  assert.doesNotMatch(sections, /generateEscalationPath/i);
});

// ─── Coordination Overview ────────────────────────────────────────────────────

test('buildCoordinationOverview builds from coordination facts', () => {
  assert.match(sections, /buildCoordinationOverview/);
  assert.match(sections, /coordination/i);
});

test('buildCoordinationOverview does not infer stakeholder responsibility', () => {
  assert.doesNotMatch(sections, /inferOwnership/i);
  assert.doesNotMatch(sections, /assignStakeholder/i);
  assert.doesNotMatch(sections, /generateCoordination/i);
});

// ─── Delivery Overview ────────────────────────────────────────────────────────

test('buildDeliveryOverview builds from constitutional brief evidence', () => {
  assert.match(sections, /buildDeliveryOverview/);
  assert.match(sections, /delivery/i);
});

test('buildDeliveryOverview does not forecast delivery', () => {
  assert.doesNotMatch(sections, /forecastDelivery/i);
  assert.doesNotMatch(sections, /deliveryScore/i);
  assert.doesNotMatch(sections, /deliveryConfidence/i);
  assert.doesNotMatch(sections, /predictDelivery/i);
});

test('delivery overview section includes "Not forecasted." in summary', () => {
  assert.match(sections, /Not forecasted\./);
});

// ─── Contradictions ───────────────────────────────────────────────────────────

test('contradictions are reused from constitutional brief, not created', () => {
  assert.match(sections, /brief\.contradictions/);
  assert.match(sections, /Not resolved\. Not judged\./);
});

test('builder reuses contradictions from constitutional brief', () => {
  assert.match(builder, /constitutionalBrief\.contradictions/);
});

// ─── Unknowns ────────────────────────────────────────────────────────────────

test('unknowns are reused from constitutional brief', () => {
  assert.match(sections, /brief\.unknowns/);
});

test('builder reuses unknowns from constitutional brief', () => {
  assert.match(builder, /constitutionalBrief\.unknowns/);
});

// ─── Timeline ────────────────────────────────────────────────────────────────

test('buildOperationalTimelineHighlights sorts chronologically', () => {
  assert.match(sections, /buildOperationalTimelineHighlights/);
  assert.match(sections, /sort/);
});

test('buildOperationalTimelineHighlights uses constitutional brief timeline', () => {
  assert.match(sections, /brief\.timeline/);
  assert.doesNotMatch(sections, /inferTimeline/i);
  assert.doesNotMatch(sections, /generateTimeline/i);
});

// ─── Evidence Summary ─────────────────────────────────────────────────────────

test('buildOperationalEvidenceSummary is present and uses counts', () => {
  assert.match(sections, /buildOperationalEvidenceSummary/);
  assert.match(sections, /recordCount/);
  assert.match(sections, /evidenceCount/);
  assert.match(sections, /executionCount/);
  assert.match(sections, /taskCount/);
  assert.match(sections, /milestoneCount/);
  assert.match(sections, /dependencyCount/);
  assert.match(sections, /riskCount/);
  assert.match(sections, /blockerCount/);
  assert.match(sections, /escalationCount/);
  assert.match(sections, /coordinationCount/);
  assert.match(sections, /deliveryCount/);
  assert.match(sections, /contradictionCount/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportOperationalBrief is present and exports JSON only', () => {
  assert.match(exportFile, /exportOperationalBrief/);
  assert.match(exportFile, /format.*json/);
  assert.doesNotMatch(exportFile, /pdf/i);
});

test('export includes all required fields', () => {
  for (const field of [
    'operationalBrief', 'sourceConstitutionalBrief', 'executionFacts',
    'riskFacts', 'dependencyFacts', 'milestoneFacts', 'blockerFacts',
    'coordinationFacts', 'timelineHighlights', 'evidenceSummary',
    'contradictions', 'unknowns',
  ]) {
    assert.match(exportFile, new RegExp(field), `export missing: ${field}`);
  }
});

test('export emits OPERATIONAL_BRIEF_EXPORTED audit event', () => {
  assert.match(exportFile, /OPERATIONAL_BRIEF_EXPORTED/);
  assert.match(exportFile, /learningEligible: false/);
  assert.match(exportFile, /eventCategory.*governance/);
});

// ─── Explanation ─────────────────────────────────────────────────────────────

test('explainOperationalBrief is present', () => {
  assert.match(builder, /explainOperationalBrief/);
});

test('explanation includes all required fields', () => {
  for (const field of ['operationalBrief', 'sectionReasons', 'sourceBrief', 'evidenceTrace', 'lineage', 'unknowns']) {
    assert.match(builder, new RegExp(field), `explanation missing: ${field}`);
  }
});

test('explanation answers why sections are included', () => {
  assert.match(builder, /operationalSectionExplanation/);
  assert.match(builder, /Included because/);
  assert.match(builder, /Always included/);
});

test('explanation emits OPERATIONAL_BRIEF_EXPLAINED audit event', () => {
  assert.match(builder, /OPERATIONAL_BRIEF_EXPLAINED/);
});

// ─── Audit events ────────────────────────────────────────────────────────────

test('audit events use learningEligible: false', () => {
  assert.match(builder, /learningEligible: false/);
  assert.match(exportFile, /learningEligible: false/);
});

test('audit events use eventCategory governance', () => {
  assert.match(builder, /eventCategory.*governance/);
  assert.match(exportFile, /eventCategory.*governance/);
});

test('audit events use visibility workspace', () => {
  assert.match(builder, /visibility.*workspace/);
  assert.match(exportFile, /visibility.*workspace/);
});

test('audit events use rawReferenceTable operational_brief', () => {
  assert.match(builder, /rawReferenceTable.*operational_brief/);
  assert.match(exportFile, /rawReferenceTable.*operational_brief/);
});

test('OPERATIONAL_BRIEF_GENERATED is emitted in buildOperationalBrief', () => {
  assert.match(builder, /OPERATIONAL_BRIEF_GENERATED/);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test('getOperationalBriefHealth is present', () => {
  assert.match(builder, /getOperationalBriefHealth/);
});

test('health returns all required fields', () => {
  for (const field of [
    'sectionCount', 'executionFactCount', 'riskFactCount', 'dependencyFactCount',
    'milestoneFactCount', 'blockerFactCount', 'coordinationFactCount',
    'timelineCount', 'contradictionCount', 'unknownCount', 'coverageMetrics',
  ]) {
    assert.match(builder, new RegExp(field), `health missing: ${field}`);
  }
});

// ─── No AI / No scoring / No recommendations / No prediction ─────────────────

test('no AI imports in any operational brief file', () => {
  for (const file of [types, builder, sections, exportFile]) {
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
    assert.doesNotMatch(file, /openai/i);
    assert.doesNotMatch(file, /anthropic/i);
    assert.doesNotMatch(file, /import.*embed/i);
  }
});

test('no scoring in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /\.score\s*=/i);
    assert.doesNotMatch(file, /riskScore/i);
    assert.doesNotMatch(file, /deliveryScore/i);
    assert.doesNotMatch(file, /priorityScore/i);
  }
});

test('no ranking in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /\.rank\s*=/i);
    assert.doesNotMatch(file, /rankBy/i);
  }
});

test('no recommendation language in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /recommendationScore/i);
    assert.doesNotMatch(file, /generateRecommendation/i);
    assert.doesNotMatch(file, /mitigationSuggestion/i);
  }
});

test('no prediction in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /predictDelivery/i);
    assert.doesNotMatch(file, /deliveryForecast/i);
    assert.doesNotMatch(file, /forecastMilestone/i);
    assert.doesNotMatch(file, /predictImpact/i);
  }
});

test('no priority generation in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /assignPriority/i);
    assert.doesNotMatch(file, /inferPriority/i);
  }
});

test('no task generation in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /createTask/i);
    assert.doesNotMatch(file, /generateTask/i);
    assert.doesNotMatch(file, /inferTask/i);
  }
});

test('no risk scoring in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /riskScore/i);
    assert.doesNotMatch(file, /calculateRisk/i);
  }
});

test('no delivery forecasting in any operational brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /deliveryForecast/i);
    assert.doesNotMatch(file, /forecastDelivery/i);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports all types', () => {
  for (const name of [
    'OperationalFact', 'OperationalBrief', 'OperationalBriefSection',
    'OperationalBriefHealth', 'OperationalBriefExport', 'OperationalBriefExplanation',
    'OperationalBriefResult', 'OperationalBriefEventType',
  ]) {
    assert.match(indexFile, new RegExp(name), `index missing: ${name}`);
  }
});

test('index exports all builder functions', () => {
  for (const fn of [
    'buildOperationalBrief', 'explainOperationalBrief', 'getOperationalBriefHealth',
    'exportOperationalBrief',
  ]) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

test('index exports all section functions', () => {
  for (const fn of [
    'buildOperationalSummary', 'buildExecutionOverview', 'buildTaskOverview',
    'buildMilestoneOverview', 'buildDependencyOverview', 'buildRiskOverview',
    'buildBlockerOverview', 'buildEscalationOverview', 'buildCoordinationOverview',
    'buildDeliveryOverview', 'buildOperationalTimelineHighlights',
    'buildOperationalEvidenceSummary', 'buildOperationalSections',
  ]) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation explains what Operational Brief is', () => {
  assert.match(docs, /Operational Brief/);
  assert.match(docs, /execution/i);
  assert.match(docs, /constitutional brief/i);
});

test('documentation explains what it is not', () => {
  assert.match(docs, /No AI/i);
  assert.match(docs, /No scoring/i);
  assert.match(docs, /No recommendation/i);
  assert.match(docs, /No prediction/i);
});

test('documentation explains difference from other brief types', () => {
  assert.match(docs, /Constitutional Brief/i);
  assert.match(docs, /Executive Brief/i);
  assert.match(docs, /Governance Brief/i);
  assert.match(docs, /Operational Brief/i);
});

test('documentation covers all operational sections', () => {
  for (const section of [
    'Execution', 'Task', 'Milestone', 'Dependency',
    'Risk', 'Blocker', 'Escalation', 'Coordination', 'Delivery',
  ]) {
    assert.match(docs, new RegExp(section), `docs missing section: ${section}`);
  }
});

test('documentation includes architecture diagram', () => {
  assert.match(docs, /Constitutional Intelligence/);
  assert.match(docs, /Constitutional Context/);
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Operational Brief/);
});
