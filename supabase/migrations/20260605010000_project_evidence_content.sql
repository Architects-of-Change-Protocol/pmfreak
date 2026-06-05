create table if not exists public.project_evidence_content (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.project_evidence(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_file_name text not null,
  source_file_type text not null,
  source_uploaded_at timestamptz not null,
  source_uploaded_by uuid null references auth.users(id) on delete set null,
  extracted_text text not null,
  content_hash text not null,
  extraction_method text not null,
  processing_started_at timestamptz not null,
  processing_completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(evidence_id),
  check (content_hash ~ '^[a-f0-9]{64}$')
);

create index if not exists project_evidence_content_project_created_idx
  on public.project_evidence_content(project_id, created_at desc);

create index if not exists project_evidence_content_workspace_project_idx
  on public.project_evidence_content(workspace_id, project_id, created_at desc);

create index if not exists project_evidence_content_hash_idx
  on public.project_evidence_content(content_hash);

alter table public.project_evidence_content enable row level security;

drop policy if exists "workspace members can read project_evidence_content" on public.project_evidence_content;
create policy "workspace members can read project_evidence_content"
  on public.project_evidence_content
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert project_evidence_content" on public.project_evidence_content;
create policy "workspace members can insert project_evidence_content"
  on public.project_evidence_content
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update project_evidence_content" on public.project_evidence_content;
create policy "workspace members can update project_evidence_content"
  on public.project_evidence_content
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create or replace function public.touch_project_evidence_content_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_project_evidence_content_updated_at on public.project_evidence_content;
create trigger trg_project_evidence_content_updated_at
before update on public.project_evidence_content
for each row execute function public.touch_project_evidence_content_updated_at();
