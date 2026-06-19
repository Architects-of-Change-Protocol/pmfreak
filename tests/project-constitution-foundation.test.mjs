import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/lib/project-constitution/constitution-service.ts', 'utf8');
const types = readFileSync('src/lib/project-constitution/types.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260623000000_project_constitution_lifecycle.sql', 'utf8');
const platformEvents = readFileSync('src/lib/platform-events/types.ts', 'utf8');
const indexFile = readFileSync('src/lib/project-constitution/index.ts', 'utf8');
const dbContract = readFileSync('src/lib/db/database-contract.ts', 'utf8');
const docs = readFileSync('docs/project-constitution-foundation.md', 'utf8');

// ─── Foundation: createConstitution ──────────────────────────────────────────

test('createConstitution is exported from the module', () => {
  assert.match(indexFile, /createConstitution/);
  assert.match(service, /export async function createConstitution/);
});

test('createConstitution validates workspaceId, projectId, createdBy as UUIDs', () => {
  assert.match(service, /workspaceId must be a UUID/);
  assert.match(service, /projectId must be a UUID/);
  assert.match(service, /createdBy must be a UUID/);
});

test('createConstitution validates title is required', () => {
  assert.match(service, /title is required/);
});

test('createConstitution inserts into project_constitutions', () => {
  assert.match(service, /from\("project_constitutions"\)/);
  assert.match(service, /\.insert\(\{/);
});

test('createConstitution always starts in draft status', () => {
  assert.match(service, /current_status: "draft"/);
  assert.match(service, /lifecycle_version: 1/);
});

test('createConstitution emits CONSTITUTION_CREATED event', () => {
  assert.match(service, /CONSTITUTION_CREATED/);
  assert.match(service, /emitConstitutionEvent\(data, "CONSTITUTION_CREATED"/);
});

test('CONSTITUTION_CREATED event type is defined in platform-events types', () => {
  assert.match(platformEvents, /"CONSTITUTION_CREATED"/);
});

test('createConstitution payload includes constitutionId, projectId, title, lifecycleVersion', () => {
  assert.match(service, /constitutionId: data\.id/);
  assert.match(service, /title: data\.title/);
  assert.match(service, /lifecycleVersion: data\.lifecycle_version/);
});

// ─── Foundation: getConstitution ─────────────────────────────────────────────

test('getConstitution is exported from the module', () => {
  assert.match(indexFile, /getConstitution/);
  assert.match(service, /export async function getConstitution/);
});

test('getConstitution enforces workspace_id filter', () => {
  assert.match(service, /\.eq\("workspace_id", workspaceId\)/);
});

test('getConstitution returns not_found failure class when missing', () => {
  assert.match(service, /failed\("Project constitution not found\.", "not_found"\)/);
});

// ─── Foundation: listConstitutions ───────────────────────────────────────────

test('listConstitutions is exported from the module', () => {
  assert.match(indexFile, /listConstitutions/);
  assert.match(service, /export async function listConstitutions/);
});

test('listConstitutions validates workspaceId', () => {
  assert.match(service, /workspaceId must be a UUID/);
});

test('listConstitutions always filters by workspace_id', () => {
  assert.match(service, /\.eq\("workspace_id", filters\.workspaceId\)/);
});

test('listConstitutions excludes archived records by default (soft delete)', () => {
  assert.match(service, /neq\("current_status", "archived"\)/);
  assert.match(service, /excludeArchived !== false/);
});

test('listConstitutions supports optional projectId filter', () => {
  assert.match(service, /\.eq\("project_id", filters\.projectId\)/);
});

test('listConstitutions supports explicit status filter', () => {
  assert.match(service, /\.eq\("current_status", filters\.status\)/);
});

test('ConstitutionListFilters type is exported', () => {
  assert.match(types, /ConstitutionListFilters/);
  assert.match(indexFile, /ConstitutionListFilters/);
});

// ─── Foundation: updateConstitution ──────────────────────────────────────────

test('updateConstitution is exported from the module', () => {
  assert.match(indexFile, /updateConstitution/);
  assert.match(service, /export async function updateConstitution/);
});

test('updateConstitution blocks archived constitutions (soft delete guard)', () => {
  assert.match(service, /current_status === "archived"/);
  assert.match(service, /Archived constitutions are read-only/);
  assert.match(service, /"governance_violation"/);
});

test('updateConstitution blocks non-draft constitutions (amendment governance)', () => {
  assert.match(service, /current_status !== "draft"/);
  assert.match(service, /amendment process/);
});

test('updateConstitution validates actorId', () => {
  assert.match(service, /actorId must be a UUID/);
});

test('updateConstitution emits CONSTITUTION_UPDATED event', () => {
  assert.match(service, /CONSTITUTION_UPDATED/);
  assert.match(service, /emitConstitutionEvent\(data, "CONSTITUTION_UPDATED"/);
});

test('CONSTITUTION_UPDATED event type is defined in platform-events types', () => {
  assert.match(platformEvents, /"CONSTITUTION_UPDATED"/);
});

test('updateConstitution payload includes updatedFields', () => {
  assert.match(service, /updatedFields/);
});

test('updateConstitution enforces workspace_id on update', () => {
  assert.match(service, /\.eq\("workspace_id", input\.workspaceId\)/);
});

test('updateConstitution validates title cannot be empty when provided', () => {
  assert.match(service, /title cannot be empty/);
});

// ─── Foundation: exportConstitution ──────────────────────────────────────────

test('exportConstitution is exported from the module', () => {
  assert.match(indexFile, /exportConstitution/);
  assert.match(service, /export async function exportConstitution/);
});

test('exportConstitution includes constitution record and full lifecycle history', () => {
  assert.match(service, /constitution: constitution\.data/);
  assert.match(service, /lifecycleHistory: history\.data/);
  assert.match(service, /exportedAt: new Date\(\)\.toISOString\(\)/);
});

test('ConstitutionExport type is defined in types and exported', () => {
  assert.match(types, /ConstitutionExport/);
  assert.match(indexFile, /ConstitutionExport/);
});

test('exportConstitution enforces workspace isolation via getConstitution', () => {
  assert.match(service, /const constitution = await getConstitution\(input\.constitutionId, input\.workspaceId\)/);
});

// ─── Soft Delete Semantics ────────────────────────────────────────────────────

test('archived status serves as soft delete: lifecycle machine allows archiving from draft', () => {
  // Imported from state-machine module — tested structurally here
  const stateMachine = readFileSync('src/lib/project-constitution/state-machine.ts', 'utf8');
  assert.match(stateMachine, /draft.*archived|archived.*draft/s);
});

test('archived is a terminal state: no transitions out', () => {
  const stateMachine = readFileSync('src/lib/project-constitution/state-machine.ts', 'utf8');
  assert.match(stateMachine, /TERMINAL_STATES/);
  assert.match(stateMachine, /"archived"/);
});

test('listConstitutions documents excludeArchived filter in types', () => {
  assert.match(types, /excludeArchived/);
});

// ─── Database Schema ──────────────────────────────────────────────────────────

test('migration creates project_constitutions table', () => {
  assert.match(migration, /create table if not exists public\.project_constitutions/);
});

test('migration schema includes all foundation fields', () => {
  for (const field of ['title', 'description', 'created_by', 'created_at', 'updated_at', 'metadata']) {
    assert.match(migration, new RegExp(field), `Migration must include field '${field}'`);
  }
});

test('migration schema includes all lifecycle fields', () => {
  for (const field of ['current_status', 'status_changed_at', 'status_changed_by', 'lifecycle_version']) {
    assert.match(migration, new RegExp(field), `Migration must include lifecycle field '${field}'`);
  }
});

test('database contract defines ProjectConstitutionRow', () => {
  assert.match(dbContract, /ProjectConstitutionRow/);
  assert.match(dbContract, /PROJECT_CONSTITUTION_SELECTABLE_COLUMNS/);
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

test('migration enables RLS on project_constitutions', () => {
  assert.match(migration, /alter table public\.project_constitutions enable row level security/);
});

test('RLS insert policy requires created_by = auth.uid()', () => {
  assert.match(migration, /created_by = auth\.uid\(\)/);
});

test('RLS policies use is_workspace_member for workspace isolation', () => {
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
});

// ─── Event Audit Coverage ─────────────────────────────────────────────────────

test('all nine constitution event types are defined in platform-events', () => {
  for (const event of [
    'CONSTITUTION_CREATED', 'CONSTITUTION_UPDATED',
    'CONSTITUTION_PROPOSED', 'CONSTITUTION_APPROVED', 'CONSTITUTION_ACTIVATED',
    'CONSTITUTION_SUSPENDED', 'CONSTITUTION_CLOSED', 'CONSTITUTION_ARCHIVED',
    'CONSTITUTION_STATUS_CHANGED',
  ]) {
    assert.match(platformEvents, new RegExp(`"${event}"`), `Platform event '${event}' must be defined`);
  }
});

test('rawReferenceTable is always set to project_constitutions in events', () => {
  const matches = [...service.matchAll(/rawReferenceTable: "project_constitutions"/g)];
  assert.ok(matches.length >= 2, 'rawReferenceTable must be set consistently across event calls');
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('foundation documentation covers all CRUD functions', () => {
  for (const fn of ['createConstitution', 'getConstitution', 'listConstitutions', 'updateConstitution', 'exportConstitution']) {
    assert.match(docs, new RegExp(fn), `Docs must document '${fn}'`);
  }
});

test('foundation documentation covers soft delete semantics', () => {
  assert.match(docs, /soft.delete|archived/i);
});

test('foundation documentation covers workspace isolation', () => {
  assert.match(docs, /workspace.isolation|workspace_id/i);
});

test('foundation documentation covers audit events', () => {
  assert.match(docs, /CONSTITUTION_CREATED/);
  assert.match(docs, /CONSTITUTION_UPDATED/);
});
