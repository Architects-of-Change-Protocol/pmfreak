create table if not exists public.runtime_conversation_state (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  session_key text not null,
  active_domain text null,
  state jsonb not null default '{}'::jsonb,
  recent_questions jsonb not null default '[]'::jsonb,
  recent_entities jsonb not null default '[]'::jsonb,
  recent_blockers jsonb not null default '[]'::jsonb,
  recent_interventions jsonb not null default '[]'::jsonb,
  recent_stakeholders jsonb not null default '[]'::jsonb,
  recent_evidence jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists runtime_conversation_state_scope_unique
  on public.runtime_conversation_state (
    company_id,
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
    session_key
  );

create index if not exists runtime_conversation_state_company_idx
  on public.runtime_conversation_state (company_id);

create index if not exists runtime_conversation_state_workspace_idx
  on public.runtime_conversation_state (workspace_id);

create index if not exists runtime_conversation_state_project_idx
  on public.runtime_conversation_state (project_id);

create index if not exists runtime_conversation_state_expires_idx
  on public.runtime_conversation_state (expires_at);

create index if not exists runtime_conversation_state_last_seen_idx
  on public.runtime_conversation_state (last_seen_at);

alter table public.runtime_conversation_state enable row level security;

drop policy if exists "workspace members can read runtime_conversation_state" on public.runtime_conversation_state;

create policy "workspace members can read runtime_conversation_state"
  on public.runtime_conversation_state
  for select
  to authenticated
  using (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  );

drop policy if exists "workspace members can insert runtime_conversation_state" on public.runtime_conversation_state;

create policy "workspace members can insert runtime_conversation_state"
  on public.runtime_conversation_state
  for insert
  to authenticated
  with check (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  );

drop policy if exists "workspace members can update runtime_conversation_state" on public.runtime_conversation_state;

create policy "workspace members can update runtime_conversation_state"
  on public.runtime_conversation_state
  for update
  to authenticated
  using (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  )
  with check (
    workspace_id is not null and public.is_workspace_member(workspace_id)
  );
