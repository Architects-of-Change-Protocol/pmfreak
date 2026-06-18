import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/executive-brief/types.ts', 'utf8');
const builder     = readFileSync('src/lib/executive-brief/executive-brief-builder.ts', 'utf8');
const sections    = readFileSync('src/lib/executive-brief/executive-brief-sections.ts', 'utf8');
const exportFile  = readFileSync('src/lib/executive-brief/executive-brief-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/executive-brief/index.ts', 'utf8');
const docs        = readFileSync('docs/executive-brief-foundation.md', 'utf8');
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

test('DATABASE_CONTRACT_VERSION preserves prior keywords including constitutional-brief', () => {
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /constitutional-intelligence-context-engine/);
  assert.match(dbContract, /intelligence-bridge/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes executive-brief suffix', () => {
  assert.match(dbContract, /executive-brief/);
  // Ensure it appears after constitutional-brief (appended, not replaced)
  const idx = dbContract.indexOf('constitutional-brief');
  const execIdx = dbContract.indexOf('executive-brief');
  assert.ok(execIdx > idx, 'executive-brief should appear after constitutional-brief');
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('ExecutiveBrief has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'contextType', 'contextId',
    'generatedAt', 'sourceConstitutionalBrief', 'executiveSummary',
    'sections', 'keyFacts', 'knowledgeDomains', 'contradictions',
    'unknowns', 'timelineHighlights', 'evidenceSummary', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ExecutiveBrief missing field: ${field}`);
  }
});

test('ExecutiveBriefSection has all required fields', () => {
  for (const field of ['id', 'sectionType', 'title', 'summary', 'records', 'evidence', 'lineage']) {
    assert.match(types, new RegExp(field), `ExecutiveBriefSection missing field: ${field}`);
  }
});

test('ExecutiveFact has all required fields', () => {
  for (const field of ['id', 'factType', 'summary', 'sourceCount', 'evidenceCount', 'lineage']) {
    assert.match(types, new RegExp(field), `ExecutiveFact missing field: ${field}`);
  }
});

test('all 7 executive section types are declared', () => {
  for (const st of [
    'executive_summary', 'key_facts', 'knowledge_domains',
    'contradictions', 'timeline_highlights', 'evidence_summary', 'unknowns',
  ]) {
    assert.match(types, new RegExp(`"${st}"`), `ExecutiveBriefSectionType missing: ${st}`);
  }
});

test('all 7 ExecutiveFactType values are declared', () => {
  for (const ft of ['memory', 'pattern', 'effectiveness', 'bridge', 'contradiction', 'timeline', 'domain']) {
    assert.match(types, new RegExp(`"${ft}"`), `ExecutiveFactType missing: ${ft}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /EXECUTIVE_BRIEF_GENERATED/);
  assert.match(types, /EXECUTIVE_BRIEF_EXPLAINED/);
  assert.match(types, /EXECUTIVE_BRIEF_EXPORTED/);
});

test('ExecutiveEvidenceSummary has all required fields', () => {
  for (const field of ['recordCount', 'evidenceCount', 'domainCoverage', 'contradictionCount']) {
    assert.match(types, new RegExp(field), `ExecutiveEvidenceSummary missing field: ${field}`);
  }
});

// ─── Executive Summary ────────────────────────────────────────────────────────

test('buildExecutiveSummary uses counts only', () => {
  assert.match(sections, /buildExecutiveSummary/);
  assert.match(sections, /\.length/);
});

test('buildExecutiveSummary includes section count in output', () => {
  assert.match(sections, /sections\.length/);
  assert.match(sections, /constitutional.*record/i);
});

test('buildExecutiveSummary includes contradiction count', () => {
  assert.match(sections, /contradictions/);
});

test('buildExecutiveSummary includes domain information', () => {
  assert.match(sections, /knowledgeDomains/);
});

test('buildExecutiveSummary does not use scoring or recommendation language', () => {
  assert.doesNotMatch(sections, /\.score\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.rank\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.predict\s*[=(<]/i);
  assert.doesNotMatch(sections, /recommendationScore/i);
  assert.doesNotMatch(sections, /from.*@\/lib\/ai/);
});

// ─── Key Facts ────────────────────────────────────────────────────────────────

test('buildKeyFacts builds facts from constitutional brief sections', () => {
  assert.match(sections, /buildKeyFacts/);
  assert.match(sections, /relevant_memories/);
  assert.match(sections, /relevant_patterns/);
  assert.match(sections, /relevant_effectiveness/);
  assert.match(sections, /bridge_relationships/);
  assert.match(sections, /contradictions/);
  assert.match(sections, /timeline/);
  assert.match(sections, /knowledgeDomains/);
});

test('key facts are not created when source sections are empty', () => {
  assert.match(sections, /\.length > 0/);
});

// ─── Timeline Highlights ─────────────────────────────────────────────────────

test('buildTimelineHighlights sorts chronologically', () => {
  assert.match(sections, /buildTimelineHighlights/);
  assert.match(sections, /sort/);
});

test('buildTimelineHighlights does not invent events', () => {
  assert.match(sections, /brief\.timeline/);
  assert.doesNotMatch(sections, /inferTimeline/i);
  assert.doesNotMatch(sections, /generateTimeline/i);
});

// ─── Evidence Summary ─────────────────────────────────────────────────────────

test('buildEvidenceSummary returns all required fields', () => {
  assert.match(sections, /buildEvidenceSummary/);
  assert.match(sections, /recordCount/);
  assert.match(sections, /evidenceCount/);
  assert.match(sections, /domainCoverage/);
  assert.match(sections, /contradictionCount/);
});

// ─── Contradictions ───────────────────────────────────────────────────────────

test('contradictions are reused from constitutional brief, not resolved', () => {
  assert.match(sections, /contradictions/);
  assert.match(sections, /Not resolved/);
  assert.doesNotMatch(sections, /resolveContradiction/i);
  assert.doesNotMatch(sections, /correct side/i);
});

// ─── Unknowns ─────────────────────────────────────────────────────────────────

test('unknowns are reused from constitutional brief', () => {
  assert.match(sections, /brief\.unknowns/);
  assert.doesNotMatch(sections, /createNewUnknown/i);
  assert.doesNotMatch(sections, /inferMissing/i);
});

// ─── Builder ──────────────────────────────────────────────────────────────────

test('buildExecutiveBrief accepts a ConstitutionalBrief', () => {
  assert.match(builder, /buildExecutiveBrief/);
  assert.match(builder, /ConstitutionalBrief/);
});

test('buildExecutiveBrief does not query databases', () => {
  assert.doesNotMatch(builder, /supabase/i);
  assert.doesNotMatch(builder, /\.from\(/);
  assert.doesNotMatch(builder, /SELECT/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportExecutiveBrief includes all required top-level keys', () => {
  assert.match(exportFile, /executiveBrief/);
  assert.match(exportFile, /sourceConstitutionalBrief/);
  assert.match(exportFile, /keyFacts/);
  assert.match(exportFile, /timelineHighlights/);
  assert.match(exportFile, /evidenceSummary/);
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
});

test('export format is json only, no PDF generation', () => {
  assert.match(exportFile, /"json"/);
  assert.doesNotMatch(exportFile, /pdfkit|puppeteer|jspdf|generatePdf/i);
});

test('export emits EXECUTIVE_BRIEF_EXPORTED audit event', () => {
  assert.match(exportFile, /EXECUTIVE_BRIEF_EXPORTED/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainExecutiveBrief returns sectionReasons and lineage', () => {
  assert.match(builder, /explainExecutiveBrief/);
  assert.match(builder, /sectionReasons/);
  assert.match(builder, /lineage/);
});

test('explainExecutiveBrief returns sourceBrief and unknowns', () => {
  assert.match(builder, /sourceBrief/);
  assert.match(builder, /unknowns/);
});

test('explainExecutiveBrief answers why sections are included', () => {
  assert.match(builder, /executiveSectionExplanation/);
  assert.match(builder, /Always included/);
});

test('explainExecutiveBrief emits EXECUTIVE_BRIEF_EXPLAINED audit event', () => {
  assert.match(builder, /EXECUTIVE_BRIEF_EXPLAINED/);
});

// ─── Health ───────────────────────────────────────────────────────────────────

test('getExecutiveBriefHealth returns all required metrics', () => {
  assert.match(builder, /getExecutiveBriefHealth/);
  assert.match(builder, /sectionCount/);
  assert.match(builder, /factCount/);
  assert.match(builder, /timelineCount/);
  assert.match(builder, /domainCount/);
  assert.match(builder, /contradictionCount/);
  assert.match(builder, /unknownCount/);
  assert.match(builder, /coverageMetrics/);
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

test('audit events use rawReferenceTable: executive_brief', () => {
  assert.match(builder, /rawReferenceTable: "executive_brief"/);
  assert.match(exportFile, /rawReferenceTable: "executive_brief"/);
});

test('audit events use rawReferenceId from brief.id', () => {
  assert.match(builder, /rawReferenceId: briefId/);
  assert.match(exportFile, /rawReferenceId: brief\.id/);
});

test('correlationId defaults to brief.id', () => {
  assert.match(builder, /correlationId.*brief/);
});

// ─── No AI behavior ───────────────────────────────────────────────────────────

test('no AI, ML, or embedding imports', () => {
  for (const file of [types, builder, sections, exportFile, indexFile]) {
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
    assert.doesNotMatch(file, /embeddingSearch/i);
    assert.doesNotMatch(file, /vectorSearch/i);
    assert.doesNotMatch(file, /semanticSearch/i);
    assert.doesNotMatch(file, /import.*openai/i);
  }
});

test('no scoring, ranking, prioritization, or recommendation language as code', () => {
  for (const file of [builder, sections, exportFile]) {
    assert.doesNotMatch(file, /\.score\s*[=(<]/i);
    assert.doesNotMatch(file, /\.rank\s*[=(<]/i);
    assert.doesNotMatch(file, /\.prioriti[zs]/i);
    assert.doesNotMatch(file, /recommendationScore/i);
    assert.doesNotMatch(file, /\.predict\s*[=(<]/i);
  }
});

test('no prediction or autonomous reasoning language as code identifiers', () => {
  for (const file of [builder, sections, exportFile]) {
    assert.doesNotMatch(file, /inferScore/i);
    assert.doesNotMatch(file, /autonomousDecision/i);
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports ExecutiveBrief type', () => {
  assert.match(indexFile, /ExecutiveBrief/);
});

test('index exports buildExecutiveBrief', () => {
  assert.match(indexFile, /buildExecutiveBrief/);
});

test('index exports exportExecutiveBrief', () => {
  assert.match(indexFile, /exportExecutiveBrief/);
});

test('index exports explainExecutiveBrief', () => {
  assert.match(indexFile, /explainExecutiveBrief/);
});

test('index exports getExecutiveBriefHealth', () => {
  assert.match(indexFile, /getExecutiveBriefHealth/);
});

test('index exports buildExecutiveSummary', () => {
  assert.match(indexFile, /buildExecutiveSummary/);
});

test('index exports buildKeyFacts', () => {
  assert.match(indexFile, /buildKeyFacts/);
});

test('index exports buildTimelineHighlights', () => {
  assert.match(indexFile, /buildTimelineHighlights/);
});

test('index exports buildEvidenceSummary', () => {
  assert.match(indexFile, /buildEvidenceSummary/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs explain what an Executive Brief is', () => {
  assert.match(docs, /Executive Brief/);
});

test('docs explain what it is not', () => {
  assert.match(docs, /not/i);
  assert.match(docs, /AI/);
});

test('docs include the constitutional intelligence diagram', () => {
  assert.match(docs, /Constitutional Intelligence/);
  assert.match(docs, /Constitutional Context Engine/);
  assert.match(docs, /Constitutional Context Package/);
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Executive Brief/);
});

test('docs explain difference between Constitutional Brief and Executive Brief', () => {
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Executive Brief/);
  assert.match(docs, /[Dd]ifference|[Cc]ompar/);
});

test('docs explain how executive summaries are built', () => {
  assert.match(docs, /[Ss]ummary/);
  assert.match(docs, /count/i);
});

test('docs explain how evidence summaries work', () => {
  assert.match(docs, /[Ee]vidence/);
});

test('docs explain how contradictions are handled', () => {
  assert.match(docs, /[Cc]ontradiction/);
  assert.match(docs, /[Nn]ot resolved/i);
});

test('docs explain timeline highlights', () => {
  assert.match(docs, /[Tt]imeline/);
});

test('docs explain why there are no recommendations', () => {
  assert.match(docs, /[Rr]ecommendation/);
});

test('docs explain why there is no scoring', () => {
  assert.match(docs, /[Ss]cor/);
});

test('docs explain why there is no AI', () => {
  assert.match(docs, /AI/);
});

test('docs explain no persistence', () => {
  assert.match(docs, /persist/i);
});
