import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { allowedTransitions, validateDecisionTransition } from '../src/lib/decision-governance/state-machine.ts';
import { buildDecisionEffectivenessSnapshot } from '../src/lib/decision-governance/service.ts';

const service = readFileSync('src/lib/decision-governance/service.ts', 'utf8');
const types = readFileSync('src/lib/decision-governance/types.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260617000000_constitutional_decision_lifecycle.sql', 'utf8');
const docs = readFileSync('docs/constitutional-decision-lifecycle.md', 'utf8');

test('state machine allows only constitutional decision transitions', () => {
  assert.deepEqual(allowedTransitions.draft, ['pending_review']);
  assert.deepEqual(allowedTransitions.pending_review, ['approved', 'rejected', 'expired']);
  assert.deepEqual(allowedTransitions.approved, ['implemented', 'expired']);
  assert.deepEqual(allowedTransitions.rejected, ['expired']);
  assert.deepEqual(allowedTransitions.implemented, ['expired']);
  assert.deepEqual(allowedTransitions.expired, []);
  assert.equal(validateDecisionTransition('draft', 'pending_review').ok, true);
  assert.equal(validateDecisionTransition('pending_review', 'approved').ok, true);
  assert.equal(validateDecisionTransition('approved', 'implemented').ok, true);
});

test('state machine rejects illegal and expired transitions', () => {
  for (const [from, to] of [['draft', 'approved'], ['draft', 'implemented'], ['approved', 'draft'], ['expired', 'draft'], ['expired', 'implemented']]) {
    const result = validateDecisionTransition(from, to);
    assert.equal(result.ok, false, `${from} -> ${to} should be invalid`);
    assert.equal(result.error.code, 'invalid_decision_transition');
  }
});

test('service enforces transition validation before persistence', () => {
  assert.match(service, /validateDecisionTransition\(current\.decision_status, status\)/);
  assert.match(service, /transitionValidationFailure\(transition\.error\)/);
  assert.match(service, /from\("project_decisions"\)\.select\(columns\)\.eq\("id", decisionId\)\.single/);
});

test('approval and implementation governance are enforced', () => {
  assert.match(service, /status === "implemented" && \(!current\.approved_at \|\| !current\.approved_by\)/);
  assert.match(service, /governance\("Decision implementation requires approved_at and approved_by\."\)/);
  assert.match(service, /implemented_by: implementedBy/);
  assert.match(service, /implemented_at: implementedAt/);
  assert.match(service, /implementation_notes: implementationNotes/);
});

test('outcome schema supports typed outcome correlation with RLS', () => {
  assert.match(migration, /create table if not exists public\.decision_outcomes/);
  for (const column of ['workspace_id', 'project_id', 'decision_id', 'outcome_type', 'outcome_status', 'summary', 'recorded_by', 'recorded_at', 'metadata']) assert.match(migration, new RegExp(column));
  for (const type of ['risk_reduction', 'schedule_improvement', 'cost_avoidance', 'stakeholder_alignment', 'resource_optimization', 'governance_compliance', 'other']) assert.match(migration, new RegExp(type));
  for (const status of ['success', 'partial_success', 'failure', 'unknown']) assert.match(migration, new RegExp(status));
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /recorded_by = auth\.uid\(\)/);
});

test('recordDecisionOutcome persists, links, and emits outcome events', () => {
  assert.match(service, /export async function recordDecisionOutcome/);
  assert.match(service, /from\("decision_outcomes"\)\.insert/);
  assert.match(service, /decision_id: decision\.id/);
  for (const eventType of ['DECISION_OUTCOME_RECORDED', 'DECISION_OUTCOME_SUCCESS', 'DECISION_OUTCOME_PARTIAL_SUCCESS', 'DECISION_OUTCOME_FAILURE']) assert.match(service, new RegExp(eventType));
  assert.match(service, /correlationId: correlationId \?\? decision\.id/);
  assert.match(service, /causationId: causationId \?\? decision\.id/);
});

test('lineage and audit package reconstruct post-decision implementation and outcomes', () => {
  assert.match(service, /implementation: DecisionImplementationRecord \| null/);
  assert.match(service, /from\("decision_outcomes"\)/);
  assert.match(service, /eventCategory: "outcome"/);
  assert.match(service, /effectivenessSnapshot/);
  for (const field of ['decisionId', 'decisionType', 'approvalDuration', 'timeToImplementation', 'outcomeStatus', 'evidenceCount', 'recommendationPresent']) assert.match(types, new RegExp(field));
});

test('effectiveness snapshot is foundational audit data', () => {
  const decision = { id: 'd', decision_type: 'risk_response', created_at: '2026-06-17T00:00:00.000Z', approved_at: '2026-06-17T01:00:00.000Z', recommendation_id: 'r' };
  const snapshot = buildDecisionEffectivenessSnapshot({ decision, evidence: [{ id: 'e1' }, { id: 'e2' }], implementation: { implemented_at: '2026-06-17T03:00:00.000Z' }, outcomes: [{ outcome_status: 'partial_success', recorded_at: '2026-06-17T04:00:00.000Z' }] });
  assert.equal(snapshot.approvalDuration, 3600000);
  assert.equal(snapshot.timeToImplementation, 7200000);
  assert.equal(snapshot.outcomeStatus, 'partial_success');
  assert.equal(snapshot.evidenceCount, 2);
  assert.equal(snapshot.recommendationPresent, true);
});

test('documentation covers lifecycle and explicitly avoids non-goals', () => {
  for (const phrase of ['Evidence', 'Recommendation', 'Decision', 'Approval', 'Implementation', 'Outcome', 'DECISION_IMPLEMENTATION_RECORDED', 'DECISION_OUTCOME_RECORDED', 'No ML', 'No memory systems']) assert.match(docs, new RegExp(phrase));
});
