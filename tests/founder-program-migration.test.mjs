/**
 * Founder Circle Program — migration static invariants.
 *
 * Source-level checks over supabase/migrations/20260828000000_founder_program.sql:
 * every founder_* table is RLS-enabled and explicitly locked down; the
 * transition function is SECURITY DEFINER with a pinned search_path and no
 * PUBLIC execute; no plaintext token column exists anywhere in the domain.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(process.cwd(), "supabase/migrations/20260828000000_founder_program.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8").toLowerCase();

const FOUNDER_TABLES = [
  "founder_program_settings",
  "founder_invitations",
  "founder_participants",
  "founder_applications",
  "founder_membership_transitions",
  "founder_onboarding_checkpoints",
  "founder_program_events",
  "founder_feedback",
  "founder_discovery_sessions",
  "founder_program_decisions",
];

test("every founder table is created and RLS-enabled", () => {
  for (const table of FOUNDER_TABLES) {
    assert.ok(sql.includes(`create table if not exists public.${table}`), `missing table ${table}`);
    assert.ok(
      sql.includes(`alter table public.${table} enable row level security`),
      `missing RLS enablement for ${table}`,
    );
  }
});

test("every founder table revokes default client grants explicitly", () => {
  for (const table of FOUNDER_TABLES) {
    assert.ok(
      sql.includes(`revoke all on table public.${table} from anon, authenticated`),
      `missing explicit revoke for ${table}`,
    );
  }
});

test("participant-visible tables re-grant SELECT only (never insert/update/delete)", () => {
  for (const table of ["founder_participants", "founder_applications", "founder_onboarding_checkpoints", "founder_feedback"]) {
    const grantRe = new RegExp(`grant select[\\s\\S]{0,600}on public\\.${table} to authenticated`);
    assert.ok(grantRe.test(sql), `missing select grant for ${table}`);
  }
  assert.ok(!/grant (insert|update|delete|all)[\s\S]{0,200}to authenticated/.test(sql), "no client write grants allowed");
});

test("internal columns are excluded from participant-facing column grants", () => {
  const participantsGrant = sql.match(/grant select \(([^)]*)\) on public\.founder_participants to authenticated/);
  assert.ok(participantsGrant, "founder_participants grant must be column-scoped");
  assert.ok(!participantsGrant[1].includes("state_reason"));
  assert.ok(!participantsGrant[1].includes("internal_owner_user_id"));
  assert.ok(!participantsGrant[1].includes("invitation_id"));

  const feedbackGrant = sql.match(/grant select \(([^)]*)\) on public\.founder_feedback to authenticated/);
  assert.ok(feedbackGrant, "founder_feedback grant must be column-scoped");
  assert.ok(!feedbackGrant[1].includes("internal_notes"));
  assert.ok(!feedbackGrant[1].includes("internal_owner_user_id"));
});

test("tokens exist only as sha256 hashes with a length pin", () => {
  assert.ok(sql.includes("token_hash text not null unique check (char_length(token_hash) = 64)"));
  assert.ok(!/\btoken text\b/.test(sql), "no plaintext token column may exist");
});

test("transition function is SECURITY DEFINER, search_path-pinned, service-role-only", () => {
  assert.ok(sql.includes("create or replace function public.founder_program_transition"));
  assert.ok(sql.includes("security definer"));
  assert.ok(sql.includes("set search_path = public"));
  assert.ok(/revoke all on function public\.founder_program_transition[\s\S]*?from public/.test(sql));
  assert.ok(/grant execute on function public\.founder_program_transition[\s\S]*?to service_role/.test(sql));
  assert.ok(!/grant execute on function public\.founder_program_transition[\s\S]*?to (anon|authenticated)/.test(sql));
});

test("no CREATE POLICY IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS (invalid Postgres)", () => {
  assert.ok(!sql.includes("create policy if not exists"));
  assert.ok(!sql.includes("add constraint if not exists"));
});

test("policies are recreated with drop-if-exists pairs", () => {
  const creates = [...sql.matchAll(/create policy ([a-z_]+)/g)].map((m) => m[1]);
  for (const policy of creates) {
    assert.ok(sql.includes(`drop policy if exists ${policy}`), `policy ${policy} missing drop-if-exists`);
  }
});

test("lifecycle check constraint covers all 18 canonical states", () => {
  const states = [
    "nominated", "invited", "invite_viewed", "applied", "under_review",
    "approved", "rejected", "waitlisted", "agreement_pending",
    "agreement_accepted", "onboarding_pending", "onboarding_active",
    "activated", "feedback_active", "paused", "completed", "withdrawn", "revoked",
  ];
  const constraint = sql.match(/lifecycle_state text not null default 'nominated' check \(lifecycle_state in \(([\s\S]*?)\)\)/);
  assert.ok(constraint, "lifecycle_state check constraint missing");
  for (const state of states) {
    assert.ok(constraint[1].includes(`'${state}'`), `state ${state} missing from constraint`);
  }
});

test("capacity states in SQL match the canonical approved-capacity scope", () => {
  const approvedScope = sql.match(/p_capacity_scope = 'approved'[\s\S]*?lifecycle_state in \(([\s\S]*?)\)/);
  assert.ok(approvedScope);
  for (const state of ["approved", "agreement_pending", "agreement_accepted", "onboarding_pending", "onboarding_active", "activated", "feedback_active", "paused"]) {
    assert.ok(approvedScope[1].includes(`'${state}'`), `approved scope missing ${state}`);
  }
  const activeScope = sql.match(/p_capacity_scope = 'active'[\s\S]*?lifecycle_state in \(([^)]*)\)/);
  assert.ok(activeScope);
  assert.ok(activeScope[1].includes("'onboarding_active'") && activeScope[1].includes("'activated'") && activeScope[1].includes("'feedback_active'"));
  assert.ok(!activeScope[1].includes("'paused'"), "paused must not count as active");
});

test("settings singleton seeds disabled with conservative defaults", () => {
  assert.ok(sql.includes("program_enabled boolean not null default false"));
  assert.ok(sql.includes("applications_enabled boolean not null default false"));
  assert.ok(sql.includes("invite_only boolean not null default true"));
  assert.ok(sql.includes("max_approved_participants integer not null default 10"));
  assert.ok(sql.includes("max_active_participants integer not null default 5"));
  assert.ok(sql.includes("invitation_expiry_days integer not null default 7"));
  assert.ok(sql.includes("capability_profile text not null default 'pilot' check (capability_profile = 'pilot')"));
});
