import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { allowedTransitions, TERMINAL_STATES, validateConstitutionTransition } from '../src/lib/project-constitution/state-machine.ts';
import { explainConstitutionLifecycle } from '../src/lib/project-constitution/lifecycle-explanation.ts';

const service = readFileSync('src/lib/project-constitution/constitution-service.ts', 'utf8');
const stateMachine = readFileSync('src/lib/project-constitution/state-machine.ts', 'utf8');
const types = readFileSync('src/lib/project-constitution/types.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260623000000_project_constitution_lifecycle.sql', 'utf8');
const platformEvents = readFileSync('src/lib/platform-events/types.ts', 'utf8');
const docs = readFileSync('docs/project-constitution-lifecycle.md', 'utf8');
const dbContract = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Lifecycle State Machine — valid transitions ──────────────────────────────

test('state machine defines all seven constitutional states', () => {
  const states = Object.keys(allowedTransitions);
  for (const s of ['draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived']) {
    assert.ok(states.includes(s), `State '${s}' must be defined`);
  }
  assert.equal(states.length, 7);
});

test('state machine allows only valid transitions from draft', () => {
  assert.deepEqual([...allowedTransitions.draft].sort(), ['archived', 'proposed'].sort());
});

test('state machine allows only valid transitions from proposed', () => {
  assert.deepEqual([...allowedTransitions.proposed].sort(), ['approved', 'archived', 'draft'].sort());
});

test('state machine allows only valid transitions from approved', () => {
  assert.deepEqual([...allowedTransitions.approved].sort(), ['active', 'archived', 'draft'].sort());
});

test('state machine allows only valid transitions from active', () => {
  assert.deepEqual([...allowedTransitions.active].sort(), ['closed', 'suspended'].sort());
});

test('state machine allows only valid transitions from suspended', () => {
  assert.deepEqual([...allowedTransitions.suspended].sort(), ['active', 'closed'].sort());
});

test('state machine allows only valid transitions from closed', () => {
  assert.deepEqual([...allowedTransitions.closed], ['archived']);
});

test('archived is a terminal state with no allowed transitions', () => {
  assert.deepEqual([...allowedTransitions.archived], []);
  assert.ok(TERMINAL_STATES.has('archived'));
  assert.equal(TERMINAL_STATES.size, 1);
});

// ─── Lifecycle State Machine — validateConstitutionTransition ─────────────────

test('validateConstitutionTransition accepts all valid transitions', () => {
  const validPairs = [
    ['draft', 'proposed'], ['draft', 'archived'],
    ['proposed', 'draft'], ['proposed', 'approved'], ['proposed', 'archived'],
    ['approved', 'active'], ['approved', 'draft'], ['approved', 'archived'],
    ['active', 'suspended'], ['active', 'closed'],
    ['suspended', 'active'], ['suspended', 'closed'],
    ['closed', 'archived'],
  ];
  for (const [from, to] of validPairs) {
    const result = validateConstitutionTransition(from, to);
    assert.equal(result.ok, true, `${from} -> ${to} should be valid`);
    if (result.ok) {
      assert.equal(result.data.currentStatus, from);
      assert.equal(result.data.targetStatus, to);
    }
  }
});

test('validateConstitutionTransition rejects invalid transitions', () => {
  const invalidPairs = [
    ['draft', 'active'], ['draft', 'approved'], ['draft', 'suspended'], ['draft', 'closed'],
    ['proposed', 'active'], ['proposed', 'suspended'], ['proposed', 'closed'],
    ['approved', 'suspended'], ['approved', 'closed'],
    ['active', 'draft'], ['active', 'proposed'], ['active', 'approved'], ['active', 'archived'],
    ['suspended', 'draft'], ['suspended', 'proposed'], ['suspended', 'approved'], ['suspended', 'archived'],
    ['closed', 'draft'], ['closed', 'proposed'], ['closed', 'approved'], ['closed', 'active'], ['closed', 'suspended'],
    ['archived', 'draft'], ['archived', 'proposed'], ['archived', 'approved'], ['archived', 'active'], ['archived', 'suspended'], ['archived', 'closed'],
  ];
  for (const [from, to] of invalidPairs) {
    const result = validateConstitutionTransition(from, to);
    assert.equal(result.ok, false, `${from} -> ${to} should be invalid`);
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_constitution_transition');
      assert.equal(result.error.currentStatus, from);
      assert.equal(result.error.targetStatus, to);
    }
  }
});

