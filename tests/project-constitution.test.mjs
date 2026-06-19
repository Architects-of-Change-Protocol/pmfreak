import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/lib/project-constitution/service.ts', 'utf8');
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
  // No delete RLS policy should exist
  assert.doesNotMatch(migration, /for delete/);
});

test('migration includes all constitutional columns', () => {
  for (const col of ['name', 'description', 'status', 'sponsor', 'client', 'pm_responsible_id', 'objectives', 'constraints', 'start_date', 'target_end_date', 'created_by', 'metadata']) {
    assert.match(migration, new RegExp(col), `missing column: ${col}`);
  }
});

test('migration status check constraint covers all statuses', () => {
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
  for (const field of ['id', 'workspace_id', 'name', 'status', 'sponsor', 'client', 'pm_responsible_id', 'objectives', 'constraints', 'start_date', 'target_end_date', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'metadata']) {
    assert.match(types, new RegExp(field), `missing field: ${field}`);
  }
});

test('types define ProjectConstitutionStatus as string literal union', () => {
  for (const status of ['draft', 'active', 'on_hold', 'completed', 'cancelled']) {
    assert.match(types, new RegExp(`"${status}"`), `missing status: ${status}`);
  }
});

test('types define all input types', () => {
  assert.match(types, /CreateProjectConstitutionInput/);
  assert.match(types, /UpdateProjectConstitutionInput/);
  assert.match(types, /ChangeProjectConstitutionStatusInput/);
  assert.match(types, /SoftDeleteProjectConstitutionInput/);
});

test('types define lifecycle events matching platform event types', () => {
  for (const event of ['PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_STATUS_CHANGED', 'PROJECT_ARCHIVED']) {
    assert.match(types, new RegExp(event), `missing lifecycle event: ${event}`);
  }
});

// ─── Service ─────────────────────────────────────────────────────────────────

test('service exports all required operations', () => {
  for (const fn of ['createProjectConstitution', 'updateProjectConstitution', 'changeProjectConstitutionStatus', 'softDeleteProjectConstitution', 'getProjectConstitution', 'listProjectConstitutions']) {
    assert.match(service, new RegExp(`export async function ${fn}`), `missing export: ${fn}`);
  }
});

test('service validates UUIDs for all identity inputs', () => {
  assert.match(service, /validUuid\(input\.workspaceId\)/);
  assert.match(service, /validUuid\(input\.createdBy\)/);
  assert.match(service, /validUuid\(input\.constitutionId\)/);
  assert.match(service, /validUuid\(input\.updatedBy\)/);
  assert.match(service, /validUuid\(input\.changedBy\)/);
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
  // All update/select operations must scope to workspace_id
  const updateMatches = [...service.matchAll(/\.update\(/g)];
  assert.ok(updateMatches.length >= 3, 'expected at least 3 update operations');
  assert.ok((service.match(/eq\("workspace_id", input\.workspaceId\)/g) ?? []).length >= 4, 'workspace_id scoping on updates');
});

test('service enforces soft delete filter on reads', () => {
  assert.match(service, /is\("deleted_at", null\)/);
});

test('service emits audit events for all mutating operations', () => {
  assert.match(service, /emitConstitutionEvent\(data, "PROJECT_CREATED"/);
  assert.match(service, /emitConstitutionEvent\(data, "PROJECT_UPDATED"/);
  assert.match(service, /emitConstitutionEvent\(data, "PROJECT_STATUS_CHANGED"/);
  assert.match(service, /emitConstitutionEvent\(data, "PROJECT_ARCHIVED"/);
});

test('service includes previousStatus and newStatus in status change event payload', () => {
  assert.match(service, /previousStatus: current\.status/);
  assert.match(service, /newStatus: input\.status/);
});

test('service uses project event category for platform events', () => {
  assert.match(service, /eventCategory: "project"/);
});

test('service references correct table name', () => {
  assert.match(service, /from\("project_constitutions"\)/);
});

test('service soft delete sets deleted_at and does not physical delete', () => {
  assert.match(service, /deleted_at: deletedAt/);
  assert.doesNotMatch(service, /\.delete\(\)/);
});

test('service changeProjectConstitutionStatus is idempotent for same status', () => {
  assert.match(service, /current\.status === input\.status/);
  assert.match(service, /return \{ ok: true, data: current \}/);
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

test('capability explain documents all four audit events', () => {
  for (const event of ['PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_STATUS_CHANGED', 'PROJECT_ARCHIVED']) {
    assert.match(capabilityExplain, new RegExp(event));
  }
});

test('capability explain mentions soft delete boundary', () => {
  assert.match(capabilityExplain, /[Ss]oft delete/);
});

test('capability explain mentions workspace isolation mechanism', () => {
  assert.match(capabilityExplain, /is_workspace_member/);
});

// ─── Index / exports ─────────────────────────────────────────────────────────

test('index re-exports all public service functions', () => {
  for (const fn of ['createProjectConstitution', 'updateProjectConstitution', 'changeProjectConstitutionStatus', 'softDeleteProjectConstitution', 'getProjectConstitution', 'listProjectConstitutions']) {
    assert.match(indexFile, new RegExp(fn), `index missing: ${fn}`);
  }
});

test('index re-exports capability explain', () => {
  assert.match(indexFile, /explainProjectConstitutionCapability/);
});
