-- ─────────────────────────────────────────────────────────────────────────────
-- Operational Command Center
-- EPIC 4 — Sprint 2
--
-- Transforms Project OS Snapshots into a prioritized operational focus layer.
-- The Command Center surfaces what needs immediate attention, why it matters,
-- who should address it, and what intervention is recommended.
-- NO business logic duplication — pure orchestration over existing attention items.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── operational_command_centers ─────────────────────────────────────────────

create table if not exists public.operational_command_centers (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  project_id            uuid not null,
  snapshot_id           uuid not null,

  command_status        text not null default 'generated'
                          check (command_status in ('generated', 'validated', 'archived')),

  overall_priority      text not null default 'low'
                          check (overall_priority in ('low', 'medium', 'high', 'critical')),

  focus_score           numeric(5,2) not null default 0
                          check (focus_score between 0 and 100),

  generated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id)
);

create index if not exists occ_workspace_id_idx
  on public.operational_command_centers(workspace_id, created_at desc);

create index if not exists occ_project_id_idx
  on public.operational_command_centers(workspace_id, project_id, created_at desc);

create index if not exists occ_snapshot_id_idx
  on public.operational_command_centers(workspace_id, snapshot_id);

create index if not exists occ_status_idx
  on public.operational_command_centers(workspace_id, command_status);

create index if not exists occ_priority_idx
  on public.operational_command_centers(workspace_id, overall_priority);

alter table public.operational_command_centers enable row level security;

create policy "workspace_members_can_access_operational_command_centers"
  on public.operational_command_centers
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_focus_items ──────────────────────────────────────────────────

create table if not exists public.operational_focus_items (
  id                          uuid primary key default gen_random_uuid(),

  workspace_id                uuid not null references public.workspaces(id) on delete cascade,
  command_center_id           uuid not null,

  attention_item_id           uuid references public.project_os_attention_items(id) on delete set null,

  focus_type                  text not null check (focus_type in (
                                'governance',
                                'execution',
                                'authority',
                                'ratification',
                                'recommendation',
                                'commitment',
                                'projection',
                                'reality',
                                'risk',
                                'health'
                              )),

  priority                    text not null check (priority in ('low', 'medium', 'high', 'critical')),

  focus_score                 numeric(5,2) not null default 0
                                check (focus_score between 0 and 100),

  title                       text not null,
  description                 text not null,
  rationale                   text not null,

  recommended_action_type     text,
  recommended_owner_type      text,
  recommended_due_date        timestamptz,

  status                      text not null default 'open'
                                check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  resolved_at                 timestamptz,
  dismissed_at                timestamptz,

  -- enforce command center belongs to same workspace
  constraint ofi_command_center_workspace_fk
    foreign key (command_center_id, workspace_id)
    references public.operational_command_centers(id, workspace_id)
    on delete cascade
);

create index if not exists ofi_workspace_id_idx
  on public.operational_focus_items(workspace_id, created_at desc);

create index if not exists ofi_command_center_id_idx
  on public.operational_focus_items(command_center_id, priority);

create index if not exists ofi_status_idx
  on public.operational_focus_items(workspace_id, status);

create index if not exists ofi_focus_type_idx
  on public.operational_focus_items(workspace_id, focus_type);

create index if not exists ofi_priority_idx
  on public.operational_focus_items(workspace_id, priority, focus_score desc);

alter table public.operational_focus_items enable row level security;

create policy "workspace_members_can_access_operational_focus_items"
  on public.operational_focus_items
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_focus_links ──────────────────────────────────────────────────

create table if not exists public.operational_focus_links (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  focus_item_id         uuid not null,

  entity_type           text not null,
  entity_id             uuid not null,

  relationship_type     text not null,

  created_at            timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id)
);

create index if not exists ofl_workspace_id_idx
  on public.operational_focus_links(workspace_id, created_at desc);

create index if not exists ofl_focus_item_id_idx
  on public.operational_focus_links(focus_item_id);

create index if not exists ofl_entity_idx
  on public.operational_focus_links(workspace_id, entity_type, entity_id);

alter table public.operational_focus_links enable row level security;

create policy "workspace_members_can_access_operational_focus_links"
  on public.operational_focus_links
  for all
  to authenticated
  using (is_workspace_member(workspace_id));
