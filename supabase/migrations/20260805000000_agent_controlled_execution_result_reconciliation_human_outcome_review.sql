-- ─────────────────────────────────────────────────────────────────────────────
-- Controlled Execution Result Reconciliation & Human Outcome Review
-- Migration: 20260805000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_execution_outcomes ─────────────────────────────────────────────────

create table if not exists public.agent_execution_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete set null,
  dispatch_attempt_id uuid references public.agent_execution_dispatch_attempts(id) on delete set null,
  dispatch_gate_id uuid references public.agent_execution_dispatch_gates(id) on delete set null,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  status text not null default 'created',
  outcome_type text not null default 'noop',
  match_status text not null default 'undetermined',
  evidence_completeness_level text not null default 'none',
  confidence_score integer not null default 0,
  confidence_level text not null default 'low',
  review_requirement text not null default 'not_required',
  review_status text not null default 'not_required',
  intended_outcome_summary text,
  actual_outcome_summary text,
  mismatch_reasons_json jsonb not null default '[]'::jsonb,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  outcome_payload_json jsonb,
  safe_outcome_payload_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_outcomes_workspace_idx
  on public.agent_execution_outcomes(workspace_id);

create index if not exists agent_execution_outcomes_request_idx
  on public.agent_execution_outcomes(execution_request_id);

create index if not exists agent_execution_outcomes_finalization_idx
  on public.agent_execution_outcomes(finalization_id);

create index if not exists agent_execution_outcomes_status_idx
  on public.agent_execution_outcomes(workspace_id, status);

create index if not exists agent_execution_outcomes_type_idx
  on public.agent_execution_outcomes(workspace_id, outcome_type);

create index if not exists agent_execution_outcomes_match_idx
  on public.agent_execution_outcomes(workspace_id, match_status);

create index if not exists agent_execution_outcomes_review_idx
  on public.agent_execution_outcomes(workspace_id, review_status);

create index if not exists agent_execution_outcomes_confidence_idx
  on public.agent_execution_outcomes(workspace_id, confidence_level);

create index if not exists agent_execution_outcomes_created_idx
  on public.agent_execution_outcomes(workspace_id, created_at desc);

-- ─── agent_execution_outcome_reconciliations ──────────────────────────────────

create table if not exists public.agent_execution_outcome_reconciliations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete set null,
  dispatch_attempt_id uuid references public.agent_execution_dispatch_attempts(id) on delete set null,
  dispatch_succeeded boolean not null default false,
  adapter_execution_exists boolean not null default false,
  result_exists boolean not null default false,
  evidence_count integer not null default 0,
  lineage_complete boolean not null default false,
  reconciliation_notes_json jsonb not null default '[]'::jsonb,
  reconciliation_payload_json jsonb,
  reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_outcome_reconciliations_workspace_idx
  on public.agent_execution_outcome_reconciliations(workspace_id);

create index if not exists agent_execution_outcome_reconciliations_outcome_idx
  on public.agent_execution_outcome_reconciliations(outcome_id);

create index if not exists agent_execution_outcome_reconciliations_request_idx
  on public.agent_execution_outcome_reconciliations(execution_request_id);

-- ─── agent_execution_outcome_comparisons ─────────────────────────────────────

create table if not exists public.agent_execution_outcome_comparisons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  match_status text not null default 'undetermined',
  intended_outcome_summary text,
  actual_outcome_summary text,
  mismatch_reasons_json jsonb not null default '[]'::jsonb,
  confidence_impact integer not null default 0,
  requires_correction boolean not null default false,
  compared_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_outcome_comparisons_workspace_idx
  on public.agent_execution_outcome_comparisons(workspace_id);

create index if not exists agent_execution_outcome_comparisons_outcome_idx
  on public.agent_execution_outcome_comparisons(outcome_id);

create index if not exists agent_execution_outcome_comparisons_match_idx
  on public.agent_execution_outcome_comparisons(workspace_id, match_status);

-- ─── agent_execution_evidence_completeness ────────────────────────────────────

