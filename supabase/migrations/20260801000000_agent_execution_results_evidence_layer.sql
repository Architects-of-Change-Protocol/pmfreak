-- Agent Execution Results & Evidence Layer
-- Sprint: Agent Execution Results & Evidence Layer

create table if not exists public.agent_execution_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  agent_type text,
  tool_key text not null,
  adapter_key text,
  execution_mode text not null,
  scope_type text not null,
  scope_id uuid,
  result_type text not null,
  result_status text not null default 'created',
  review_state text not null default 'not_ready',
  title text not null,
  summary text,
  result_payload_json jsonb,
  safe_result_payload_json jsonb,
  artifact_type text not null default 'inline_json',
  artifact_metadata_json jsonb,
  confidence_score integer not null default 0,
  confidence_level text not null default 'low',
  confidence_reasons_json jsonb not null default '[]'::jsonb,
  evidence_ids_json jsonb not null default '[]'::jsonb,
  lineage_refs_json jsonb not null default '[]'::jsonb,
  retention_policy text not null default 'standard',
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_results_workspace_idx on public.agent_execution_results(workspace_id);
create index if not exists agent_execution_results_request_idx on public.agent_execution_results(execution_request_id);
create index if not exists agent_execution_results_adapter_execution_idx on public.agent_execution_results(adapter_execution_id);
create index if not exists agent_execution_results_status_idx on public.agent_execution_results(workspace_id, result_status);
create index if not exists agent_execution_results_review_idx on public.agent_execution_results(workspace_id, review_state);
create index if not exists agent_execution_results_type_idx on public.agent_execution_results(workspace_id, result_type);
create index if not exists agent_execution_results_tool_idx on public.agent_execution_results(workspace_id, tool_key);
create index if not exists agent_execution_results_created_idx on public.agent_execution_results(workspace_id, created_at desc);

alter table public.agent_execution_results enable row level security;

create policy "workspace_members_read_execution_results"
  on public.agent_execution_results for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_execution_results"
  on public.agent_execution_results for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_update_execution_results"
  on public.agent_execution_results for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create table if not exists public.agent_execution_evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  execution_request_id uuid references public.agent_execution_requests(id) on delete set null,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  evidence_type text not null,
  evidence_source text not null,
  scope_type text,
  scope_id uuid,
  title text not null,
  summary text,
  evidence_payload_json jsonb,
  safe_evidence_payload_json jsonb,
  evidence_ref text,
  evidence_hash text,
  confidence_weight integer not null default 0,
  retention_policy text not null default 'standard',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_evidence_workspace_idx on public.agent_execution_evidence_items(workspace_id);
create index if not exists agent_execution_evidence_result_idx on public.agent_execution_evidence_items(result_id);
create index if not exists agent_execution_evidence_request_idx on public.agent_execution_evidence_items(execution_request_id);
create index if not exists agent_execution_evidence_adapter_idx on public.agent_execution_evidence_items(adapter_execution_id);
create index if not exists agent_execution_evidence_type_idx on public.agent_execution_evidence_items(workspace_id, evidence_type);
create index if not exists agent_execution_evidence_source_idx on public.agent_execution_evidence_items(workspace_id, evidence_source);
create index if not exists agent_execution_evidence_created_idx on public.agent_execution_evidence_items(workspace_id, created_at desc);

alter table public.agent_execution_evidence_items enable row level security;

create policy "workspace_members_read_execution_evidence"
  on public.agent_execution_evidence_items for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_execution_evidence"
  on public.agent_execution_evidence_items for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_update_execution_evidence"
  on public.agent_execution_evidence_items for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create table if not exists public.agent_execution_result_lineage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  result_id uuid not null references public.agent_execution_results(id) on delete cascade,
  lineage_type text not null,
  lineage_ref text not null,
  lineage_payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_result_lineage_workspace_idx on public.agent_execution_result_lineage(workspace_id);
create index if not exists agent_execution_result_lineage_result_idx on public.agent_execution_result_lineage(result_id);
create index if not exists agent_execution_result_lineage_type_idx on public.agent_execution_result_lineage(result_id, lineage_type);
create index if not exists agent_execution_result_lineage_created_idx on public.agent_execution_result_lineage(workspace_id, created_at desc);

alter table public.agent_execution_result_lineage enable row level security;

create policy "workspace_members_read_result_lineage"
  on public.agent_execution_result_lineage for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_result_lineage"
  on public.agent_execution_result_lineage for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create table if not exists public.agent_execution_result_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  result_id uuid references public.agent_execution_results(id) on delete cascade,
  evidence_id uuid references public.agent_execution_evidence_items(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_result_events_workspace_idx on public.agent_execution_result_events(workspace_id);
create index if not exists agent_execution_result_events_result_idx on public.agent_execution_result_events(result_id);
create index if not exists agent_execution_result_events_evidence_idx on public.agent_execution_result_events(evidence_id);
create index if not exists agent_execution_result_events_type_idx on public.agent_execution_result_events(workspace_id, event_type);
create index if not exists agent_execution_result_events_created_idx on public.agent_execution_result_events(workspace_id, created_at desc);

alter table public.agent_execution_result_events enable row level security;

create policy "workspace_members_read_result_events"
  on public.agent_execution_result_events for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_result_events"
  on public.agent_execution_result_events for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );
