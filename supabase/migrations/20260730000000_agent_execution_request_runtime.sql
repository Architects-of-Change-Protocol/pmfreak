-- ─── Agent Execution Request Runtime ─────────────────────────────────────────
-- Sprint: Agent Execution Request Runtime
-- Purpose: Governed execution request lifecycle for agent tool calls.

-- ─── agent_execution_requests ─────────────────────────────────────────────────

create table if not exists public.agent_execution_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  correlation_id text,
  agent_id uuid,
  agent_type text,
  tool_key text not null,
  execution_mode text not null,
  execution_state text not null default 'draft',
  risk_level text not null default 'medium',
  scope_type text not null,
  scope_id uuid,
  source_type text not null,
  source_id uuid,
  title text not null,
  description text,
  input_payload_json jsonb,
  safe_input_payload_json jsonb,
  preflight_status text not null default 'not_started',
  preflight_result_json jsonb,
  requires_approval boolean not null default false,
  approval_request_id uuid,
  memory_ids_json jsonb not null default '[]'::jsonb,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  result_payload_json jsonb,
  error_code text,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_requests_workspace_idx
  on public.agent_execution_requests(workspace_id);

create index if not exists agent_execution_requests_state_idx
  on public.agent_execution_requests(workspace_id, execution_state);

create index if not exists agent_execution_requests_mode_idx
  on public.agent_execution_requests(workspace_id, execution_mode);

create index if not exists agent_execution_requests_risk_idx
  on public.agent_execution_requests(workspace_id, risk_level);

create index if not exists agent_execution_requests_tool_idx
  on public.agent_execution_requests(workspace_id, tool_key);

create index if not exists agent_execution_requests_scope_idx
  on public.agent_execution_requests(workspace_id, scope_type, scope_id);

create index if not exists agent_execution_requests_agent_idx
  on public.agent_execution_requests(workspace_id, agent_id);

create index if not exists agent_execution_requests_correlation_idx
  on public.agent_execution_requests(workspace_id, correlation_id);

create index if not exists agent_execution_requests_requested_by_idx
  on public.agent_execution_requests(workspace_id, requested_by);

create index if not exists agent_execution_requests_created_idx
  on public.agent_execution_requests(workspace_id, created_at desc);

-- ─── agent_execution_events ───────────────────────────────────────────────────

create table if not exists public.agent_execution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  event_type text not null,
  from_state text,
  to_state text,
  actor_id uuid references auth.users(id) on delete set null,
  message text,
  event_payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_events_workspace_idx
  on public.agent_execution_events(workspace_id);

create index if not exists agent_execution_events_request_idx
  on public.agent_execution_events(workspace_id, execution_request_id);

create index if not exists agent_execution_events_type_idx
  on public.agent_execution_events(workspace_id, event_type);

create index if not exists agent_execution_events_created_idx
  on public.agent_execution_events(workspace_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.agent_execution_requests enable row level security;
alter table public.agent_execution_events enable row level security;

-- agent_execution_requests: workspace members read; admins insert/update
create policy "workspace_members_read_execution_requests"
  on public.agent_execution_requests for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_execution_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_execution_requests"
  on public.agent_execution_requests for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_execution_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_admins_update_execution_requests"
  on public.agent_execution_requests for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_execution_requests.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- agent_execution_events: workspace members read/insert
create policy "workspace_members_read_execution_events"
  on public.agent_execution_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_execution_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_execution_events"
  on public.agent_execution_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_execution_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );
