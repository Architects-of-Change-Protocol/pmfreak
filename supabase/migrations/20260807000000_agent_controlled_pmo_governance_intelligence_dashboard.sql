-- ─────────────────────────────────────────────────────────────────────────────
-- Controlled PMO Governance Intelligence Dashboard
-- Migration: 20260807000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, free text rationale, or identifiers.
-- Does NOT mutate policies, routing, or scoring values.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_pmo_governance_dashboard_snapshots ─────────────────────────────────

create table if not exists public.agent_pmo_governance_dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'created',
  total_signals integer not null default 0,
  active_signals integer not null default 0,
  governance_feedback_count integer not null default 0,
  risk_calibration_count integer not null default 0,
  evidence_quality_count integer not null default 0,
  adapter_performance_count integer not null default 0,
  review_routing_count integer not null default 0,
  feedback_queue_pending_count integer not null default 0,
  policy_proposal_draft_count integer not null default 0,
  policy_proposal_under_review_count integer not null default 0,
  report_export_count integer not null default 0,
  snapshot_meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_governance_dashboard_snapshots_workspace_idx
  on public.agent_pmo_governance_dashboard_snapshots(workspace_id);

create index if not exists agent_pmo_governance_dashboard_snapshots_created_idx
  on public.agent_pmo_governance_dashboard_snapshots(workspace_id, created_at desc);

-- ─── agent_pmo_governance_insight_cards ──────────────────────────────────────

create table if not exists public.agent_pmo_governance_insight_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  card_type text not null,
  severity text not null default 'info',
  status text not null default 'open',
  actionability text not null default 'informational',
  trend_direction text not null default 'stable',
  title text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  source_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pmo_governance_insight_cards_workspace_idx
  on public.agent_pmo_governance_insight_cards(workspace_id);

create index if not exists agent_pmo_governance_insight_cards_type_idx
  on public.agent_pmo_governance_insight_cards(workspace_id, card_type);

create index if not exists agent_pmo_governance_insight_cards_severity_idx
  on public.agent_pmo_governance_insight_cards(workspace_id, severity);

create index if not exists agent_pmo_governance_insight_cards_status_idx
  on public.agent_pmo_governance_insight_cards(workspace_id, status);

-- ─── agent_pmo_risk_calibration_insights ─────────────────────────────────────

create table if not exists public.agent_pmo_risk_calibration_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  total_risk_signals integer not null default 0,
  underestimated_count integer not null default 0,
  overestimated_count integer not null default 0,
  aligned_count integer not null default 0,
  unknown_count integer not null default 0,
  trend_direction text not null default 'stable',
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_risk_calibration_insights_workspace_idx
  on public.agent_pmo_risk_calibration_insights(workspace_id);

create index if not exists agent_pmo_risk_calibration_insights_created_idx
  on public.agent_pmo_risk_calibration_insights(workspace_id, created_at desc);

-- ─── agent_pmo_evidence_quality_insights ─────────────────────────────────────

create table if not exists public.agent_pmo_evidence_quality_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  total_evidence_signals integer not null default 0,
  missing_count integer not null default 0,
  complete_count integer not null default 0,
  trend_direction text not null default 'stable',
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_evidence_quality_insights_workspace_idx
  on public.agent_pmo_evidence_quality_insights(workspace_id);

create index if not exists agent_pmo_evidence_quality_insights_created_idx
  on public.agent_pmo_evidence_quality_insights(workspace_id, created_at desc);

-- ─── agent_pmo_adapter_performance_insights ──────────────────────────────────

create table if not exists public.agent_pmo_adapter_performance_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  adapter_key text not null,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  correction_count integer not null default 0,
  trend_direction text not null default 'stable',
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_adapter_performance_insights_workspace_idx
  on public.agent_pmo_adapter_performance_insights(workspace_id);

create index if not exists agent_pmo_adapter_performance_insights_adapter_idx
  on public.agent_pmo_adapter_performance_insights(workspace_id, adapter_key);

