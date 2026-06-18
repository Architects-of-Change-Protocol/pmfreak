-- ─────────────────────────────────────────────────────────────────────────────
-- Intelligence Bridge Foundation
-- Connects personal PM intelligence to organizational intelligence records
-- without AI, scoring, profiling, ranking, or cross-PM leakage.
--
-- Three tables:
--   intelligence_bridge_links       — primary bridge record
--   intelligence_bridge_sources     — additional supporting evidence
--   intelligence_bridge_observations — explicit review notes
--
-- Privacy model: each PM sees ONLY their own bridges.
-- RLS enforces workspace_id + pm_user_id on every policy.
-- Frozen bridges cannot be edited, deleted, or deprecated — only archived.
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS helper: returns true only when the calling user IS the pm_user_id
-- inside a workspace they belong to with a PM-capable role.
create or replace function public.is_bridge_owner(
  target_workspace_id uuid,
  target_pm_user_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id      = auth.uid()
      and wm.user_id      = target_pm_user_id
      and wm.role in ('owner', 'admin', 'pm')
  )
$$;

-- ─── intelligence_bridge_links ────────────────────────────────────────────────

create table if not exists public.intelligence_bridge_links (
  id                        uuid        primary key default gen_random_uuid(),
  workspace_id              uuid        not null references public.workspaces(id) on delete cascade,
  pm_user_id                uuid        not null references auth.users(id) on delete cascade,
  relationship_type         text        not null,
  status                    text        not null default 'active',
  personal_source_type      text        not null,
  personal_source_id        uuid        not null,
  organizational_source_type text       not null,
  organizational_source_id  uuid        not null,
  summary                   text        not null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid        null references auth.users(id) on delete set null,
  metadata                  jsonb       not null default '{}'::jsonb,

  constraint chk_bridge_summary_not_empty
    check (length(trim(summary)) > 0),

  constraint chk_bridge_relationship_type
    check (relationship_type in (
      'personal_pattern_supports_org_pattern',
      'personal_pattern_contradicts_org_pattern',
      'personal_effectiveness_supports_org_effectiveness',
      'personal_effectiveness_contradicts_org_effectiveness',
      'personal_memory_supports_org_memory',
      'personal_memory_contradicts_org_memory',
      'personal_candidate_supports_org_candidate',
      'personal_candidate_contradicts_org_candidate',
      'org_pattern_contextualizes_personal_pattern',
      'org_memory_contextualizes_personal_memory',
      'org_effectiveness_contextualizes_personal_effectiveness',
      'shared_evidence',
      'related_to'
    )),

  constraint chk_bridge_personal_source_type
    check (personal_source_type in (
      'personal_memory',
      'personal_pattern',
      'personal_effectiveness',
      'personal_pattern_candidate',
      'personal_event'
    )),

  constraint chk_bridge_organizational_source_type
    check (organizational_source_type in (
      'organizational_memory',
      'organizational_pattern',
      'decision_effectiveness',
      'pattern_candidate',
      'platform_event',
      'decision',
      'outcome'
    )),

  constraint chk_bridge_status
    check (status in ('active', 'archived', 'frozen', 'deprecated'))
);

create index if not exists idx_bridge_links_workspace_pm_updated
  on public.intelligence_bridge_links (workspace_id, pm_user_id, updated_at desc);

create index if not exists idx_bridge_links_workspace_pm_status_updated
  on public.intelligence_bridge_links (workspace_id, pm_user_id, status, updated_at desc);

create index if not exists idx_bridge_links_workspace_relationship_updated
  on public.intelligence_bridge_links (workspace_id, relationship_type, updated_at desc);

create index if not exists idx_bridge_links_personal_source
  on public.intelligence_bridge_links (personal_source_type, personal_source_id);

create index if not exists idx_bridge_links_organizational_source
  on public.intelligence_bridge_links (organizational_source_type, organizational_source_id);

-- ─── intelligence_bridge_sources ─────────────────────────────────────────────

create table if not exists public.intelligence_bridge_sources (
  id                uuid        primary key default gen_random_uuid(),
  bridge_id         uuid        not null references public.intelligence_bridge_links(id) on delete cascade,
  source_type       text        not null,
  source_id         uuid        not null,
  relationship_type text        not null,
  created_at        timestamptz not null default now(),

  constraint chk_bridge_source_type
    check (source_type in (
      'platform_event',
      'decision',
      'outcome',
      'organizational_memory',
      'organizational_pattern',
      'decision_effectiveness',
      'pattern_candidate',
      'personal_memory',
      'personal_pattern',
      'personal_effectiveness',
      'personal_pattern_candidate'
    )),

  constraint chk_bridge_source_relationship_type
    check (relationship_type in (
      'supports',
      'contradicts',
      'derived_from',
      'reviewed_during',
      'contextualizes',
      'related_to'
    ))
);

create index if not exists idx_bridge_sources_bridge_id
  on public.intelligence_bridge_sources (bridge_id);

-- ─── intelligence_bridge_observations ────────────────────────────────────────

create table if not exists public.intelligence_bridge_observations (
  id                   uuid        primary key default gen_random_uuid(),
  bridge_id            uuid        not null references public.intelligence_bridge_links(id) on delete cascade,
  observation_summary  text        not null,
  recorded_at          timestamptz not null default now(),
  recorded_by          uuid        null references auth.users(id) on delete set null,
  metadata             jsonb       not null default '{}'::jsonb,

  constraint chk_bridge_observation_summary_not_empty
    check (length(trim(observation_summary)) > 0)
);

create index if not exists idx_bridge_observations_bridge_id
  on public.intelligence_bridge_observations (bridge_id);

