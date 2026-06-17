import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  classifyOutcome,
  computeDecisionEffectiveness,
} from '../src/lib/decision-effectiveness/effectiveness-service.ts';
import {
  DECISION_EFFECTIVENESS_CAPABILITIES,
} from '../src/lib/decision-effectiveness/types.ts';

const types = readFileSync('src/lib/decision-effectiveness/types.ts', 'utf8');
const service = readFileSync('src/lib/decision-effectiveness/effectiveness-service.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260617030000_decision_effectiveness_foundation.sql', 'utf8');
const docs = readFileSync('docs/decision-effectiveness-foundation.md', 'utf8');

function makeDecision(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    workspace_id: '22222222-2222-4222-8222-222222222222',
    project_id: '33333333-3333-4333-8333-333333333333',
    created_at: '2026-06-01T00:00:00.000Z',
    approved_at: '2026-06-02T00:00:00.000Z',
    implemented_at: '2026-06-05T00:00:00.000Z',
    closed_at: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Migration: registry table ────────────────────────────────────────────────

test('migration creates decision_effectiveness table', () => {
  assert.match(migration, /create table if not exists public\.decision_effectiveness/);
});

test('migration defines all required fields on decision_effectiveness', () => {
  for (const field of [
    'workspace_id uuid not null',
    'decision_id uuid not null',
    'project_id uuid not null',
    'effectiveness_status text not null',
    'outcome_classification text not null',
    'approval_duration_seconds bigint null',
    'implementation_duration_seconds bigint null',
    'time_to_outcome_seconds bigint null',
    'evidence_count integer not null',
    'outcome_count integer not null',
    'pattern_count integer not null',
    'created_by uuid',
    'metadata jsonb',
  ]) assert.match(migration, new RegExp(field));
});

test('migration creates decision_effectiveness_observations table', () => {
  assert.match(migration, /create table if not exists public\.decision_effectiveness_observations/);
  for (const field of [
    'effectiveness_id uuid not null',
    'observation_type text not null',
    'summary text not null',
    'source_type text not null',
    'source_id uuid not null',
    'recorded_at timestamptz',
  ]) assert.match(migration, new RegExp(field));
});

test('migration enforces validated record immutability via trigger', () => {
  assert.match(migration, /decision_effectiveness_validated_guard/);
  assert.match(migration, /Validated effectiveness records are immutable/);
  assert.match(migration, /Validated effectiveness records cannot be deleted/);
});

test('migration enables RLS on both tables', () => {
  assert.match(migration, /alter table public\.decision_effectiveness enable row level security/);
  assert.match(migration, /alter table public\.decision_effectiveness_observations enable row level security/);
});

test('migration includes workspace member RLS policies', () => {
  assert.match(migration, /workspace members can read decision_effectiveness/);
  assert.match(migration, /workspace members can create decision_effectiveness/);
  assert.match(migration, /is_workspace_member/);
});

test('migration includes cross-workspace isolation via is_workspace_member', () => {
  const count = (migration.match(/is_workspace_member/g) ?? []).length;
  assert.ok(count >= 3, `Expected multiple is_workspace_member references, found ${count}`);
});

// ─── Types: vocabulary ────────────────────────────────────────────────────────

test('types define all outcome classifications', () => {
  for (const cls of ['success', 'partial_success', 'failure', 'unknown'])
    assert.match(types, new RegExp(`"${cls}"`));
});

test('types define all effectiveness statuses', () => {
  for (const s of ['candidate', 'validated', 'archived'])
    assert.match(types, new RegExp(`"${s}"`));
});

test('types define all event types', () => {
  for (const evt of [
    'DECISION_EFFECTIVENESS_CREATED',
    'DECISION_EFFECTIVENESS_UPDATED',
    'DECISION_EFFECTIVENESS_ARCHIVED',
    'DECISION_EFFECTIVENESS_OBSERVATION_RECORDED',
  ]) assert.match(types, new RegExp(evt));
});

test('capability constants enumerate governance vocabulary', () => {
  assert.deepEqual([...DECISION_EFFECTIVENESS_CAPABILITIES], [
    'DECISION_EFFECTIVENESS_CREATE',
    'DECISION_EFFECTIVENESS_READ',
    'DECISION_EFFECTIVENESS_EXPORT',
    'DECISION_EFFECTIVENESS_ARCHIVE',
    'DECISION_EFFECTIVENESS_INSPECT',
  ]);
});

test('types define DecisionEffectivenessRecord', () => {
  assert.match(types, /DecisionEffectivenessRecord/);
});

test('types define DecisionEffectivenessObservation', () => {
  assert.match(types, /DecisionEffectivenessObservation/);
});

test('types define DecisionEffectivenessSummary', () => {
  assert.match(types, /DecisionEffectivenessSummary/);
});

test('types define DecisionEffectivenessExport', () => {
  assert.match(types, /DecisionEffectivenessExport/);
});

// ─── Service: function exports ─────────────────────────────────────────────────

test('service exports all required functions', () => {
  for (const fn of [
    'createEffectivenessRecord',
    'getEffectivenessRecord',
    'listDecisionEffectiveness',
    'recordEffectivenessObservation',
    'archiveEffectivenessRecord',
    'exportEffectivenessRecord',
    'computeDecisionEffectiveness',
    'explainDecisionEffectiveness',
    'buildDecisionEffectivenessLineage',
    'classifyOutcome',
  ]) assert.match(service, new RegExp(fn));
});

// ─── Effectiveness computation ─────────────────────────────────────────────────

test('computeDecisionEffectiveness calculates approval duration', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision(),
    outcomes: [],
    patterns: [],
    evidence: [],
  });
  // created_at -> approved_at: 1 day = 86400 seconds
  assert.equal(metrics.approval_duration_seconds, 86400);
});

