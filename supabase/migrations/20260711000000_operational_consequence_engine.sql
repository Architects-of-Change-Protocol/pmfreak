-- ─────────────────────────────────────────────────────────────────────────────
-- Operational Consequence Engine
-- EPIC 4 — Sprint 3
--
-- Transforms Focus Items into structured consequence analyses.
-- Answers: what happens if we don't act?
-- NO business logic duplication — pure analysis over existing focus items.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── operational_consequences ─────────────────────────────────────────────────

create table if not exists public.operational_consequences (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  focus_item_id           uuid not null,

  severity                text not null check (severity in ('low', 'medium', 'high', 'critical', 'systemic')),

  impact_horizon          text not null check (impact_horizon in ('24h', '48h', '7d', '14d', '30d', '90d')),

  escalation_probability  numeric(4,3) not null default 0
                            check (escalation_probability between 0 and 1),

  impact_score            numeric(5,2) not null default 0
                            check (impact_score between 0 and 100),

  analysis_status         text not null default 'generated'
                            check (analysis_status in ('generated', 'validated', 'archived')),

  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id),

  -- enforce source focus item belongs to same workspace
  constraint oc_focus_item_workspace_fk
    foreign key (focus_item_id, workspace_id)
    references public.operational_focus_items(id, workspace_id)
    on delete cascade
);

create index if not exists oc_workspace_id_idx
  on public.operational_consequences(workspace_id, created_at desc);

create index if not exists oc_focus_item_id_idx
  on public.operational_consequences(workspace_id, focus_item_id);

create index if not exists oc_severity_idx
  on public.operational_consequences(workspace_id, severity);

create index if not exists oc_status_idx
  on public.operational_consequences(workspace_id, analysis_status);

create index if not exists oc_impact_score_idx
  on public.operational_consequences(workspace_id, impact_score desc);

alter table public.operational_consequences enable row level security;

create policy "workspace_members_can_access_operational_consequences"
  on public.operational_consequences
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_consequence_impacts ─────────────────────────────────────────

create table if not exists public.operational_consequence_impacts (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  consequence_id          uuid not null,

  impact_type             text not null check (impact_type in (
                            'governance',
                            'execution',
                            'authority',
                            'ratification',
                            'commitment',
                            'projection',
                            'reality',
                            'recommendation',
                            'risk',
                            'health'
                          )),

  affected_entity_type    text not null,
  affected_entity_count   integer not null default 0 check (affected_entity_count >= 0),
  impact_score            numeric(5,2) not null default 0 check (impact_score between 0 and 100),
  description             text not null,

  created_at              timestamptz not null default now(),

  -- enforce consequence belongs to same workspace
  constraint oci_consequence_workspace_fk
    foreign key (consequence_id, workspace_id)
    references public.operational_consequences(id, workspace_id)
    on delete cascade
);

create index if not exists oci_workspace_id_idx
  on public.operational_consequence_impacts(workspace_id, created_at desc);

create index if not exists oci_consequence_id_idx
  on public.operational_consequence_impacts(consequence_id);

create index if not exists oci_impact_type_idx
  on public.operational_consequence_impacts(workspace_id, impact_type);

alter table public.operational_consequence_impacts enable row level security;

create policy "workspace_members_can_access_operational_consequence_impacts"
  on public.operational_consequence_impacts
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_consequence_paths ───────────────────────────────────────────

create table if not exists public.operational_consequence_paths (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  consequence_id          uuid not null,

  source_entity_type      text not null,
  source_entity_id        uuid not null,
  target_entity_type      text not null,
  target_entity_id        uuid not null,
  relationship_type       text not null,
  cascade_depth           integer not null default 0 check (cascade_depth >= 0),

  created_at              timestamptz not null default now(),

  -- enforce consequence belongs to same workspace
  constraint ocp_consequence_workspace_fk
    foreign key (consequence_id, workspace_id)
    references public.operational_consequences(id, workspace_id)
    on delete cascade
);

create index if not exists ocp_workspace_id_idx
  on public.operational_consequence_paths(workspace_id, created_at desc);

create index if not exists ocp_consequence_id_idx
  on public.operational_consequence_paths(consequence_id, cascade_depth);

create index if not exists ocp_source_entity_idx
  on public.operational_consequence_paths(workspace_id, source_entity_type, source_entity_id);

alter table public.operational_consequence_paths enable row level security;

create policy "workspace_members_can_access_operational_consequence_paths"
  on public.operational_consequence_paths
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_consequence_scenarios ───────────────────────────────────────

create table if not exists public.operational_consequence_scenarios (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  consequence_id          uuid not null,

  scenario_name           text not null check (scenario_name in ('best_case', 'expected_case', 'worst_case')),
  scenario_description    text not null,
  probability             numeric(4,3) not null check (probability between 0 and 1),

  created_at              timestamptz not null default now(),

  -- enforce consequence belongs to same workspace
  constraint ocs_consequence_workspace_fk
    foreign key (consequence_id, workspace_id)
    references public.operational_consequences(id, workspace_id)
    on delete cascade
);

create index if not exists ocs_workspace_id_idx
  on public.operational_consequence_scenarios(workspace_id, created_at desc);

create index if not exists ocs_consequence_id_idx
  on public.operational_consequence_scenarios(consequence_id);

alter table public.operational_consequence_scenarios enable row level security;

create policy "workspace_members_can_access_operational_consequence_scenarios"
  on public.operational_consequence_scenarios
  for all
  to authenticated
  using (is_workspace_member(workspace_id));