create table if not exists public.agent_execution_evidence_completeness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  completeness_score integer not null default 0,
  level text not null default 'none',
  present_types_json jsonb not null default '[]'::jsonb,
  missing_types_json jsonb not null default '[]'::jsonb,
  blocking_gaps_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_evidence_completeness_workspace_idx
  on public.agent_execution_evidence_completeness(workspace_id);

create index if not exists agent_execution_evidence_completeness_outcome_idx
  on public.agent_execution_evidence_completeness(outcome_id);

create index if not exists agent_execution_evidence_completeness_level_idx
  on public.agent_execution_evidence_completeness(workspace_id, level);

-- ─── agent_execution_outcome_confidence ──────────────────────────────────────

create table if not exists public.agent_execution_outcome_confidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  confidence_score integer not null default 0,
  confidence_level text not null default 'low',
  confidence_reasons_json jsonb not null default '[]'::jsonb,
  scored_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_outcome_confidence_workspace_idx
  on public.agent_execution_outcome_confidence(workspace_id);

create index if not exists agent_execution_outcome_confidence_outcome_idx
  on public.agent_execution_outcome_confidence(outcome_id);

create index if not exists agent_execution_outcome_confidence_level_idx
  on public.agent_execution_outcome_confidence(workspace_id, confidence_level);

-- ─── agent_execution_human_outcome_reviews ───────────────────────────────────

create table if not exists public.agent_execution_human_outcome_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  review_requirement text not null default 'not_required',
  review_status text not null default 'pending',
  priority text not null default 'normal',
  title text not null,
  summary text,
  decided_by uuid references auth.users(id) on delete set null,
  decision_type text,
  decision_rationale text,
  decided_at timestamptz,
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_human_outcome_reviews_workspace_idx
  on public.agent_execution_human_outcome_reviews(workspace_id);

create index if not exists agent_execution_human_outcome_reviews_outcome_idx
  on public.agent_execution_human_outcome_reviews(outcome_id);

create index if not exists agent_execution_human_outcome_reviews_status_idx
  on public.agent_execution_human_outcome_reviews(workspace_id, review_status);

create index if not exists agent_execution_human_outcome_reviews_priority_idx
  on public.agent_execution_human_outcome_reviews(workspace_id, priority);

create index if not exists agent_execution_human_outcome_reviews_due_idx
  on public.agent_execution_human_outcome_reviews(workspace_id, due_at);

-- ─── agent_execution_failed_dispatch_triage ──────────────────────────────────

create table if not exists public.agent_execution_failed_dispatch_triage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete set null,
  dispatch_attempt_id uuid references public.agent_execution_dispatch_attempts(id) on delete set null,
  failure_category text not null default 'unknown',
  failure_message text,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  triage_notes_json jsonb not null default '[]'::jsonb,
  recommended_correction_type text,
  triage_payload_json jsonb,
  triaged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_failed_dispatch_triage_workspace_idx
  on public.agent_execution_failed_dispatch_triage(workspace_id);

create index if not exists agent_execution_failed_dispatch_triage_outcome_idx
  on public.agent_execution_failed_dispatch_triage(outcome_id);

create index if not exists agent_execution_failed_dispatch_triage_category_idx
  on public.agent_execution_failed_dispatch_triage(workspace_id, failure_category);

-- ─── agent_execution_correction_loops ────────────────────────────────────────

