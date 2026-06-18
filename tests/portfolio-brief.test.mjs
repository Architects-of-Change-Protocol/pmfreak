import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/portfolio-brief/types.ts', 'utf8');
const builder     = readFileSync('src/lib/portfolio-brief/portfolio-brief-builder.ts', 'utf8');
const sections    = readFileSync('src/lib/portfolio-brief/portfolio-brief-sections.ts', 'utf8');
const exportFile  = readFileSync('src/lib/portfolio-brief/portfolio-brief-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/portfolio-brief/index.ts', 'utf8');
const docs        = readFileSync('docs/portfolio-brief-foundation.md', 'utf8');
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

test('DATABASE_CONTRACT_VERSION preserves prior keywords including operational-brief', () => {
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /executive-brief/);
  assert.match(dbContract, /governance-brief/);
  assert.match(dbContract, /operational-brief/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes portfolio-brief suffix', () => {
  assert.match(dbContract, /portfolio-brief/);
  const opIdx = dbContract.indexOf('operational-brief');
  const pfIdx = dbContract.indexOf('portfolio-brief');
  assert.ok(pfIdx > opIdx, 'portfolio-brief should appear after operational-brief');
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('PortfolioBrief has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'contextType', 'contextId',
    'generatedAt', 'sourceConstitutionalBrief', 'portfolioSummary',
    'sections', 'projectFacts', 'programFacts', 'workstreamFacts',
    'dependencyFacts', 'riskFacts', 'blockerFacts', 'escalationFacts',
    'contradictions', 'unknowns', 'timelineHighlights',
    'evidenceSummary', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `PortfolioBrief missing field: ${field}`);
  }
});

test('PortfolioFact has all required fields', () => {
  for (const field of ['id', 'factType', 'summary', 'sourceCount', 'evidenceCount', 'lineage']) {
    assert.match(types, new RegExp(field), `PortfolioFact missing field: ${field}`);
  }
});

test('PortfolioBriefSection has all required fields', () => {
  for (const field of ['id', 'sectionType', 'title', 'summary', 'records', 'evidence', 'lineage']) {
    assert.match(types, new RegExp(field), `PortfolioBriefSection missing field: ${field}`);
  }
});

test('all 14 portfolio section types are declared', () => {
  for (const st of [
    'portfolio_summary', 'project_overview', 'program_overview',
    'workstream_overview', 'dependency_overview', 'risk_overview',
    'blocker_overview', 'escalation_overview', 'cross_project_overview',
    'delivery_overview', 'contradictions', 'timeline_highlights',
    'evidence_summary', 'unknowns',
  ]) {
    assert.match(types, new RegExp(`"${st}"`), `PortfolioBriefSectionType missing: ${st}`);
  }
});

