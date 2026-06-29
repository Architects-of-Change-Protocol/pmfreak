-- ─────────────────────────────────────────────────────────────────────────────
-- PMO Governance Proposal Review & Controlled Policy Change Backlog
-- Migration: 20260808000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, free text rationale, or blocked identifiers.
-- Does NOT mutate policies, routing, or scoring values.
-- Does NOT apply policy changes — creates backlog/draft/simulation records only.
-- Draft policies are NOT live policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_pmo_policy_backlog_items ──────────────────────────────────────────

create table if not exists public.agent_pmo_policy_backlog_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_proposal_id uuid references public.agent_pmo_policy_proposals(id) on delete set null,
  item_type text not null,
  item_category text not null default '',
  priority text not null default 'normal',
  status text not null default 'created',
  title text not null,
  description text not null default '',
  source_signal_count integer not null default 0,
  source_feedback_ids_json jsonb not null default '[]'::jsonb,
  source_signal_ids_json jsonb not null default '[]'::jsonb,
  related_adapter_keys_json jsonb not null default '[]'::jsonb,
  estimated_impact_level text not null default 'low',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_backlog_items enable row level security;

create policy "workspace members can read policy backlog items"
  on public.agent_pmo_policy_backlog_items for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_backlog_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_backlog_items_workspace_idx
  on public.agent_pmo_policy_backlog_items(workspace_id);

create index if not exists agent_pmo_policy_backlog_items_status_idx
  on public.agent_pmo_policy_backlog_items(workspace_id, status);

create index if not exists agent_pmo_policy_backlog_items_priority_idx
  on public.agent_pmo_policy_backlog_items(workspace_id, priority);

create index if not exists agent_pmo_policy_backlog_items_created_idx
  on public.agent_pmo_policy_backlog_items(workspace_id, created_at desc);

-- ─── agent_pmo_policy_change_requests ────────────────────────────────────────

create table if not exists public.agent_pmo_policy_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  backlog_item_id uuid not null references public.agent_pmo_policy_backlog_items(id) on delete cascade,
  status text not null default 'draft',
  policy_area text not null,
  change_summary text not null default '',
  change_rationale text not null default '',
  estimated_impact_level text not null default 'low',
  simulation_count integer not null default 0,
  approval_workflow_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_change_requests enable row level security;

create policy "workspace members can read policy change requests"
  on public.agent_pmo_policy_change_requests for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_change_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_change_requests_workspace_idx
  on public.agent_pmo_policy_change_requests(workspace_id);

create index if not exists agent_pmo_policy_change_requests_backlog_item_idx
  on public.agent_pmo_policy_change_requests(workspace_id, backlog_item_id);

create index if not exists agent_pmo_policy_change_requests_status_idx
  on public.agent_pmo_policy_change_requests(workspace_id, status);

-- ─── agent_pmo_policy_change_scopes ──────────────────────────────────────────

create table if not exists public.agent_pmo_policy_change_scopes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  scope_type text not null,
  scope_description text not null default '',
  affected_policy_keys_json jsonb not null default '[]'::jsonb,
  affected_adapter_keys_json jsonb not null default '[]'::jsonb,
  estimated_records_affected integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_change_scopes enable row level security;

create policy "workspace members can read policy change scopes"
  on public.agent_pmo_policy_change_scopes for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_change_scopes.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_change_scopes_workspace_idx
  on public.agent_pmo_policy_change_scopes(workspace_id);

create index if not exists agent_pmo_policy_change_scopes_request_idx
  on public.agent_pmo_policy_change_scopes(change_request_id);

-- ─── agent_pmo_policy_simulations ────────────────────────────────────────────

create table if not exists public.agent_pmo_policy_simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  status text not null default 'created',
  simulation_label text not null default '',
  signal_count_used integer not null default 0,
  estimated_affected_count integer not null default 0,
  estimated_approval_rate_change numeric not null default 0,
  estimated_rejection_rate_change numeric not null default 0,
  estimated_review_volume_change numeric not null default 0,
  impact_level text not null default 'none',
  safe_simulation_summary text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_simulations enable row level security;

create policy "workspace members can read policy simulations"
  on public.agent_pmo_policy_simulations for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_simulations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_simulations_workspace_idx
  on public.agent_pmo_policy_simulations(workspace_id);

create index if not exists agent_pmo_policy_simulations_request_idx
  on public.agent_pmo_policy_simulations(change_request_id);

create index if not exists agent_pmo_policy_simulations_status_idx
  on public.agent_pmo_policy_simulations(workspace_id, status);

-- ─── agent_pmo_policy_impact_previews ────────────────────────────────────────

create table if not exists public.agent_pmo_policy_impact_previews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  simulation_id uuid references public.agent_pmo_policy_simulations(id) on delete set null,
  impact_level text not null default 'none',
  affected_area_count integer not null default 0,
  estimated_signal_count integer not null default 0,
  deterministic_summary text not null default '',
  safe_impact_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_impact_previews enable row level security;

create policy "workspace members can read policy impact previews"
  on public.agent_pmo_policy_impact_previews for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_impact_previews.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_impact_previews_workspace_idx
  on public.agent_pmo_policy_impact_previews(workspace_id);

create index if not exists agent_pmo_policy_impact_previews_request_idx
  on public.agent_pmo_policy_impact_previews(change_request_id);

-- ─── agent_pmo_governance_policy_drafts ──────────────────────────────────────

create table if not exists public.agent_pmo_governance_policy_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  draft_type text not null,
  draft_status text not null default 'created',
  draft_version integer not null default 1,
  draft_title text not null default '',
  draft_summary text not null default '',
  is_live_policy boolean not null default false,
  approval_workflow_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_governance_policy_drafts enable row level security;

create policy "workspace members can read governance policy drafts"
  on public.agent_pmo_governance_policy_drafts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_governance_policy_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_governance_policy_drafts_workspace_idx
  on public.agent_pmo_governance_policy_drafts(workspace_id);

create index if not exists agent_pmo_governance_policy_drafts_request_idx
  on public.agent_pmo_governance_policy_drafts(change_request_id);

create index if not exists agent_pmo_governance_policy_drafts_status_idx
  on public.agent_pmo_governance_policy_drafts(workspace_id, draft_status);

-- ─── agent_pmo_policy_approval_workflows ─────────────────────────────────────

create table if not exists public.agent_pmo_policy_approval_workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  current_stage text not null default 'pmo_review',
  overall_status text not null default 'not_started',
  required_stages_json jsonb not null default '[]'::jsonb,
  completed_stages_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_approval_workflows enable row level security;

create policy "workspace members can read policy approval workflows"
  on public.agent_pmo_policy_approval_workflows for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_approval_workflows.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_approval_workflows_workspace_idx
  on public.agent_pmo_policy_approval_workflows(workspace_id);

create index if not exists agent_pmo_policy_approval_workflows_request_idx
  on public.agent_pmo_policy_approval_workflows(change_request_id);

-- ─── agent_pmo_policy_approval_decisions ─────────────────────────────────────

create table if not exists public.agent_pmo_policy_approval_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id uuid not null references public.agent_pmo_policy_approval_workflows(id) on delete cascade,
  stage text not null,
  decision_type text not null,
  status text not null,
  decided_by uuid references auth.users(id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_approval_decisions enable row level security;

create policy "workspace members can read policy approval decisions"
  on public.agent_pmo_policy_approval_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_approval_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_approval_decisions_workspace_idx
  on public.agent_pmo_policy_approval_decisions(workspace_id);

create index if not exists agent_pmo_policy_approval_decisions_workflow_idx
  on public.agent_pmo_policy_approval_decisions(workflow_id);

-- ─── agent_pmo_policy_implementation_readiness ───────────────────────────────

create table if not exists public.agent_pmo_policy_implementation_readiness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  readiness_status text not null default 'not_ready',
  simulation_completed boolean not null default false,
  approval_completed boolean not null default false,
  rollback_plan_present boolean not null default false,
  blocked_reasons_json jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_implementation_readiness enable row level security;

create policy "workspace members can read policy implementation readiness"
  on public.agent_pmo_policy_implementation_readiness for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_implementation_readiness.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_implementation_readiness_workspace_idx
  on public.agent_pmo_policy_implementation_readiness(workspace_id);

create index if not exists agent_pmo_policy_implementation_readiness_request_idx
  on public.agent_pmo_policy_implementation_readiness(change_request_id);

-- ─── agent_pmo_policy_rollback_plans ─────────────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null references public.agent_pmo_policy_change_requests(id) on delete cascade,
  plan_type text not null,
  plan_status text not null default 'created',
  plan_description text not null default '',
  affected_policy_keys_json jsonb not null default '[]'::jsonb,
  estimated_rollback_minutes integer not null default 30,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_plans enable row level security;

create policy "workspace members can read policy rollback plans"
  on public.agent_pmo_policy_rollback_plans for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_plans.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_rollback_plans_workspace_idx
  on public.agent_pmo_policy_rollback_plans(workspace_id);

create index if not exists agent_pmo_policy_rollback_plans_request_idx
  on public.agent_pmo_policy_rollback_plans(change_request_id);

-- ─── agent_pmo_policy_backlog_events ─────────────────────────────────────────

create table if not exists public.agent_pmo_policy_backlog_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  backlog_item_id uuid references public.agent_pmo_policy_backlog_items(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  simulation_id uuid references public.agent_pmo_policy_simulations(id) on delete set null,
  draft_id uuid references public.agent_pmo_governance_policy_drafts(id) on delete set null,
  workflow_id uuid references public.agent_pmo_policy_approval_workflows(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_backlog_events enable row level security;

create policy "workspace members can read policy backlog events"
  on public.agent_pmo_policy_backlog_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_backlog_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_backlog_events_workspace_idx
  on public.agent_pmo_policy_backlog_events(workspace_id);

create index if not exists agent_pmo_policy_backlog_events_type_idx
  on public.agent_pmo_policy_backlog_events(workspace_id, event_type);

create index if not exists agent_pmo_policy_backlog_events_created_idx
  on public.agent_pmo_policy_backlog_events(workspace_id, created_at desc);

create index if not exists agent_pmo_policy_backlog_events_request_idx
  on public.agent_pmo_policy_backlog_events(change_request_id);