create index if not exists agent_pmo_adapter_performance_insights_created_idx
  on public.agent_pmo_adapter_performance_insights(workspace_id, created_at desc);

-- ─── agent_pmo_review_routing_insights ───────────────────────────────────────

create table if not exists public.agent_pmo_review_routing_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  total_routing_signals integer not null default 0,
  effective_count integer not null default 0,
  ineffective_count integer not null default 0,
  trend_direction text not null default 'stable',
  severity text not null default 'info',
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_review_routing_insights_workspace_idx
  on public.agent_pmo_review_routing_insights(workspace_id);

create index if not exists agent_pmo_review_routing_insights_created_idx
  on public.agent_pmo_review_routing_insights(workspace_id, created_at desc);

-- ─── agent_pmo_governance_feedback_queue ─────────────────────────────────────

create table if not exists public.agent_pmo_governance_feedback_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feedback_id uuid not null,
  feedback_type text not null,
  feedback_category text not null,
  feedback_severity text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pmo_governance_feedback_queue_workspace_idx
  on public.agent_pmo_governance_feedback_queue(workspace_id);

create index if not exists agent_pmo_governance_feedback_queue_status_idx
  on public.agent_pmo_governance_feedback_queue(workspace_id, status);

create index if not exists agent_pmo_governance_feedback_queue_feedback_idx
  on public.agent_pmo_governance_feedback_queue(feedback_id);

-- ─── agent_pmo_policy_proposals ──────────────────────────────────────────────

create table if not exists public.agent_pmo_policy_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_type text not null,
  status text not null default 'draft',
  title text not null,
  rationale text not null,
  source_type text not null,
  source_ids_json jsonb not null default '[]'::jsonb,
  proposed_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  decision text,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pmo_policy_proposals_workspace_idx
  on public.agent_pmo_policy_proposals(workspace_id);

create index if not exists agent_pmo_policy_proposals_status_idx
  on public.agent_pmo_policy_proposals(workspace_id, status);

create index if not exists agent_pmo_policy_proposals_type_idx
  on public.agent_pmo_policy_proposals(workspace_id, proposal_type);

create index if not exists agent_pmo_policy_proposals_created_idx
  on public.agent_pmo_policy_proposals(workspace_id, created_at desc);

-- ─── agent_pmo_governance_report_exports ─────────────────────────────────────

create table if not exists public.agent_pmo_governance_report_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  format text not null,
  status text not null default 'created',
  safe_report_json jsonb,
  blocked_reasons_json jsonb not null default '[]'::jsonb,
  download_count integer not null default 0,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_pmo_governance_report_exports_workspace_idx
  on public.agent_pmo_governance_report_exports(workspace_id);

create index if not exists agent_pmo_governance_report_exports_status_idx
  on public.agent_pmo_governance_report_exports(workspace_id, status);

create index if not exists agent_pmo_governance_report_exports_created_idx
  on public.agent_pmo_governance_report_exports(workspace_id, created_at desc);

-- ─── agent_pmo_governance_dashboard_events ───────────────────────────────────

create table if not exists public.agent_pmo_governance_dashboard_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  snapshot_id uuid references public.agent_pmo_governance_dashboard_snapshots(id) on delete set null,
  card_id uuid references public.agent_pmo_governance_insight_cards(id) on delete set null,
  proposal_id uuid references public.agent_pmo_policy_proposals(id) on delete set null,
  export_id uuid references public.agent_pmo_governance_report_exports(id) on delete set null,
  event_type text not null,
  message text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_pmo_governance_dashboard_events_workspace_idx
  on public.agent_pmo_governance_dashboard_events(workspace_id);

create index if not exists agent_pmo_governance_dashboard_events_type_idx
  on public.agent_pmo_governance_dashboard_events(workspace_id, event_type);

