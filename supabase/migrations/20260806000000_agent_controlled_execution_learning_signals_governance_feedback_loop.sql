-- ─────────────────────────────────────────────────────────────────────────────
-- Controlled Execution Learning Signals & Governance Feedback Loop
-- Migration: 20260806000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, free text rationale, or identifiers in signals.
-- Does NOT mutate policies, routing, or scoring values.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_execution_learning_signals ────────────────────────────────────────

create table if not exists public.agent_execution_learning_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  outcome_id uuid references public.agent_execution_outcomes(id) on delete set null,
  review_id uuid references public.agent_execution_human_outcome_reviews(id) on delete set null,
  decision_id uuid references public.agent_execution_human_outcome_reviews(id) on delete set null,
  dispatch_attempt_id uuid references public.agent_execution_dispatch_attempts(id) on delete set null,
  adapter_key text,
  tool_key text,
  action_type text,
  signal_type text not null,
  signal_category text not null,
  signal_value text not null,
  signal_weight integer not null default 50,
  confidence_score integer not null default 40,
  privacy_classification text not null default 'safe',
  retention_class text not null default 'signal_only',
  status text not null default 'active',
  signal_payload_json jsonb,
  safe_signal_payload_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_learning_signals_workspace_idx
  on public.agent_execution_learning_signals(workspace_id);

create index if not exists agent_execution_learning_signals_source_idx
  on public.agent_execution_learning_signals(workspace_id, source_type, source_id);

create index if not exists agent_execution_learning_signals_status_idx
  on public.agent_execution_learning_signals(workspace_id, status);

create index if not exists agent_execution_learning_signals_type_idx
  on public.agent_execution_learning_signals(workspace_id, signal_type);

create index if not exists agent_execution_learning_signals_category_idx
  on public.agent_execution_learning_signals(workspace_id, signal_category);

create index if not exists agent_execution_learning_signals_outcome_idx
  on public.agent_execution_learning_signals(outcome_id);

create index if not exists agent_execution_learning_signals_created_idx
  on public.agent_execution_learning_signals(workspace_id, created_at desc);

-- ─── agent_execution_learning_extractions ────────────────────────────────────

create table if not exists public.agent_execution_learning_extractions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  status text not null default 'created',
  signals_extracted integer not null default 0,
  signals_skipped integer not null default 0,
  privacy_passed integer not null default 0,
  privacy_blocked integer not null default 0,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_learning_extractions_workspace_idx
  on public.agent_execution_learning_extractions(workspace_id);

create index if not exists agent_execution_learning_extractions_source_idx
  on public.agent_execution_learning_extractions(workspace_id, source_type, source_id);

create index if not exists agent_execution_learning_extractions_status_idx
  on public.agent_execution_learning_extractions(workspace_id, status);

-- ─── agent_execution_learning_privacy_filters ────────────────────────────────

create table if not exists public.agent_execution_learning_privacy_filters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  candidate_signal_type text not null,
  contains_raw_payload boolean not null default false,
  contains_free_text boolean not null default false,
  contains_sensitive_key boolean not null default false,
  contains_customer_identifier boolean not null default false,
  contains_project_identifier boolean not null default false,
  safe_to_store boolean not null default true,
  redaction_applied boolean not null default false,
  privacy_classification text not null default 'unknown',
  retention_class text not null default 'signal_only',
  filter_reasons_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_learning_privacy_filters_workspace_idx
  on public.agent_execution_learning_privacy_filters(workspace_id);

create index if not exists agent_execution_learning_privacy_filters_source_idx
  on public.agent_execution_learning_privacy_filters(workspace_id, source_type, source_id);

-- ─── agent_execution_governance_feedback ─────────────────────────────────────

create table if not exists public.agent_execution_governance_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feedback_type text not null,
  feedback_category text not null,
  severity text not null default 'info',
  status text not null default 'created',
  recommendation text not null,
  confidence_score integer not null default 40,
  source_signal_ids_json jsonb not null default '[]'::jsonb,
  owner_role text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_governance_feedback_workspace_idx
  on public.agent_execution_governance_feedback(workspace_id);

create index if not exists agent_execution_governance_feedback_status_idx
  on public.agent_execution_governance_feedback(workspace_id, status);

create index if not exists agent_execution_governance_feedback_type_idx
  on public.agent_execution_governance_feedback(workspace_id, feedback_type);

create index if not exists agent_execution_governance_feedback_created_idx
  on public.agent_execution_governance_feedback(workspace_id, created_at desc);

-- ─── agent_execution_risk_calibration_signals ────────────────────────────────

create table if not exists public.agent_execution_risk_calibration_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_signal_id uuid references public.agent_execution_learning_signals(id) on delete set null,
  outcome_id uuid references public.agent_execution_outcomes(id) on delete set null,
  action_type text,
  adapter_key text,
  original_risk_level text,
  observed_risk_level text,
  human_decision_type text,
  calibration_direction text not null default 'unknown',
  confidence_score integer not null default 40,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_risk_calibration_signals_workspace_idx
  on public.agent_execution_risk_calibration_signals(workspace_id);

