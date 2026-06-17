import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { computeMemoryHealthSnapshot } from '../src/lib/organizational-memory/memory-service.ts';
import { MEMORY_CAPABILITIES } from '../src/lib/organizational-memory/types.ts';

const types = readFileSync('src/lib/organizational-memory/types.ts', 'utf8');
const service = readFileSync('src/lib/organizational-memory/memory-service.ts', 'utf8');
const resolver = readFileSync('src/lib/organizational-memory/source-resolver.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260617010000_organizational_memory_foundation.sql', 'utf8');
const docs = readFileSync('docs/organizational-memory-foundation.md', 'utf8');

function memory(id, status = 'active') {
  return { id, workspace_id: '11111111-1111-4111-8111-111111111111', project_id: null, memory_scope: 'workspace', memory_category: 'other', title: id, summary: id, confidence: 'medium', status, created_at: '2026-06-17T00:00:00.000Z', updated_at: '2026-06-17T00:00:00.000Z', created_by: null, metadata: {} };
}

function source(memoryId, id = `${memoryId}-source`) {
  return { id, memory_id: memoryId, source_type: 'decision', source_id: '22222222-2222-4222-8222-222222222222', relationship_type: 'supports', created_at: '2026-06-17T00:00:00.000Z' };
}

test('memory registry and lineage tables exist with required fields', () => {
  assert.match(migration, /create table if not exists public\.organizational_memory/);
  assert.match(migration, /create table if not exists public\.organizational_memory_sources/);
  for (const field of ['workspace_id uuid not null', 'project_id uuid null', 'memory_scope text not null', 'memory_category text not null', 'title text not null', 'summary text not null', 'confidence text not null', 'status text not null', 'created_by uuid', 'metadata jsonb']) assert.match(migration, new RegExp(field));
  for (const field of ['memory_id uuid not null', 'source_type text not null', 'source_id uuid not null', 'relationship_type text not null']) assert.match(migration, new RegExp(field));
});

test('types define constitutional memory vocabulary', () => {
  for (const value of ['workspace', 'project', 'team', 'risk_pattern', 'decision_pattern', 'stakeholder_pattern', 'schedule_pattern', 'delivery_pattern', 'dependency_pattern', 'resource_pattern', 'governance_pattern', 'execution_pattern', 'other', 'low', 'medium', 'high', 'very_high']) assert.match(types, new RegExp(`"${value}"`));
  for (const value of ['platform_event', 'decision', 'outcome', 'risk', 'task', 'milestone', 'dependency', 'stakeholder', 'recommendation']) assert.match(types, new RegExp(`"${value}"`));
});

test('memory capability constants exist as future governance hooks', () => {
  assert.deepEqual([...MEMORY_CAPABILITIES], ['MEMORY_CREATE', 'MEMORY_UPDATE', 'MEMORY_FREEZE', 'MEMORY_ARCHIVE', 'MEMORY_DEPRECATE', 'MEMORY_DELETE', 'MEMORY_INSPECT', 'MEMORY_EXPORT']);
  assert.match(docs, /Capability enforcement is prepared but not fully wired yet/);
});

test('service supports explicit creation and source lineage only', () => {
  assert.match(service, /export async function createMemory/);
  assert.match(service, /At least one source is required; every memory must point to evidence/);
  assert.match(service, /organizational_memory_sources"\)\.insert/);
  for (const forbidden of ['embedding', 'vector', 'semantic search', 'retrieval augmented', 'autonomous learning', 'extractPattern']) assert.doesNotMatch(service, new RegExp(forbidden, 'i'));
});

test('service supports update, freeze, archive, deprecate, delete, lists and reads', () => {
  for (const fn of ['updateMemory', 'archiveMemory', 'freezeMemory', 'deprecateMemory', 'getMemory', 'listWorkspaceMemory', 'listProjectMemory', 'deleteMemory']) assert.match(service, new RegExp(fn));
  assert.match(service, /Frozen memories cannot be edited or mutated/);
  assert.match(service, /Frozen memories can only be archived/);
  assert.match(migration, /organizational_memory_frozen_guard/);
});

test('health calculation handles zero memories and clamps coverage to 0..1', () => {
  const health = computeMemoryHealthSnapshot([], []);
  assert.equal(health.sourceCoverage, 0);
  assert.equal(health.lineageCoverage, 0);
});

test('health calculation handles one memory with zero sources', () => {
  const health = computeMemoryHealthSnapshot([memory('m1')], []);
  assert.equal(health.sourceCoverage, 0);
  assert.equal(health.lineageCoverage, 0);
});

test('health calculation handles one memory with multiple sources without exceeding 1', () => {
  const health = computeMemoryHealthSnapshot([memory('m1')], [source('m1', 's1'), source('m1', 's2')]);
  assert.equal(health.sourceCoverage, 1);
  assert.equal(health.lineageCoverage, 1);
});

test('health calculation handles multiple memories with partial source coverage', () => {
  const health = computeMemoryHealthSnapshot([memory('m1'), memory('m2'), memory('m3')], [source('m1', 's1'), source('m1', 's2'), source('m3', 's3')]);
  assert.equal(health.sourceCoverage, 2 / 3);
  assert.equal(health.lineageCoverage, 2 / 3);
});

test('explanation, inspection, export and health reconstruct lineage', () => {
  for (const fn of ['explainMemory', 'inspectMemory', 'exportMemory', 'getMemoryHealth']) assert.match(service, new RegExp(`export async function ${fn}`));
  for (const field of ['supportingEvidence', 'supportingEvents', 'supportingDecisions', 'supportingOutcomes', 'lineage', 'timeline', 'sourceCoverage', 'lineageCoverage', 'unresolvedSources']) assert.match(service + types, new RegExp(field));
});

test('source resolver isolates decision/outcome resolution from memory service', () => {
  assert.match(resolver, /export async function resolveMemorySources/);
  assert.match(resolver, /from\("project_decisions"\)/);
  assert.match(resolver, /from\("decision_outcomes"\)/);
  assert.doesNotMatch(service, /from\("project_decisions"\)/);
  assert.doesNotMatch(service, /from\("decision_outcomes"\)/);
  assert.match(service, /resolveMemorySources\(memory\.data, sources\.data\)/);
});

test('source resolver returns unresolvedSources for unsupported or unresolved source types', () => {
  assert.match(resolver, /unresolvedSources: sources\.filter/);
  assert.match(resolver, /!resolvedSourceIds\.has\(source\.source_id\)/);
  assert.match(docs, /Unsupported source types remain visible as `unresolvedSources`/);
});

test('memory audit events are emitted with platform event governance fields', () => {
  for (const eventType of ['MEMORY_CREATED', 'MEMORY_UPDATED', 'MEMORY_FROZEN', 'MEMORY_ARCHIVED', 'MEMORY_DEPRECATED', 'MEMORY_DELETED']) assert.match(service, new RegExp(eventType));
  assert.match(service, /eventCategory: "governance"/);
  assert.match(service, /correlationId: correlationId \?\? memory\.id/);
  assert.match(service, /causationId: causationId \?\? null/);
  assert.match(service, /rawReferenceTable: "organizational_memory"/);
  assert.match(service, /rawReferenceId: memory\.id/);
  assert.match(service, /learningEligible: false/);
});

test('RLS is workspace-scoped with centralized temporary governor role logic and cross-workspace denial', () => {
  assert.match(migration, /alter table public\.organizational_memory enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /Temporary workspace-role governance bridge/);
  assert.match(migration, /public\.is_organizational_memory_governor\(workspace_id\)/);
  assert.match(migration, /workspace_memberships wm[\s\S]*wm\.workspace_id = target_workspace_id[\s\S]*wm\.user_id = auth\.uid\(\)/);
  assert.equal((migration.match(/role in \('owner','admin','pm'\)/g) ?? []).length, 1);
});

test('frozen memory cannot be updated, deleted, source-mutated, or transitioned except archive', () => {
  assert.match(migration, /old\.status = 'frozen' and new\.status <> 'archived'/);
  assert.match(migration, /tg_op = 'DELETE' and old\.status = 'frozen'/);
  assert.match(migration, /organizational_memory_sources_frozen_guard/);
  assert.match(migration, /before insert or update or delete on public\.organizational_memory_sources/);
  assert.match(migration, /Frozen organizational memory sources cannot be mutated/);
  assert.match(service, /current\.data\.status === "frozen" && status !== "archived"/);
});

test('documentation explains sovereignty, lineage, export, freeze, governance, resolver, health and non-goals', () => {
  for (const phrase of ['What memory is', 'What memory is not', 'Memory sovereignty', 'Memory lineage', 'Memory export', 'Memory freeze', 'Relationship with events', 'Relationship with decisions', 'Relationship with outcomes', 'Governance controls', 'Memory capability vocabulary', 'Source resolver boundary', 'Health metric definitions', 'Frozen source mutation guarantee']) assert.match(docs, new RegExp(phrase));
  for (const phrase of ['No PDF', 'not an AI memory system', 'does not use embeddings', 'does not automatically create memories']) assert.match(docs, new RegExp(phrase, 'i'));
});
