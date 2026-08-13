import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260906000000_p2_09_outcome_observation_contract.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/check-p2-09-db.mjs",
  "utf8",
);

test("P2-09 defines canonical_task_outcomes with required columns, constraints and task uniqueness", () => {
  assert.match(migration, /create table if not exists public\.canonical_task_outcomes/);
  assert.match(migration, /task_id uuid not null\s+references public\.execution_tasks\(id\)/);
  assert.match(migration, /unique \(workspace_id, project_id, task_id\)/);
  assert.match(migration, /'expected',\s*'observing',\s*'achieved',\s*'partially_achieved',\s*'not_achieved',\s*'disputed',\s*'inconclusive',\s*'superseded'/);
});

test("P2-09 defines canonical_outcome_observations with required columns and idempotency", () => {
  assert.match(migration, /create table if not exists public\.canonical_outcome_observations/);
  assert.match(migration, /outcome_id uuid not null\s+references public\.canonical_task_outcomes\(id\)/);
  assert.match(migration, /unique \(workspace_id, project_id, idempotency_key\)/);
  assert.match(migration, /evidence_reference_ids uuid\[\] not null/);
  assert.match(migration, /confidence_score numeric\(5,4\) not null/);
});

test("P2-09 ensures expected Outcome requires completed internal execution and never infers achievement", () => {
  assert.match(migration, /create or replace function public\.ensure_expected_task_outcome/);
  assert.match(migration, /canonical_task_not_completed/);
  assert.match(migration, /completed_internal_execution_required/);
  assert.match(migration, /'achievementInferred',\s*false/);
});

test("P2-09 record_canonical_outcome_observation strictly validates canonical LIVE evidence", () => {
  assert.match(migration, /create or replace function public\.record_canonical_outcome_observation/);
  assert.match(migration, /e\.normalized_event_id is not null/);
  assert.match(migration, /e\.fixture_state = 'LIVE'/);
  assert.match(migration, /e\.freshness_state = 'CURRENT'/);
  assert.match(migration, /e\.lifecycle = 'RECORDED'/);
  assert.match(migration, /e\.rejection_reason is null/);
  assert.match(migration, /e\.degraded_reason is null/);
  assert.match(migration, /e\.evaluated_at is not null/);
  assert.match(migration, /observation_evidence_scope_invalid/);
});

test("P2-09 provides capture_live_operational_input with is_fixture = false and canonical lineage", () => {
  assert.match(migration, /create or replace function public\.capture_live_operational_input/);
  assert.match(migration, /is_fixture,\s*fixture_label,\s*fixture_expires_when/);
  assert.match(migration, /false,\s*null,\s*null/);
  assert.match(migration, /intake_source_fixture_prohibited/);
  assert.match(migration, /insert into public\.operational_raw_inputs/);
  assert.match(migration, /insert into public\.operational_normalized_events/);
  assert.match(migration, /NORMALIZED_EVENT_RECORDED/);
});

test("P2-09 revokes direct table writes and manages execute permissions", () => {
  assert.match(migration, /revoke insert, update, delete, truncate\s+on public\.canonical_task_outcomes\s+from authenticated/);
  assert.match(migration, /revoke insert, update, delete, truncate\s+on public\.canonical_outcome_observations\s+from authenticated/);
  assert.match(migration, /grant execute on function public\.capture_live_operational_input[\s\S]*?to authenticated/);
  assert.match(migration, /grant execute on function public\.ensure_expected_task_outcome[\s\S]*?to authenticated/);
  assert.match(migration, /grant execute on function public\.record_canonical_outcome_observation[\s\S]*?to authenticated/);
});

test("P2-09 verifier tests separate LIVE observation evidence from decision-context evidence", () => {
  assert.match(verifier, /captureLiveInput/);
  assert.match(verifier, /deriveLiveEvidence/);
  assert.match(verifier, /liveEvidence\.fixture_state,\s*"LIVE"/);
  assert.match(verifier, /Observation with DEMO_FIXTURE Evidence rejected/);
  assert.match(verifier, /persisted Observation preserves NEW LIVE Evidence provenance/);
  assert.match(verifier, /!finalObservations\.data\[0\]\.evidence_reference_ids\.includes\(\s*governed\.evidenceId/);
});