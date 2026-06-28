begin;

-- ─── agent_tools ──────────────────────────────────────────────────────────────
-- Formal registry of governed agent capabilities.
-- A tool must be registered, active, and compatible before an agent may use it.

create table if not exists public.agent_tools (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references public.workspaces(id) on delete cascade,
  tool_key                 text not null,
  display_name             text not null,
  description              text not null,
  category                 text not null check (category in (
    'project_read','portfolio_read','pm_read','analysis','drafting',
    'recommendation','task_generation','communication','governance',
    'reporting','administration'
  )),
  risk_level               text not null check (risk_level in ('low','medium','high','critical')),
  execution_mode           text not null check (execution_mode in (
    'read_only','draft_only','requires_approval','automatic'
  )),
  status                   text not null default 'active' check (status in ('active','disabled','deprecated')),
  input_schema_json        text,
  output_schema_json       text,
  required_permissions_json text not null default '[]',
  compatible_agent_types_json text not null default '[]',
  creates_evidence         boolean not null default false,
  mutates_state            boolean not null default false,
  requires_human_approval  boolean not null default false,
  created_at               timestamptz not null default timezone('utc', now()),
  updated_at               timestamptz not null default timezone('utc', now()),
  unique(workspace_id, tool_key)
);

create index if not exists agent_tools_workspace_idx
  on public.agent_tools(workspace_id, status, category);

create index if not exists agent_tools_key_idx
  on public.agent_tools(workspace_id, tool_key);

-- ─── agent_tool_assignments ───────────────────────────────────────────────────
-- Explicit per-agent tool access grants (optional layer on top of type-based compatibility).

create table if not exists public.agent_tool_assignments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id     uuid not null references public.ai_agents(id) on delete cascade,
  tool_id      uuid not null references public.agent_tools(id) on delete cascade,
  status       text not null default 'active' check (status in ('active','removed')),
  assigned_at  timestamptz not null default timezone('utc', now()),
  assigned_by  text,
  removed_at   timestamptz,
  unique(workspace_id, agent_id, tool_id)
);

create index if not exists agent_tool_assignments_agent_idx
  on public.agent_tool_assignments(workspace_id, agent_id, status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.agent_tools enable row level security;
alter table public.agent_tool_assignments enable row level security;

create policy if not exists agent_tools_workspace_read on public.agent_tools
  for select using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tools.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tools_admin_write on public.agent_tools
  for all using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tools.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tools.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

create policy if not exists agent_tool_assignments_workspace_read on public.agent_tool_assignments
  for select using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_assignments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tool_assignments_admin_write on public.agent_tool_assignments
  for all using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_assignments.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_assignments.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

commit;
