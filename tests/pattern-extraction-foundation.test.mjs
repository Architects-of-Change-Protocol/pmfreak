import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  EXTRACTION_MINIMUM_OCCURRENCES,
  PATTERN_EXTRACTION_CAPABILITIES,
} from '../src/lib/pattern-extraction/types.ts';
import {
  ALL_RULE_IDS,
  getAllRules,
  getRuleById,
  RULE_REPEATED_DECISION_OUTCOME,
  RULE_REPEATED_DEPENDENCY_DELAY,
  RULE_REPEATED_RISK_ESCALATION,
  RULE_REPEATED_DECISION_REJECTION,
} from '../src/lib/pattern-extraction/rule-registry.ts';

const types = readFileSync('src/lib/pattern-extraction/types.ts', 'utf8');
const service = readFileSync('src/lib/pattern-extraction/pattern-extraction-service.ts', 'utf8');
const rules = readFileSync('src/lib/pattern-extraction/rule-registry.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260618000000_pattern_extraction_foundation.sql', 'utf8');
const contract = readFileSync('src/lib/db/database-contract.ts', 'utf8');
const docs = readFileSync('docs/pattern-extraction-foundation.md', 'utf8');

// ─── Migration: tables ────────────────────────────────────────────────────────

test('migration creates organizational_pattern_candidates table', () => {
  assert.match(migration, /create table if not exists public\.organizational_pattern_candidates/);
  for (const field of [
    'workspace_id uuid not null',
    'pattern_category text not null',
    'candidate_title text not null',
    'candidate_summary text not null',
    'observation_count integer not null',
    'confidence text not null',
    'status text not null',
    'rule_id text not null',
    'promoted_pattern_id uuid null',
    'metadata jsonb not null',
  ]) assert.match(migration, new RegExp(field));
});

test('migration creates pattern_candidate_sources table', () => {
  assert.match(migration, /create table if not exists public\.pattern_candidate_sources/);
  for (const field of [
    'candidate_id uuid not null',
    'source_type text not null',
    'source_id uuid not null',
    'source_label text not null',
  ]) assert.match(migration, new RegExp(field));
});

test('migration creates pattern_extraction_runs table', () => {
  assert.match(migration, /create table if not exists public\.pattern_extraction_runs/);
  for (const field of [
    'workspace_id uuid not null',
    'started_at timestamptz not null',
    'completed_at timestamptz null',
    'candidate_count integer not null',
    'rule_count integer not null',
    'metadata jsonb not null',
  ]) assert.match(migration, new RegExp(field));
});

test('migration enforces candidate status values', () => {
  assert.match(migration, /'candidate','promoted','rejected','archived'/);
});

test('migration enforces promoted candidate immutability via trigger', () => {
  assert.match(migration, /pattern_candidates_promoted_guard/);
  assert.match(migration, /Promoted pattern candidates are immutable/);
});

test('migration enables RLS on all three tables', () => {
  assert.match(migration, /alter table public\.organizational_pattern_candidates enable row level security/);
  assert.match(migration, /alter table public\.pattern_candidate_sources enable row level security/);
  assert.match(migration, /alter table public\.pattern_extraction_runs enable row level security/);
});

test('migration includes workspace member RLS policies', () => {
  assert.match(migration, /workspace members can read pattern candidates/);
  assert.match(migration, /workspace members can create pattern candidates/);
  assert.match(migration, /workspace members can read pattern extraction runs/);
  assert.match(migration, /is_workspace_member/);
});

test('migration links candidates to organizational_patterns for lineage', () => {
  assert.match(migration, /promoted_pattern_id uuid null references public\.organizational_patterns/);
});

// ─── Types ────────────────────────────────────────────────────────────────────

test('types define PatternCandidate with all required fields', () => {
  assert.match(types, /PatternCandidate/);
  for (const field of ['workspace_id', 'pattern_category', 'candidate_title', 'candidate_summary',
    'observation_count', 'confidence', 'status', 'rule_id', 'promoted_pattern_id', 'metadata'])
    assert.match(types, new RegExp(field));
});

test('types define PatternCandidateSource', () => {
  assert.match(types, /PatternCandidateSource/);
  for (const field of ['candidate_id', 'source_type', 'source_id', 'source_label'])
    assert.match(types, new RegExp(field));
});

test('types define PatternExtractionRun', () => {
  assert.match(types, /PatternExtractionRun/);
  for (const field of ['started_at', 'completed_at', 'candidate_count', 'rule_count'])
    assert.match(types, new RegExp(field));
});

test('types define PatternCandidateRule', () => {
  assert.match(types, /PatternCandidateRule/);
  for (const field of ['id', 'name', 'description', 'patternCategory', 'minimumOccurrences', 'confidenceWhenMet'])
    assert.match(types, new RegExp(field));
});

test('types define PatternExtractionObservation', () => {
  assert.match(types, /PatternExtractionObservation/);
  for (const field of ['ruleId', 'groupKey', 'occurrenceCount', 'sourceType', 'sourceIds', 'sourceLabels'])
    assert.match(types, new RegExp(field));
});

test('types define PatternCandidateSummary', () => {
  assert.match(types, /PatternCandidateSummary/);
});

test('types define PatternExtractionResult', () => {
  assert.match(types, /PatternExtractionResult/);
  for (const field of ['runId', 'workspaceId', 'rulesEvaluated', 'candidatesCreated', 'candidatesSkipped'])
    assert.match(types, new RegExp(field));
});

test('types define PatternCandidateExplanation with all source types', () => {
  assert.match(types, /PatternCandidateExplanation/);
  for (const field of ['rulesTriggered', 'observations', 'sourceEvents', 'sourceDecisions', 'sourceOutcomes', 'sourcePatterns'])
    assert.match(types, new RegExp(field));
});

test('types define PatternCandidateExport with lineage', () => {
  assert.match(types, /PatternCandidateExport/);
  assert.match(types, /lineage/);
  assert.match(types, /promotedPatternId/);
});

test('types define PatternExtractionHealth', () => {
  assert.match(types, /PatternExtractionHealth/);
  for (const field of ['runCount', 'candidateCount', 'promotedCount', 'rejectedCount', 'archivedCount', 'averageCandidatesPerRun'])
    assert.match(types, new RegExp(field));
});

test('types define ExtractionResult discriminated union', () => {
  assert.match(types, /ExtractionResult/);
  assert.match(types, /ok: true/);
  assert.match(types, /ok: false/);
  assert.match(types, /failureClass/);
});

test('EXTRACTION_MINIMUM_OCCURRENCES constant is 3', () => {
  assert.equal(EXTRACTION_MINIMUM_OCCURRENCES, 3);
});

test('capability constants enumerate governance vocabulary', () => {
  assert.deepEqual([...PATTERN_EXTRACTION_CAPABILITIES], [
    'PATTERN_EXTRACTION_RUN',
    'PATTERN_CANDIDATE_CREATE',
    'PATTERN_CANDIDATE_REVIEW',
    'PATTERN_CANDIDATE_PROMOTE',
    'PATTERN_CANDIDATE_REJECT',
    'PATTERN_CANDIDATE_EXPORT',
  ]);
});

// ─── Rule registry ────────────────────────────────────────────────────────────

test('rule registry exports all four rule IDs', () => {
  assert.deepEqual([...ALL_RULE_IDS], [
    'repeated_decision_outcome',
    'repeated_risk_escalation',
    'repeated_dependency_delay',
    'repeated_decision_rejection',
  ]);
});

test('getAllRules returns one rule per ID', () => {
  const all = getAllRules();
  assert.equal(all.length, ALL_RULE_IDS.length);
  for (const r of all) {
    assert.ok(typeof r.id === 'string');
    assert.ok(typeof r.name === 'string');
    assert.ok(typeof r.description === 'string');
    assert.ok(r.minimumOccurrences >= 3);
  }
});

test('getRuleById returns correct rule for each ID', () => {
  assert.equal(getRuleById(RULE_REPEATED_DECISION_OUTCOME)?.id, RULE_REPEATED_DECISION_OUTCOME);
  assert.equal(getRuleById(RULE_REPEATED_RISK_ESCALATION)?.id, RULE_REPEATED_RISK_ESCALATION);
  assert.equal(getRuleById(RULE_REPEATED_DEPENDENCY_DELAY)?.id, RULE_REPEATED_DEPENDENCY_DELAY);
  assert.equal(getRuleById(RULE_REPEATED_DECISION_REJECTION)?.id, RULE_REPEATED_DECISION_REJECTION);
});

test('getRuleById returns null for unknown rule', () => {
  assert.equal(getRuleById('nonexistent_rule'), null);
});

test('rule minimumOccurrences equals EXTRACTION_MINIMUM_OCCURRENCES', () => {
  for (const rule of getAllRules()) {
    assert.equal(rule.minimumOccurrences, EXTRACTION_MINIMUM_OCCURRENCES);
  }
});

test('rules are deterministic: no AI API calls, vector operations, or inference code', () => {
  for (const forbidden of ['openai', 'anthropic', 'togetherAI', 'vectorSearch', 'cosineSimilarity', 'classifyText', 'inferFromText'])
    assert.doesNotMatch(rules, new RegExp(forbidden, 'i'));
});

test('rules reference only structured data fields', () => {
  assert.match(rules, /decision_type/);
  assert.match(rules, /outcome_status/);
  assert.match(rules, /raid_items/);
  assert.match(rules, /category/);
  assert.match(rules, /status/);
});

// ─── Service: API shape ───────────────────────────────────────────────────────

test('service exports runPatternExtraction', () => {
  assert.match(service, /export async function runPatternExtraction/);
});

test('service exports evaluateRule', () => {
  assert.match(service, /export async function evaluateRule/);
});

test('service exports createPatternCandidate', () => {
  assert.match(service, /export async function createPatternCandidate/);
});

test('service exports listPatternCandidates', () => {
  assert.match(service, /export async function listPatternCandidates/);
});

test('service exports rejectPatternCandidate', () => {
  assert.match(service, /export const rejectPatternCandidate/);
});

test('service exports archivePatternCandidate', () => {
  assert.match(service, /export const archivePatternCandidate/);
});

