-- Personal PM Effectiveness Foundation
-- Connects Personal PM Memory → Personal PM Patterns → Decisions → Outcomes → Effectiveness.
-- Evidence-backed, inspectable, sovereign, exportable, auditable.
-- No AI. No scoring. No profiling. No behavioral prediction. No embeddings. No ranking.

-- ─── personal_pm_effectiveness ───────────────────────────────────────────────

create table if not exists public.personal_pm_effectiveness (
  id                        uuid        primary key default gen_random_uuid(),
  workspace_id              uuid        not null references public.workspaces(id) on delete cascade,
  pm_user_id                uuid        not null references auth.users(id) on delete cascade,
  personal_pattern_id       uuid        null references public.personal_pm_patterns(id) on delete set null,
  personal_memory_id        uuid        null references public.personal_pm_memory(id) on delete set null,
  decision_id               uuid        null references public.project_decisions(id) on delete set null,
  decision_effectiveness_id uuid        null references public.decision_effectiveness(id) on delete set null,
  outcome_classification    text        not null check (outcome_classification in (
    'success',
    'partial_success',
    'failure',
    'unknown'
  )),
  effectiveness_status      text        not null default 'candidate' check (effectiveness_status in (
    'candidate',
    'validated',
    'archived',
    'deprecated'
  )),
  summary                   text        not null check (char_length(trim(summary)) > 0),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid        null references auth.users(id) on delete set null,
  metadata                  jsonb       not null default '{}'::jsonb,

  -- At least one anchor reference must be present.
  constraint personal_pm_effectiveness_anchor_required check (
    personal_pattern_id is not null
    or personal_memory_id is not null
    or decision_id is not null
    or decision_effectiveness_id is not null
  )
);

comment on table public.personal_pm_effectiveness is
  'Evidence-backed registry connecting PM operating patterns to project outcomes. '
  'Inspectable, sovereign, exportable, auditable. '
  'Not AI. Not scoring. Not profiling. Not performance rating. Not behavioral prediction.';

create index if not exists personal_pm_effectiveness_workspace_pm_idx
  on public.personal_pm_effectiveness (workspace_id, pm_user_id, updated_at desc);

create index if not exists personal_pm_effectiveness_status_idx
  on public.personal_pm_effectiveness (workspace_id, pm_user_id, effectiveness_status, updated_at desc);

create index if not exists personal_pm_effectiveness_outcome_idx
  on public.personal_pm_effectiveness (workspace_id, pm_user_id, outcome_classification, updated_at desc);

create index if not exists personal_pm_effectiveness_pattern_idx
  on public.personal_pm_effectiveness (personal_pattern_id)
  where personal_pattern_id is not null;

create index if not exists personal_pm_effectiveness_memory_idx
  on public.personal_pm_effectiveness (personal_memory_id)
  where personal_memory_id is not null;

create index if not exists personal_pm_effectiveness_decision_idx
  on public.personal_pm_effectiveness (decision_id)
  where decision_id is not null;

create index if not exists personal_pm_effectiveness_dec_eff_idx
  on public.personal_pm_effectiveness (decision_effectiveness_id)
  where decision_effectiveness_id is not null;

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.personal_pm_effectiveness_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists personal_pm_effectiveness_touch_updated_at on public.personal_pm_effectiveness;
create trigger personal_pm_effectiveness_touch_updated_at
  before update on public.personal_pm_effectiveness
  for each row execute function public.personal_pm_effectiveness_touch_updated_at();

-- ─── validated guard trigger ──────────────────────────────────────────────────
-- Validated records cannot be mutated — only archived.

create or replace function public.personal_pm_effectiveness_validated_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.effectiveness_status = 'validated' then
    -- Allow only the transition validated → archived.
    if new.effectiveness_status = 'archived' then
      if (new.summary               is distinct from old.summary)               or
         (new.outcome_classification is distinct from old.outcome_classification) or
         (new.personal_pattern_id   is distinct from old.personal_pattern_id)   or
         (new.personal_memory_id    is distinct from old.personal_memory_id)    or
         (new.decision_id           is distinct from old.decision_id)           or
         (new.decision_effectiveness_id is distinct from old.decision_effectiveness_id) or
         (new.metadata              is distinct from old.metadata)              or
         (new.pm_user_id            is distinct from old.pm_user_id)            or
         (new.workspace_id          is distinct from old.workspace_id) then
        raise exception 'Validated personal PM effectiveness records cannot have fields mutated; only status=archived transition is permitted.';
      end if;
      return new;
    end if;
    raise exception 'Validated personal PM effectiveness records can only be archived, not mutated or otherwise transitioned.';
  end if;
  if tg_op = 'DELETE' and old.effectiveness_status = 'validated' then
    raise exception 'Validated personal PM effectiveness records cannot be deleted. Archive them first.';
  end if;
  return new;
end $$;

drop trigger if exists personal_pm_effectiveness_validated_guard on public.personal_pm_effectiveness;
create trigger personal_pm_effectiveness_validated_guard
  before update or delete on public.personal_pm_effectiveness
  for each row execute function public.personal_pm_effectiveness_validated_guard();

-- ─── personal_pm_effectiveness_sources ───────────────────────────────────────

create table if not exists public.personal_pm_effectiveness_sources (
  id                 uuid        primary key default gen_random_uuid(),
  effectiveness_id   uuid        not null references public.personal_pm_effectiveness(id) on delete cascade,
  source_type        text        not null check (source_type in (
    'platform_event',
    'decision',
    'decision_effectiveness',
    'organizational_pattern',
    'organizational_memory',
    'personal_memory',
    'personal_pattern',
    'outcome',
    'risk',
    'task',
    'milestone',
    'stakeholder'
  )),
  source_id          uuid        not null,
  relationship_type  text        not null check (relationship_type in (
    'supports',
    'contradicts',
    'caused_by',
    'derived_from',
    'reviewed_during',
    'supersedes',
    'related_to'
  )),
  created_at         timestamptz not null default now()
);

comment on table public.personal_pm_effectiveness_sources is
  'Source evidence records for each personal PM effectiveness record. '
  'Every effectiveness record must have at least one source (enforced at service level).';

create index if not exists personal_pm_effectiveness_sources_eff_idx
  on public.personal_pm_effectiveness_sources (effectiveness_id, created_at);

-- Sources of validated effectiveness records are immutable.
create or replace function public.personal_pm_effectiveness_sources_validated_guard()
returns trigger language plpgsql as $$
declare
  eff_status text;
begin
  select effectiveness_status into eff_status
    from public.personal_pm_effectiveness
    where id = coalesce(new.effectiveness_id, old.effectiveness_id);
  if eff_status = 'validated' then
    raise exception 'Sources of validated personal PM effectiveness records cannot be mutated.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists personal_pm_effectiveness_sources_validated_guard on public.personal_pm_effectiveness_sources;
create trigger personal_pm_effectiveness_sources_validated_guard
  before insert or update or delete on public.personal_pm_effectiveness_sources
  for each row execute function public.personal_pm_effectiveness_sources_validated_guard();

-- ─── personal_pm_effectiveness_observations ───────────────────────────────────

create table if not exists public.personal_pm_effectiveness_observations (
  id                   uuid        primary key default gen_random_uuid(),
  effectiveness_id     uuid        not null references public.personal_pm_effectiveness(id) on delete cascade,
  observation_summary  text        not null check (char_length(trim(observation_summary)) > 0),
  recorded_at          timestamptz not null default now(),
  recorded_by          uuid        null references auth.users(id) on delete set null,
  metadata             jsonb       not null default '{}'::jsonb
);

comment on table public.personal_pm_effectiveness_observations is
  'Explicit review notes about why a pattern, memory, decision, or outcome relationship '
  'is considered effective, partially effective, failed, or unknown.';

create index if not exists personal_pm_effectiveness_observations_eff_idx
  on public.personal_pm_effectiveness_observations (effectiveness_id, recorded_at);

-- Observations of validated effectiveness records are immutable.
create or replace function public.personal_pm_effectiveness_observations_validated_guard()
returns trigger language plpgsql as $$
declare
  eff_status text;
begin
  select effectiveness_status into eff_status
    from public.personal_pm_effectiveness
    where id = coalesce(new.effectiveness_id, old.effectiveness_id);
  if eff_status = 'validated' then
    raise exception 'Observations of validated personal PM effectiveness records cannot be mutated.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists personal_pm_effectiveness_observations_validated_guard on public.personal_pm_effectiveness_observations;
create trigger personal_pm_effectiveness_observations_validated_guard
  before insert or update or delete on public.personal_pm_effectiveness_observations
  for each row execute function public.personal_pm_effectiveness_observations_validated_guard();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.personal_pm_effectiveness enable row level security;
alter table public.personal_pm_effectiveness_sources enable row level security;
alter table public.personal_pm_effectiveness_observations enable row level security;

-- personal_pm_effectiveness: PM can only access their own records within their workspace.
drop policy if exists "personal_pm_effectiveness_isolation" on public.personal_pm_effectiveness;
create policy "personal_pm_effectiveness_isolation"
  on public.personal_pm_effectiveness
  for all
  using (
    workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
    and pm_user_id = auth.uid()
  );

-- personal_pm_effectiveness_sources: inherits privacy boundary from parent effectiveness record.
drop policy if exists "personal_pm_effectiveness_sources_isolation" on public.personal_pm_effectiveness_sources;
create policy "personal_pm_effectiveness_sources_isolation"
  on public.personal_pm_effectiveness_sources
  for all
  using (
    effectiveness_id in (
      select id from public.personal_pm_effectiveness
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );

-- personal_pm_effectiveness_observations: inherits privacy boundary from parent effectiveness record.
drop policy if exists "personal_pm_effectiveness_observations_isolation" on public.personal_pm_effectiveness_observations;
create policy "personal_pm_effectiveness_observations_isolation"
  on public.personal_pm_effectiveness_observations
  for all
  using (
    effectiveness_id in (
      select id from public.personal_pm_effectiveness
      where workspace_id = (select (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid)
        and pm_user_id = auth.uid()
    )
  );
