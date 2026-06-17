import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { computePatternHealthSnapshot } from '../src/lib/organizational-patterns/pattern-service.ts';
import { PATTERN_CAPABILITIES, PATTERN_VALIDATION_THRESHOLD } from '../src/lib/organizational-patterns/types.ts';

const types = readFileSync('src/lib/organizational-patterns/types.ts', 'utf8');
const service = readFileSync('src/lib/organizational-patterns/pattern-service.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260617020000_organizational_pattern_foundation.sql', 'utf8');
const docs = readFileSync('docs/organizational-pattern-foundation.md', 'utf8');

function pattern(id, status = 'candidate', observationCount = 0) {
  return {
    id,
    workspace_id: '11111111-1111-4111-8111-111111111111',
    pattern_category: 'other',
    status,
    confidence: 'medium',
    title: id,
    summary: id,
    observation_count: observationCount,
    created_at: '2026-06-17T00:00:00.000Z',
    updated_at: '2026-06-17T00:00:00.000Z',
    created_by: null,
    metadata: {},
  };
}

function source(patternId, id = `${patternId}-src`) {
  return {
    id,
    pattern_id: patternId,
    source_type: 'decision',
    source_id: '22222222-2222-4222-8222-222222222222',
    relationship_type: 'supports',
    created_at: '2026-06-17T00:00:00.000Z',
  };
}

// ─── Migration: registry and lineage tables ───────────────────────────────────

test('pattern registry table exists with required fields', () => {
  assert.match(migration, /create table if not exists public\.organizational_patterns/);
  for (const field of [
    'workspace_id uuid not null',
    'pattern_category text not null',
    'status text not null',
    'confidence text not null',
    'title text not null',
    'summary text not null',
    'observation_count integer not null',
    'created_by uuid',
    'metadata jsonb',
  ]) assert.match(migration, new RegExp(field));
});

test('pattern sources table exists with required fields', () => {
  assert.match(migration, /create table if not exists public\.organizational_pattern_sources/);
  for (const field of ['pattern_id uuid not null', 'source_type text not null', 'source_id uuid not null', 'relationship_type text not null'])
    assert.match(migration, new RegExp(field));
});

test('pattern observations table exists with required fields', () => {
  assert.match(migration, /create table if not exists public\.organizational_pattern_observations/);
  for (const field of ['pattern_id uuid not null', 'source_type text not null', 'source_id uuid not null', 'observation_summary text not null', 'recorded_at timestamptz'])
    assert.match(migration, new RegExp(field));
});

test('migration enforces validated pattern immutability via trigger', () => {
  assert.match(migration, /organizational_patterns_validated_guard/);
  assert.match(migration, /Validated organizational patterns are immutable/);
  assert.match(migration, /Validated organizational patterns cannot be deleted/);
});

test('migration syncs observation_count via trigger', () => {
  assert.match(migration, /organizational_pattern_observations_sync_count/);
  assert.match(migration, /observation_count = observation_count \+ 1/);
});

test('migration enables RLS on all three tables', () => {
  assert.match(migration, /alter table public\.organizational_patterns enable row level security/);
  assert.match(migration, /alter table public\.organizational_pattern_sources enable row level security/);
  assert.match(migration, /alter table public\.organizational_pattern_observations enable row level security/);
});

test('migration includes workspace member RLS policies', () => {
  assert.match(migration, /workspace members can read organizational_patterns/);
  assert.match(migration, /workspace members can create organizational_patterns/);
  assert.match(migration, /workspace members can delete non-validated organizational_patterns/);
  assert.match(migration, /is_workspace_member/);
});

// ─── Types: constitutional vocabulary ────────────────────────────────────────

test('types define all pattern categories', () => {
  for (const cat of ['risk_pattern', 'decision_pattern', 'schedule_pattern', 'stakeholder_pattern',
    'delivery_pattern', 'resource_pattern', 'dependency_pattern', 'governance_pattern',
    'execution_pattern', 'memory_pattern', 'other'])
    assert.match(types, new RegExp(`"${cat}"`));
});

test('types define all pattern statuses', () => {
  for (const s of ['candidate', 'validated', 'deprecated', 'archived'])
    assert.match(types, new RegExp(`"${s}"`));
});

test('types define all confidence levels', () => {
  for (const c of ['low', 'medium', 'high', 'very_high'])
    assert.match(types, new RegExp(`"${c}"`));
});

test('types define all supported source types including organizational_memory', () => {
  for (const t of ['organizational_memory', 'platform_event', 'decision', 'outcome',
    'risk', 'task', 'milestone', 'dependency', 'stakeholder'])
    assert.match(types, new RegExp(`"${t}"`));
});

test('validation threshold constant is 3', () => {
  assert.equal(PATTERN_VALIDATION_THRESHOLD, 3);
});

test('capability constants enumerate governance vocabulary', () => {
  assert.deepEqual([...PATTERN_CAPABILITIES], [
    'PATTERN_CREATE', 'PATTERN_UPDATE', 'PATTERN_VALIDATE',
    'PATTERN_ARCHIVE', 'PATTERN_DEPRECATE', 'PATTERN_DELETE',
    'PATTERN_EXPORT', 'PATTERN_INSPECT',
  ]);
});

// ─── Service: pattern creation ────────────────────────────────────────────────

test('service exports createPattern and requires sources', () => {
  assert.match(service, /export async function createPattern/);
  assert.match(service, /At least one source is required; every pattern must point to evidence/);
});

