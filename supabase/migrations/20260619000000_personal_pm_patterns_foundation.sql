-- Personal PM Pattern Formation Foundation
-- Evidence-backed, inspectable, sovereign, exportable, auditable registry of
-- professional PM operating patterns.
-- No AI. No scoring. No profiling. No behavioral prediction. No embeddings.

-- ─── personal_pm_patterns ────────────────────────────────────────────────────

create table if not exists public.personal_pm_patterns (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references public.workspaces(id) on delete cascade,
  pm_user_id       uuid        not null references auth.users(id) on delete cascade,
  pattern_category text        not null check (pattern_category in (
    'decision_pattern',
    'risk_response_pattern',
    'stakeholder_management_pattern',
    'communication_pattern',
    'execution_pattern',
    'planning_pattern',
    'escalation_pattern',
    'governance_pattern',
    'delivery_pattern',
    'approval_pattern',
    'follow_up_pattern',
    'dependency_resolution_pattern',
    'other'
  )),
  title            text        not null check (char_length(trim(title)) > 0),
  summary          text        not null check (char_length(trim(summary)) > 0),
  confidence       text        not null check (confidence in ('low', 'medium', 'high', 'very_high')),
  status           text        not null default 'active' check (status in ('active', 'archived', 'frozen', 'deprecated')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid        null references auth.users(id) on delete set null,
  metadata         jsonb       not null default '{}'::jsonb
);

comment on table public.personal_pm_patterns is
  'Evidence-backed registry of professional PM operating patterns. '
  'Inspectable, sovereign, exportable, auditable. '
  'Not personality profiling. Not scoring. Not prediction.';

create index if not exists personal_pm_patterns_workspace_pm_idx
  on public.personal_pm_patterns (workspace_id, pm_user_id, updated_at desc);

create index if not exists personal_pm_patterns_status_idx
  on public.personal_pm_patterns (workspace_id, pm_user_id, status, updated_at desc);

create index if not exists personal_pm_patterns_category_idx
  on public.personal_pm_patterns (workspace_id, pm_user_id, pattern_category, updated_at desc);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.personal_pm_patterns_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists personal_pm_patterns_touch_updated_at on public.personal_pm_patterns;
create trigger personal_pm_patterns_touch_updated_at
  before update on public.personal_pm_patterns
  for each row execute function public.personal_pm_patterns_touch_updated_at();

-- ─── freeze guard trigger ─────────────────────────────────────────────────────
-- Frozen patterns cannot be mutated by any means other than archiving.

create or replace function public.personal_pm_patterns_freeze_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'frozen' then
    -- Allow only the transition frozen → archived.
    if new.status = 'archived' then
      -- Permit: only status column may change.
      if (new.title        is distinct from old.title)       or
         (new.summary      is distinct from old.summary)     or
         (new.confidence   is distinct from old.confidence)  or
         (new.metadata     is distinct from old.metadata)    or
         (new.pm_user_id   is distinct from old.pm_user_id)  or
         (new.workspace_id is distinct from old.workspace_id) then
        raise exception 'Frozen personal PM patterns cannot have fields mutated; only status=archived transition is permitted.';
      end if;
      return new;
    end if;
    raise exception 'Frozen personal PM patterns can only be archived, not mutated or otherwise transitioned.';
  end if;
  if tg_op = 'DELETE' and old.status = 'frozen' then
    raise exception 'Frozen personal PM patterns cannot be deleted. Archive them first.';
  end if;
  return new;
end $$;

drop trigger if exists personal_pm_patterns_freeze_guard on public.personal_pm_patterns;
create trigger personal_pm_patterns_freeze_guard
  before update or delete on public.personal_pm_patterns
  for each row execute function public.personal_pm_patterns_freeze_guard();

-- ─── personal_pm_pattern_sources ─────────────────────────────────────────────

create table if not exists public.personal_pm_pattern_sources (
  id                uuid        primary key default gen_random_uuid(),
  pattern_id        uuid        not null references public.personal_pm_patterns(id) on delete cascade,
  source_type       text        not null check (source_type in (
    'platform_event',
    'decision',
    'decision_effectiveness',
    'organizational_pattern',
    'organizational_memory',
    'personal_memory',
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

comment on table public.personal_pm_pattern_sources is
  'Source evidence records for each personal PM pattern. Every pattern must have at least one source.';

create index if not exists personal_pm_pattern_sources_pattern_idx
  on public.personal_pm_pattern_sources (pattern_id, created_at);

-- Sources of frozen patterns are immutable.
create or replace function public.personal_pm_pattern_sources_freeze_guard()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    declare frozen_check boolean;
    begin
      select (status = 'frozen') into frozen_check
        from public.personal_pm_patterns
        where id = coalesce(new.pattern_id, old.pattern_id);
      if frozen_check then
        raise exception 'Sources of frozen personal PM patterns cannot be mutated.';
      end if;
    end;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists personal_pm_pattern_sources_freeze_guard on public.personal_pm_pattern_sources;
create trigger personal_pm_pattern_sources_freeze_guard
  before insert or update or delete on public.personal_pm_pattern_sources
  for each row execute function public.personal_pm_pattern_sources_freeze_guard();

-- ─── personal_pm_pattern_observations ────────────────────────────────────────

create table if not exists public.personal_pm_pattern_observations (
  id                   uuid        primary key default gen_random_uuid(),
  pattern_id           uuid        not null references public.personal_pm_patterns(id) on delete cascade,
  observation_summary  text        not null check (char_length(trim(observation_summary)) > 0),
  recorded_at          timestamptz not null default now(),
  recorded_by          uuid        null references auth.users(id) on delete set null,
  metadata             jsonb       not null default '{}'::jsonb
);

comment on table public.personal_pm_pattern_observations is
  'Explicit review notes or observations about a professional PM pattern.';

create index if not exists personal_pm_pattern_observations_pattern_idx
  on public.personal_pm_pattern_observations (pattern_id, recorded_at);

-- Observations of frozen patterns are immutable.
create or replace function public.personal_pm_pattern_observations_freeze_guard()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    declare frozen_check boolean;
    begin
      select (status = 'frozen') into frozen_check
        from public.personal_pm_patterns
        where id = coalesce(new.pattern_id, old.pattern_id);
      if frozen_check then
        raise exception 'Observations of frozen personal PM patterns cannot be mutated.';
      end if;
    end;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists personal_pm_pattern_observations_freeze_guard on public.personal_pm_pattern_observations;
create trigger personal_pm_pattern_observations_freeze_guard
  before insert or update or delete on public.personal_pm_pattern_observations
  for each row execute function public.personal_pm_pattern_observations_freeze_guard();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.personal_pm_patterns enable row level security;
alter table public.personal_pm_pattern_sources enable row level security;
alter table public.personal_pm_pattern_observations enable row level security;

-- personal_pm_patterns: PM can only access their own patterns within their workspace.
drop policy if exists "personal_pm_patterns_isolation" on public.personal_pm_patterns;
create policy "personal_pm_patterns_isolation"
  on public.personal_pm_patterns
  for all
  using (
    workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
    and pm_user_id = auth.uid()
  );

-- personal_pm_pattern_sources: inherits privacy boundary from parent pattern.
drop policy if exists "personal_pm_pattern_sources_isolation" on public.personal_pm_pattern_sources;
create policy "personal_pm_pattern_sources_isolation"
  on public.personal_pm_pattern_sources
  for all
  using (
    pattern_id in (
      select id from public.personal_pm_patterns
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );

-- personal_pm_pattern_observations: inherits privacy boundary from parent pattern.
drop policy if exists "personal_pm_pattern_observations_isolation" on public.personal_pm_pattern_observations;
create policy "personal_pm_pattern_observations_isolation"
  on public.personal_pm_pattern_observations
  for all
  using (
    pattern_id in (
      select id from public.personal_pm_patterns
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );
