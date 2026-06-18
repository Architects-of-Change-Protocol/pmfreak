import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/governance-brief/types.ts', 'utf8');
const builder     = readFileSync('src/lib/governance-brief/governance-brief-builder.ts', 'utf8');
const sections    = readFileSync('src/lib/governance-brief/governance-brief-sections.ts', 'utf8');
const exportFile  = readFileSync('src/lib/governance-brief/governance-brief-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/governance-brief/index.ts', 'utf8');
const docs        = readFileSync('docs/governance-brief-foundation.md', 'utf8');
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

test('DATABASE_CONTRACT_VERSION preserves prior keywords including executive-brief', () => {
  assert.match(dbContract, /executive-brief/);
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /constitutional-intelligence-context-engine/);
  assert.match(dbContract, /intelligence-bridge/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes governance-brief suffix', () => {
  assert.match(dbContract, /governance-brief/);
  // Ensure it appears after executive-brief (appended, not replaced)
  const execIdx = dbContract.indexOf('executive-brief');
  const govIdx = dbContract.indexOf('governance-brief');
  assert.ok(govIdx > execIdx, 'governance-brief should appear after executive-brief');
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('GovernanceBrief has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'contextType', 'contextId',
    'generatedAt', 'sourceConstitutionalBrief', 'governanceSummary',
    'sections', 'authorityFacts', 'capabilityFacts', 'delegationFacts',
    'trustFacts', 'contradictions', 'unknowns', 'timelineHighlights',
    'evidenceSummary', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `GovernanceBrief missing field: ${field}`);
  }
});

test('GovernanceBriefSection has all required fields', () => {
  for (const field of ['id', 'sectionType', 'title', 'summary', 'records', 'evidence', 'lineage']) {
    assert.match(types, new RegExp(field), `GovernanceBriefSection missing field: ${field}`);
  }
});

test('GovernanceAuthorityFact has all required fields', () => {
  for (const field of ['id', 'factType', 'summary', 'sourceCount', 'evidenceCount', 'lineage']) {
    assert.match(types, new RegExp(field), `GovernanceAuthorityFact missing field: ${field}`);
  }
});

test('all 11 governance section types are declared', () => {
  for (const st of [
    'governance_summary', 'authority_overview', 'approval_overview',
    'delegation_overview', 'capability_overview', 'trust_overview',
    'policy_overview', 'contradictions', 'timeline_highlights',
    'evidence_summary', 'unknowns',
  ]) {
    assert.match(types, new RegExp(`"${st}"`), `GovernanceBriefSectionType missing: ${st}`);
  }
});

test('all 8 GovernanceFactType values are declared', () => {
  for (const ft of [
    'authority', 'approval', 'delegation', 'capability',
    'trust', 'policy', 'contradiction', 'timeline',
  ]) {
    assert.match(types, new RegExp(`"${ft}"`), `GovernanceFactType missing: ${ft}`);
  }
});

test('audit event types are declared', () => {
  assert.match(types, /GOVERNANCE_BRIEF_GENERATED/);
  assert.match(types, /GOVERNANCE_BRIEF_EXPLAINED/);
  assert.match(types, /GOVERNANCE_BRIEF_EXPORTED/);
});

test('GovernanceEvidenceSummary has all required fields', () => {
  for (const field of [
    'recordCount', 'evidenceCount', 'authorityCount',
    'capabilityCount', 'delegationCount', 'trustCount', 'contradictionCount',
  ]) {
    assert.match(types, new RegExp(field), `GovernanceEvidenceSummary missing field: ${field}`);
  }
});

// ─── Governance Summary ───────────────────────────────────────────────────────

test('buildGovernanceSummary uses counts only', () => {
  assert.match(sections, /buildGovernanceSummary/);
  assert.match(sections, /\.length/);
});

test('buildGovernanceSummary includes authority-related record count', () => {
  assert.match(sections, /authority-related/);
});

test('buildGovernanceSummary includes capability record count', () => {
  assert.match(sections, /capability/);
});

test('buildGovernanceSummary includes delegation relationship count', () => {
  assert.match(sections, /delegation/);
});

test('buildGovernanceSummary includes trust relationship count', () => {
  assert.match(sections, /trust/);
});