test('computeDecisionEffectiveness calculates implementation duration', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision(),
    outcomes: [],
    patterns: [],
    evidence: [],
  });
  // approved_at -> implemented_at: 3 days = 259200 seconds
  assert.equal(metrics.implementation_duration_seconds, 259200);
});

test('computeDecisionEffectiveness calculates time to outcome', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision(),
    outcomes: [],
    patterns: [],
    evidence: [],
  });
  // created_at -> closed_at: 9 days = 777600 seconds
  assert.equal(metrics.time_to_outcome_seconds, 777600);
});

test('computeDecisionEffectiveness returns null durations when timestamps missing', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision({ approved_at: null, implemented_at: null, closed_at: null }),
    outcomes: [],
    patterns: [],
    evidence: [],
  });
  assert.equal(metrics.approval_duration_seconds, null);
  assert.equal(metrics.implementation_duration_seconds, null);
  assert.equal(metrics.time_to_outcome_seconds, null);
});

test('computeDecisionEffectiveness counts evidence, outcomes, patterns', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision(),
    outcomes: [{ id: 'a', outcome_status: 'success' }, { id: 'b', outcome_status: 'failure' }],
    patterns: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    evidence: [{ id: 'e1' }, { id: 'e2' }],
  });
  assert.equal(metrics.outcome_count, 2);
  assert.equal(metrics.pattern_count, 3);
  assert.equal(metrics.evidence_count, 2);
});

test('computeDecisionEffectiveness does not produce scores or probabilities', () => {
  const metrics = computeDecisionEffectiveness({
    decision: makeDecision(),
    outcomes: [{ id: 'a', outcome_status: 'success' }],
    patterns: [],
    evidence: [],
  });
  assert.ok(!('score' in metrics));
  assert.ok(!('probability' in metrics));
  assert.ok(!('confidence' in metrics));
  assert.ok(!('ranking' in metrics));
});

// ─── Outcome classification ───────────────────────────────────────────────────

test('classifyOutcome returns unknown for empty outcomes', () => {
  assert.equal(classifyOutcome([]), 'unknown');
});

test('classifyOutcome returns success when all outcomes are success', () => {
  assert.equal(classifyOutcome([{ outcome_status: 'success' }, { outcome_status: 'success' }]), 'success');
});

test('classifyOutcome returns failure when all outcomes are failure', () => {
  assert.equal(classifyOutcome([{ outcome_status: 'failure' }, { outcome_status: 'failure' }]), 'failure');
});

test('classifyOutcome returns partial_success for mixed success/failure', () => {
  assert.equal(classifyOutcome([{ outcome_status: 'success' }, { outcome_status: 'failure' }]), 'partial_success');
});

