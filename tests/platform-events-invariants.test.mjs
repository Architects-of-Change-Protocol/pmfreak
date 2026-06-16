import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePlatformEventPayload, assertPlatformEventPayloadAllowed, validatePlatformEventActor } from '../src/lib/platform-events/payload-validation.ts';

const migration = readFileSync('supabase/migrations/20260616000000_platform_events_invariants.sql', 'utf8');

test('platform_events migration defines append-only mutation guard and update/delete triggers', () => {
  assert.match(migration, /create or replace function public\.prevent_platform_event_mutation\(\)/);
  assert.match(migration, /platform_events are append-only\. Emit a compensating event instead of mutating history\./);
  assert.match(migration, /create trigger platform_events_prevent_update\s+before update on public\.platform_events/s);
  assert.match(migration, /create trigger platform_events_prevent_delete\s+before delete on public\.platform_events/s);
});

test('platform_events migration allows inserts while blocking mutation triggers only update and delete', () => {
  assert.match(migration, /create table if not exists public\.platform_events/);
  assert.doesNotMatch(migration, /platform_events_prevent_insert/);
  assert.match(migration, /create trigger platform_events_validate_payload\s+before insert on public\.platform_events/s);
  assert.match(migration, /create trigger platform_events_validate_project_workspace\s+before insert on public\.platform_events/s);
  assert.match(migration, /grant insert, select on public\.platform_events to service_role/);
});

test('platform_events migration enforces workspace/project ownership integrity', () => {
  assert.match(migration, /platform_events_project_workspace_fkey/);
  assert.match(migration, /foreign key \(workspace_id, project_id\)\s+references public\.projects\(workspace_id, id\)/s);
  assert.match(migration, /validate_platform_event_project_workspace/);
  assert.match(migration, /project_id does not belong to workspace_id/);
});

test('recursive payload validation rejects nested object forbidden keys with object path', () => {
  const result = validatePlatformEventPayload({ data: { credentials: { api_key: 'hidden' } } });
  assert.equal(result.ok, false);
  assert.equal(result.path, 'data.credentials.api_key');
  assert.equal(result.offendingKey, 'api_key');
  assert.equal(result.message, 'Forbidden payload key detected: data.credentials.api_key');
});

test('recursive payload validation rejects nested array forbidden keys with array path', () => {
  const result = validatePlatformEventPayload({ items: [{ metadata: { token: 'hidden' } }] });
  assert.equal(result.ok, false);
  assert.equal(result.path, 'items[0].metadata.token');
  assert.equal(result.offendingKey, 'token');
});

test('recursive payload validation rejects arbitrarily deep forbidden keys', () => {
  const result = validatePlatformEventPayload({ a: { b: [{ c: { d: { full_contract_text: 'raw' } } }] } });
  assert.equal(result.ok, false);
  assert.equal(result.path, 'a.b[0].c.d.full_contract_text');
});

test('recursive payload validation allows valid metadata payloads', () => {
  const payload = { action: 'decision_recorded', evidenceIds: ['e1'], metadata: { score: 95, tags: ['governance'] } };
  assert.deepEqual(validatePlatformEventPayload(payload), { ok: true });
  assert.doesNotThrow(() => assertPlatformEventPayloadAllowed(payload));
});

test('recursive payload validation throws validation error without stripping fields', () => {
  assert.throws(
    () => assertPlatformEventPayloadAllowed({ data: { password: 'hidden' } }),
    /Forbidden payload key detected: data\.password/,
  );
});

test('actor consistency validation requires actor_id for user actors only', () => {
  assert.equal(validatePlatformEventActor({ actorType: 'user', actorId: null }).ok, false);
  assert.deepEqual(validatePlatformEventActor({ actorType: 'system' }), { ok: true });
  assert.deepEqual(validatePlatformEventActor({ actorType: 'ai_agent' }), { ok: true });
  assert.deepEqual(validatePlatformEventActor({ actorType: 'user', actorId: 'user-1' }), { ok: true });
});