test('service exports all CRUD and lifecycle functions', () => {
  for (const fn of ['createPattern', 'getPattern', 'listPatterns', 'updatePattern',
    'validatePattern', 'archivePattern', 'deprecatePattern', 'deletePattern'])
    assert.match(service, new RegExp(fn));
});

test('service exports observation, explanation, export and health functions', () => {
  for (const fn of ['recordObservation', 'explainPattern', 'exportPattern', 'getPatternHealth', 'computePatternHealthSnapshot'])
    assert.match(service, new RegExp(fn));
});

// ─── Validation threshold enforcement ────────────────────────────────────────

test('validatePattern service function enforces minimum observation threshold', () => {
  assert.match(service, /observation_count < PATTERN_VALIDATION_THRESHOLD/);
  assert.match(service, /requires at least/);
});

test('service blocks updates to validated patterns', () => {
  assert.match(service, /Validated patterns are immutable/);
});

test('service blocks deletion of validated patterns', () => {
  assert.match(service, /Validated patterns cannot be deleted/);
});

// ─── Observation recording ────────────────────────────────────────────────────

test('service emits PATTERN_OBSERVATION_RECORDED event after observation', () => {
  assert.match(service, /PATTERN_OBSERVATION_RECORDED/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('service emits all required audit event types', () => {
  for (const evt of ['PATTERN_CREATED', 'PATTERN_UPDATED', 'PATTERN_VALIDATED',
    'PATTERN_ARCHIVED', 'PATTERN_DEPRECATED', 'PATTERN_DELETED', 'PATTERN_OBSERVATION_RECORDED'])
    assert.match(service, new RegExp(evt));
});

test('service sets learningEligible false on all audit events', () => {
  assert.match(service, /learningEligible: false/);
});

test('service passes correlation_id and causation_id', () => {
  assert.match(service, /correlationId/);
  assert.match(service, /causationId/);
});

// ─── Lineage reconstruction ───────────────────────────────────────────────────

test('explainPattern returns observations, memories, events, decisions and outcomes', () => {
  assert.match(types, /supportingMemories/);
  assert.match(types, /supportingEvents/);
  assert.match(types, /supportingDecisions/);
  assert.match(types, /supportingOutcomes/);
  assert.match(types, /observations/);
});

test('exportPattern includes pattern, observations, sources, lineage', () => {
  assert.match(types, /PatternExport/);
  assert.match(types, /lineage/);
  assert.match(service, /export async function exportPattern/);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test('health snapshot returns zero counts for empty input', () => {
  const h = computePatternHealthSnapshot([], []);
  assert.equal(h.candidateCount, 0);
  assert.equal(h.validatedCount, 0);
  assert.equal(h.deprecatedCount, 0);
  assert.equal(h.archivedCount, 0);
  assert.equal(h.averageObservationCount, 0);
  assert.equal(h.lineageCoverage, 0);
});

test('health snapshot counts patterns by status', () => {
  const patterns = [
    pattern('p1', 'candidate', 2),
    pattern('p2', 'validated', 5),
    pattern('p3', 'validated', 4),
    pattern('p4', 'deprecated', 1),
    pattern('p5', 'archived', 0),
  ];
  const h = computePatternHealthSnapshot(patterns, []);
  assert.equal(h.candidateCount, 1);
  assert.equal(h.validatedCount, 2);
  assert.equal(h.deprecatedCount, 1);
  assert.equal(h.archivedCount, 1);
  assert.equal(h.averageObservationCount, (2 + 5 + 4 + 1 + 0) / 5);
});

test('health snapshot computes lineage coverage as fraction of patterns with sources', () => {
  const patterns = [pattern('p1'), pattern('p2'), pattern('p3')];
  const sources = [source('p1'), source('p1', 'p1-s2'), source('p3')];
  const h = computePatternHealthSnapshot(patterns, sources);
  assert.equal(h.lineageCoverage, 2 / 3);
});

test('health snapshot clamps lineage coverage to 1 when all patterns have sources', () => {
  const patterns = [pattern('p1'), pattern('p2')];
  const sources = [source('p1'), source('p2'), source('p1', 'p1-s2')];
  const h = computePatternHealthSnapshot(patterns, sources);
  assert.equal(h.lineageCoverage, 1);
});

// ─── Cross-workspace isolation ────────────────────────────────────────────────

test('migration RLS policies reference is_workspace_member for tenant isolation', () => {
  const policyCount = (migration.match(/is_workspace_member/g) ?? []).length;
  assert.ok(policyCount >= 3, `Expected multiple is_workspace_member references, found ${policyCount}`);
});

// ─── No AI ────────────────────────────────────────────────────────────────────

test('service contains no AI, embedding, vector or autonomous discovery code', () => {
  for (const forbidden of ['embedding', 'vector', 'semantic search', 'autonomous', 'extractPattern', 'detectPattern', 'inferPattern'])
    assert.doesNotMatch(service, new RegExp(forbidden, 'i'));
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation explains what a pattern is and is not', () => {
  assert.match(docs, /pattern is not an opinion/i);
  assert.match(docs, /pattern is not an AI/i);
});

test('documentation explains validated pattern immutability', () => {
  assert.match(docs, /immutab/i);
  assert.match(docs, /deprecate/i);
});

test('documentation shows Events → Memory → Pattern lineage diagram', () => {
  assert.match(docs, /Events/);
  assert.match(docs, /Memory/);
  assert.match(docs, /Pattern/);
});

test('documentation mentions capability vocabulary', () => {
  assert.match(docs, /PATTERN_CREATE/);
  assert.match(docs, /Capability enforcement is prepared but not fully wired yet/);
});