test('validateConstitutionTransition rejects transition to same state', () => {
  for (const status of ['draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived']) {
    const result = validateConstitutionTransition(status, status);
    assert.equal(result.ok, false, `${status} -> ${status} should be invalid`);
    if (!result.ok) {
      assert.match(result.error.message, /same status/);
    }
  }
});

test('archived protection: archived cannot transition anywhere', () => {
  for (const to of ['draft', 'proposed', 'approved', 'active', 'suspended', 'closed']) {
    const result = validateConstitutionTransition('archived', to);
    assert.equal(result.ok, false, `archived -> ${to} must be blocked`);
  }
});

// ─── Audit Events ──────────────────────────────────────────────────────────────

test('all required constitution lifecycle events exist in platform-events types', () => {
  for (const event of ['CONSTITUTION_PROPOSED', 'CONSTITUTION_APPROVED', 'CONSTITUTION_ACTIVATED', 'CONSTITUTION_SUSPENDED', 'CONSTITUTION_CLOSED', 'CONSTITUTION_ARCHIVED', 'CONSTITUTION_STATUS_CHANGED']) {
    assert.match(platformEvents, new RegExp(`"${event}"`), `Event type '${event}' must be in platform-events types`);
  }
});

test('service emits specific lifecycle event for each non-draft target status', () => {
  const explanation = readFileSync('src/lib/project-constitution/lifecycle-explanation.ts', 'utf8');
  for (const event of ['CONSTITUTION_PROPOSED', 'CONSTITUTION_APPROVED', 'CONSTITUTION_ACTIVATED', 'CONSTITUTION_SUSPENDED', 'CONSTITUTION_CLOSED', 'CONSTITUTION_ARCHIVED']) {
    assert.ok(
      service.includes(`"${event}"`) || explanation.includes(`"${event}"`),
      `Event '${event}' must be referenced in service or lifecycle-explanation`,
    );
  }
});

test('service always emits generic CONSTITUTION_STATUS_CHANGED alongside specific event', () => {
  assert.match(service, /CONSTITUTION_STATUS_CHANGED/);
  assert.match(service, /specificEvent/);
});

test('service emits correct audit payload fields', () => {
  for (const field of ['constitutionId', 'projectId', 'fromStatus', 'toStatus', 'lifecycleVersion', 'reason']) {
    assert.match(service, new RegExp(field), `Audit payload must include '${field}'`);
  }
});

test('service sets rawReferenceTable to project_constitutions', () => {
  assert.match(service, /rawReferenceTable: "project_constitutions"/);
});

// ─── Lifecycle Versioning ─────────────────────────────────────────────────────

test('service increments lifecycle_version by 1 on each transition', () => {
  assert.match(service, /lifecycle_version: newVersion/);
  assert.match(service, /const newVersion = current\.data\.lifecycle_version \+ 1/);
});

test('migration initialises lifecycle_version to 1', () => {
  assert.match(migration, /lifecycle_version\s+integer not null default 1/);
  assert.match(migration, /lifecycle_version >= 1/);
});

test('history table records lifecycle_version_after on each transition', () => {
  assert.match(service, /lifecycle_version_after: newVersion/);
  assert.match(migration, /lifecycle_version_after integer not null/);
});

// ─── Workspace Isolation ─────────────────────────────────────────────────────

test('getConstitution enforces workspace_id filter', () => {
  assert.match(service, /\.eq\("workspace_id", workspaceId\)/);
});

test('changeConstitutionStatus enforces workspace_id on update', () => {
  assert.match(service, /\.eq\("workspace_id", input\.workspaceId\)/);
});

test('getConstitutionLifecycleHistory verifies workspace ownership before querying history', () => {
  assert.match(service, /const constitutionCheck = await getConstitution\(input\.constitutionId, input\.workspaceId\)/);
  assert.match(service, /\.eq\("workspace_id", input\.workspaceId\)/);
});

test('migration has composite workspace+project FK for isolation', () => {
  assert.match(migration, /project_constitutions_workspace_project_fkey/);
  assert.match(migration, /references public\.projects\(id, workspace_id\)/);
});

test('migration enables RLS on both tables', () => {
  const rlsMatches = [...migration.matchAll(/enable row level security/g)];
  assert.ok(rlsMatches.length >= 2, 'RLS must be enabled on project_constitutions and constitution_lifecycle_history');
});

test('RLS policies use is_workspace_member for access control', () => {
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
});

// ─── Archived Protection ─────────────────────────────────────────────────────

test('TERMINAL_STATES set contains only archived', () => {
  assert.ok(TERMINAL_STATES.has('archived'));
  assert.equal(TERMINAL_STATES.size, 1);
});

test('no transitions originate from archived', () => {
  const result = validateConstitutionTransition('archived', 'draft');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.error.allowedTargets, []);
  }
});

// ─── explainConstitutionLifecycle ─────────────────────────────────────────────

test('explainConstitutionLifecycle returns all seven states', () => {
  const explanation = explainConstitutionLifecycle();
  assert.equal(explanation.states.length, 7);
  const statuses = explanation.states.map(s => s.status);
  for (const s of ['draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived']) {
    assert.ok(statuses.includes(s), `${s} must appear in explanation`);
  }
});

test('explainConstitutionLifecycle marks archived as terminal', () => {
  const explanation = explainConstitutionLifecycle();
  const archived = explanation.states.find(s => s.status === 'archived');
  assert.ok(archived, 'archived state must be present');
  assert.equal(archived.terminal, true);
  assert.deepEqual(archived.allowedTransitions, []);
});

test('explainConstitutionLifecycle lists all seven audit events', () => {
  const explanation = explainConstitutionLifecycle();
  for (const event of ['CONSTITUTION_PROPOSED', 'CONSTITUTION_APPROVED', 'CONSTITUTION_ACTIVATED', 'CONSTITUTION_SUSPENDED', 'CONSTITUTION_CLOSED', 'CONSTITUTION_ARCHIVED', 'CONSTITUTION_STATUS_CHANGED']) {
    assert.ok(explanation.auditEvents.includes(event), `Audit event '${event}' must be listed`);
  }
});

test('explainConstitutionLifecycle includes all eight business rules', () => {
  const explanation = explainConstitutionLifecycle();
  assert.ok(explanation.rules.length >= 8, 'At least 8 business rules must be documented');
});

// ─── Database Contract ────────────────────────────────────────────────────────

test('database contract defines ProjectConstitutionRow with all required fields', () => {
  for (const field of ['current_status', 'status_changed_at', 'status_changed_by', 'lifecycle_version', 'workspace_id', 'project_id']) {
    assert.match(dbContract, new RegExp(field), `DB contract must include '${field}'`);
  }
});

test('database contract defines ConstitutionLifecycleHistoryRow', () => {
  assert.match(dbContract, /ConstitutionLifecycleHistoryRow/);
  assert.match(dbContract, /CONSTITUTION_LIFECYCLE_HISTORY_SELECTABLE_COLUMNS/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation exists and covers all states', () => {
  for (const state of ['Draft', 'Proposed', 'Approved', 'Active', 'Suspended', 'Closed', 'Archived']) {
    assert.match(docs, new RegExp(state), `Docs must document '${state}' state`);
  }
});

test('documentation includes transition rules', () => {
  assert.match(docs, /transition/i);
  assert.match(docs, /CONSTITUTION_STATUS_CHANGED/);
});

test('documentation covers audit events', () => {
  for (const event of ['CONSTITUTION_PROPOSED', 'CONSTITUTION_APPROVED', 'CONSTITUTION_ACTIVATED']) {
    assert.match(docs, new RegExp(event), `Docs must mention '${event}'`);
  }
});