test('service exports promotePatternCandidate', () => {
  assert.match(service, /export async function promotePatternCandidate/);
});

test('service exports explainPatternCandidate', () => {
  assert.match(service, /export async function explainPatternCandidate/);
});

test('service exports exportPatternCandidate', () => {
  assert.match(service, /export async function exportPatternCandidate/);
});

test('service exports getPatternExtractionHealth', () => {
  assert.match(service, /export async function getPatternExtractionHealth/);
});

// ─── Service: audit events ────────────────────────────────────────────────────

test('service emits PATTERN_EXTRACTION_RUN_STARTED event', () => {
  assert.match(service, /PATTERN_EXTRACTION_RUN_STARTED/);
});

test('service emits PATTERN_EXTRACTION_RUN_COMPLETED event', () => {
  assert.match(service, /PATTERN_EXTRACTION_RUN_COMPLETED/);
});

test('service emits PATTERN_CANDIDATE_CREATED event', () => {
  assert.match(service, /PATTERN_CANDIDATE_CREATED/);
});

test('service emits PATTERN_CANDIDATE_PROMOTED event', () => {
  assert.match(service, /PATTERN_CANDIDATE_PROMOTED/);
});

test('service emits PATTERN_CANDIDATE_REJECTED event', () => {
  assert.match(service, /PATTERN_CANDIDATE_REJECTED/);
});

test('service emits PATTERN_CANDIDATE_ARCHIVED event', () => {
  assert.match(service, /PATTERN_CANDIDATE_ARCHIVED/);
});

test('service sets learningEligible false on all audit events', () => {
  assert.match(service, /learningEligible: false/);
});

// ─── Service: immutability ─────────────────────────────────────────────────────

test('service blocks updates to promoted candidates', () => {
  assert.match(service, /Promoted candidates are immutable/);
});

test('service blocks promotion of non-candidate records', () => {
  assert.match(service, /Only candidates can be promoted/);
});

// ─── Service: promotion creates a pattern with lineage ───────────────────────

test('promotePatternCandidate calls createPattern for lineage', () => {
  assert.match(service, /createPattern/);
  assert.match(service, /promoted_from_candidate_id/);
});

test('service links promoted_pattern_id back on the candidate', () => {
  assert.match(service, /promoted_pattern_id: patternResult\.data\.id/);
});

// ─── Service: no AI ──────────────────────────────────────────────────────────

test('service contains no AI, embedding, or autonomous code', () => {
  for (const forbidden of ['embedding', 'vector', 'semantic search', 'autonomous', 'inferPattern', 'classifyPattern'])
    assert.doesNotMatch(service, new RegExp(forbidden, 'i'));
});

// ─── Service: UUID validation ─────────────────────────────────────────────────

test('service validates workspaceId as UUID', () => {
  assert.match(service, /workspaceId must be a UUID/);
});

test('service validates actorId as UUID', () => {
  assert.match(service, /actorId must be a UUID/);
});

// ─── Database contract ────────────────────────────────────────────────────────

test('database contract declares OrganizationalPatternCandidateRow', () => {
  assert.match(contract, /OrganizationalPatternCandidateRow/);
  for (const field of ['candidate_title', 'candidate_summary', 'rule_id', 'promoted_pattern_id'])
    assert.match(contract, new RegExp(field));
});

test('database contract declares PatternCandidateSourceRow', () => {
  assert.match(contract, /PatternCandidateSourceRow/);
  assert.match(contract, /source_label/);
});

test('database contract declares PatternExtractionRunRow', () => {
  assert.match(contract, /PatternExtractionRunRow/);
  assert.match(contract, /candidate_count/);
  assert.match(contract, /rule_count/);
});

test('database contract version references pattern-extraction-foundation', () => {
  assert.match(contract, /pattern-extraction-foundation/);
});

// ─── Cross-workspace isolation ────────────────────────────────────────────────

test('migration RLS policies use is_workspace_member for tenant isolation', () => {
  const count = (migration.match(/is_workspace_member/g) ?? []).length;
  assert.ok(count >= 3, `Expected at least 3 is_workspace_member references, found ${count}`);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation explains what extraction is and is not', () => {
  assert.match(docs, /extraction/i);
  assert.match(docs, /deterministic/i);
  assert.match(docs, /no ai/i);
});

test('documentation explains why candidates require review', () => {
  assert.match(docs, /human review/i);
  assert.match(docs, /candidate/i);
  assert.match(docs, /promot/i);
});

test('documentation shows Events → Memory → Candidate → Pattern lineage', () => {
  assert.match(docs, /Events/);
  assert.match(docs, /Memory/);
  assert.match(docs, /Candidate/);
  assert.match(docs, /Pattern/);
});

test('documentation explains difference between candidate and pattern', () => {
  assert.match(docs, /candidate/i);
  assert.match(docs, /organizational pattern/i);
});

test('documentation lists deterministic rules', () => {
  assert.match(docs, /Repeated Decision Outcome/);
  assert.match(docs, /Repeated Risk Escalation/);
  assert.match(docs, /Repeated Dependency Delay/);
});
