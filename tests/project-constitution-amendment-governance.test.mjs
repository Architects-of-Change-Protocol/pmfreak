import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  amendmentAllowedTransitions,
  AMENDMENT_TERMINAL_STATES,
  validateAmendmentTransition,
} from '../src/lib/project-constitution/amendment-state-machine.ts';
import { generateConstitutionDiff } from '../src/lib/project-constitution/diff-engine.ts';
import { explainConstitutionAmendmentGovernance } from '../src/lib/project-constitution/amendment-explanation.ts';

const service     = readFileSync('src/lib/project-constitution/amendment-service.ts', 'utf8');
const stateMachine = readFileSync('src/lib/project-constitution/amendment-state-machine.ts', 'utf8');
const types       = readFileSync('src/lib/project-constitution/amendment-types.ts', 'utf8');
const diffEngine  = readFileSync('src/lib/project-constitution/diff-engine.ts', 'utf8');
const migration   = readFileSync('supabase/migrations/20260624000000_project_constitution_amendment_governance.sql', 'utf8');
const platformEvents = readFileSync('src/lib/platform-events/types.ts', 'utf8');
const dbContract  = readFileSync('src/lib/db/database-contract.ts', 'utf8');
const docs        = readFileSync('docs/project-constitution-amendment-governance.md', 'utf8');

// ─── Amendment State Machine ──────────────────────────────────────────────────

test('state machine defines all six amendment states', () => {
  const states = Object.keys(amendmentAllowedTransitions);
  for (const s of ['draft', 'proposed', 'approved', 'rejected', 'withdrawn', 'applied']) {
    assert.ok(states.includes(s), `State '${s}' must be defined`);
  }
  assert.equal(states.length, 6);
});

test('draft can transition to proposed and withdrawn only', () => {
  assert.deepEqual([...amendmentAllowedTransitions.draft].sort(), ['proposed', 'withdrawn'].sort());
});

test('proposed can transition to approved, rejected, and withdrawn', () => {
  assert.deepEqual([...amendmentAllowedTransitions.proposed].sort(), ['approved', 'rejected', 'withdrawn'].sort());
});

test('approved can only transition to applied', () => {
  assert.deepEqual([...amendmentAllowedTransitions.approved], ['applied']);
});

test('rejected is a terminal state with no transitions', () => {
  assert.deepEqual([...amendmentAllowedTransitions.rejected], []);
  assert.ok(AMENDMENT_TERMINAL_STATES.has('rejected'));
});

test('withdrawn is a terminal state with no transitions', () => {
  assert.deepEqual([...amendmentAllowedTransitions.withdrawn], []);
  assert.ok(AMENDMENT_TERMINAL_STATES.has('withdrawn'));
});

test('applied is a terminal state with no transitions', () => {
  assert.deepEqual([...amendmentAllowedTransitions.applied], []);
  assert.ok(AMENDMENT_TERMINAL_STATES.has('applied'));
});

test('terminal states are rejected, withdrawn, and applied', () => {
  assert.equal(AMENDMENT_TERMINAL_STATES.size, 3);
  assert.ok(AMENDMENT_TERMINAL_STATES.has('rejected'));
  assert.ok(AMENDMENT_TERMINAL_STATES.has('withdrawn'));
  assert.ok(AMENDMENT_TERMINAL_STATES.has('applied'));
});

// ─── Amendment Lifecycle — Valid Transitions ──────────────────────────────────

test('validateAmendmentTransition accepts all valid transitions', () => {
  const validPairs = [
    ['draft', 'proposed'],
    ['draft', 'withdrawn'],
    ['proposed', 'approved'],
    ['proposed', 'rejected'],
    ['proposed', 'withdrawn'],
    ['approved', 'applied'],
  ];
  for (const [from, to] of validPairs) {
    const result = validateAmendmentTransition(from, to);
    assert.equal(result.ok, true, `${from} -> ${to} should be valid`);
    if (result.ok) {
      assert.equal(result.data.currentStatus, from);
      assert.equal(result.data.targetStatus, to);
    }
  }
});

// ─── Amendment Lifecycle — Invalid Transitions ────────────────────────────────

test('validateAmendmentTransition rejects invalid transitions', () => {
  const invalidPairs = [
    ['draft', 'approved'],
    ['draft', 'rejected'],
    ['draft', 'applied'],
    ['proposed', 'draft'],
    ['approved', 'draft'],
    ['approved', 'proposed'],
    ['approved', 'rejected'],
    ['approved', 'withdrawn'],
    ['rejected', 'draft'],
    ['rejected', 'proposed'],
    ['rejected', 'approved'],
    ['rejected', 'withdrawn'],
    ['rejected', 'applied'],
    ['withdrawn', 'draft'],
    ['withdrawn', 'proposed'],
    ['withdrawn', 'applied'],
    ['applied', 'draft'],
    ['applied', 'proposed'],
    ['applied', 'approved'],
    ['applied', 'rejected'],
    ['applied', 'withdrawn'],
  ];
  for (const [from, to] of invalidPairs) {
    const result = validateAmendmentTransition(from, to);
    assert.equal(result.ok, false, `${from} -> ${to} should be invalid`);
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_amendment_transition');
    }
  }
});

test('validateAmendmentTransition rejects same-state transitions', () => {
  for (const status of ['draft', 'proposed', 'approved', 'rejected', 'withdrawn', 'applied']) {
    const result = validateAmendmentTransition(status, status);
    assert.equal(result.ok, false, `${status} -> ${status} should be invalid`);
    if (!result.ok) {
      assert.match(result.error.message, /same status/);
    }
  }
});

test('terminal states cannot transition anywhere', () => {
  for (const terminal of ['rejected', 'withdrawn', 'applied']) {
    for (const to of ['draft', 'proposed', 'approved', 'rejected', 'withdrawn', 'applied']) {
      if (to === terminal) continue;
      const result = validateAmendmentTransition(terminal, to);
      assert.equal(result.ok, false, `Terminal state '${terminal}' must not transition to '${to}'`);
    }
  }
});

// ─── Amendment Creation ───────────────────────────────────────────────────────

test('service exports createAmendment function', () => {
  assert.match(service, /export async function createAmendment/);
});

test('createAmendment validates required fields', () => {
  assert.match(service, /workspaceId must be a UUID/);
  assert.match(service, /constitutionId must be a UUID/);
  assert.match(service, /createdBy must be a UUID/);
  assert.match(service, /title is required/);
});

test('createAmendment verifies workspace isolation via getConstitution', () => {
  assert.match(service, /const constitutionCheck = await getConstitution/);
});

test('createAmendment emits CONSTITUTION_AMENDMENT_CREATED event', () => {
  assert.match(service, /"CONSTITUTION_AMENDMENT_CREATED"/);
});

// ─── Amendment Update ─────────────────────────────────────────────────────────

test('service exports updateAmendment function', () => {
  assert.match(service, /export async function updateAmendment/);
});

test('updateAmendment enforces draft-only editability', () => {
  assert.match(service, /only draft amendments are editable/);
  assert.match(service, /governance_violation/);
});

test('updateAmendment emits CONSTITUTION_AMENDMENT_UPDATED event', () => {
  assert.match(service, /"CONSTITUTION_AMENDMENT_UPDATED"/);
});

// ─── Amendment Application ────────────────────────────────────────────────────

test('service exports applyAmendment function', () => {
  assert.match(service, /export async function applyAmendment/);
});

test('applyAmendment creates before and after snapshots', () => {
  assert.match(service, /Snapshot BEFORE apply/);
  assert.match(service, /Snapshot AFTER apply/);
  assert.match(service, /await createSnapshot/);
});

test('applyAmendment increments constitution_version by 1', () => {
  assert.match(service, /const newVersion = currentVersion \+ 1/);
  assert.match(service, /constitution_version: newVersion/);
});

test('applyAmendment emits CONSTITUTION_VERSION_INCREMENTED event', () => {
  assert.match(service, /"CONSTITUTION_VERSION_INCREMENTED"/);
});

test('applyAmendment emits CONSTITUTION_AMENDMENT_APPLIED event', () => {
  assert.match(service, /"CONSTITUTION_AMENDMENT_APPLIED"/);
});

test('applyAmendment prevents double-apply', () => {
  assert.match(service, /Amendment has already been applied/);
});

test('applyAmendment validates only approved can be applied', () => {
  assert.match(service, /validateAmendmentTransition/);
});

// ─── Snapshot Engine ──────────────────────────────────────────────────────────

test('service has createSnapshot internal function', () => {
  assert.match(service, /async function createSnapshot/);
});

test('createSnapshot emits CONSTITUTION_SNAPSHOT_CREATED event', () => {
  assert.match(service, /"CONSTITUTION_SNAPSHOT_CREATED"/);
});

test('service exports listConstitutionSnapshots function', () => {
  assert.match(service, /export async function listConstitutionSnapshots/);
});

// ─── Diff Engine ──────────────────────────────────────────────────────────────

test('diff engine exports generateConstitutionDiff', () => {
  assert.match(diffEngine, /export function generateConstitutionDiff/);
});

test('generateConstitutionDiff returns correct structure for ADD', () => {
  const result = generateConstitutionDiff({
    constitutionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    amendmentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    changes: [
      {
        id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
        workspace_id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
        amendment_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        change_type: 'add',
        field_name: 'objectives',
        old_value: null,
        new_value: 'Deliver MVP by Q4',
        created_at: new Date().toISOString(),
      },
    ],
  });
  assert.equal(result.constitutionId, 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  assert.equal(result.amendmentId, 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].changeType, 'add');
  assert.equal(result.changes[0].field, 'objectives');
  assert.equal(result.changes[0].previousValue, null);
  assert.equal(result.changes[0].newValue, 'Deliver MVP by Q4');
});

test('generateConstitutionDiff returns correct structure for UPDATE', () => {
  const result = generateConstitutionDiff({
    constitutionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    amendmentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    changes: [
      {
        id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
        workspace_id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
        amendment_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        change_type: 'update',
        field_name: 'title',
        old_value: 'Old Title',
        new_value: 'New Title',
        created_at: new Date().toISOString(),
      },
    ],
  });
  assert.equal(result.changes[0].changeType, 'update');
  assert.equal(result.changes[0].previousValue, 'Old Title');
  assert.equal(result.changes[0].newValue, 'New Title');
});

test('generateConstitutionDiff returns correct structure for REMOVE', () => {
  const result = generateConstitutionDiff({
    constitutionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    amendmentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    changes: [
      {
        id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
        workspace_id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
        amendment_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        change_type: 'remove',
        field_name: 'description',
        old_value: 'Obsolete description',
        new_value: null,
        created_at: new Date().toISOString(),
      },
    ],
  });
  assert.equal(result.changes[0].changeType, 'remove');
  assert.equal(result.changes[0].previousValue, 'Obsolete description');
  assert.equal(result.changes[0].newValue, null);
});

test('generateConstitutionDiff handles multiple changes', () => {
  const result = generateConstitutionDiff({
    constitutionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    amendmentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    changes: [
      {
        id: 'cc1',
        workspace_id: 'ws1',
        amendment_id: 'am1',
        change_type: 'add',
        field_name: 'field_a',
        old_value: null,
        new_value: 'value_a',
        created_at: new Date().toISOString(),
      },
      {
        id: 'cc2',
        workspace_id: 'ws1',
        amendment_id: 'am1',
        change_type: 'remove',
        field_name: 'field_b',
        old_value: 'old_b',
        new_value: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'cc3',
        workspace_id: 'ws1',
        amendment_id: 'am1',
        change_type: 'update',
        field_name: 'field_c',
        old_value: 'old_c',
        new_value: 'new_c',
        created_at: new Date().toISOString(),
      },
    ],
  });
  assert.equal(result.changes.length, 3);
  assert.equal(result.changes[0].changeType, 'add');
  assert.equal(result.changes[1].changeType, 'remove');
  assert.equal(result.changes[2].changeType, 'update');
});

// ─── Audit Events ─────────────────────────────────────────────────────────────

test('all required amendment audit events exist in platform-events types', () => {
  for (const event of [
    'CONSTITUTION_AMENDMENT_CREATED',
    'CONSTITUTION_AMENDMENT_UPDATED',
    'CONSTITUTION_AMENDMENT_PROPOSED',
    'CONSTITUTION_AMENDMENT_APPROVED',
    'CONSTITUTION_AMENDMENT_REJECTED',
    'CONSTITUTION_AMENDMENT_WITHDRAWN',
    'CONSTITUTION_AMENDMENT_APPLIED',
    'CONSTITUTION_SNAPSHOT_CREATED',
    'CONSTITUTION_VERSION_INCREMENTED',
  ]) {
    assert.match(platformEvents, new RegExp(`"${event}"`), `Event '${event}' must be in platform-events types`);
  }
});

test('service emits all required audit events', () => {
  for (const event of [
    'CONSTITUTION_AMENDMENT_CREATED',
    'CONSTITUTION_AMENDMENT_UPDATED',
    'CONSTITUTION_AMENDMENT_PROPOSED',
    'CONSTITUTION_AMENDMENT_APPROVED',
    'CONSTITUTION_AMENDMENT_REJECTED',
    'CONSTITUTION_AMENDMENT_WITHDRAWN',
    'CONSTITUTION_AMENDMENT_APPLIED',
    'CONSTITUTION_SNAPSHOT_CREATED',
    'CONSTITUTION_VERSION_INCREMENTED',
  ]) {
    assert.ok(
      service.includes(`"${event}"`),
      `Service must emit '${event}'`,
    );
  }
});

test('amendment events use rawReferenceTable constitution_amendments', () => {
  assert.match(service, /rawReferenceTable: "constitution_amendments"/);
});

test('snapshot events use rawReferenceTable constitution_snapshots', () => {
  assert.match(service, /rawReferenceTable: "constitution_snapshots"/);
});

// ─── Constitutional Versioning ────────────────────────────────────────────────

test('migration adds constitution_version column to project_constitutions', () => {
  assert.match(migration, /constitution_version integer not null default 1/);
  assert.match(migration, /constitution_version >= 1/);
});

test('database contract declares ProjectConstitutionWithVersionRow', () => {
  assert.match(dbContract, /ProjectConstitutionWithVersionRow/);
  assert.match(dbContract, /constitution_version/);
});

test('database contract declares ConstitutionAmendmentRow', () => {
  assert.match(dbContract, /ConstitutionAmendmentRow/);
  assert.match(dbContract, /CONSTITUTION_AMENDMENT_SELECTABLE_COLUMNS/);
});

test('database contract declares ConstitutionAmendmentChangeRow', () => {
  assert.match(dbContract, /ConstitutionAmendmentChangeRow/);
  assert.match(dbContract, /CONSTITUTION_AMENDMENT_CHANGE_SELECTABLE_COLUMNS/);
});

test('database contract declares ConstitutionSnapshotRow', () => {
  assert.match(dbContract, /ConstitutionSnapshotRow/);
  assert.match(dbContract, /CONSTITUTION_SNAPSHOT_SELECTABLE_COLUMNS/);
});

