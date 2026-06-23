-- ─────────────────────────────────────────────────────────────────────────────
-- Project Operating System Shell
-- EPIC 4 — Sprint 1
--
-- Creates the central orchestration tables that compose governance,
-- memory, execution, and intelligence data into a unified project snapshot.
-- NO business logic duplication — pure orchestration records.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── project_os_snapshots ─────────────────────────────────────────────────────

create table if not exists public.project_os_snapshots (
  id                            uuid primary key default gen_random_uuid(),

  workspace_id                  uuid not null references public.workspaces(id) on delete cascade,
  project_id                    uuid not null,

  snapshot_status               text not null default 'generated'
                                  check (snapshot_status in ('generated', 'validated', 'archived')),

  operating_health_score        numeric(5,2) not null default 100
                                  check (operating_health_score between 0 and 100),

  governance_health_score       numeric(5,2) not null default 100
                                  check (governance_health_score between 0 and 100),
  execution_health_score        numeric(5,2) not null default 100
                                  check (execution_health_score between 0 and 100),
  memory_health_score           numeric(5,2) not null default 100
                                  check (memory_health_score between 0 and 100),
  recommendation_health_score   numeric(5,2) not null default 100
                                  check (recommendation_health_score between 0 and 100),

  snapshot_payload              jsonb not null default '{}',

  generated_at                  timestamptz not null default now(),
  created_at                    timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id)
);

create index if not exists project_os_snapshots_workspace_id_idx
  on public.project_os_snapshots(workspace_id, created_at desc);

create index if not exists project_os_snapshots_project_id_idx
  on public.project_os_snapshots(workspace_id, project_id, created_at desc);

create index if not exists project_os_snapshots_status_idx
  on public.project_os_snapshots(workspace_id, snapshot_status);

create index if not exists project_os_snapshots_health_idx
  on public.project_os_snapshots(workspace_id, operating_health_score);

alter table public.project_os_snapshots enable row level security;

create policy "workspace_members_can_access_project_os_snapshots"
  on public.project_os_snapshots
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── project_os_attention_items ───────────────────────────────────────────────

create table if not exists public.project_os_attention_items (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id           uuid not null,

  attention_type        text not null check (attention_type in (
                          'critical_signal',
                          'overdue_commitment',
                          'execution_drift',
                          'governance_violation',
                          'ratification_stall',
                          'authority_gap',
                          'low_health_score',
                          'ignored_recommendation',
                          'projection_variance'
                        )),

  attention_severity    text not null check (attention_severity in (
                          'low', 'medium', 'high', 'critical'
                        )),

  source_entity_type    text not null,
  source_entity_id      uuid not null,

  title                 text not null,
  description           text not null,
  recommended_action    text,

  created_at            timestamptz not null default now(),

  -- enforce snapshot belongs to same workspace (composite FK)
  constraint posa_snapshot_workspace_fk
    foreign key (snapshot_id, workspace_id)
    references public.project_os_snapshots(id, workspace_id)
    on delete cascade
);

create index if not exists project_os_attention_items_workspace_id_idx
  on public.project_os_attention_items(workspace_id, created_at desc);

create index if not exists project_os_attention_items_snapshot_id_idx
  on public.project_os_attention_items(snapshot_id, attention_severity);

create index if not exists project_os_attention_items_type_idx
  on public.project_os_attention_items(workspace_id, attention_type);

alter table public.project_os_attention_items enable row level security;

create policy "workspace_members_can_access_project_os_attention_items"
  on public.project_os_attention_items
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── project_os_context_links ─────────────────────────────────────────────────

create table if not exists public.project_os_context_links (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id           uuid not null,

  entity_type           text not null,
  entity_id             uuid not null,

  relationship_type     text not null,

  created_at            timestamptz not null default now(),

  constraint poscl_snapshot_workspace_fk
    foreign key (snapshot_id, workspace_id)
    references public.project_os_snapshots(id, workspace_id)
    on delete cascade
);

create index if not exists project_os_context_links_workspace_id_idx
  on public.project_os_context_links(workspace_id, created_at desc);

create index if not exists project_os_context_links_snapshot_id_idx
  on public.project_os_context_links(snapshot_id);

create index if not exists project_os_context_links_entity_idx
  on public.project_os_context_links(workspace_id, entity_type, entity_id);

alter table public.project_os_context_links enable row level security;

create policy "workspace_members_can_access_project_os_context_links"
  on public.project_os_context_links
  for all
  to authenticated
  using (is_workspace_member(workspace_id));
