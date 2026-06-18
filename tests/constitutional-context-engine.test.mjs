import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types      = readFileSync('src/lib/constitutional-context/types.ts', 'utf8');
const resolver   = readFileSync('src/lib/constitutional-context/context-resolver.ts', 'utf8');
const engine     = readFileSync('src/lib/constitutional-context/context-engine.ts', 'utf8');
const health     = readFileSync('src/lib/constitutional-context/context-health.ts', 'utf8');
const indexFile  = readFileSync('src/lib/constitutional-context/index.ts', 'utf8');
const docs       = readFileSync('docs/constitutional-context-engine-foundation.md', 'utf8');
const dbContract = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Database contract ────────────────────────────────────────────────────────

test('database contract version includes context-engine suffix', () => {
  assert.match(dbContract, /context-engine/);
  assert.match(dbContract, /constitutional-intelligence-context-engine/);
});

// ─── Types — ConstitutionalContextPackage ────────────────────────────────────

test('ConstitutionalContextPackage has all required fields', () => {
  assert.match(types, /workspaceId/);
  assert.match(types, /pmUserId/);
  assert.match(types, /contextType/);
  assert.match(types, /contextId/);
  assert.match(types, /generatedAt/);
  assert.match(types, /memories/);
  assert.match(types, /patterns/);
  assert.match(types, /effectivenessRecords/);
  assert.match(types, /bridgeRelationships/);
  assert.match(types, /contradictions/);
  assert.match(types, /evidence/);
  assert.match(types, /timeline/);
  assert.match(types, /knowledgeDomains/);
});

// ─── Types — ConstitutionalContextRequest ────────────────────────────────────

test('ConstitutionalContextRequest has all required fields', () => {
  assert.match(types, /ConstitutionalContextRequest/);
  assert.match(types, /workspaceId/);
  assert.match(types, /pmUserId/);
  assert.match(types, /contextType/);
  assert.match(types, /contextId/);
  assert.match(types, /relatedIds/);
  assert.match(types, /knowledgeDomains/);
  assert.match(types, /maxResults/);
});

// ─── Types — All 10 context types ────────────────────────────────────────────

test('all 10 context types are declared', () => {
  for (const ct of [
    'decision', 'project', 'stakeholder', 'risk', 'milestone',
    'task', 'escalation', 'meeting', 'outcome', 'governance-review',
  ]) {
    assert.match(types, new RegExp(`"${ct}"`), `context type "${ct}" missing`);
  }
});

// ─── Types — ConstitutionalTimelineEntry ─────────────────────────────────────

test('ConstitutionalTimelineEntry has all required fields', () => {
  assert.match(types, /ConstitutionalTimelineEntry/);
  assert.match(types, /timestamp/);
  assert.match(types, /recordType/);
  assert.match(types, /recordId/);
  assert.match(types, /summary/);
  assert.match(types, /source/);
});

// ─── Types — Audit events ─────────────────────────────────────────────────────

test('audit event types are declared', () => {
  assert.match(types, /CONTEXT_PACKAGE_GENERATED/);
  assert.match(types, /CONTEXT_PACKAGE_EXPLAINED/);
  assert.match(types, /CONTEXT_PACKAGE_EXPORTED/);
});

// ─── Types — Health ───────────────────────────────────────────────────────────

test('ConstitutionalContextHealth has all health fields', () => {
  assert.match(types, /ConstitutionalContextHealth/);
  assert.match(types, /contextCount/);
  assert.match(types, /averageRecordsPerContext/);
  assert.match(types, /averageEvidencePerContext/);
  assert.match(types, /averageContradictionsPerContext/);
  assert.match(types, /coverageMetrics/);
});

// ─── Context Resolver — deterministic selection ───────────────────────────────

test('context resolver uses explicit IDs only — no semantic matching', () => {
  assert.match(resolver, /targetIds/);
  assert.match(resolver, /referenceFields/);
  // No AI or semantic search
  assert.doesNotMatch(resolver, /createEmbedding|getEmbedding|vectorize/i);
  assert.doesNotMatch(resolver, /semanticSearch|fuzzySearch/i);
  assert.doesNotMatch(resolver, /cosineSimilarity|dotProduct/i);
  assert.doesNotMatch(resolver, /scoreRecord|rankRecord/i);
});

test('context resolver matches by direct ID', () => {
  assert.match(resolver, /direct_id_match/);
});

test('context resolver matches by reference field', () => {
  assert.match(resolver, /reference_field_match/);
});

test('context resolver covers all 10 context types in reference field map', () => {
  for (const ct of [
    'decision', 'project', 'stakeholder', 'risk', 'milestone',
    'task', 'escalation', 'meeting', 'outcome', 'governance-review',
  ]) {
    assert.match(resolver, new RegExp(`"${ct}"`), `context type "${ct}" missing from resolver`);
  }
});

test('context resolver selects memories, patterns, effectiveness, bridges separately', () => {
  assert.match(resolver, /organizationalMemory/);
  assert.match(resolver, /personalMemory/);
  assert.match(resolver, /organizationalPatterns/);
  assert.match(resolver, /personalPatterns/);
  assert.match(resolver, /decisionEffectiveness/);
  assert.match(resolver, /personalEffectiveness/);
  assert.match(resolver, /bridgeRelationships/);
});

test('context resolver returns selectionReasons', () => {
  assert.match(resolver, /selectionReasons/);
  assert.match(resolver, /ConstitutionalContextSelectionReason/);
});

// ─── Context Engine ───────────────────────────────────────────────────────────

test('buildConstitutionalContext is exported and validates UUIDs', () => {
  assert.match(engine, /export async function buildConstitutionalContext/);
  assert.match(engine, /validUuid\(workspaceId\)/);
  assert.match(engine, /validUuid\(pmUserId\)/);
  assert.match(engine, /validUuid\(contextId\)/);
});

test('buildConstitutionalContext validates contextType', () => {
  assert.match(engine, /ALL_CONTEXT_TYPES\.includes\(contextType\)/);
});

test('buildConstitutionalContext builds timeline from records', () => {
  assert.match(engine, /buildTimeline/);
  assert.match(engine, /ConstitutionalTimelineEntry/);
});

test('buildConstitutionalContext filters contradictions from existing intelligence layer', () => {
  assert.match(engine, /filterContradictions/);
  assert.match(engine, /snapshot\.contradictions/);
  // Must not create new contradictions
  assert.doesNotMatch(engine, /new ConstitutionalContradiction/);
  assert.doesNotMatch(engine, /detectContradictions/);
});

test('buildConstitutionalContext emits CONTEXT_PACKAGE_GENERATED audit event', () => {
  assert.match(engine, /CONTEXT_PACKAGE_GENERATED/);
});

test('explainContextSelection is exported', () => {
  assert.match(engine, /export async function explainContextSelection/);
  assert.match(engine, /CONTEXT_PACKAGE_EXPLAINED/);
});

test('explainContextSelection returns selectedRecords and selectionReasons', () => {
  assert.match(engine, /selectedRecords/);
  assert.match(engine, /selectionReasons/);
  assert.match(engine, /sourceRelationships/);
  assert.match(engine, /lineage/);
});

