-- Project Constitution Foundation
-- Establishes the constitutional record for projects within a workspace.
-- Includes soft delete, RLS workspace isolation, and audit-friendly schema.

begin;

create table if not exists public.project_constitutions (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null,
  name              text        not null,
  description       text,
  status            text        not null default 'draft'
                                check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  sponsor           text,
  client            text,
  pm_responsible_id uuid        references auth.users(id) on delete set null,
  objectives        text[]      not null default '{}',
  constraints       text[]      not null default '{}',
  start_date        date,
  target_end_date   date,
  created_by        uuid        not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  metadata          jsonb       not null default '{}'
);

create index if not exists project_constitutions_workspace_id_idx
  on public.project_constitutions (workspace_id)
  where deleted_at is null;

create index if not exists project_constitutions_workspace_status_idx
  on public.project_constitutions (workspace_id, status)
  where deleted_at is null;

create index if not exists project_constitutions_created_by_idx
  on public.project_constitutions (created_by);

alter table public.project_constitutions enable row level security;

create policy "workspace members can read project constitutions"
  on public.project_constitutions
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id) and deleted_at is null);

create policy "workspace members can insert project constitutions"
  on public.project_constitutions
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "workspace members can update project constitutions"
  on public.project_constitutions
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id) and deleted_at is null)
  with check (public.is_workspace_member(workspace_id));

commit;
