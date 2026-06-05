create table if not exists public.project_discovery (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  stakeholders_json jsonb not null default '[]'::jsonb,
  dependencies_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  milestones_json jsonb not null default '[]'::jsonb,
  deliverables_json jsonb not null default '[]'::jsonb,
  assumptions_json jsonb not null default '[]'::jsonb,
  unknowns_json jsonb not null default '[]'::jsonb,
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version)
);

create index if not exists project_discovery_project_version_idx
  on public.project_discovery(project_id, version desc);

create index if not exists project_discovery_workspace_project_version_idx
  on public.project_discovery(workspace_id, project_id, version desc);

alter table public.project_discovery enable row level security;

drop policy if exists "workspace members can read project_discovery" on public.project_discovery;
create policy "workspace members can read project_discovery"
  on public.project_discovery
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert project_discovery" on public.project_discovery;
create policy "workspace members can insert project_discovery"
  on public.project_discovery
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create or replace function public.touch_project_discovery_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_project_discovery_updated_at on public.project_discovery;
create trigger trg_project_discovery_updated_at
before update on public.project_discovery
for each row execute function public.touch_project_discovery_updated_at();