create index if not exists agent_pmo_governance_dashboard_events_created_idx
  on public.agent_pmo_governance_dashboard_events(workspace_id, created_at desc);

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.agent_pmo_governance_dashboard_snapshots enable row level security;
alter table public.agent_pmo_governance_insight_cards enable row level security;
alter table public.agent_pmo_risk_calibration_insights enable row level security;
alter table public.agent_pmo_evidence_quality_insights enable row level security;
alter table public.agent_pmo_adapter_performance_insights enable row level security;
alter table public.agent_pmo_review_routing_insights enable row level security;
alter table public.agent_pmo_governance_feedback_queue enable row level security;
alter table public.agent_pmo_policy_proposals enable row level security;
alter table public.agent_pmo_governance_report_exports enable row level security;
alter table public.agent_pmo_governance_dashboard_events enable row level security;

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

-- agent_pmo_governance_dashboard_snapshots
create policy "workspace_members_read_pmo_governance_dashboard_snapshots"
  on public.agent_pmo_governance_dashboard_snapshots for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_dashboard_snapshots.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_governance_dashboard_snapshots"
  on public.agent_pmo_governance_dashboard_snapshots for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_dashboard_snapshots.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_governance_insight_cards
create policy "workspace_members_read_pmo_governance_insight_cards"
  on public.agent_pmo_governance_insight_cards for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_insight_cards.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_governance_insight_cards"
  on public.agent_pmo_governance_insight_cards for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_insight_cards.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_pmo_governance_insight_cards"
  on public.agent_pmo_governance_insight_cards for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_insight_cards.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_risk_calibration_insights
create policy "workspace_members_read_pmo_risk_calibration_insights"
  on public.agent_pmo_risk_calibration_insights for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_risk_calibration_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_risk_calibration_insights"
  on public.agent_pmo_risk_calibration_insights for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_risk_calibration_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_evidence_quality_insights
create policy "workspace_members_read_pmo_evidence_quality_insights"
  on public.agent_pmo_evidence_quality_insights for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_evidence_quality_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_evidence_quality_insights"
  on public.agent_pmo_evidence_quality_insights for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_evidence_quality_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_adapter_performance_insights
create policy "workspace_members_read_pmo_adapter_performance_insights"
  on public.agent_pmo_adapter_performance_insights for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_adapter_performance_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_adapter_performance_insights"
  on public.agent_pmo_adapter_performance_insights for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_adapter_performance_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_review_routing_insights
create policy "workspace_members_read_pmo_review_routing_insights"
  on public.agent_pmo_review_routing_insights for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_review_routing_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_review_routing_insights"
  on public.agent_pmo_review_routing_insights for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_review_routing_insights.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_governance_feedback_queue
create policy "workspace_members_read_pmo_governance_feedback_queue"
  on public.agent_pmo_governance_feedback_queue for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_feedback_queue.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_governance_feedback_queue"
  on public.agent_pmo_governance_feedback_queue for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_feedback_queue.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_pmo_governance_feedback_queue"
  on public.agent_pmo_governance_feedback_queue for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_feedback_queue.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_policy_proposals
create policy "workspace_members_read_pmo_policy_proposals"
  on public.agent_pmo_policy_proposals for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_policy_proposals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_policy_proposals"
  on public.agent_pmo_policy_proposals for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_policy_proposals.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_pmo_policy_proposals"
  on public.agent_pmo_policy_proposals for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_policy_proposals.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_governance_report_exports
create policy "workspace_members_read_pmo_governance_report_exports"
  on public.agent_pmo_governance_report_exports for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_report_exports.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_governance_report_exports"
  on public.agent_pmo_governance_report_exports for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_report_exports.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_update_pmo_governance_report_exports"
  on public.agent_pmo_governance_report_exports for update
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_report_exports.workspace_id
      and wm.user_id = auth.uid()
  ));

-- agent_pmo_governance_dashboard_events
create policy "workspace_members_read_pmo_governance_dashboard_events"
  on public.agent_pmo_governance_dashboard_events for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_dashboard_events.workspace_id
      and wm.user_id = auth.uid()
  ));

create policy "workspace_members_insert_pmo_governance_dashboard_events"
  on public.agent_pmo_governance_dashboard_events for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = agent_pmo_governance_dashboard_events.workspace_id
      and wm.user_id = auth.uid()
  ));
