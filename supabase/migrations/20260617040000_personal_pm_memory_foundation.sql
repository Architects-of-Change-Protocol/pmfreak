-- Personal PM Memory Foundation
-- Constitutional memory layer attached to an individual PM.
-- Inspectable, sovereign, exportable, auditable.
-- No AI. No scoring. No profiling. No prediction.

-- ─── personal_pm_memory ──────────────────────────────────────────────────────

create table if not exists public.personal_pm_memory (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null,
  pm_user_id    uuid        not null,
  memory_category text      not null check (memory_category in (
    'decision_behavior',
    'risk_behavior',
    'stakeholder_behavior',
    'communication_behavior',
    'execution_behavior',
    'planning_behavior',
    'escalation_behavior',
    'governance_behavior',
    'delivery_behavior',
    'leadership_behavior',
    'other'
  )),
  title         text        not null check (char_length(trim(title)) > 0),
  summary       text        not null check (char_length(trim(summary)) > 0),
  confidence    text        not null check (confidence in ('low', 'medium', 'high', 'very_high')),
  status        text        not null default 'active' check (status in ('active', 'archived', 'frozen', 'deprecated')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid        null,
  metadata      jsonb       not null default '{}'::jsonb
);

create index if not exists personal_pm_memory_workspace_pm_idx
  on public.personal_pm_memory (workspace_id, pm_user_id);

create index if not exists personal_pm_memory_status_idx
  on public.personal_pm_memory (workspace_id, pm_user_id, status);

alter table public.personal_pm_memory enable row level security;

-- Privacy boundary: a PM can only read their own memory within their workspace.
create policy "personal_pm_memory_isolation"
  on public.personal_pm_memory
  for all
  using (
    workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
    and pm_user_id = auth.uid()
  );

-- ─── personal_pm_memory_sources ──────────────────────────────────────────────

create table if not exists public.personal_pm_memory_sources (
  id                uuid        primary key default gen_random_uuid(),
  memory_id         uuid        not null references public.personal_pm_memory (id) on delete cascade,
  source_type       text        not null check (source_type in (
    'platform_event',
    'decision',
    'decision_effectiveness',
    'organizational_pattern',
    'organizational_memory',
    'outcome',
    'risk',
    'task',
    'milestone',
    'stakeholder'
  )),
  source_id         uuid        not null,
  relationship_type text        not null check (relationship_type in (
    'supports',
    'contradicts',
    'caused_by',
    'derived_from',
    'reviewed_during',
    'supersedes',
    'related_to'
  )),
  created_at        timestamptz not null default now()
);

create index if not exists personal_pm_memory_sources_memory_idx
  on public.personal_pm_memory_sources (memory_id);

alter table public.personal_pm_memory_sources enable row level security;

-- Sources inherit privacy from the parent memory record.
create policy "personal_pm_memory_sources_isolation"
  on public.personal_pm_memory_sources
  for all
  using (
    memory_id in (
      select id from public.personal_pm_memory
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );

-- ─── personal_pm_memory_observations ─────────────────────────────────────────

create table if not exists public.personal_pm_memory_observations (
  id                   uuid        primary key default gen_random_uuid(),
  memory_id            uuid        not null references public.personal_pm_memory (id) on delete cascade,
  observation_summary  text        not null check (char_length(trim(observation_summary)) > 0),
  recorded_at          timestamptz not null default now(),
  recorded_by          uuid        null,
  metadata             jsonb       not null default '{}'::jsonb
);

create index if not exists personal_pm_memory_observations_memory_idx
  on public.personal_pm_memory_observations (memory_id);

alter table public.personal_pm_memory_observations enable row level security;

-- Observations inherit privacy from the parent memory record.
create policy "personal_pm_memory_observations_isolation"
  on public.personal_pm_memory_observations
  for all
  using (
    memory_id in (
      select id from public.personal_pm_memory
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );
