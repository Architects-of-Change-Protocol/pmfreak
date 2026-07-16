-- Founder Circle Program Sprint 01 — data foundation.
--
-- Closed, invite-only, human-approved founder program. Design:
-- docs/founder-program/00-architecture-decision-record.md and
-- docs/founder-program/04-data-model.md.
--
-- Conventions honored (see docs/release/migration-inventory.md):
--   * every table RLS-enabled with explicit policies or a documented
--     service-role-only lockdown (explicit revokes),
--   * `drop policy if exists` + `create policy` pairs,
--   * column-scoped SELECT grants for participant-visible tables so
--     internal/operator fields never reach the authenticated role,
--   * SECURITY DEFINER function pins search_path and revokes PUBLIC execute
--     (scripts/check-security-definer-hardening.mjs),
--   * reuses public.touch_updated_at() from 20260512198000_early_access_trials.sql.

-- ─── Program settings (operator-managed singleton) ──────────────────────────

create table if not exists public.founder_program_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  display_name text not null default 'PMFreak Founder Circle',
  program_enabled boolean not null default false,
  invite_only boolean not null default true,
  applications_enabled boolean not null default false,
  max_approved_participants integer not null default 10
    check (max_approved_participants between 1 and 500),
  max_active_participants integer not null default 5
    check (max_active_participants between 1 and 500),
  max_invitations_per_batch integer not null default 5
    check (max_invitations_per_batch between 1 and 25),
  invitation_expiry_days integer not null default 7
    check (invitation_expiry_days between 1 and 90),
  required_agreement_version text not null default '0.1-draft',
  required_onboarding_version text not null default 'v1',
  -- Only the curated pilot profile may ever be assigned by this program.
  capability_profile text not null default 'pilot' check (capability_profile = 'pilot'),
  support_contact text,
  feedback_cadence_days integer not null default 14
    check (feedback_cadence_days between 1 and 90),
  program_starts_on date,
  review_due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.founder_program_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.founder_program_settings enable row level security;
-- Service-role only: operators read/update via founder-gated routes.
revoke all on table public.founder_program_settings from anon, authenticated;

drop trigger if exists trg_founder_program_settings_touch on public.founder_program_settings;
create trigger trg_founder_program_settings_touch
before update on public.founder_program_settings
for each row execute function public.touch_updated_at();

-- ─── Invitations ─────────────────────────────────────────────────────────────

create table if not exists public.founder_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  -- sha256 hex of a 192-bit CSPRNG token; plaintext is never stored.
  token_hash text not null unique check (char_length(token_hash) = 64),
  archetype text not null check (archetype in (
    'independent_pm', 'pmo_practitioner', 'agile_lead', 'program_manager',
    'consultant', 'operations_leader', 'founder_operator', 'other'
  )),
  nomination_note text,
  status text not null default 'pending'
    check (status in ('pending', 'viewed', 'applied', 'expired', 'revoked')),
  expires_at timestamptz not null,
  viewed_at timestamptz,
  applied_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  batch_id uuid,
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one live invitation per address.
create unique index if not exists founder_invitations_live_email_idx
  on public.founder_invitations (email)
  where status in ('pending', 'viewed');

create index if not exists founder_invitations_status_idx
  on public.founder_invitations (status);

alter table public.founder_invitations enable row level security;
-- Service-role only: participants resolve invitations exclusively through
-- token-hash lookups in server routes; token_hash must never be selectable
-- by any client role.
revoke all on table public.founder_invitations from anon, authenticated;

drop trigger if exists trg_founder_invitations_touch on public.founder_invitations;
create trigger trg_founder_invitations_touch
before update on public.founder_invitations
for each row execute function public.touch_updated_at();

-- ─── Participants (canonical lifecycle record) ──────────────────────────────

create table if not exists public.founder_participants (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.founder_invitations(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null check (email = lower(email)),
  full_name text,
  archetype text not null check (archetype in (
    'independent_pm', 'pmo_practitioner', 'agile_lead', 'program_manager',
    'consultant', 'operations_leader', 'founder_operator', 'other'
  )),
  lifecycle_state text not null default 'nominated' check (lifecycle_state in (
    'nominated', 'invited', 'invite_viewed', 'applied', 'under_review',
    'approved', 'rejected', 'waitlisted', 'agreement_pending',
    'agreement_accepted', 'onboarding_pending', 'onboarding_active',
    'activated', 'feedback_active', 'paused', 'completed', 'withdrawn',
    'revoked'
  )),
  state_reason text,
  cohort text,
  internal_owner_user_id uuid references auth.users(id),
  workspace_id uuid references public.workspaces(id) on delete set null,
  application_id uuid,
  agreement_version_accepted text,
  activated_at timestamptz,
  paused_at timestamptz,
  revoked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_participants_state_idx
  on public.founder_participants (lifecycle_state);
create index if not exists founder_participants_user_idx
  on public.founder_participants (user_id);

alter table public.founder_participants enable row level security;

-- Participants read their own record; internal fields are excluded by the
-- column-scoped grant below (workspace_invitations.token_hash precedent).
drop policy if exists founder_participants_self_read on public.founder_participants;
create policy founder_participants_self_read
  on public.founder_participants for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.founder_participants from anon, authenticated;
grant select (
  id, user_id, email, full_name, archetype, lifecycle_state, cohort,
  workspace_id, agreement_version_accepted, activated_at, paused_at,
  completed_at, created_at, updated_at
) on public.founder_participants to authenticated;

drop trigger if exists trg_founder_participants_touch on public.founder_participants;
create trigger trg_founder_participants_touch
before update on public.founder_participants
for each row execute function public.touch_updated_at();

-- ─── Applications (intake answers) ──────────────────────────────────────────

create table if not exists public.founder_applications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.founder_participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role_title text not null check (char_length(role_title) between 1 and 120),
  company_status text not null check (company_status in ('company', 'independent', 'other')),
  experience_range text not null check (experience_range in ('lt_2', '2_5', '5_10', '10_plus')),
  pain_point text not null check (char_length(pain_point) between 1 and 1000),
  current_tools text check (char_length(current_tools) <= 500),
  active_projects_range text not null check (active_projects_range in ('1_2', '3_5', '6_10', '10_plus')),
  joining_reason text not null check (char_length(joining_reason) between 1 and 1000),
  consent_contact boolean not null check (consent_contact),
  feedback_availability text not null check (feedback_availability in ('weekly', 'biweekly', 'monthly', 'async_only')),
  referral_source text check (char_length(referral_source) <= 200),
  linkedin_url text check (char_length(linkedin_url) <= 300),
  timezone text check (char_length(timezone) <= 60),
  submitted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

alter table public.founder_applications enable row level security;

drop policy if exists founder_applications_self_read on public.founder_applications;
create policy founder_applications_self_read
  on public.founder_applications for select
  to authenticated
  using (user_id = auth.uid());

-- All writes go through validated service-role routes; participants cannot
-- edit an application after submission.
revoke all on table public.founder_applications from anon, authenticated;
grant select on public.founder_applications to authenticated;

-- ─── Lifecycle transitions (append-only audit) ──────────────────────────────

create table if not exists public.founder_membership_transitions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.founder_participants(id) on delete cascade,
  from_state text not null,
  to_state text not null,
  actor_type text not null check (actor_type in ('participant', 'operator', 'system')),
  actor_user_id uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists founder_membership_transitions_participant_idx
  on public.founder_membership_transitions (participant_id, created_at);

alter table public.founder_membership_transitions enable row level security;
-- Service-role only; append-only (no update/delete code path exists either).
revoke all on table public.founder_membership_transitions from anon, authenticated;

-- ─── Onboarding checkpoints ─────────────────────────────────────────────────

create table if not exists public.founder_onboarding_checkpoints (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.founder_participants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  checkpoint text not null check (checkpoint in (
    'invite_opened', 'application_submitted', 'approved', 'agreement_accepted',
    'first_login', 'workspace_ready', 'first_project_created',
    'first_data_entered', 'first_command_center_visit',
    'first_core_capability_used', 'first_feedback_submitted',
    'first_followup_session_completed', 'activation_completed'
  )),
  reached_at timestamptz not null default now(),
  unique (participant_id, checkpoint)
);

create index if not exists founder_onboarding_checkpoints_participant_idx
  on public.founder_onboarding_checkpoints (participant_id);

alter table public.founder_onboarding_checkpoints enable row level security;

drop policy if exists founder_onboarding_checkpoints_self_read on public.founder_onboarding_checkpoints;
create policy founder_onboarding_checkpoints_self_read
  on public.founder_onboarding_checkpoints for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.founder_onboarding_checkpoints from anon, authenticated;
grant select on public.founder_onboarding_checkpoints to authenticated;

-- ─── First-party analytics events ───────────────────────────────────────────

create table if not exists public.founder_program_events (
  id uuid primary key default gen_random_uuid(),
  -- Canonical names + property allowlist enforced in
  -- src/lib/founder-program/analytics.ts; the constraint here only pins the
  -- namespace so foreign event families cannot land in this table.
  event_name text not null check (event_name ~ '^founder_[a-z0-9_]{1,64}$'),
  schema_version integer not null default 1 check (schema_version >= 1),
  participant_id uuid references public.founder_participants(id) on delete set null,
  cohort text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists founder_program_events_name_idx
  on public.founder_program_events (event_name, occurred_at);
create index if not exists founder_program_events_participant_idx
  on public.founder_program_events (participant_id);

alter table public.founder_program_events enable row level security;
revoke all on table public.founder_program_events from anon, authenticated;

-- ─── Structured feedback ─────────────────────────────────────────────────────

create table if not exists public.founder_feedback (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.founder_participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  feedback_type text not null check (feedback_type in (
    'onboarding_friction', 'defect', 'usability', 'feature_request',
    'missing_integration', 'pricing_value', 'workflow_outcome', 'general'
  )),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  product_area text check (char_length(product_area) <= 120),
  body text not null check (char_length(body) between 1 and 4000),
  allow_contact boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'triaged', 'planned', 'declined', 'resolved', 'duplicate')),
  internal_owner_user_id uuid references auth.users(id),
  internal_notes text,
  resolution_ref text check (char_length(resolution_ref) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_feedback_participant_idx
  on public.founder_feedback (participant_id);
create index if not exists founder_feedback_status_idx
  on public.founder_feedback (status);

alter table public.founder_feedback enable row level security;

drop policy if exists founder_feedback_self_read on public.founder_feedback;
create policy founder_feedback_self_read
  on public.founder_feedback for select
  to authenticated
  using (user_id = auth.uid());

-- Column-scoped grant: internal triage fields never reach participants.
revoke all on table public.founder_feedback from anon, authenticated;
grant select (
  id, participant_id, user_id, workspace_id, feedback_type, severity,
  product_area, body, allow_contact, status, resolution_ref, created_at,
  updated_at
) on public.founder_feedback to authenticated;

drop trigger if exists trg_founder_feedback_touch on public.founder_feedback;
create trigger trg_founder_feedback_touch
before update on public.founder_feedback
for each row execute function public.touch_updated_at();

-- ─── Discovery-session evidence (operator-recorded) ─────────────────────────

create table if not exists public.founder_discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.founder_participants(id) on delete cascade,
  session_type text not null check (session_type in (
    'discovery', 'onboarding_observation', 'usability_review',
    'value_review', 'retention_review', 'exit_interview'
  )),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  scheduled_for date,
  completed_on date,
  facilitator_user_id uuid not null references auth.users(id),
  main_pain_point text check (char_length(main_pain_point) <= 1000),
  moment_of_value text check (char_length(moment_of_value) <= 1000),
  main_friction text check (char_length(main_friction) <= 1000),
  requested_capability text check (char_length(requested_capability) <= 500),
  willingness_to_pay text not null default 'unknown'
    check (willingness_to_pay in ('unknown', 'none', 'low', 'medium', 'high')),
  findings text check (char_length(findings) <= 4000),
  follow_up_actions text check (char_length(follow_up_actions) <= 2000),
  -- Reference only (doc link, filename, note) — recordings are never
  -- uploaded or stored by this system.
  evidence_ref text check (char_length(evidence_ref) <= 300),
  consent_status text not null default 'not_requested'
    check (consent_status in ('not_requested', 'requested', 'granted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_discovery_sessions_participant_idx
  on public.founder_discovery_sessions (participant_id);

alter table public.founder_discovery_sessions enable row level security;
revoke all on table public.founder_discovery_sessions from anon, authenticated;

drop trigger if exists trg_founder_discovery_sessions_touch on public.founder_discovery_sessions;
create trigger trg_founder_discovery_sessions_touch
before update on public.founder_discovery_sessions
for each row execute function public.touch_updated_at();

-- ─── Program decision gate (append-only) ────────────────────────────────────

create table if not exists public.founder_program_decisions (
  id uuid primary key default gen_random_uuid(),
  decision text not null check (decision in (
    'continue', 'continue_with_remediation', 'pause', 'stop', 'expand_cohort'
  )),
  decided_on date not null,
  decision_owner_user_id uuid not null references auth.users(id),
  evidence_window_start date not null,
  evidence_window_end date not null check (evidence_window_end >= evidence_window_start),
  participant_count integer not null check (participant_count >= 0),
  activation_count integer not null check (activation_count >= 0),
  retention_evidence_available boolean not null default false,
  positive_signals text check (char_length(positive_signals) <= 4000),
  negative_signals text check (char_length(negative_signals) <= 4000),
  critical_defects text check (char_length(critical_defects) <= 4000),
  requested_capabilities text check (char_length(requested_capabilities) <= 4000),
  security_incidents text check (char_length(security_incidents) <= 4000),
  data_quality_limitations text check (char_length(data_quality_limitations) <= 4000),
  rationale text not null check (char_length(rationale) between 1 and 8000),
  required_remediation text check (char_length(required_remediation) <= 4000),
  next_review_on date,
  created_at timestamptz not null default now()
);

alter table public.founder_program_decisions enable row level security;
revoke all on table public.founder_program_decisions from anon, authenticated;

-- ─── Capacity- and race-safe transition function ────────────────────────────
--
-- The application-level transition policy (src/lib/founder-program/lifecycle.ts)
-- is the canonical allowlist of (from, to, actor) tuples; this function is the
-- database-side enforcement of the two properties that cannot be guaranteed
-- from the application layer alone:
--   1. capacity checks that are atomic with the state change (settings row
--      locked for update), and
--   2. compare-and-swap on the current state (duplicate activation / lost
--      update protection).
-- Precedent: abuse_rate_limit_increment (20260819000000_abuse_rate_limits.sql).

create or replace function public.founder_program_transition(
  p_participant_id uuid,
  p_expected_from text,
  p_to text,
  p_actor_type text,
  p_actor_user_id uuid,
  p_reason text,
  p_capacity_scope text default null,
  p_capacity_override boolean default false
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.founder_program_settings%rowtype;
  v_count integer;
  v_updated integer;
begin
  if p_actor_type not in ('participant', 'operator', 'system') then
    return 'invalid_actor';
  end if;
  if p_capacity_scope is not null and p_capacity_scope not in ('approved', 'active') then
    return 'invalid_capacity_scope';
  end if;

  select * into v_settings
  from public.founder_program_settings
  where singleton
  for update;

  if not found then
    return 'settings_missing';
  end if;

  if p_capacity_scope = 'approved' and not p_capacity_override then
    select count(*) into v_count
    from public.founder_participants
    where lifecycle_state in (
      'approved', 'agreement_pending', 'agreement_accepted',
      'onboarding_pending', 'onboarding_active', 'activated',
      'feedback_active', 'paused'
    );
    if v_count >= v_settings.max_approved_participants then
      return 'capacity_reached';
    end if;
  end if;

  if p_capacity_scope = 'active' and not p_capacity_override then
    select count(*) into v_count
    from public.founder_participants
    where lifecycle_state in ('onboarding_active', 'activated', 'feedback_active');
    if v_count >= v_settings.max_active_participants then
      return 'capacity_reached';
    end if;
  end if;

  update public.founder_participants
  set lifecycle_state = p_to,
      state_reason = coalesce(p_reason, state_reason)
  where id = p_participant_id
    and lifecycle_state = p_expected_from;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    if exists (select 1 from public.founder_participants where id = p_participant_id) then
      return 'state_conflict';
    end if;
    return 'participant_not_found';
  end if;

  insert into public.founder_membership_transitions
    (participant_id, from_state, to_state, actor_type, actor_user_id, reason)
  values
    (p_participant_id, p_expected_from, p_to, p_actor_type, p_actor_user_id, p_reason);

  return 'ok';
end;
$$;

revoke all on function public.founder_program_transition(uuid, text, text, text, uuid, text, text, boolean) from public;
revoke all on function public.founder_program_transition(uuid, text, text, text, uuid, text, text, boolean) from anon, authenticated;
grant execute on function public.founder_program_transition(uuid, text, text, text, uuid, text, text, boolean) to service_role;