create index if not exists agent_execution_risk_calibration_signals_direction_idx
  on public.agent_execution_risk_calibration_signals(workspace_id, calibration_direction);

-- ─── agent_execution_evidence_quality_signals ────────────────────────────────

create table if not exists public.agent_execution_evidence_quality_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_signal_id uuid references public.agent_execution_learning_signals(id) on delete set null,
  action_type text,
  adapter_key text,
  required_evidence_type text,
  available_evidence_type text,
  missing_evidence_type text,
  evidence_completeness_level text,
  frequency integer not null default 1,
  trend_direction text not null default 'insufficient_data',
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_evidence_quality_signals_workspace_idx
  on public.agent_execution_evidence_quality_signals(workspace_id);

-- ─── agent_execution_adapter_performance_signals ─────────────────────────────

create table if not exists public.agent_execution_adapter_performance_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  adapter_key text not null,
  tool_key text,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  missing_evidence_count integer not null default 0,
  correction_count integer not null default 0,
  retry_recommendation_count integer not null default 0,
  human_acceptance_count integer not null default 0,
  human_rejection_count integer not null default 0,
  low_confidence_count integer not null default 0,
  medium_confidence_count integer not null default 0,
  high_confidence_count integer not null default 0,
  trend_direction text not null default 'insufficient_data',
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_adapter_performance_signals_workspace_idx
  on public.agent_execution_adapter_performance_signals(workspace_id);

create index if not exists agent_execution_adapter_performance_signals_adapter_idx
  on public.agent_execution_adapter_performance_signals(workspace_id, adapter_key);

-- ─── agent_execution_review_decision_patterns ────────────────────────────────

create table if not exists public.agent_execution_review_decision_patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  decision_type text not null,
  review_requirement text,
  risk_level text,
  action_type text,
  adapter_key text,
  confidence_level text,
  evidence_completeness_level text,
  count integer not null default 1,
  trend_direction text not null default 'insufficient_data',
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_review_decision_patterns_workspace_idx
  on public.agent_execution_review_decision_patterns(workspace_id);

create index if not exists agent_execution_review_decision_patterns_type_idx
  on public.agent_execution_review_decision_patterns(workspace_id, decision_type);

-- ─── agent_execution_review_routing_feedback ─────────────────────────────────

create table if not exists public.agent_execution_review_routing_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assigned_role text,
  assigned_to uuid references auth.users(id) on delete set null,
  review_priority text,
  decision_type text,
  route_effectiveness text not null default 'unknown',
  suggested_route_adjustment text,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_review_routing_feedback_workspace_idx
  on public.agent_execution_review_routing_feedback(workspace_id);

-- ─── agent_execution_workspace_learning_summaries ────────────────────────────

create table if not exists public.agent_execution_workspace_learning_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_signals integer not null default 0,
  governance_feedback_count integer not null default 0,
  risk_calibration_count integer not null default 0,
  evidence_quality_count integer not null default 0,
  adapter_performance_count integer not null default 0,
  review_pattern_count integer not null default 0,
  top_signals_json jsonb not null default '{}'::jsonb,
  recommendations_json jsonb not null default '{}'::jsonb,
  confidence_score integer not null default 40,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_workspace_learning_summaries_workspace_idx
  on public.agent_execution_workspace_learning_summaries(workspace_id);

create index if not exists agent_execution_workspace_learning_summaries_period_idx
  on public.agent_execution_workspace_learning_summaries(workspace_id, period_start, period_end);

-- ─── agent_execution_aggregate_learning_signals ──────────────────────────────