test('exportContextPackage is exported and returns JSON format', () => {
  assert.match(engine, /export async function exportContextPackage/);
  assert.match(engine, /format: "json"/);
  assert.match(engine, /CONTEXT_PACKAGE_EXPORTED/);
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

test('timeline uses explicit timestamp fields only', () => {
  assert.match(engine, /created_at/);
  assert.match(engine, /occurred_at/);
  assert.match(engine, /updated_at/);
  // Sorted chronologically
  assert.match(engine, /\.sort\(/);
  assert.match(engine, /localeCompare/);
});

test('timeline entry includes recordType, recordId, summary, source', () => {
  assert.match(engine, /recordType/);
  assert.match(engine, /recordId/);
  assert.match(engine, /summary/);
  assert.match(engine, /source/);
  assert.match(engine, /timestamp/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportContextPackage produces JSON-only export', () => {
  assert.match(engine, /format: "json"/);
  assert.match(engine, /exportedAt/);
});

// ─── Health ───────────────────────────────────────────────────────────────────

test('getContextEngineHealth is exported', () => {
  assert.match(health, /export async function getContextEngineHealth/);
});

test('getContextEngineHealth returns all required health fields', () => {
  assert.match(health, /contextCount/);
  assert.match(health, /averageRecordsPerContext/);
  assert.match(health, /averageEvidencePerContext/);
  assert.match(health, /averageContradictionsPerContext/);
  assert.match(health, /coverageMetrics/);
});

test('getContextEngineHealth validates UUIDs', () => {
  assert.match(health, /validUuid\(workspaceId\)/);
  assert.match(health, /validUuid\(pmUserId\)/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('audit events use learningEligible=false', () => {
  assert.match(engine, /learningEligible: false/);
});

test('audit events use eventCategory=governance', () => {
  assert.match(engine, /eventCategory: "governance"/);
});

test('audit events use visibility=workspace', () => {
  assert.match(engine, /visibility: "workspace"/);
});

test('all three audit event types are emitted in the engine', () => {
  assert.match(engine, /CONTEXT_PACKAGE_GENERATED/);
  assert.match(engine, /CONTEXT_PACKAGE_EXPLAINED/);
  assert.match(engine, /CONTEXT_PACKAGE_EXPORTED/);
});

// ─── Cross-PM isolation ───────────────────────────────────────────────────────

test('context engine validates both workspaceId and pmUserId before processing', () => {
  for (const fn of ['buildConstitutionalContext', 'explainContextSelection', 'exportContextPackage']) {
    assert.match(engine, new RegExp(`function ${fn}`), `${fn} not found`);
  }
  assert.match(engine, /validUuid\(workspaceId\)/);
  assert.match(engine, /validUuid\(pmUserId\)/);
});

test('health validates both workspaceId and pmUserId', () => {
  assert.match(health, /validUuid\(workspaceId\)/);
  assert.match(health, /validUuid\(pmUserId\)/);
});

// ─── Decision context ─────────────────────────────────────────────────────────

test('decision context references decision_id field', () => {
  assert.match(resolver, /decision_id/);
});

// ─── Risk context ─────────────────────────────────────────────────────────────

test('risk context references risk_id field', () => {
  assert.match(resolver, /risk_id/);
});

// ─── Stakeholder context ──────────────────────────────────────────────────────

test('stakeholder context references stakeholder_id field', () => {
  assert.match(resolver, /stakeholder_id/);
});

// ─── Project context ──────────────────────────────────────────────────────────

test('project context references project_id field', () => {
  assert.match(resolver, /project_id/);
});

// ─── No AI / no scoring / no ranking ──────────────────────────────────────────

test('engine contains no AI, ML, scoring, or ranking logic', () => {
  for (const file of [engine, resolver, health]) {
    assert.doesNotMatch(file, /createEmbedding|vectorize|getEmbedding/i, 'found embedding API call');
    assert.doesNotMatch(file, /\.score\s*[=(]/i, 'found scoring assignment');
    assert.doesNotMatch(file, /\.rank\s*[=(]/i, 'found ranking assignment');
    assert.doesNotMatch(file, /openai/i, 'found openai reference');
    assert.doesNotMatch(file, /new.*Predictor|runPrediction/i, 'found prediction code');
    assert.doesNotMatch(file, /runInference|callModel/i, 'found inference code');
    assert.doesNotMatch(file, /generateRecommendation/i, 'found recommendation generation');
    assert.doesNotMatch(file, /semanticSearch|fuzzySearch/i, 'found semantic search');
    assert.doesNotMatch(file, /cosineSimilarity|dotProduct/i, 'found vector math');
  }
});

test('deterministic selection — no non-deterministic behavior', () => {
  // Selection must be based on explicit ID matching only
  assert.match(resolver, /targetIds\.has\(/);
  assert.doesNotMatch(resolver, /Math\.random/);
  assert.doesNotMatch(resolver, /shuffle|sample\b/);
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index re-exports all modules', () => {
  assert.match(indexFile, /types/);
  assert.match(indexFile, /context-resolver/);
  assert.match(indexFile, /context-engine/);
  assert.match(indexFile, /context-health/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation exists and covers required topics', () => {
  assert.match(docs, /Constitutional Context Engine/i);
  assert.match(docs, /what it is not/i);
  assert.match(docs, /deterministic/i);
  assert.match(docs, /timeline/i);
  assert.match(docs, /export/i);
  assert.match(docs, /audit/i);
  assert.match(docs, /privacy/i);
  assert.match(docs, /context package/i);
});
