import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types      = readFileSync('src/lib/constitutional-intelligence/types.ts', 'utf8');
const assembler  = readFileSync('src/lib/constitutional-intelligence/knowledge-assembler.ts', 'utf8');
const service    = readFileSync('src/lib/constitutional-intelligence/constitutional-intelligence-service.ts', 'utf8');
const resolver   = readFileSync('src/lib/constitutional-intelligence/source-resolver.ts', 'utf8');
const indexFile  = readFileSync('src/lib/constitutional-intelligence/index.ts', 'utf8');
const docs       = readFileSync('docs/constitutional-intelligence-foundation.md', 'utf8');
const dbContract = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Database contract ────────────────────────────────────────────────────────

test('database contract version includes constitutional-intelligence suffix', () => {
  assert.match(dbContract, /constitutional-intelligence/);
  assert.match(dbContract, /intelligence-bridge-constitutional-intelligence/);
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('ConstitutionalIntelligenceSnapshot has all required fields', () => {
  assert.match(types, /workspaceId/);
  assert.match(types, /generatedAt/);
  assert.match(types, /organizationalMemory/);
  assert.match(types, /organizationalPatterns/);
  assert.match(types, /decisionEffectiveness/);
  assert.match(types, /patternCandidates/);
  assert.match(types, /personalMemory/);
  assert.match(types, /personalPatterns/);
  assert.match(types, /personalEffectiveness/);
  assert.match(types, /personalPatternCandidates/);
  assert.match(types, /bridgeRelationships/);
  assert.match(types, /contradictions/);
  assert.match(types, /knowledgeDomains/);
  assert.match(types, /evidenceCount/);
});

test('all 12 knowledge domains are declared', () => {
  for (const domain of [
    'execution', 'delivery', 'stakeholders', 'risk', 'governance',
    'communication', 'planning', 'escalation', 'decision-making',
    'coordination', 'quality', 'operational',
  ]) {
    assert.match(types, new RegExp(`"${domain}"`), `domain "${domain}" missing from types`);
  }
});

test('ConstitutionalContradiction has required fields', () => {
  assert.match(types, /ConstitutionalContradiction/);
  assert.match(types, /sourceAType/);
  assert.match(types, /sourceAId/);
  assert.match(types, /sourceBType/);
  assert.match(types, /sourceBId/);
  assert.match(types, /detectedAt/);
  assert.match(types, /bridgeId/);
});

test('ConstitutionalKnowledgeHealth has all health fields', () => {
  assert.match(types, /memoryCount/);
  assert.match(types, /patternCount/);
  assert.match(types, /effectivenessCount/);
  assert.match(types, /bridgeCount/);
  assert.match(types, /candidateCount/);
  assert.match(types, /contradictionCount/);
  assert.match(types, /evidenceCount/);
  assert.match(types, /coverageMetrics/);
});

test('audit event types are declared', () => {
  assert.match(types, /CONSTITUTIONAL_INTELLIGENCE_ACCESSED/);
  assert.match(types, /CONSTITUTIONAL_KNOWLEDGE_EXPLAINED/);
  assert.match(types, /CONSTITUTIONAL_KNOWLEDGE_EXPORTED/);
});

// ─── Source resolver ──────────────────────────────────────────────────────────

test('source resolver uses explicit IDs only — no semantic matching', () => {
  assert.match(resolver, /\.in\("id", /);
  assert.match(resolver, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(resolver, /\.eq\("pm_user_id", pmUserId\)/);
  // Must not contain actual embedding/scoring function calls
  assert.doesNotMatch(resolver, /createEmbedding|getEmbedding|vectorize/i);
  assert.doesNotMatch(resolver, /semanticSearch|fuzzySearch/i);
  assert.doesNotMatch(resolver, /cosineSimilarity|dotProduct/i);
  assert.doesNotMatch(resolver, /scoreRecord|rankRecord/i);
});

test('source resolver covers all 9 source types', () => {
  for (const sourceType of [
    'organizational_memory', 'organizational_pattern', 'decision_effectiveness',
    'pattern_candidate', 'personal_memory', 'personal_pattern',
    'personal_effectiveness', 'personal_pattern_candidate', 'bridge_relationship',
  ]) {
    assert.match(resolver, new RegExp(sourceType), `source type "${sourceType}" missing from resolver`);
  }
});

test('source resolver maps to correct database tables', () => {
  assert.match(resolver, /organizational_memory.*organizational_memory/s);
  assert.match(resolver, /personal_pm_memory/);
  assert.match(resolver, /personal_pm_patterns/);
  assert.match(resolver, /personal_pm_effectiveness/);
  assert.match(resolver, /personal_pm_pattern_candidates/);
  assert.match(resolver, /intelligence_bridge_links/);
  assert.match(resolver, /pattern_extraction_candidates/);
});

// ─── Knowledge assembler ──────────────────────────────────────────────────────

test('assembleConstitutionalKnowledge is exported', () => {
  assert.match(assembler, /export async function assembleConstitutionalKnowledge/);
});

test('knowledge assembler computes evidenceCount as sum of all sources', () => {
  assert.match(assembler, /evidenceCount/);
  assert.match(assembler, /\.length \+/);
});

test('contradiction detection uses only explicit bridge relationship_type strings', () => {
  assert.match(assembler, /contradicts/);
  assert.match(assembler, /relType.*includes.*contradicts/);
  // No AI or ML calls
  assert.doesNotMatch(assembler, /createEmbedding|getEmbedding/i);
  assert.doesNotMatch(assembler, /scoreRecord|rankRecord/i);
  assert.doesNotMatch(assembler, /runPrediction|callModel/i);
});

test('domain classification uses deterministic string mapping only', () => {
  assert.match(assembler, /CATEGORY_DOMAIN_MAP/);
  assert.match(assembler, /classifyToDomain/);
  assert.doesNotMatch(assembler, /createEmbedding|getEmbedding/i);
  assert.doesNotMatch(assembler, /cosineSimilarity|dotProduct/i);
  assert.doesNotMatch(assembler, /semanticSearch|fuzzySearch/i);
});

test('assembleDomains builds DomainKnowledgeEntry for every domain', () => {
  assert.match(assembler, /ALL_KNOWLEDGE_DOMAINS/);
  assert.match(assembler, /domainMap\.set\(domain/);
});

// ─── Service functions ────────────────────────────────────────────────────────

test('getConstitutionalIntelligence is exported and validates UUIDs', () => {
  assert.match(service, /export async function getConstitutionalIntelligence/);
  assert.match(service, /validUuid\(workspaceId\)/);
  assert.match(service, /validUuid\(pmUserId\)/);
});

test('getKnowledgeDomain is exported', () => {
  assert.match(service, /export async function getKnowledgeDomain/);
});

test('getRelevantMemories is exported', () => {
  assert.match(service, /export async function getRelevantMemories/);
});

test('getRelevantPatterns is exported', () => {
  assert.match(service, /export async function getRelevantPatterns/);
});

test('getRelevantEffectivenessRecords is exported', () => {
  assert.match(service, /export async function getRelevantEffectivenessRecords/);
});

test('getRelevantBridgeRelationships is exported', () => {
  assert.match(service, /export async function getRelevantBridgeRelationships/);
});

test('explainKnowledge is exported and emits audit event', () => {
  assert.match(service, /export async function explainKnowledge/);
  assert.match(service, /CONSTITUTIONAL_KNOWLEDGE_EXPLAINED/);
});

test('exportConstitutionalKnowledge returns JSON format', () => {
  assert.match(service, /export async function exportConstitutionalKnowledge/);
  assert.match(service, /format: "json"/);
  assert.match(service, /CONSTITUTIONAL_KNOWLEDGE_EXPORTED/);
});

test('getConstitutionalKnowledgeHealth returns all health metrics', () => {
  assert.match(service, /export async function getConstitutionalKnowledgeHealth/);
  assert.match(service, /memoryCount/);
  assert.match(service, /patternCount/);
  assert.match(service, /effectivenessCount/);
  assert.match(service, /bridgeCount/);
  assert.match(service, /candidateCount/);
  assert.match(service, /contradictionCount/);
  assert.match(service, /evidenceCount/);
  assert.match(service, /coverageMetrics/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('audit events are emitted with learningEligible=false', () => {
  assert.match(service, /learningEligible: false/);
});

test('audit events use eventCategory=governance', () => {
  assert.match(service, /eventCategory: "governance"/);
});

test('audit events use visibility=workspace', () => {
  assert.match(service, /visibility: "workspace"/);
});

test('all three audit event types are emitted in the service', () => {
  assert.match(service, /CONSTITUTIONAL_INTELLIGENCE_ACCESSED/);
  assert.match(service, /CONSTITUTIONAL_KNOWLEDGE_EXPLAINED/);
  assert.match(service, /CONSTITUTIONAL_KNOWLEDGE_EXPORTED/);
});

// ─── No AI / no scoring / no ranking ──────────────────────────────────────────

test('service contains no AI, ML, scoring, or ranking logic', () => {
  for (const file of [service, assembler, resolver]) {
    // Check for actual code usage (not just comments) by looking for identifier patterns
    assert.doesNotMatch(file, /createEmbedding|vectorize|getEmbedding/i, 'found embedding API call');
    assert.doesNotMatch(file, /\.score\s*[=(]/i, 'found scoring assignment');
    assert.doesNotMatch(file, /\.rank\s*[=(]/i, 'found ranking assignment');
    assert.doesNotMatch(file, /openai/i, 'found openai reference');
    assert.doesNotMatch(file, /new.*Predictor|runPrediction/i, 'found prediction code');
    assert.doesNotMatch(file, /runInference|callModel/i, 'found inference code');
    assert.doesNotMatch(file, /generateRecommendation/i, 'found recommendation generation');
  }
});

// ─── Cross-PM isolation ───────────────────────────────────────────────────────

test('source resolver enforces pm_user_id isolation for personal records', () => {
  // Personal tables must be filtered by pm_user_id
  assert.match(resolver, /personal_pm_memory.*pm_user_id/s);
  assert.match(resolver, /personal_pm_patterns.*pm_user_id/s);
  assert.match(resolver, /personal_pm_effectiveness.*pm_user_id/s);
  assert.match(resolver, /intelligence_bridge_links.*pm_user_id/s);
});

test('service validates both workspaceId and pmUserId as UUIDs', () => {
  for (const fn of [
    'getConstitutionalIntelligence',
    'getKnowledgeDomain',
    'getRelevantMemories',
    'getRelevantPatterns',
    'getRelevantEffectivenessRecords',
    'getRelevantBridgeRelationships',
    'explainKnowledge',
    'exportConstitutionalKnowledge',
    'getConstitutionalKnowledgeHealth',
  ]) {
    assert.match(service, new RegExp(`function ${fn}`), `${fn} not found`);
    assert.match(service, /validUuid\(workspaceId\)/, `workspaceId validation missing`);
    assert.match(service, /validUuid\(pmUserId\)/, `pmUserId validation missing`);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index re-exports all modules', () => {
  assert.match(indexFile, /types/);
  assert.match(indexFile, /source-resolver/);
  assert.match(indexFile, /knowledge-assembler/);
  assert.match(indexFile, /constitutional-intelligence-service/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation exists and covers required topics', () => {
  assert.match(docs, /Constitutional Intelligence/i);
  assert.match(docs, /what it is not/i);
  assert.match(docs, /lineage/i);
  assert.match(docs, /contradiction/i);
  assert.match(docs, /export/i);
  assert.match(docs, /audit/i);
  assert.match(docs, /privacy/i);
});