create table if not exists public.agent_execution_aggregate_learning_signals (
  id uuid primary key default gen_random_uuid(),
  aggregate_scope text not null default 'workspace',
  workspace_id uuid references public.workspaces(id) on delete cascade,
  signal_type text not null,
  signal_category text not null,
  count integer not null default 0,
  threshold_met boolean not null default false,
  privacy_safe boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_aggregate_learning_signals_workspace_idx
  on public.agent_execution_aggregate_learning_signals(workspace_id);

create index if not exists agent_execution_aggregate_learning_signals_type_idx
  on public.agent_execution_aggregate_learning_signals(signal_type, signal_category);

-- ─── agent_execution_learning_events ─────────────────────────────────────────

create table if not exists public.agent_execution_learning_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  signal_id uuid references public.agent_execution_learning_signals(id) on delete set null,
  extraction_id uuid references public.agent_execution_learning_extractions(id) on delete set null,
  feedback_id uuid references public.agent_execution_governance_feedback(id) on delete set null,
  source_type text,
  source_id text,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_learning_events_workspace_idx
  on public.agent_execution_learning_events(workspace_id);

create index if not exists agent_execution_learning_events_signal_idx
  on public.agent_execution_learning_events(signal_id);

create index if not exists agent_execution_learning_events_extraction_idx
  on public.agent_execution_learning_events(extraction_id);

create index if not exists agent_execution_learning_events_feedback_idx
  on public.agent_execution_learning_events(feedback_id);

create index if not exists agent_execution_learning_events_type_idx
  on public.agent_execution_learning_events(workspace_id, event_type);

create index if not exists agent_execution_learning_events_created_idx
  on public.agent_execution_learning_events(workspace_id, created_at desc);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.agent_execution_learning_signals enable row level security;
alter table public.agent_execution_learning_extractions enable row level security;
alter table public.agent_execution_learning_privacy_filters enable row level security;
alter table public.agent_execution_governance_feedback enable row level security;
alter table public.agent_execution_risk_calibration_signals enable row level security;
alter table public.agent_execution_evidence_quality_signals enable row level security;
alter table public.agent_execution_adapter_performance_signals enable row level security;
alter table public.agent_execution_review_decision_patterns enable row level security;
alter table public.agent_execution_review_routing_feedback enable row level security;
alter table public.agent_execution_workspace_learning_summaries enable row level security;
alter table public.agent_execution_aggregate_learning_signals enable row level security;
alter table public.agent_execution_learning_events enable row level security;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- agent_execution_learning_signals
create policy "workspace_members_read_learning_signals"
  on public.agent_execution_learning_signals for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_learning_signals"
  on public.agent_execution_learning_signals for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_learning_signals"
  on public.agent_execution_learning_signals for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_learning_extractions
create policy "workspace_members_read_learning_extractions"
  on public.agent_execution_learning_extractions for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_extractions.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_learning_extractions"
  on public.agent_execution_learning_extractions for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_extractions.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_learning_extractions"
  on public.agent_execution_learning_extractions for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_extractions.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_learning_privacy_filters
create policy "workspace_members_read_learning_privacy_filters"
  on public.agent_execution_learning_privacy_filters for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_privacy_filters.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_learning_privacy_filters"
  on public.agent_execution_learning_privacy_filters for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_learning_privacy_filters.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_governance_feedback
create policy "workspace_members_read_governance_feedback"
  on public.agent_execution_governance_feedback for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_governance_feedback.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_governance_feedback"
  on public.agent_execution_governance_feedback for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_governance_feedback.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_governance_feedback"
  on public.agent_execution_governance_feedback for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_governance_feedback.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_risk_calibration_signals
create policy "workspace_members_read_risk_calibration_signals"
  on public.agent_execution_risk_calibration_signals for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_risk_calibration_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_risk_calibration_signals"
  on public.agent_execution_risk_calibration_signals for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_risk_calibration_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_evidence_quality_signals
create policy "workspace_members_read_evidence_quality_signals"
  on public.agent_execution_evidence_quality_signals for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_evidence_quality_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_evidence_quality_signals"
  on public.agent_execution_evidence_quality_signals for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_evidence_quality_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_adapter_performance_signals
create policy "workspace_members_read_adapter_performance_signals"
  on public.agent_execution_adapter_performance_signals for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_adapter_performance_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_adapter_performance_signals"
  on public.agent_execution_adapter_performance_signals for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_adapter_performance_signals.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_review_decision_patterns
create policy "workspace_members_read_review_decision_patterns"
  on public.agent_execution_review_decision_patterns for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_review_decision_patterns.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_review_decision_patterns"
  on public.agent_execution_review_decision_patterns for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_review_decision_patterns.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_review_routing_feedback
create policy "workspace_members_read_review_routing_feedback"
  on public.agent_execution_review_routing_feedback for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_review_routing_feedback.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_review_routing_feedback"
  on public.agent_execution_review_routing_feedback for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_review_routing_feedback.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_workspace_learning_summaries
create policy "workspace_members_read_workspace_learning_summaries"
  on public.agent_execution_workspace_learning_summaries for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_workspace_learning_summaries.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_workspace_learning_summaries"
  on public.agent_execution_workspace_learning_summaries for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_execution_workspace_learning_summaries.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_execution_aggregate_learning_signals
create policy "workspace_members_read_aggregate_learning_signals"
  on public.agent_execution_aggregate_learning_signals for select
  using (
    workspace_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_aggregate_learning_signals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_aggregate_learning_signals"
  on public.agent_execution_aggregate_learning_signals for insert
  with check (
    workspace_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_aggregate_learning_signals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_learning_events
create policy "workspace_members_read_learning_events"
  on public.agent_execution_learning_events for select
  using (
    workspace_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_learning_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_learning_events"
  on public.agent_execution_learning_events for insert
  with check (
    workspace_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_learning_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );
