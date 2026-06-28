-- Agent Tool Execution Adapter Layer
-- Sprint: Agent Tool Execution Adapter Layer

create table if not exists public.agent_tool_adapter_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  adapter_key text not null,
  tool_key text not null,
  execution_mode text not null,
  execution_status text not null default 'queued',
  output_type text not null default 'noop',
  input_snapshot_json jsonb,
  safe_input_snapshot_json jsonb,
  output_payload_json jsonb,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  refusal_reason text,
  error_code text,
  error_message text,
  actor_id uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_tool_adapter_executions_workspace_idx on public.agent_tool_adapter_executions(workspace_id);
create index if not exists agent_tool_adapter_executions_request_idx on public.agent_tool_adapter_executions(execution_request_id);
create index if not exists agent_tool_adapter_executions_adapter_idx on public.agent_tool_adapter_executions(workspace_id, adapter_key);
create index if not exists agent_tool_adapter_executions_tool_idx on public.agent_tool_adapter_executions(workspace_id, tool_key);
create index if not exists agent_tool_adapter_executions_status_idx on public.agent_tool_adapter_executions(workspace_id, execution_status);
create index if not exists agent_tool_adapter_executions_created_idx on public.agent_tool_adapter_executions(workspace_id, created_at desc);

alter table public.agent_tool_adapter_executions enable row level security;

create policy "workspace_members_read_adapter_executions"
  on public.agent_tool_adapter_executions for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_adapter_executions"
  on public.agent_tool_adapter_executions for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create table if not exists public.agent_tool_adapter_execution_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  adapter_execution_id uuid not null references public.agent_tool_adapter_executions(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_tool_adapter_execution_events_workspace_idx on public.agent_tool_adapter_execution_events(workspace_id);
create index if not exists agent_tool_adapter_execution_events_execution_idx on public.agent_tool_adapter_execution_events(adapter_execution_id);
create index if not exists agent_tool_adapter_execution_events_request_idx on public.agent_tool_adapter_execution_events(execution_request_id);
create index if not exists agent_tool_adapter_execution_events_type_idx on public.agent_tool_adapter_execution_events(workspace_id, event_type);
create index if not exists agent_tool_adapter_execution_events_created_idx on public.agent_tool_adapter_execution_events(workspace_id, created_at desc);

alter table public.agent_tool_adapter_execution_events enable row level security;

create policy "workspace_members_read_adapter_execution_events"
  on public.agent_tool_adapter_execution_events for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_adapter_execution_events"
  on public.agent_tool_adapter_execution_events for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );
