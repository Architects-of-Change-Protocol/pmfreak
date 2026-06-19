import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/lib/project-constitution/constitution-service.ts', 'utf8');
const types = readFileSync('src/lib/project-constitution/types.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260623000000_project_constitution_foundation.sql', 'utf8');
const capabilityExplain = readFileSync('src/lib/project-constitution/capability-explain.ts', 'utf8');
const indexFile = readFileSync('src/lib/project-constitution/index.ts', 'utf8');

// ─── Migration ───────────────────────────────────────────────────────────────

test('migration creates project_constitutions with workspace isolation', () => {
  assert.match(migration, /create table if not exists public\.project_constitutions/);
  assert.match(migration, /workspace_id/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
});

test('migration enforces soft delete — no physical delete policy', () => {
  assert.match(migration, /deleted_at/);
  assert.doesNotMatch(migration, /for delete/);
});

test('migration includes all constitutional columns', () => {
  for (const col of ['name', 'description', 'status', 'sponsor', 'client', 'pm_responsible_id', 'objectives', 'constraints', 'start_date', 'target_end_date', 'created_by', 'metadata']) {
    assert.match(migration, new RegExp(col), `missing column: ${col}`);
  }
});

test('migration status check constraint covers all legacy statuses', () => {
  for (const status of ['draft', 'active', 'on_hold', 'completed', 'cancelled']) {
    assert.match(migration, new RegExp(status), `missing status: ${status}`);
  }
});

test('migration wraps in transaction', () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});

// ─── Types ───────────────────────────────────────────────────────────────────

test('types define Result<T> with all failure classes', () => {
  assert.match(types, /validation_failed/);
  assert.match(types, /not_found/);
  assert.match(types, /persistence_failed/);
  assert.match(types, /event_emission_failed/);
  assert.match(types, /governance_violation/);
});

test('types define ProjectConstitutionRecord with required fields', () => {
  for (const field of ['id', 'workspace_id', 'name', 'current_status', 'sponsor', 'client', 'pm_responsible_id', 'objectives', 'constraints', 'start_date', 'target_end_date', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'metadata']) {
    assert.match(types, new RegExp(field), `missing field: ${field}`);
  }
});

test('types define ConstitutionStatus with all lifecycle states', () => {
  for (const status of ['draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived']) {
    assert.match(types, new RegExp(`"${status}"`), `missing status: ${status}`);
  }
});

test('types define all input types', () => {
  assert.match(types, /CreateProjectConstitutionInput/);
  assert.match(types, /UpdateProjectConstitutionInput/);
  assert.match(types, /SoftDeleteProjectConstitutionInput/);
});

test('types define ConstitutionLifecycleEventName', () => {
  assert.match(types, /ConstitutionLifecycleEventName/);
});

// ─── Service ─────────────────────────────────────────────────────────────────

test('service exports all required CRUD operations', () => {
  for (const fn of ['createProjectConstitution', 'updateProjectConstitution', 'softDeleteProjectConstitution', 'getProjectConstitution', 'listProjectConstitutions']) {
    assert.match(service, new RegExp(`export async function ${fn}`), `missing export: ${fn}`);
  }
});

test('service exports lifecycle operations', () => {
  assert.match(service, /export async function changeConstitutionStatus/);
  assert.match(service, /export async function getConstitutionLifecycleHistory/);
});

test('service validates UUIDs for all identity inputs', () => {
  assert.match(service, /validUuid\(input\.workspaceId\)/);
  assert.match(service, /validUuid\(input\.createdBy\)/);
  assert.match(service, /validUuid\(input\.constitutionId\)/);
  assert.match(service, /validUuid\(input\.updatedBy\)/);
  assert.match(service, /validUuid\(input\.actorId\)/);
  assert.match(service, /validUuid\(input\.deletedBy\)/);
});

test('service validates pmResponsibleId as optional UUID', () => {
  assert.match(service, /pmResponsibleId != null && !validUuid\(input\.pmResponsibleId\)/);
});

test('service validates ISO date fields', () => {
  assert.match(service, /validIsoDate\(input\.startDate\)/);
  assert.match(service, /validIsoDate\(input\.targetEndDate\)/);
});

test('service enforces workspace isolation on all write operations', () => {
  assert.ok((service.match(/eq\("workspace_id", input\.workspaceId\)/g) ?? []).length >= 3, 'workspace_id scoping on updates');
});

test('service enforces soft delete filter on reads', () => {
  assert.match(service, /is\("deleted_at", null\)/);
});

test('service emits audit events for create, update, archive', () => {
  assert.match(service, /CONSTITUTION_CREATED/);
  assert.match(service, /CONSTITUTION_UPDATED/);
  assert.match(service, /CONSTITUTION_ARCHIVED/);
});

test('service includes fromStatus and toStatus in status change event payload', () => {
  assert.match(service, /fromStatus: current\.data\.current_status/);
  assert.match(service, /toStatus: input\.targetStatus/);
});

test('service uses governance event category for platform events', () => {
  assert.match(service, /eventCategory: "governance"/);
});

test('service references correct table name', () => {
  assert.match(service, /from\("project_constitutions"\)/);
});

test('service soft delete sets deleted_at and does not physical delete', () => {
  assert.match(service, /deleted_at: now/);
  assert.doesNotMatch(service, /\.delete\(\)/);
});

// ─── Capability Explain ──────────────────────────────────────────────────────

test('capability explain exports explainProjectConstitutionCapability function', () => {
  assert.match(capabilityExplain, /export function explainProjectConstitutionCapability/);
});

test('capability explain covers purpose, scope, limits, audit events, and isolation', () => {
  assert.match(capabilityExplain, /purpose/);
  assert.match(capabilityExplain, /scope/);
  assert.match(capabilityExplain, /limits/);
  assert.match(capabilityExplain, /auditEvents/);
  assert.match(capabilityExplain, /workspaceIsolation/);
});

test('capability explain mentions soft delete boundary', () => {
  assert.match(capabilityExplain, /[Ss]oft delete/);
});

test('capability explain mentions workspace isolation mechanism', () => {
  assert.match(capabilityExplain, /is_workspace_member/);
});

// ─── Index / exports ─────────────────────────────────────────────────────────

test('index re-exports all public service functions', () => {
  for (const fn of ['createProjectConstitution', 'updateProjectConstitution', 'softDeleteProjectConstitution', 'getProjectConstitution', 'listProjectConstitutions', 'changeConstitutionStatus', 'getConstitutionLifecycleHistory']) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

test('index re-exports capability explain', () => {
  assert.match(indexFile, /explainProjectConstitutionCapability/);
});

test('index re-exports lifecycle explain', () => {
  assert.match(indexFile, /explainConstitutionLifecycle/);
});