create table if not exists public.agent_execution_correction_loops (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid not null references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  correction_type text not null,
  correction_status text not null default 'created',
  correction_rationale text,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  correction_payload_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_correction_loops_workspace_idx
  on public.agent_execution_correction_loops(workspace_id);

create index if not exists agent_execution_correction_loops_outcome_idx
  on public.agent_execution_correction_loops(outcome_id);

create index if not exists agent_execution_correction_loops_status_idx
  on public.agent_execution_correction_loops(workspace_id, correction_status);

-- ─── agent_execution_outcome_events ──────────────────────────────────────────

create table if not exists public.agent_execution_outcome_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome_id uuid references public.agent_execution_outcomes(id) on delete cascade,
  execution_request_id uuid references public.agent_execution_requests(id) on delete set null,
  reconciliation_id uuid references public.agent_execution_outcome_reconciliations(id) on delete set null,
  comparison_id uuid references public.agent_execution_outcome_comparisons(id) on delete set null,
  human_review_id uuid references public.agent_execution_human_outcome_reviews(id) on delete set null,
  correction_loop_id uuid references public.agent_execution_correction_loops(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_outcome_events_workspace_idx
  on public.agent_execution_outcome_events(workspace_id);

create index if not exists agent_execution_outcome_events_outcome_idx
  on public.agent_execution_outcome_events(outcome_id);

create index if not exists agent_execution_outcome_events_type_idx
  on public.agent_execution_outcome_events(workspace_id, event_type);

create index if not exists agent_execution_outcome_events_created_idx
  on public.agent_execution_outcome_events(workspace_id, created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.agent_execution_outcomes enable row level security;
alter table public.agent_execution_outcome_reconciliations enable row level security;
alter table public.agent_execution_outcome_comparisons enable row level security;
alter table public.agent_execution_evidence_completeness enable row level security;
alter table public.agent_execution_outcome_confidence enable row level security;
alter table public.agent_execution_human_outcome_reviews enable row level security;
alter table public.agent_execution_failed_dispatch_triage enable row level security;
alter table public.agent_execution_correction_loops enable row level security;
alter table public.agent_execution_outcome_events enable row level security;

-- agent_execution_outcomes policies
create policy "workspace_members_read_execution_outcomes"
  on public.agent_execution_outcomes for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcomes.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_execution_outcomes"
  on public.agent_execution_outcomes for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcomes.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_execution_outcomes"
  on public.agent_execution_outcomes for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcomes.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_outcome_reconciliations policies
create policy "workspace_members_read_outcome_reconciliations"
  on public.agent_execution_outcome_reconciliations for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_reconciliations.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_outcome_reconciliations"
  on public.agent_execution_outcome_reconciliations for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_reconciliations.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_outcome_comparisons policies
create policy "workspace_members_read_outcome_comparisons"
  on public.agent_execution_outcome_comparisons for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_comparisons.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_outcome_comparisons"
  on public.agent_execution_outcome_comparisons for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_comparisons.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_evidence_completeness policies
create policy "workspace_members_read_evidence_completeness"
  on public.agent_execution_evidence_completeness for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_evidence_completeness.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_evidence_completeness"
  on public.agent_execution_evidence_completeness for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_evidence_completeness.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_outcome_confidence policies
create policy "workspace_members_read_outcome_confidence"
  on public.agent_execution_outcome_confidence for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_confidence.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_outcome_confidence"
  on public.agent_execution_outcome_confidence for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_confidence.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_human_outcome_reviews policies
create policy "workspace_members_read_human_outcome_reviews"
  on public.agent_execution_human_outcome_reviews for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_human_outcome_reviews.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_human_outcome_reviews"
  on public.agent_execution_human_outcome_reviews for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_human_outcome_reviews.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_human_outcome_reviews"
  on public.agent_execution_human_outcome_reviews for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_human_outcome_reviews.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_failed_dispatch_triage policies
create policy "workspace_members_read_failed_dispatch_triage"
  on public.agent_execution_failed_dispatch_triage for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_failed_dispatch_triage.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_failed_dispatch_triage"
  on public.agent_execution_failed_dispatch_triage for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_failed_dispatch_triage.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_correction_loops policies
create policy "workspace_members_read_correction_loops"
  on public.agent_execution_correction_loops for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_correction_loops.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_correction_loops"
  on public.agent_execution_correction_loops for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_correction_loops.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_correction_loops"
  on public.agent_execution_correction_loops for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_correction_loops.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_outcome_events policies
create policy "workspace_members_read_outcome_events"
  on public.agent_execution_outcome_events for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_events.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_outcome_events"
  on public.agent_execution_outcome_events for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_outcome_events.workspace_id
      and wm.user_id = auth.uid()
  ));
