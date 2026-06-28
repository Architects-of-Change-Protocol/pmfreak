-- ─── Agent Memory & Context Layer ────────────────────────────────────────────
-- Sprint: Agent Memory & Context Layer
-- Purpose: Governed memory records, context policies, and audit events for agents.

-- ─── agent_context_policies ──────────────────────────────────────────────────

create table if not exists public.agent_context_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  policy_key text not null,
  display_name text not null,
  description text,
  allowed_scope_types_json jsonb not null default '[]'::jsonb,
  allowed_memory_kinds_json jsonb not null default '[]'::jsonb,
  max_sensitivity text not null default 'internal',
  default_retention_policy text not null default 'short_term',
  default_retention_days integer,
  allow_cross_project_memory boolean not null default false,
  allow_cross_pm_memory boolean not null default false,
  allow_portfolio_memory boolean not null default true,
  allow_restricted_memory boolean not null default false,
  require_approval_for_confidential boolean not null default true,
  require_approval_for_restricted boolean not null default true,
  hide_expired_memory boolean not null default true,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, policy_key)
);

create index if not exists agent_context_policies_workspace_idx
  on public.agent_context_policies(workspace_id);

create index if not exists agent_context_policies_key_idx
  on public.agent_context_policies(workspace_id, policy_key);

create index if not exists agent_context_policies_status_idx
  on public.agent_context_policies(workspace_id, status);

-- ─── agent_memory_records ─────────────────────────────────────────────────────

create table if not exists public.agent_memory_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid,
  agent_type text,
  scope_type text not null,
  scope_id uuid,
  memory_kind text not null,
  title text not null,
  content text,
  summary text,
  source_type text not null,
  source_id text,
  source_uri text,
  provenance_json jsonb,
  sensitivity text not null default 'internal',
  retention_policy text not null default 'short_term',
  retention_days integer,
  status text not null default 'active',
  expires_at timestamptz,
  stale_at timestamptz,
  last_accessed_at timestamptz,
  last_refreshed_at timestamptz,
  access_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_memory_records_workspace_idx
  on public.agent_memory_records(workspace_id);

create index if not exists agent_memory_records_agent_idx
  on public.agent_memory_records(workspace_id, agent_id);

create index if not exists agent_memory_records_agent_type_idx
  on public.agent_memory_records(workspace_id, agent_type);

create index if not exists agent_memory_records_scope_idx
  on public.agent_memory_records(workspace_id, scope_type, scope_id);

create index if not exists agent_memory_records_kind_idx
  on public.agent_memory_records(workspace_id, memory_kind);

create index if not exists agent_memory_records_status_idx
  on public.agent_memory_records(workspace_id, status);

create index if not exists agent_memory_records_sensitivity_idx
  on public.agent_memory_records(workspace_id, sensitivity);

create index if not exists agent_memory_records_expires_idx
  on public.agent_memory_records(workspace_id, expires_at);

-- ─── agent_memory_events ──────────────────────────────────────────────────────

create table if not exists public.agent_memory_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid references public.agent_memory_records(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_memory_events_workspace_idx
  on public.agent_memory_events(workspace_id);

create index if not exists agent_memory_events_memory_idx
  on public.agent_memory_events(memory_id);

create index if not exists agent_memory_events_type_idx
  on public.agent_memory_events(workspace_id, event_type);

-- ─── agent_context_windows ────────────────────────────────────────────────────

create table if not exists public.agent_context_windows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid,
  agent_type text,
  scope_type text not null,
  scope_id uuid,
  window_key text not null,
  display_name text not null,
  description text,
  allowed_memory_kinds_json jsonb not null default '[]'::jsonb,
  max_sensitivity text not null default 'internal',
  retention_policy text not null default 'short_term',
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, window_key)
);

create index if not exists agent_context_windows_workspace_idx
  on public.agent_context_windows(workspace_id);

create index if not exists agent_context_windows_scope_idx
  on public.agent_context_windows(workspace_id, scope_type, scope_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.agent_context_policies enable row level security;
alter table public.agent_memory_records enable row level security;
alter table public.agent_memory_events enable row level security;
alter table public.agent_context_windows enable row level security;

-- agent_context_policies: workspace members read, owner/admin write
create policy "workspace_members_read_context_policies"
  on public.agent_context_policies for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_policies.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_admins_insert_context_policies"
  on public.agent_context_policies for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_policies.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "workspace_admins_update_context_policies"
  on public.agent_context_policies for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_policies.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- agent_memory_records: workspace members read, members insert, admins update lifecycle
create policy "workspace_members_read_memory"
  on public.agent_memory_records for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_memory_records.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_memory"
  on public.agent_memory_records for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_memory_records.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_admins_update_memory"
  on public.agent_memory_records for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_memory_records.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- agent_memory_events: workspace members read, members insert
create policy "workspace_members_read_memory_events"
  on public.agent_memory_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_memory_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_memory_events"
  on public.agent_memory_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_memory_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_context_windows: workspace members read, admins write
create policy "workspace_members_read_context_windows"
  on public.agent_context_windows for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_windows.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_admins_insert_context_windows"
  on public.agent_context_windows for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_windows.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "workspace_admins_update_context_windows"
  on public.agent_context_windows for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_context_windows.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
