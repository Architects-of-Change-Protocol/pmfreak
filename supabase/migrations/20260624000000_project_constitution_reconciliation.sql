-- ─────────────────────────────────────────────────────────────────────────────
-- Project Constitution Reconciliation
-- Adds Sprint 2 lifecycle columns to Sprint 1's project_constitutions table.
-- Sprint 1 migration (20260623000000_project_constitution_foundation.sql)
-- created the table with: name, status (draft/active/on_hold/completed/cancelled),
-- sponsor, client, pm_responsible_id, objectives, constraints, start_date,
-- target_end_date, created_by, created_at, updated_at, deleted_at, metadata.
-- This migration adds lifecycle governance columns and the history table.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ─── Add Sprint 2 lifecycle columns ──────────────────────────────────────────

alter table public.project_constitutions
  add column if not exists project_id         uuid          null references public.projects(id) on delete set null,
  add column if not exists current_status     text          null,
  add column if not exists status_changed_at  timestamptz   null,
  add column if not exists status_changed_by  uuid          null references auth.users(id) on delete set null,
  add column if not exists lifecycle_version  integer       null;

-- ─── Back-fill current_status from Sprint 1's status column ──────────────────
-- Sprint 2 lifecycle states: draft | proposed | approved | active | suspended | closed | archived
-- Sprint 1 statuses mapped as: draft→draft, active→active, on_hold→suspended,
--   completed→closed, cancelled→closed

update public.project_constitutions
set
  current_status    = case status
                        when 'draft'      then 'draft'
                        when 'active'     then 'active'
                        when 'on_hold'    then 'suspended'
                        when 'completed'  then 'closed'
                        when 'cancelled'  then 'closed'
                        else 'draft'
                      end,
  status_changed_at = updated_at,
  status_changed_by = created_by,
  lifecycle_version = 1
where current_status is null;

-- ─── Apply NOT NULL + CHECK constraints ──────────────────────────────────────

alter table public.project_constitutions
  alter column current_status    set not null,
  alter column current_status    set default 'draft',
  alter column status_changed_at set not null,
  alter column status_changed_at set default now(),
  alter column lifecycle_version set not null,
  alter column lifecycle_version set default 1;

alter table public.project_constitutions
  add constraint if not exists project_constitutions_current_status_check
  check (current_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived'));

alter table public.project_constitutions
  add constraint if not exists project_constitutions_lifecycle_version_check
  check (lifecycle_version >= 1);

-- ─── Additional indexes for new columns ──────────────────────────────────────

create index if not exists project_constitutions_project_id_idx
  on public.project_constitutions (project_id)
  where project_id is not null;

create index if not exists project_constitutions_current_status_idx
  on public.project_constitutions (workspace_id, current_status)
  where deleted_at is null;

-- ─── constitution_lifecycle_history ──────────────────────────────────────────
-- Created here via IF NOT EXISTS; Sprint 2 migration may have created it first
-- on branches that ran before Sprint 1 was merged.

create table if not exists public.constitution_lifecycle_history (
  id                      uuid        primary key default gen_random_uuid(),
  workspace_id            uuid        not null references public.workspaces(id) on delete cascade,
  constitution_id         uuid        not null references public.project_constitutions(id) on delete cascade,
  from_status             text        not null
                            check (from_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived')),
  to_status               text        not null
                            check (to_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived')),
  changed_by              uuid        not null references auth.users(id) on delete restrict,
  changed_at              timestamptz not null default now(),
  reason                  text        null,
  lifecycle_version_after integer     not null check (lifecycle_version_after >= 1),
  metadata                jsonb       not null default '{}'
);

create index if not exists constitution_lifecycle_history_constitution_idx
  on public.constitution_lifecycle_history (constitution_id, workspace_id);

create index if not exists constitution_lifecycle_history_workspace_idx
  on public.constitution_lifecycle_history (workspace_id);

alter table public.constitution_lifecycle_history enable row level security;

create policy "workspace members can read lifecycle history"
  on public.constitution_lifecycle_history
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert lifecycle history"
  on public.constitution_lifecycle_history
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id) and changed_by = auth.uid());

commit;
