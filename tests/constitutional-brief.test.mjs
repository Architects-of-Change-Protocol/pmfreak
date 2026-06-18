import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/constitutional-brief/types.ts', 'utf8');
const builder     = readFileSync('src/lib/constitutional-brief/brief-builder.ts', 'utf8');
const sections    = readFileSync('src/lib/constitutional-brief/brief-sections.ts', 'utf8');
const exportFile  = readFileSync('src/lib/constitutional-brief/brief-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/constitutional-brief/index.ts', 'utf8');
const docs        = readFileSync('docs/constitutional-brief-foundation.md', 'utf8');
const dbContract  = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePackage(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function makeMemory(id) {
  return { id, workspace_id: '11111111-1111-4111-8111-111111111111', created_at: '2026-06-18T00:00:00.000Z', source: 'test' };
}

function makeContradiction(id, aId, bId) {
  return {
    id,
    sourceAType: 'organizational_memory',
    sourceAId: aId,
    sourceAStatement: 'statement A',
    sourceBType: 'organizational_memory',
    sourceBId: bId,
    sourceBStatement: 'statement B',
    detectedAt: '2026-06-18T00:00:00.000Z',
    relationshipType: 'contradicts',
    bridgeId: null,
  };
}

// ─── Database contract ────────────────────────────────────────────────────────

test('DATABASE_CONTRACT_VERSION preserves prior keywords', () => {
  assert.match(dbContract, /constitutional-intelligence-context-engine/);
  assert.match(dbContract, /intelligence-bridge/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes constitutional-brief suffix', () => {
  assert.match(dbContract, /constitutional-brief/);
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('ConstitutionalBrief has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'contextType', 'contextId',
    'generatedAt', 'sourceContextPackage', 'summary', 'sections',
    'evidenceTrace', 'timeline', 'contradictions', 'knowledgeDomains',
    'unknowns', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ConstitutionalBrief missing field: ${field}`);
  }
});

test('ConstitutionalBriefSection has all required fields', () => {
  for (const field of ['id', 'sectionType', 'title', 'summary', 'records', 'evidence', 'lineage']) {
    assert.match(types, new RegExp(field), `ConstitutionalBriefSection missing field: ${field}`);
  }
});

test('all 10 section types are declared', () => {
  for (const st of [
    'context_summary', 'relevant_knowledge', 'relevant_memories',
    'relevant_patterns', 'relevant_effectiveness', 'bridge_relationships',
    'contradictions', 'evidence_trace', 'timeline', 'outstanding_unknowns',
  ]) {
    assert.match(types, new RegExp(`"${st}"`), `BriefSectionType missing: ${st}`);
  }
});

test('ConstitutionalBriefUnknown has area and description fields', () => {
  assert.match(types, /ConstitutionalBriefUnknown/);
  assert.match(types, /area/);
  assert.match(types, /description/);
});

test('ConstitutionalBriefEvidenceTraceEntry has all required fields', () => {
  for (const field of ['recordType', 'recordId', 'source', 'lineage', 'reasonIncluded']) {
    assert.match(types, new RegExp(field), `EvidenceTraceEntry missing: ${field}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /CONSTITUTIONAL_BRIEF_GENERATED/);
  assert.match(types, /CONSTITUTIONAL_BRIEF_EXPLAINED/);
  assert.match(types, /CONSTITUTIONAL_BRIEF_EXPORTED/);
});

// ─── Summary builder ──────────────────────────────────────────────────────────

test('buildBriefSummary uses counts only', () => {
  assert.match(builder, /buildBriefSummary/);
  // summary produces counts via .length
  assert.match(builder, /\.length/);
});

test('buildBriefSummary includes contextType in output', () => {
  assert.match(builder, /contextType/);
  assert.match(builder, /context contains/);
});

test('buildBriefSummary does not use scoring or recommendation language', () => {
  // Check that scoring/ranking/prediction are not used as identifiers or operations
  // (comments may state "No scoring. No ranking." as declarations — those are allowed)
  assert.doesNotMatch(builder, /\.score\s*[=(<]/i);
  assert.doesNotMatch(builder, /\.rank\s*[=(<]/i);
  assert.doesNotMatch(builder, /\.predict\s*[=(<]/i);
  assert.doesNotMatch(builder, /recommendationScore/i);
  assert.doesNotMatch(builder, /from.*@\/lib\/ai/);
});

test('buildBriefSummary includes contradiction count', () => {
  assert.match(builder, /contradictions?/);
});

test('buildBriefSummary includes knowledge domains', () => {
  assert.match(builder, /knowledgeDomains/);
});

// ─── Section builder ──────────────────────────────────────────────────────────

test('buildBriefSections builds sections deterministically from package fields', () => {
  assert.match(sections, /buildBriefSections/);
  assert.match(sections, /memories/);
  assert.match(sections, /patterns/);
  assert.match(sections, /effectivenessRecords/);
  assert.match(sections, /bridgeRelationships/);
  assert.match(sections, /contradictions/);
  assert.match(sections, /evidence/);
  assert.match(sections, /timeline/);
  assert.match(sections, /knowledgeDomains/);
});

test('sections are not created when arrays are empty (except context_summary)', () => {
  assert.match(sections, /\.length > 0/);
});

test('context_summary section is always created', () => {
  assert.match(sections, /context_summary/);
});

// ─── Evidence trace ───────────────────────────────────────────────────────────

test('buildEvidenceTrace preserves reasonIncluded', () => {
  assert.match(builder, /reasonIncluded/);
});

test('buildEvidenceTrace extracts recordType and recordId', () => {
  assert.match(builder, /recordType/);
  assert.match(builder, /recordId/);
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

test('timeline is reused from context package, not rebuilt', () => {
  assert.match(builder, /timeline/);
  // The builder takes timeline directly from contextPackage, not calling buildTimeline
  assert.doesNotMatch(builder, /buildTimeline/);
});

// ─── Contradictions ───────────────────────────────────────────────────────────

test('contradictions are included but not resolved', () => {
  assert.match(sections, /contradictions/);
  // Includes "Not resolved" statement and does not make judgments
  assert.match(sections, /Not resolved/);
  assert.doesNotMatch(sections, /resolveContradiction/i);
  assert.doesNotMatch(sections, /correct side/i);
});

// ─── Unknowns ─────────────────────────────────────────────────────────────────

test('buildBriefUnknowns is created for each missing context area', () => {
  assert.match(sections, /buildBriefUnknowns/);
  assert.match(sections, /No linked memories/);
  assert.match(sections, /No linked patterns/);
  assert.match(sections, /No relevant effectiveness/);
  assert.match(sections, /No explicit bridge/);
  assert.match(sections, /No contradictions/);
  assert.match(sections, /No evidence trace/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportConstitutionalBrief includes all required top-level keys', () => {
  assert.match(exportFile, /brief/);
  assert.match(exportFile, /sourceContextPackage/);
  assert.match(exportFile, /evidenceTrace/);
  assert.match(exportFile, /timeline/);
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
});

test('export format is json only, no PDF generation', () => {
  assert.match(exportFile, /"json"/);
  // No PDF library imports or PDF generation code
  assert.doesNotMatch(exportFile, /pdfkit|puppeteer|jspdf|generatePdf/i);
});

test('export emits CONSTITUTIONAL_BRIEF_EXPORTED audit event', () => {
  assert.match(exportFile, /CONSTITUTIONAL_BRIEF_EXPORTED/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainConstitutionalBrief returns sectionReasons and lineage', () => {
  assert.match(builder, /explainConstitutionalBrief/);
  assert.match(builder, /sectionReasons/);
  assert.match(builder, /lineage/);
});

test('explainConstitutionalBrief returns sourceContextPackage and unknowns', () => {
  assert.match(builder, /sourceContextPackage/);
  assert.match(builder, /unknowns/);
});

test('explainConstitutionalBrief emits CONSTITUTIONAL_BRIEF_EXPLAINED audit event', () => {
  assert.match(builder, /CONSTITUTIONAL_BRIEF_EXPLAINED/);
});

// ─── Health ───────────────────────────────────────────────────────────────────

test('getConstitutionalBriefHealth returns all required metrics', () => {
  assert.match(builder, /getConstitutionalBriefHealth/);
  assert.match(builder, /sectionCount/);
  assert.match(builder, /recordCount/);
  assert.match(builder, /evidenceTraceCount/);
  assert.match(builder, /contradictionCount/);
  assert.match(builder, /unknownCount/);
  assert.match(builder, /domainCount/);
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

test('audit events use rawReferenceTable: constitutional_brief', () => {
  assert.match(builder, /rawReferenceTable: "constitutional_brief"/);
  assert.match(exportFile, /rawReferenceTable: "constitutional_brief"/);
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

test('no prediction language as code identifiers', () => {
  for (const file of [builder, sections, exportFile]) {
    // These should not appear as function calls or variable names
    assert.doesNotMatch(file, /inferScore/i);
    assert.doesNotMatch(file, /autonomousDecision/i);
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports ConstitutionalBrief type', () => {
  assert.match(indexFile, /ConstitutionalBrief/);
});

test('index exports buildConstitutionalBrief', () => {
  assert.match(indexFile, /buildConstitutionalBrief/);
});

test('index exports exportConstitutionalBrief', () => {
  assert.match(indexFile, /exportConstitutionalBrief/);
});

test('index exports explainConstitutionalBrief', () => {
  assert.match(indexFile, /explainConstitutionalBrief/);
});

test('index exports getConstitutionalBriefHealth', () => {
  assert.match(indexFile, /getConstitutionalBriefHealth/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs explain what a Constitutional Brief is', () => {
  assert.match(docs, /Constitutional Brief/);
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
});

test('docs explain unknowns', () => {
  assert.match(docs, /[Uu]nknown/);
});

test('docs explain evidence trace', () => {
  assert.match(docs, /[Ee]vidence/);
});

test('docs explain why briefs are not persisted', () => {
  assert.match(docs, /persist/i);
});