test('buildGovernanceSummary does not use scoring or recommendation language', () => {
  assert.doesNotMatch(sections, /\.score\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.rank\s*[=(<]/i);
  assert.doesNotMatch(sections, /\.predict\s*[=(<]/i);
  assert.doesNotMatch(sections, /recommendationScore/i);
  assert.doesNotMatch(sections, /from.*@\/lib\/ai/);
});

// ─── Authority Overview ───────────────────────────────────────────────────────

test('buildAuthorityOverview builds facts from constitutional brief sections', () => {
  assert.match(sections, /buildAuthorityOverview/);
  assert.match(sections, /relevant_knowledge/);
  assert.match(sections, /relevant_memories/);
});

test('buildAuthorityOverview does not generate authority hierarchies', () => {
  assert.doesNotMatch(sections, /generateHierarchy/i);
  assert.doesNotMatch(sections, /inferAuthority/i);
  assert.doesNotMatch(sections, /missingAuthority/i);
});

// ─── Delegation Overview ──────────────────────────────────────────────────────

test('buildDelegationOverview builds facts from bridge relationships', () => {
  assert.match(sections, /buildDelegationOverview/);
  assert.match(sections, /bridge_relationships/);
});

test('delegation facts are not created when source sections are empty', () => {
  assert.match(sections, /\.length > 0/);
});

// ─── Capability Overview ──────────────────────────────────────────────────────

test('buildCapabilityOverview builds facts from patterns and effectiveness', () => {
  assert.match(sections, /buildCapabilityOverview/);
  assert.match(sections, /relevant_patterns/);
  assert.match(sections, /relevant_effectiveness/);
});

// ─── Trust Overview ───────────────────────────────────────────────────────────

test('buildTrustOverview builds facts from bridge relationships', () => {
  assert.match(sections, /buildTrustOverview/);
  assert.match(sections, /bridge_relationships/);
});

test('buildTrustOverview does not calculate trust scores', () => {
  assert.doesNotMatch(sections, /trustScore/i);
  assert.doesNotMatch(sections, /calculateTrust/i);
  assert.doesNotMatch(sections, /trustRating/i);
  assert.doesNotMatch(sections, /inferTrust/i);
});

test('trust overview section notes no trust scores and no trust ratings', () => {
  assert.match(sections, /No trust scores/);
  assert.match(sections, /No trust ratings/);
});

// ─── Policy Overview ──────────────────────────────────────────────────────────

test('buildPolicyOverview builds facts from knowledge section', () => {
  assert.match(sections, /buildPolicyOverview/);
  assert.match(sections, /relevant_knowledge/);
});

// ─── Timeline Highlights ──────────────────────────────────────────────────────

test('buildGovernanceTimelineHighlights sorts chronologically', () => {
  assert.match(sections, /buildGovernanceTimelineHighlights/);
  assert.match(sections, /sort/);
});

test('buildGovernanceTimelineHighlights does not invent events', () => {
  assert.match(sections, /brief\.timeline/);
  assert.doesNotMatch(sections, /inferTimeline/i);
  assert.doesNotMatch(sections, /generateTimeline/i);
});

// ─── Evidence Summary ─────────────────────────────────────────────────────────

test('buildGovernanceEvidenceSummary returns all required fields', () => {
  assert.match(sections, /buildGovernanceEvidenceSummary/);
  assert.match(sections, /recordCount/);
  assert.match(sections, /evidenceCount/);
  assert.match(sections, /authorityCount/);
  assert.match(sections, /capabilityCount/);
  assert.match(sections, /delegationCount/);
  assert.match(sections, /trustCount/);
  assert.match(sections, /contradictionCount/);
});

// ─── Contradictions ───────────────────────────────────────────────────────────

test('contradictions are reused from constitutional brief, not resolved', () => {
  assert.match(sections, /contradictions/);
  assert.match(sections, /Not resolved/);
  assert.doesNotMatch(sections, /resolveContradiction/i);
  assert.doesNotMatch(sections, /correct side/i);
});

test('contradictions are not judged', () => {
  assert.match(sections, /Not judged/);
});

// ─── Unknowns ─────────────────────────────────────────────────────────────────

test('unknowns are reused from constitutional brief', () => {
  assert.match(sections, /brief\.unknowns/);
  assert.doesNotMatch(sections, /createNewUnknown/i);
  assert.doesNotMatch(sections, /inferMissing/i);
});

// ─── Builder ──────────────────────────────────────────────────────────────────

test('buildGovernanceBrief accepts a ConstitutionalBrief', () => {
  assert.match(builder, /buildGovernanceBrief/);
  assert.match(builder, /ConstitutionalBrief/);
});

test('buildGovernanceBrief does not query databases', () => {
  assert.doesNotMatch(builder, /supabase/i);
  assert.doesNotMatch(builder, /\.from\(/);
  assert.doesNotMatch(builder, /SELECT/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportGovernanceBrief includes all required top-level keys', () => {
  assert.match(exportFile, /governanceBrief/);
  assert.match(exportFile, /sourceConstitutionalBrief/);
  assert.match(exportFile, /authorityFacts/);
  assert.match(exportFile, /capabilityFacts/);
  assert.match(exportFile, /delegationFacts/);
  assert.match(exportFile, /trustFacts/);
  assert.match(exportFile, /timelineHighlights/);
  assert.match(exportFile, /evidenceSummary/);
  assert.match(exportFile, /contradictions/);
  assert.match(exportFile, /unknowns/);
});

test('export format is json only, no PDF generation', () => {
  assert.match(exportFile, /"json"/);
  assert.doesNotMatch(exportFile, /pdfkit|puppeteer|jspdf|generatePdf/i);
});

test('export emits GOVERNANCE_BRIEF_EXPORTED audit event', () => {
  assert.match(exportFile, /GOVERNANCE_BRIEF_EXPORTED/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainGovernanceBrief returns sectionReasons and lineage', () => {
  assert.match(builder, /explainGovernanceBrief/);
  assert.match(builder, /sectionReasons/);
  assert.match(builder, /lineage/);
});

test('explainGovernanceBrief returns sourceBrief and unknowns', () => {
  assert.match(builder, /sourceBrief/);
  assert.match(builder, /unknowns/);
});

test('explainGovernanceBrief answers why sections are included', () => {
  assert.match(builder, /governanceSectionExplanation/);
  assert.match(builder, /Always included/);
});

test('explainGovernanceBrief emits GOVERNANCE_BRIEF_EXPLAINED audit event', () => {
  assert.match(builder, /GOVERNANCE_BRIEF_EXPLAINED/);
});

// ─── Health ───────────────────────────────────────────────────────────────────

test('getGovernanceBriefHealth returns all required metrics', () => {
  assert.match(builder, /getGovernanceBriefHealth/);
  assert.match(builder, /sectionCount/);
  assert.match(builder, /authorityFactCount/);
  assert.match(builder, /capabilityFactCount/);
  assert.match(builder, /delegationFactCount/);
  assert.match(builder, /trustFactCount/);
  assert.match(builder, /timelineCount/);
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

test('audit events use rawReferenceTable: governance_brief', () => {
  assert.match(builder, /rawReferenceTable: "governance_brief"/);
  assert.match(exportFile, /rawReferenceTable: "governance_brief"/);
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

test('no trust scoring or trust rating generation', () => {
  for (const file of [builder, sections, exportFile]) {
    assert.doesNotMatch(file, /trustScore\s*=/i);
    assert.doesNotMatch(file, /calculateTrustScore/i);
    assert.doesNotMatch(file, /generateTrustRating/i);
    assert.doesNotMatch(file, /trustRating\s*=/i);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports GovernanceBrief type', () => {
  assert.match(indexFile, /GovernanceBrief/);
});

test('index exports buildGovernanceBrief', () => {
  assert.match(indexFile, /buildGovernanceBrief/);
});

test('index exports exportGovernanceBrief', () => {
  assert.match(indexFile, /exportGovernanceBrief/);
});

test('index exports explainGovernanceBrief', () => {
  assert.match(indexFile, /explainGovernanceBrief/);
});

test('index exports getGovernanceBriefHealth', () => {
  assert.match(indexFile, /getGovernanceBriefHealth/);
});

test('index exports buildGovernanceSummary', () => {
  assert.match(indexFile, /buildGovernanceSummary/);
});

test('index exports buildAuthorityOverview', () => {
  assert.match(indexFile, /buildAuthorityOverview/);
});

test('index exports buildDelegationOverview', () => {
  assert.match(indexFile, /buildDelegationOverview/);
});

test('index exports buildCapabilityOverview', () => {
  assert.match(indexFile, /buildCapabilityOverview/);
});

test('index exports buildTrustOverview', () => {
  assert.match(indexFile, /buildTrustOverview/);
});

test('index exports buildPolicyOverview', () => {
  assert.match(indexFile, /buildPolicyOverview/);
});

test('index exports buildGovernanceEvidenceSummary', () => {
  assert.match(indexFile, /buildGovernanceEvidenceSummary/);
});

test('index exports buildGovernanceTimelineHighlights', () => {
  assert.match(indexFile, /buildGovernanceTimelineHighlights/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs explain what a Governance Brief is', () => {
  assert.match(docs, /Governance Brief/);
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
  assert.match(docs, /Governance Brief/);
});

test('docs explain difference between Constitutional Brief, Executive Brief, and Governance Brief', () => {
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Executive Brief/);
  assert.match(docs, /Governance Brief/);
  assert.match(docs, /[Dd]ifference|[Cc]ompar/);
});

test('docs explain authority overview', () => {
  assert.match(docs, /[Aa]uthority/);
});

test('docs explain delegation overview', () => {
  assert.match(docs, /[Dd]elegation/);
});

test('docs explain capability overview', () => {
  assert.match(docs, /[Cc]apability/);
});

test('docs explain trust overview', () => {
  assert.match(docs, /[Tt]rust/);
});

test('docs explain policy overview', () => {
  assert.match(docs, /[Pp]olicy/);
});

test('docs explain how contradictions are handled', () => {
  assert.match(docs, /[Cc]ontradiction/);
  assert.match(docs, /[Nn]ot resolved/i);
});

test('docs explain evidence summary', () => {
  assert.match(docs, /[Ee]vidence/);
});

test('docs explain why there are no recommendations', () => {
  assert.match(docs, /[Rr]ecommendation/);
});

test('docs explain why there is no trust scoring', () => {
  assert.match(docs, /trust.*scor|scor.*trust/i);
});

test('docs explain why there is no AI', () => {
  assert.match(docs, /AI/);
});

test('docs explain no persistence', () => {
  assert.match(docs, /persist/i);
});