test('database contract declares AmendmentStatus type', () => {
  assert.match(dbContract, /AmendmentStatus/);
  assert.match(dbContract, /"draft"/);
  assert.match(dbContract, /"proposed"/);
  assert.match(dbContract, /"approved"/);
  assert.match(dbContract, /"rejected"/);
  assert.match(dbContract, /"withdrawn"/);
  assert.match(dbContract, /"applied"/);
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

test('migration enables RLS on constitution_amendments', () => {
  assert.match(migration, /alter table public\.constitution_amendments enable row level security/);
});

test('migration enables RLS on constitution_amendment_changes', () => {
  assert.match(migration, /alter table public\.constitution_amendment_changes enable row level security/);
});

test('migration enables RLS on constitution_snapshots', () => {
  assert.match(migration, /alter table public\.constitution_snapshots enable row level security/);
});

test('migration uses is_workspace_member for RLS policies', () => {
  const matches = [...migration.matchAll(/public\.is_workspace_member\(workspace_id\)/g)];
  assert.ok(matches.length >= 3, 'RLS must use is_workspace_member on all three amendment tables');
});

test('service scopes all queries to workspace_id', () => {
  assert.match(service, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(service, /\.eq\("workspace_id", input\.workspaceId\)/);
});

test('migration enforces composite FK for workspace isolation on amendments', () => {
  assert.match(migration, /constitution_amendments_workspace_constitution_fkey/);
  assert.match(migration, /references public\.project_constitutions\(id, workspace_id\)/);
});

test('migration enforces composite FK for workspace isolation on snapshots', () => {
  assert.match(migration, /constitution_snapshots_workspace_constitution_fkey/);
});

test('getAmendment verifies workspace ownership before returning data', () => {
  assert.match(service, /async function getAmendment/);
  assert.match(service, /\.eq\("workspace_id", workspaceId\)/);
});

// ─── Governance Rules ─────────────────────────────────────────────────────────

test('service enforces rule 1: active constitution cannot be modified directly', () => {
  assert.match(service, /Active Constitution cannot be modified directly/);
});

test('service enforces rule 3: only draft is editable', () => {
  assert.match(service, /current\.data\.status !== "draft"/);
  assert.match(service, /governance_violation/);
});

test('service enforces rule 4: only approved can be applied', () => {
  assert.match(service, /validateAmendmentTransition.*applied/s);
});

test('service enforces rule 12: no double apply', () => {
  assert.match(service, /already been applied/);
});

// ─── Explain Capability ───────────────────────────────────────────────────────

test('explainConstitutionAmendmentGovernance returns correct structure', () => {
  const explanation = explainConstitutionAmendmentGovernance();
  assert.ok(typeof explanation.whatIsAnAmendment === 'string' && explanation.whatIsAnAmendment.length > 0);
  assert.ok(Array.isArray(explanation.approvalFlow) && explanation.approvalFlow.length >= 4);
  assert.ok(typeof explanation.versioning === 'string');
  assert.ok(typeof explanation.snapshots === 'string');
  assert.ok(typeof explanation.constitutionalIntegrity === 'string');
  assert.ok(Array.isArray(explanation.states) && explanation.states.length === 6);
  assert.ok(Array.isArray(explanation.terminalStates) && explanation.terminalStates.length === 3);
  assert.ok(Array.isArray(explanation.auditEvents) && explanation.auditEvents.length === 9);
  assert.ok(Array.isArray(explanation.governanceRules) && explanation.governanceRules.length >= 12);
});

test('explainConstitutionAmendmentGovernance marks terminal states correctly', () => {
  const explanation = explainConstitutionAmendmentGovernance();
  for (const state of explanation.states) {
    if (['rejected', 'withdrawn', 'applied'].includes(state.status)) {
      assert.equal(state.terminal, true, `${state.status} must be terminal`);
      assert.deepEqual(state.allowedTransitions, [], `${state.status} must have no transitions`);
    } else {
      assert.equal(state.terminal, false, `${state.status} must not be terminal`);
    }
  }
});

test('explainConstitutionAmendmentGovernance lists all nine audit events', () => {
  const explanation = explainConstitutionAmendmentGovernance();
  for (const event of [
    'CONSTITUTION_AMENDMENT_CREATED',
    'CONSTITUTION_AMENDMENT_UPDATED',
    'CONSTITUTION_AMENDMENT_PROPOSED',
    'CONSTITUTION_AMENDMENT_APPROVED',
    'CONSTITUTION_AMENDMENT_REJECTED',
    'CONSTITUTION_AMENDMENT_WITHDRAWN',
    'CONSTITUTION_AMENDMENT_APPLIED',
    'CONSTITUTION_SNAPSHOT_CREATED',
    'CONSTITUTION_VERSION_INCREMENTED',
  ]) {
    assert.ok(explanation.auditEvents.includes(event), `Explain must list audit event '${event}'`);
  }
});

test('explainConstitutionAmendmentGovernance includes all 12 governance rules', () => {
  const explanation = explainConstitutionAmendmentGovernance();
  assert.ok(explanation.governanceRules.length >= 12, 'At least 12 governance rules must be documented');
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation exists and covers amendment lifecycle states', () => {
  for (const state of ['Draft', 'Proposed', 'Approved', 'Rejected', 'Withdrawn', 'Applied']) {
    assert.match(docs, new RegExp(state), `Docs must document '${state}' state`);
  }
});

test('documentation covers approval flow', () => {
  assert.match(docs, /approval/i);
  assert.match(docs, /Amendment/);
});

test('documentation covers versioning', () => {
  assert.match(docs, /constitution_version/);
  assert.match(docs, /version/i);
});

test('documentation covers snapshots', () => {
  assert.match(docs, /snapshot/i);
});

test('documentation covers audit events', () => {
  for (const event of [
    'CONSTITUTION_AMENDMENT_CREATED',
    'CONSTITUTION_AMENDMENT_APPLIED',
    'CONSTITUTION_VERSION_INCREMENTED',
  ]) {
    assert.match(docs, new RegExp(event), `Docs must mention '${event}'`);
  }
});

test('documentation covers governance rules', () => {
  assert.match(docs, /governance/i);
  assert.match(docs, /Rule/);
});