test('all 12 PortfolioFactType values are declared', () => {
  for (const ft of [
    'project', 'program', 'workstream', 'dependency', 'risk', 'blocker',
    'escalation', 'coordination', 'delivery', 'timeline', 'contradiction', 'unknown',
  ]) {
    assert.match(types, new RegExp(`"${ft}"`), `PortfolioFactType missing: ${ft}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /PORTFOLIO_BRIEF_GENERATED/);
  assert.match(types, /PORTFOLIO_BRIEF_EXPLAINED/);
  assert.match(types, /PORTFOLIO_BRIEF_EXPORTED/);
});

test('PortfolioEvidenceSummary has all required fields', () => {
  for (const field of [
    'recordCount', 'evidenceCount', 'projectCount', 'programCount',
    'workstreamCount', 'dependencyCount', 'riskCount', 'blockerCount',
    'escalationCount', 'contradictionCount',
  ]) {
    assert.match(types, new RegExp(field), `PortfolioEvidenceSummary missing field: ${field}`);
  }
});

test('PortfolioBriefHealth has all required fields', () => {
  for (const field of [
    'sectionCount', 'projectFactCount', 'programFactCount', 'workstreamFactCount',
    'dependencyFactCount', 'riskFactCount', 'blockerFactCount', 'escalationFactCount',
    'timelineCount', 'contradictionCount', 'unknownCount', 'coverageMetrics',
  ]) {
    assert.match(types, new RegExp(field), `PortfolioBriefHealth missing field: ${field}`);
  }
});

// ─── Portfolio Summary ────────────────────────────────────────────────────────

test('buildPortfolioSummary uses counts only', () => {
  assert.match(sections, /buildPortfolioSummary/);
  assert.match(sections, /\.length/);
});

test('buildPortfolioSummary references evidence count', () => {
  assert.match(sections, /evidenceTrace/);
  assert.match(sections, /evidence.*reference/i);
});

test('buildPortfolioSummary references contradictions', () => {
  assert.match(sections, /contradictions/);
});

test('buildPortfolioSummary does not use scoring or recommendation language', () => {
  assert.doesNotMatch(sections, /\.score\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.rank\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.predict\s*[=(<]/i);
  assert.doesNotMatch(sections, /recommendationScore/i);
  assert.doesNotMatch(sections, /from.*@\/lib\/ai/);
});

test('buildPortfolioSummary produces deterministic count-based text', () => {
  assert.match(sections, /buildPortfolioSummary/);
  assert.match(sections, /portfolio brief contains/);
});

// ─── Portfolio Brief Creation ─────────────────────────────────────────────────

test('buildPortfolioBrief is present in builder', () => {
  assert.match(builder, /buildPortfolioBrief/);
});

test('builder uses all section builders', () => {
  assert.match(builder, /buildProjectOverview/);
  assert.match(builder, /buildProgramOverview/);
  assert.match(builder, /buildWorkstreamOverview/);
  assert.match(builder, /buildPortfolioDependencyOverview/);
  assert.match(builder, /buildPortfolioRiskOverview/);
  assert.match(builder, /buildPortfolioBlockerOverview/);
  assert.match(builder, /buildPortfolioEscalationOverview/);
  assert.match(builder, /buildCrossProjectOverview/);
  assert.match(builder, /buildPortfolioDeliveryOverview/);
});

// ─── Project Overview ─────────────────────────────────────────────────────────

test('buildProjectOverview builds from constitutional brief sections', () => {
  assert.match(sections, /buildProjectOverview/);
  assert.match(sections, /relevant_memories/);
});

test('buildProjectOverview does not infer project status or rank projects', () => {
  assert.doesNotMatch(sections, /inferProjectStatus/i);
  assert.doesNotMatch(sections, /rankProject/i);
  assert.doesNotMatch(sections, /projectHealth/i);
});

// ─── Program Overview ─────────────────────────────────────────────────────────

test('buildProgramOverview builds from constitutional brief patterns', () => {
  assert.match(sections, /buildProgramOverview/);
  assert.match(sections, /relevant_patterns/);
});

test('buildProgramOverview does not infer program health or forecast outcomes', () => {
  assert.doesNotMatch(sections, /inferProgramHealth/i);
  assert.doesNotMatch(sections, /forecastProgram/i);
});

// ─── Workstream Overview ──────────────────────────────────────────────────────

test('buildWorkstreamOverview builds from constitutional brief effectiveness records', () => {
  assert.match(sections, /buildWorkstreamOverview/);
  assert.match(sections, /relevant_effectiveness/);
});

test('buildWorkstreamOverview does not infer workstream relationships', () => {
  assert.doesNotMatch(sections, /inferWorkstreamRelationship/i);
  assert.doesNotMatch(sections, /generateWorkstream/i);
});

// ─── Dependency Overview ─────────────────────────────────────────────────────

test('buildPortfolioDependencyOverview builds from bridge relationships', () => {
  assert.match(sections, /buildPortfolioDependencyOverview/);
  assert.match(sections, /bridge_relationships/);
});

test('buildPortfolioDependencyOverview does not infer dependency risk or create scores', () => {
  assert.doesNotMatch(sections, /inferDependencyRisk/i);
  assert.doesNotMatch(sections, /dependencyScore/i);
  assert.doesNotMatch(sections, /generateMitigation/i);
});

// ─── Risk Overview ────────────────────────────────────────────────────────────

test('buildPortfolioRiskOverview builds from constitutional brief contradictions', () => {
  assert.match(sections, /buildPortfolioRiskOverview/);
  assert.match(sections, /contradictions/);
});

test('buildPortfolioRiskOverview does not score or rank risks', () => {
  assert.doesNotMatch(sections, /riskScore/i);
  assert.doesNotMatch(sections, /rankRisk/i);
  assert.doesNotMatch(sections, /predictImpact/i);
});

test('risk overview section includes "Not scored. Not ranked." in summary', () => {
  assert.match(sections, /Not scored\. Not ranked\./);
});

// ─── Blocker Overview ────────────────────────────────────────────────────────

test('buildPortfolioBlockerOverview builds from constitutional brief outstanding unknowns', () => {
  assert.match(sections, /buildPortfolioBlockerOverview/);
  assert.match(sections, /outstanding_unknowns/);
});

test('buildPortfolioBlockerOverview does not infer blockers', () => {
  assert.doesNotMatch(sections, /inferBlocker/i);
  assert.doesNotMatch(sections, /classifyBlocker/i);
});

// ─── Escalation Overview ─────────────────────────────────────────────────────

test('buildPortfolioEscalationOverview builds from constitutional brief evidence', () => {
  assert.match(sections, /buildPortfolioEscalationOverview/);
  assert.match(sections, /evidenceTrace/);
  assert.match(sections, /escalation/i);
});

test('buildPortfolioEscalationOverview does not recommend escalation', () => {
  assert.doesNotMatch(sections, /recommendEscalation/i);
  assert.doesNotMatch(sections, /generateEscalationPath/i);
});

// ─── Cross-Project Overview ───────────────────────────────────────────────────

test('buildCrossProjectOverview builds from bridge relationships', () => {
  assert.match(sections, /buildCrossProjectOverview/);
  assert.match(sections, /bridge_relationships/);
});

test('buildCrossProjectOverview does not infer relationships', () => {
  assert.doesNotMatch(sections, /inferRelationship/i);
  assert.doesNotMatch(sections, /generateCrossProject/i);
});

// ─── Delivery Overview ────────────────────────────────────────────────────────

test('buildPortfolioDeliveryOverview builds from constitutional brief evidence', () => {
  assert.match(sections, /buildPortfolioDeliveryOverview/);
  assert.match(sections, /delivery/i);
});

test('buildPortfolioDeliveryOverview does not forecast delivery', () => {
  assert.doesNotMatch(sections, /forecastDelivery/i);
  assert.doesNotMatch(sections, /deliveryScore/i);
  assert.doesNotMatch(sections, /deliveryConfidence/i);
  assert.doesNotMatch(sections, /predictDelivery/i);
  assert.doesNotMatch(sections, /portfolioHealthScore/i);
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

test('buildPortfolioTimelineHighlights sorts chronologically', () => {
  assert.match(sections, /buildPortfolioTimelineHighlights/);
  assert.match(sections, /sort/);
});

test('buildPortfolioTimelineHighlights uses constitutional brief timeline', () => {
  assert.match(sections, /brief\.timeline/);
  assert.doesNotMatch(sections, /inferTimeline/i);
  assert.doesNotMatch(sections, /generateTimeline/i);
});

// ─── Evidence Summary ─────────────────────────────────────────────────────────

test('buildPortfolioEvidenceSummary is present and uses counts', () => {
  assert.match(sections, /buildPortfolioEvidenceSummary/);
  assert.match(sections, /recordCount/);
  assert.match(sections, /evidenceCount/);
  assert.match(sections, /projectCount/);
  assert.match(sections, /programCount/);
  assert.match(sections, /workstreamCount/);
  assert.match(sections, /dependencyCount/);
  assert.match(sections, /riskCount/);
  assert.match(sections, /blockerCount/);
  assert.match(sections, /escalationCount/);
  assert.match(sections, /contradictionCount/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportPortfolioBrief is present and exports JSON only', () => {
  assert.match(exportFile, /exportPortfolioBrief/);
  assert.match(exportFile, /format.*json/);
  assert.doesNotMatch(exportFile, /pdf/i);
});

test('export includes all required fields', () => {
  for (const field of [
    'portfolioBrief', 'sourceConstitutionalBrief', 'projectFacts',
    'programFacts', 'workstreamFacts', 'dependencyFacts', 'riskFacts',
    'blockerFacts', 'escalationFacts', 'timelineHighlights',
    'evidenceSummary', 'contradictions', 'unknowns',
  ]) {
    assert.match(exportFile, new RegExp(field), `export missing: ${field}`);
  }
});

test('export emits PORTFOLIO_BRIEF_EXPORTED audit event', () => {
  assert.match(exportFile, /PORTFOLIO_BRIEF_EXPORTED/);
  assert.match(exportFile, /learningEligible: false/);
  assert.match(exportFile, /eventCategory.*governance/);
});

// ─── Explanation ─────────────────────────────────────────────────────────────

test('explainPortfolioBrief is present', () => {
  assert.match(builder, /explainPortfolioBrief/);
});

test('explanation includes all required fields', () => {
  for (const field of ['portfolioBrief', 'sectionReasons', 'sourceBrief', 'evidenceTrace', 'lineage', 'unknowns']) {
    assert.match(builder, new RegExp(field), `explanation missing: ${field}`);
  }
});

test('explanation answers why sections are included', () => {
  assert.match(builder, /portfolioSectionExplanation/);
  assert.match(builder, /Included because/);
  assert.match(builder, /Always included/);
});

test('explanation emits PORTFOLIO_BRIEF_EXPLAINED audit event', () => {
  assert.match(builder, /PORTFOLIO_BRIEF_EXPLAINED/);
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

test('audit events use rawReferenceTable portfolio_brief', () => {
  assert.match(builder, /rawReferenceTable.*portfolio_brief/);
  assert.match(exportFile, /rawReferenceTable.*portfolio_brief/);
});

test('PORTFOLIO_BRIEF_GENERATED is emitted in buildPortfolioBrief', () => {
  assert.match(builder, /PORTFOLIO_BRIEF_GENERATED/);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test('getPortfolioBriefHealth is present', () => {
  assert.match(builder, /getPortfolioBriefHealth/);
});

test('health returns all required fields', () => {
  for (const field of [
    'sectionCount', 'projectFactCount', 'programFactCount', 'workstreamFactCount',
    'dependencyFactCount', 'riskFactCount', 'blockerFactCount', 'escalationFactCount',
    'timelineCount', 'contradictionCount', 'unknownCount', 'coverageMetrics',
  ]) {
    assert.match(builder, new RegExp(field), `health missing: ${field}`);
  }
});

// ─── No AI / No scoring / No recommendations / No prediction ─────────────────

test('no AI imports in any portfolio brief file', () => {
  for (const file of [types, builder, sections, exportFile]) {
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
    assert.doesNotMatch(file, /openai/i);
    assert.doesNotMatch(file, /anthropic/i);
    assert.doesNotMatch(file, /import.*embed/i);
  }
});

test('no scoring in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /riskScore/i);
    assert.doesNotMatch(file, /deliveryScore/i);
    assert.doesNotMatch(file, /priorityScore/i);
    assert.doesNotMatch(file, /portfolioHealthScore/i);
    assert.doesNotMatch(file, /dependencyScore/i);
  }
});

test('no ranking in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /rankProject/i);
    assert.doesNotMatch(file, /rankBy/i);
    assert.doesNotMatch(file, /rankRisk/i);
  }
});

test('no prioritization in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /assignPriority/i);
    assert.doesNotMatch(file, /inferPriority/i);
    assert.doesNotMatch(file, /prioritizeProject/i);
  }
});

test('no recommendation language in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /recommendationScore/i);
    assert.doesNotMatch(file, /generateRecommendation/i);
    assert.doesNotMatch(file, /mitigationSuggestion/i);
    assert.doesNotMatch(file, /recommendEscalation/i);
  }
});

test('no prediction in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /predictDelivery/i);
    assert.doesNotMatch(file, /deliveryForecast/i);
    assert.doesNotMatch(file, /forecastMilestone/i);
    assert.doesNotMatch(file, /predictImpact/i);
  }
});

test('no portfolio health scoring in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /portfolioHealth\s*=/i);
    assert.doesNotMatch(file, /healthScore/i);
    assert.doesNotMatch(file, /calculatePortfolioHealth/i);
  }
});

test('no forecasting in any portfolio brief file', () => {
  for (const file of [builder, sections]) {
    assert.doesNotMatch(file, /forecastDelivery/i);
    assert.doesNotMatch(file, /forecastProgram/i);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports all types', () => {
  for (const name of [
    'PortfolioFact', 'PortfolioBrief', 'PortfolioBriefSection',
    'PortfolioBriefHealth', 'PortfolioBriefExport', 'PortfolioBriefExplanation',
    'PortfolioBriefResult', 'PortfolioBriefEventType',
  ]) {
    assert.match(indexFile, new RegExp(name), `index missing: ${name}`);
  }
});

test('index exports all builder functions', () => {
  for (const fn of [
    'buildPortfolioBrief', 'explainPortfolioBrief', 'getPortfolioBriefHealth',
    'exportPortfolioBrief',
  ]) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

test('index exports all section functions', () => {
  for (const fn of [
    'buildPortfolioSummary', 'buildProjectOverview', 'buildProgramOverview',
    'buildWorkstreamOverview', 'buildPortfolioDependencyOverview', 'buildPortfolioRiskOverview',
    'buildPortfolioBlockerOverview', 'buildPortfolioEscalationOverview', 'buildCrossProjectOverview',
    'buildPortfolioDeliveryOverview', 'buildPortfolioTimelineHighlights',
    'buildPortfolioEvidenceSummary', 'buildPortfolioSections',
  ]) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation explains what Portfolio Brief is', () => {
  assert.match(docs, /Portfolio Brief/);
  assert.match(docs, /portfolio/i);
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
  assert.match(docs, /Portfolio Brief/i);
});

test('documentation covers all portfolio sections', () => {
  for (const section of [
    'Project', 'Program', 'Workstream', 'Dependency',
    'Risk', 'Blocker', 'Escalation', 'Cross-Project', 'Delivery',
  ]) {
    assert.match(docs, new RegExp(section), `docs missing section: ${section}`);
  }
});

test('documentation includes architecture diagram', () => {
  assert.match(docs, /Constitutional Intelligence/);
  assert.match(docs, /Constitutional Context/);
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Portfolio Brief/);
});