-- ─── updated_at maintenance ───────────────────────────────────────────────────

create or replace function public.intelligence_bridge_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists intelligence_bridge_set_updated_at on public.intelligence_bridge_links;
create trigger intelligence_bridge_set_updated_at
  before update on public.intelligence_bridge_links
  for each row execute function public.intelligence_bridge_set_updated_at();

-- ─── Frozen bridge guard ──────────────────────────────────────────────────────
-- Frozen bridges cannot be edited or deleted — only archived.
-- This is enforced at the DB level to complement service-level checks.

create or replace function public.intelligence_bridge_frozen_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'frozen' and new.status <> 'archived' then
    raise exception 'Frozen intelligence bridge cannot be edited; archive it instead.';
  end if;
  if tg_op = 'DELETE' and old.status = 'frozen' then
    raise exception 'Frozen intelligence bridge cannot be deleted; archive instead.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists intelligence_bridge_frozen_guard on public.intelligence_bridge_links;
create trigger intelligence_bridge_frozen_guard
  before update or delete on public.intelligence_bridge_links
  for each row execute function public.intelligence_bridge_frozen_guard();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.intelligence_bridge_links       enable row level security;
alter table public.intelligence_bridge_sources     enable row level security;
alter table public.intelligence_bridge_observations enable row level security;

-- intelligence_bridge_links — read
drop policy if exists "bridge owner can read own bridge links" on public.intelligence_bridge_links;
create policy "bridge owner can read own bridge links"
  on public.intelligence_bridge_links for select to authenticated
  using (public.is_bridge_owner(workspace_id, pm_user_id));

-- intelligence_bridge_links — insert
drop policy if exists "bridge owner can create own bridge links" on public.intelligence_bridge_links;
create policy "bridge owner can create own bridge links"
  on public.intelligence_bridge_links for insert to authenticated
  with check (
    public.is_bridge_owner(workspace_id, pm_user_id)
    and (created_by is null or created_by = auth.uid())
  );

-- intelligence_bridge_links — update active records
drop policy if exists "bridge owner can update active bridge links" on public.intelligence_bridge_links;
create policy "bridge owner can update active bridge links"
  on public.intelligence_bridge_links for update to authenticated
  using  (public.is_bridge_owner(workspace_id, pm_user_id) and status = 'active')
  with check (public.is_bridge_owner(workspace_id, pm_user_id) and status = 'active');

-- intelligence_bridge_links — preserve (freeze / archive / deprecate)
drop policy if exists "bridge owner can preserve bridge links" on public.intelligence_bridge_links;
create policy "bridge owner can preserve bridge links"
  on public.intelligence_bridge_links for update to authenticated
  using  (public.is_bridge_owner(workspace_id, pm_user_id))
  with check (public.is_bridge_owner(workspace_id, pm_user_id));

-- intelligence_bridge_links — delete (frozen guard prevents frozen deletes at trigger level)
drop policy if exists "bridge owner can delete non-frozen bridge links" on public.intelligence_bridge_links;
create policy "bridge owner can delete non-frozen bridge links"
  on public.intelligence_bridge_links for delete to authenticated
  using (public.is_bridge_owner(workspace_id, pm_user_id) and status <> 'frozen');

-- intelligence_bridge_sources — read
drop policy if exists "bridge owner can read own bridge sources" on public.intelligence_bridge_sources;
create policy "bridge owner can read own bridge sources"
  on public.intelligence_bridge_sources for select to authenticated
  using (
    exists (
      select 1 from public.intelligence_bridge_links b
      where b.id = bridge_id
        and public.is_bridge_owner(b.workspace_id, b.pm_user_id)
    )
  );

-- intelligence_bridge_sources — insert (forbidden on frozen bridges)
drop policy if exists "bridge owner can create sources on non-frozen bridges" on public.intelligence_bridge_sources;
create policy "bridge owner can create sources on non-frozen bridges"
  on public.intelligence_bridge_sources for insert to authenticated
  with check (
    exists (
      select 1 from public.intelligence_bridge_links b
      where b.id = bridge_id
        and public.is_bridge_owner(b.workspace_id, b.pm_user_id)
        and b.status <> 'frozen'
    )
  );

-- intelligence_bridge_sources — delete (forbidden on frozen bridges)
drop policy if exists "bridge owner can delete sources on non-frozen bridges" on public.intelligence_bridge_sources;
create policy "bridge owner can delete sources on non-frozen bridges"
  on public.intelligence_bridge_sources for delete to authenticated
  using (
    exists (
      select 1 from public.intelligence_bridge_links b
      where b.id = bridge_id
        and public.is_bridge_owner(b.workspace_id, b.pm_user_id)
        and b.status <> 'frozen'
    )
  );

-- intelligence_bridge_observations — read
drop policy if exists "bridge owner can read own bridge observations" on public.intelligence_bridge_observations;
create policy "bridge owner can read own bridge observations"
  on public.intelligence_bridge_observations for select to authenticated
  using (
    exists (
      select 1 from public.intelligence_bridge_links b
      where b.id = bridge_id
        and public.is_bridge_owner(b.workspace_id, b.pm_user_id)
    )
  );

-- intelligence_bridge_observations — insert (forbidden on frozen bridges)
drop policy if exists "bridge owner can create observations on non-frozen bridges" on public.intelligence_bridge_observations;
create policy "bridge owner can create observations on non-frozen bridges"
  on public.intelligence_bridge_observations for insert to authenticated
  with check (
    exists (
      select 1 from public.intelligence_bridge_links b
      where b.id = bridge_id
        and public.is_bridge_owner(b.workspace_id, b.pm_user_id)
        and b.status <> 'frozen'
    )
  );
