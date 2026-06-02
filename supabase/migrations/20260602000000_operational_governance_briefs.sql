create table if not exists public.operational_governance_briefs (
  id text not null primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  brief_payload jsonb not null default '{}'::jsonb,
  confidence_score integer not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  generated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create unique index if not exists operational_governance_briefs_project_unique
  on public.operational_governance_briefs(project_id);

create index if not exists operational_governance_briefs_workspace_generated_idx
  on public.operational_governance_briefs(workspace_id, generated_at desc);

alter table public.operational_governance_briefs enable row level security;

create policy if not exists "workspace members can read operational_governance_briefs"
  on public.operational_governance_briefs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy if not exists "workspace members can insert operational_governance_briefs"
  on public.operational_governance_briefs
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy if not exists "workspace members can update operational_governance_briefs"
  on public.operational_governance_briefs
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