test('classifyOutcome returns partial_success when any outcome is partial_success', () => {
  assert.equal(classifyOutcome([{ outcome_status: 'partial_success' }, { outcome_status: 'failure' }]), 'partial_success');
});

test('classifyOutcome returns unknown when no success or partial_success', () => {
  assert.equal(classifyOutcome([{ outcome_status: 'unknown' }, { outcome_status: 'unknown' }]), 'unknown');
});

// ─── Immutability ─────────────────────────────────────────────────────────────

test('service blocks archiving already-archived records', () => {
  assert.match(service, /already archived/);
});

test('service blocks adding observations to archived records', () => {
  assert.match(service, /Cannot add observations to archived/);
});

test('migration trigger blocks updates to validated records', () => {
  assert.match(migration, /if tg_op = 'UPDATE' and old\.effectiveness_status = 'validated'/);
});

test('migration trigger blocks deletes of validated records', () => {
  assert.match(migration, /if tg_op = 'DELETE' and old\.effectiveness_status = 'validated'/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('service emits all required audit event types', () => {
  for (const evt of [
    'DECISION_EFFECTIVENESS_CREATED',
    'DECISION_EFFECTIVENESS_ARCHIVED',
    'DECISION_EFFECTIVENESS_OBSERVATION_RECORDED',
  ]) assert.match(service, new RegExp(evt));
});

test('service sets learningEligible false on all events', () => {
  assert.match(service, /learningEligible: false/);
});

test('service passes correlationId and causationId', () => {
  assert.match(service, /correlationId/);
  assert.match(service, /causationId/);
});

// ─── Pattern correlation ──────────────────────────────────────────────────────

test('service queries organizational_patterns for pattern correlation', () => {
  assert.match(service, /organizational_patterns/);
});

test('service references pattern_count in effectiveness record', () => {
  assert.match(service, /pattern_count/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('service exports exportEffectivenessRecord function', () => {
  assert.match(service, /export async function exportEffectivenessRecord/);
});

test('export includes record, decision, outcomes, patterns, metrics, observations, events', () => {
  assert.match(types, /DecisionEffectivenessExport/);
  assert.match(types, /outcomes/);
  assert.match(types, /patterns/);
  assert.match(types, /metrics/);
  assert.match(types, /observations/);
  assert.match(types, /events/);
});

// ─── No scoring, no AI ────────────────────────────────────────────────────────

test('service contains no effectiveness_score or success_probability', () => {
  for (const forbidden of [
    'effectiveness_score', 'success_probability', 'risk_probability',
    'confidence_prediction', 'trend_prediction', 'ai_scoring', 'ml_scoring',
    'embedding', 'vector', 'semantic', 'autonomous', 'ranking',
  ]) assert.doesNotMatch(service, new RegExp(forbidden, 'i'));
});

test('types contain no scoring or prediction fields', () => {
  for (const forbidden of [
    'effectiveness_score', 'success_probability', 'risk_probability',
    'confidence_prediction', 'trend_prediction',
  ]) assert.doesNotMatch(types, new RegExp(forbidden, 'i'));
});

// ─── Lineage ──────────────────────────────────────────────────────────────────

test('lineage type includes decision, implementation, outcomes, patterns, observations, events', () => {
  assert.match(types, /DecisionEffectivenessLineage/);
  assert.match(types, /implementation/);
  assert.match(types, /observations/);
  assert.match(types, /events/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation explains what effectiveness means', () => {
  assert.match(docs, /effectiveness/i);
});

test('documentation explains what effectiveness does not mean', () => {
  assert.match(docs, /not.*scor/i);
});

test('documentation shows Decision → Implementation → Outcome → Pattern diagram', () => {
  assert.match(docs, /Decision/);
  assert.match(docs, /Implementation/);
  assert.match(docs, /Outcome/);
  assert.match(docs, /Pattern/);
});

test('documentation mentions capability vocabulary', () => {
  assert.match(docs, /DECISION_EFFECTIVENESS_CREATE/);
  assert.match(docs, /Capability enforcement is prepared but not fully wired yet/);
});

test('documentation explains difference between metrics and scoring', () => {
  assert.match(docs, /metric/i);
  assert.match(docs, /scor/i);
});
