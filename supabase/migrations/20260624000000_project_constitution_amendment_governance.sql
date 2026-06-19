-- ─────────────────────────────────────────────────────────────────────────────
-- Project Constitution Amendment Governance
-- Sprint 3: Constitutional Amendment Governance
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Add constitution_version to project_constitutions ───────────────────────
-- Tracks the number of applied amendments (separate from lifecycle_version).

alter table public.project_constitutions
  add column if not exists constitution_version integer not null default 1
    check (constitution_version >= 1);

-- ─── constitution_amendments ─────────────────────────────────────────────────

create table if not exists public.constitution_amendments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  constitution_id   uuid not null references public.project_constitutions(id) on delete cascade,

  title             text not null check (char_length(trim(title)) > 0),
  description       text null,
  justification     text null,

  status            text not null default 'draft'
                      check (status in ('draft', 'proposed', 'approved', 'rejected', 'withdrawn', 'applied')),

  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  approved_by       uuid null references auth.users(id) on delete restrict,
  approved_at       timestamptz null,

  rejected_by       uuid null references auth.users(id) on delete restrict,
  rejected_at       timestamptz null,
  rejection_reason  text null,

  withdrawn_by      uuid null references auth.users(id) on delete restrict,
  withdrawn_at      timestamptz null,

  applied_by        uuid null references auth.users(id) on delete restrict,
  applied_at        timestamptz null,

  deleted_at        timestamptz null,

  -- workspace isolation via composite FK
  constraint constitution_amendments_workspace_constitution_fkey
    foreign key (constitution_id, workspace_id)
    references public.project_constitutions(id, workspace_id) on delete cascade
);

create index if not exists constitution_amendments_workspace_idx
  on public.constitution_amendments(workspace_id);

create index if not exists constitution_amendments_constitution_idx
  on public.constitution_amendments(constitution_id, workspace_id);

create index if not exists constitution_amendments_status_idx
  on public.constitution_amendments(workspace_id, status);

alter table public.constitution_amendments enable row level security;

create policy "workspace members can read amendments"
  on public.constitution_amendments
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert amendments"
  on public.constitution_amendments
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "workspace members can update amendments"
  on public.constitution_amendments
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─── constitution_amendment_changes ──────────────────────────────────────────

create table if not exists public.constitution_amendment_changes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  amendment_id  uuid not null references public.constitution_amendments(id) on delete cascade,

  change_type   text not null check (change_type in ('add', 'update', 'remove')),
  field_name    text not null check (char_length(trim(field_name)) > 0),

  old_value     text null,
  new_value     text null,

  created_at    timestamptz not null default now()
);

create index if not exists constitution_amendment_changes_amendment_idx
  on public.constitution_amendment_changes(amendment_id, workspace_id);

create index if not exists constitution_amendment_changes_workspace_idx
  on public.constitution_amendment_changes(workspace_id);

alter table public.constitution_amendment_changes enable row level security;

create policy "workspace members can read amendment changes"
  on public.constitution_amendment_changes
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert amendment changes"
  on public.constitution_amendment_changes
  for insert
  with check (public.is_workspace_member(workspace_id));

-- ─── constitution_snapshots ───────────────────────────────────────────────────

create table if not exists public.constitution_snapshots (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  constitution_id  uuid not null references public.project_constitutions(id) on delete cascade,

  version          integer not null check (version >= 1),

  snapshot_data    jsonb not null default '{}'::jsonb,

  created_by       uuid not null references auth.users(id) on delete restrict,
  created_at       timestamptz not null default now(),

  constraint constitution_snapshots_workspace_constitution_fkey
    foreign key (constitution_id, workspace_id)
    references public.project_constitutions(id, workspace_id) on delete cascade
);

create index if not exists constitution_snapshots_constitution_idx
  on public.constitution_snapshots(constitution_id, workspace_id);

create index if not exists constitution_snapshots_workspace_idx
  on public.constitution_snapshots(workspace_id);

create index if not exists constitution_snapshots_version_idx
  on public.constitution_snapshots(constitution_id, version);

alter table public.constitution_snapshots enable row level security;

create policy "workspace members can read snapshots"
  on public.constitution_snapshots
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert snapshots"
  on public.constitution_snapshots
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );
