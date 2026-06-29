-- ─── Agent Controlled Action Conversion & Approval Bridge ─────────────────────
-- Sprint: Controlled Action Conversion & Approval Bridge
-- This migration creates tables for the controlled bridge from human-accepted
-- action drafts to governed execution requests.
-- Does NOT execute actions, send communications, or create external side effects.

-- ─── agent_action_conversions ─────────────────────────────────────────────────

create table if not exists public.agent_action_conversions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action_draft_id uuid not null references public.agent_review_action_drafts(id) on delete cascade,
  review_item_id uuid references public.agent_review_items(id) on delete set null,
  review_decision_id uuid references public.agent_review_decisions(id) on delete set null,
  source_result_id uuid references public.agent_execution_results(id) on delete set null,
  source_evidence_id uuid references public.agent_execution_evidence_items(id) on delete set null,
  execution_request_id uuid references public.agent_execution_requests(id) on delete set null,
  approval_bridge_id uuid,
  action_type text not null,
  status text not null default 'created',
  readiness text not null default 'not_ready',
  risk_level text not null default 'medium',
  target_scope_type text,
  target_scope_id uuid,
  owner_id uuid references auth.users(id) on delete set null,
  owner_role text,
  approval_requirement text not null default 'not_required',
  execution_request_creation_status text not null default 'not_started',
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  conversion_payload_json jsonb,
  safe_conversion_payload_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_action_conversions_workspace_idx
  on public.agent_action_conversions(workspace_id);

create index if not exists agent_action_conversions_action_draft_idx
  on public.agent_action_conversions(action_draft_id);

create index if not exists agent_action_conversions_review_item_idx
  on public.agent_action_conversions(review_item_id);

create index if not exists agent_action_conversions_review_decision_idx
  on public.agent_action_conversions(review_decision_id);

create index if not exists agent_action_conversions_source_result_idx
  on public.agent_action_conversions(source_result_id);

create index if not exists agent_action_conversions_execution_request_idx
  on public.agent_action_conversions(execution_request_id);

create index if not exists agent_action_conversions_status_idx
  on public.agent_action_conversions(workspace_id, status);

create index if not exists agent_action_conversions_readiness_idx
  on public.agent_action_conversions(workspace_id, readiness);

create index if not exists agent_action_conversions_risk_idx
  on public.agent_action_conversions(workspace_id, risk_level);

create index if not exists agent_action_conversions_owner_idx
  on public.agent_action_conversions(workspace_id, owner_id);

create index if not exists agent_action_conversions_owner_role_idx
  on public.agent_action_conversions(workspace_id, owner_role);

create index if not exists agent_action_conversions_scope_idx
  on public.agent_action_conversions(workspace_id, target_scope_type, target_scope_id);

create index if not exists agent_action_conversions_created_idx
  on public.agent_action_conversions(workspace_id, created_at desc);

alter table public.agent_action_conversions enable row level security;

create policy "workspace_members_read_action_conversions"
  on public.agent_action_conversions
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_action_conversions"
  on public.agent_action_conversions
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_update_action_conversions"
  on public.agent_action_conversions
  for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- ─── agent_action_conversion_preflights ───────────────────────────────────────

create table if not exists public.agent_action_conversion_preflights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversion_id uuid not null references public.agent_action_conversions(id) on delete cascade,
  status text not null default 'not_run',
  readiness_score integer not null default 0,
  checks_json jsonb not null default '[]'::jsonb,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  approval_required boolean not null default false,
  approval_requirement text not null default 'not_required',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_action_conversion_preflights_workspace_idx
  on public.agent_action_conversion_preflights(workspace_id);

create index if not exists agent_action_conversion_preflights_conversion_idx
  on public.agent_action_conversion_preflights(conversion_id);

create index if not exists agent_action_conversion_preflights_status_idx
  on public.agent_action_conversion_preflights(workspace_id, status);

create index if not exists agent_action_conversion_preflights_approval_idx
  on public.agent_action_conversion_preflights(workspace_id, approval_required);

create index if not exists agent_action_conversion_preflights_created_idx
  on public.agent_action_conversion_preflights(workspace_id, created_at desc);

alter table public.agent_action_conversion_preflights enable row level security;

create policy "workspace_members_read_conversion_preflights"
  on public.agent_action_conversion_preflights
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_conversion_preflights"
  on public.agent_action_conversion_preflights
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- ─── agent_action_approval_bridges ────────────────────────────────────────────

create table if not exists public.agent_action_approval_bridges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversion_id uuid not null references public.agent_action_conversions(id) on delete cascade,
  action_draft_id uuid not null references public.agent_review_action_drafts(id) on delete cascade,
  approval_requirement text not null,
  status text not null default 'required',
  approval_policy_key text,
  required_approver_role text,
  required_approver_user_id uuid references auth.users(id) on delete set null,
  approval_request_id uuid,
  approval_reason text not null,
  risk_justification text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_action_approval_bridges_workspace_idx
  on public.agent_action_approval_bridges(workspace_id);

create index if not exists agent_action_approval_bridges_conversion_idx
  on public.agent_action_approval_bridges(conversion_id);

create index if not exists agent_action_approval_bridges_action_draft_idx
  on public.agent_action_approval_bridges(action_draft_id);

create index if not exists agent_action_approval_bridges_status_idx
  on public.agent_action_approval_bridges(workspace_id, status);

create index if not exists agent_action_approval_bridges_requirement_idx
  on public.agent_action_approval_bridges(workspace_id, approval_requirement);

create index if not exists agent_action_approval_bridges_policy_idx
  on public.agent_action_approval_bridges(workspace_id, approval_policy_key);

create index if not exists agent_action_approval_bridges_role_idx
  on public.agent_action_approval_bridges(workspace_id, required_approver_role);

create index if not exists agent_action_approval_bridges_created_idx
  on public.agent_action_approval_bridges(workspace_id, created_at desc);

alter table public.agent_action_approval_bridges enable row level security;

create policy "workspace_members_read_approval_bridges"
  on public.agent_action_approval_bridges
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_approval_bridges"
  on public.agent_action_approval_bridges
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_update_approval_bridges"
  on public.agent_action_approval_bridges
  for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

-- ─── agent_action_conversion_events ───────────────────────────────────────────

create table if not exists public.agent_action_conversion_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversion_id uuid references public.agent_action_conversions(id) on delete cascade,
  action_draft_id uuid references public.agent_review_action_drafts(id) on delete set null,
  approval_bridge_id uuid references public.agent_action_approval_bridges(id) on delete set null,
  execution_request_id uuid references public.agent_execution_requests(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_action_conversion_events_workspace_idx
  on public.agent_action_conversion_events(workspace_id);

create index if not exists agent_action_conversion_events_conversion_idx
  on public.agent_action_conversion_events(conversion_id);

create index if not exists agent_action_conversion_events_action_draft_idx
  on public.agent_action_conversion_events(action_draft_id);

create index if not exists agent_action_conversion_events_approval_bridge_idx
  on public.agent_action_conversion_events(approval_bridge_id);

create index if not exists agent_action_conversion_events_execution_request_idx
  on public.agent_action_conversion_events(execution_request_id);

create index if not exists agent_action_conversion_events_type_idx
  on public.agent_action_conversion_events(workspace_id, event_type);

create index if not exists agent_action_conversion_events_created_idx
  on public.agent_action_conversion_events(workspace_id, created_at desc);

alter table public.agent_action_conversion_events enable row level security;

create policy "workspace_members_read_conversion_events"
  on public.agent_action_conversion_events
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_conversion_events"
  on public.agent_action_conversion_events
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );
