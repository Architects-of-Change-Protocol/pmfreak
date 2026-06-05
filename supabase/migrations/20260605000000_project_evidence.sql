create table if not exists public.project_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'processed', 'failed'))
);

create index if not exists project_evidence_project_uploaded_idx
  on public.project_evidence(project_id, uploaded_at desc);

create index if not exists project_evidence_workspace_project_status_idx
  on public.project_evidence(workspace_id, project_id, status, uploaded_at desc);

create unique index if not exists project_evidence_storage_path_uidx
  on public.project_evidence(storage_path);

alter table public.project_evidence enable row level security;

drop policy if exists "workspace members can read project_evidence" on public.project_evidence;
create policy "workspace members can read project_evidence"
  on public.project_evidence
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert project_evidence" on public.project_evidence;
create policy "workspace members can insert project_evidence"
  on public.project_evidence
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update project_evidence" on public.project_evidence;
create policy "workspace members can update project_evidence"
  on public.project_evidence
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can delete project_evidence" on public.project_evidence;
create policy "workspace members can delete project_evidence"
  on public.project_evidence
  for delete to authenticated
  using (public.is_workspace_member(workspace_id));
