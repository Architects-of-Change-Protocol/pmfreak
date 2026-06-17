-- Organizational Pattern Formation Foundation.
-- Explicit, auditable, customer-owned repeatable operational patterns.
-- No AI, no embeddings, no automatic learning, no autonomous discovery.

create table if not exists public.organizational_patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pattern_category text not null check (pattern_category in (
    'risk_pattern','decision_pattern','schedule_pattern','stakeholder_pattern','delivery_pattern',
    'resource_pattern','dependency_pattern','governance_pattern','execution_pattern','memory_pattern','other'
  )),
  status text not null default 'candidate' check (status in ('candidate','validated','deprecated','archived')),
  confidence text not null check (confidence in ('low','medium','high','very_high')),
  title text not null,
  summary text not null,
  observation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.organizational_pattern_sources (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.organizational_patterns(id) on delete cascade,
  source_type text not null check (source_type in (
    'organizational_memory','platform_event','decision','outcome','risk','task','milestone','dependency','stakeholder'
  )),
  source_id uuid not null,
  relationship_type text not null default 'supports' check (relationship_type in (
    'supports','contradicts','caused_by','derived_from','reviewed_during','supersedes','related_to'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.organizational_pattern_observations (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.organizational_patterns(id) on delete cascade,
  source_type text not null check (source_type in (
    'organizational_memory','platform_event','decision','outcome','risk','task','milestone','dependency','stakeholder'
  )),
  source_id uuid not null,
  observation_summary text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists organizational_patterns_workspace_idx on public.organizational_patterns(workspace_id, updated_at desc);
create index if not exists organizational_patterns_status_idx on public.organizational_patterns(workspace_id, status, updated_at desc);
create index if not exists organizational_patterns_category_idx on public.organizational_patterns(workspace_id, pattern_category, updated_at desc);
create index if not exists organizational_pattern_sources_pattern_idx on public.organizational_pattern_sources(pattern_id, created_at);
create index if not exists organizational_pattern_sources_source_idx on public.organizational_pattern_sources(source_type, source_id);
create index if not exists organizational_pattern_observations_pattern_idx on public.organizational_pattern_observations(pattern_id, recorded_at);

-- Auto-touch updated_at on pattern edits.
create or replace function public.organizational_patterns_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists organizational_patterns_touch_updated_at on public.organizational_patterns;
create trigger organizational_patterns_touch_updated_at
  before update on public.organizational_patterns
  for each row execute function public.organizational_patterns_touch_updated_at();

-- Validated pattern immutability: changes require deprecate-then-recreate.
create or replace function public.organizational_patterns_validated_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'validated' then
    raise exception 'Validated organizational patterns are immutable. To change a validated pattern, deprecate it and create a new one.';
  end if;
  if tg_op = 'DELETE' and old.status = 'validated' then
    raise exception 'Validated organizational patterns cannot be deleted; deprecate them first.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists organizational_patterns_validated_guard on public.organizational_patterns;
create trigger organizational_patterns_validated_guard
  before update or delete on public.organizational_patterns
  for each row execute function public.organizational_patterns_validated_guard();

-- Prevent source mutation on validated patterns.
create or replace function public.organizational_pattern_sources_validated_guard()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.organizational_patterns p
    where p.id = coalesce(new.pattern_id, old.pattern_id)
      and p.status = 'validated'
  ) then
    raise exception 'Sources of validated organizational patterns cannot be mutated.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists organizational_pattern_sources_validated_guard on public.organizational_pattern_sources;
create trigger organizational_pattern_sources_validated_guard
  before insert or update or delete on public.organizational_pattern_sources
  for each row execute function public.organizational_pattern_sources_validated_guard();

-- Keep observation_count in sync automatically.
create or replace function public.organizational_pattern_observations_sync_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.organizational_patterns
       set observation_count = observation_count + 1, updated_at = now()
     where id = new.pattern_id;
  elsif tg_op = 'DELETE' then
    update public.organizational_patterns
       set observation_count = greatest(0, observation_count - 1), updated_at = now()
     where id = old.pattern_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists organizational_pattern_observations_sync_count on public.organizational_pattern_observations;
create trigger organizational_pattern_observations_sync_count
  after insert or delete on public.organizational_pattern_observations
  for each row execute function public.organizational_pattern_observations_sync_count();

-- Workspace-role governance bridge. owner/admin/pm may validate and lifecycle-manage patterns.
create or replace function public.is_organizational_pattern_governor(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','pm')
  )
$$;

alter table public.organizational_patterns enable row level security;
alter table public.organizational_pattern_sources enable row level security;
alter table public.organizational_pattern_observations enable row level security;

-- organizational_patterns
drop policy if exists "workspace members can read organizational_patterns" on public.organizational_patterns;
create policy "workspace members can read organizational_patterns" on public.organizational_patterns
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create organizational_patterns" on public.organizational_patterns;
create policy "workspace members can create organizational_patterns" on public.organizational_patterns
  for insert to authenticated with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "workspace members can update candidate organizational_patterns" on public.organizational_patterns;
create policy "workspace members can update candidate organizational_patterns" on public.organizational_patterns
  for update to authenticated
  using (public.is_workspace_member(workspace_id) and status = 'candidate')
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "governance users can manage organizational_patterns lifecycle" on public.organizational_patterns;
create policy "governance users can manage organizational_patterns lifecycle" on public.organizational_patterns
  for update to authenticated
  using (public.is_organizational_pattern_governor(workspace_id))
  with check (public.is_organizational_pattern_governor(workspace_id));

drop policy if exists "workspace members can delete non-validated organizational_patterns" on public.organizational_patterns;
create policy "workspace members can delete non-validated organizational_patterns" on public.organizational_patterns
  for delete to authenticated using (public.is_workspace_member(workspace_id) and status <> 'validated');

-- organizational_pattern_sources
drop policy if exists "workspace members can read organizational_pattern_sources" on public.organizational_pattern_sources;
create policy "workspace members can read organizational_pattern_sources" on public.organizational_pattern_sources
  for select to authenticated using (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id))
  );

drop policy if exists "workspace members can create organizational_pattern_sources" on public.organizational_pattern_sources;
create policy "workspace members can create organizational_pattern_sources" on public.organizational_pattern_sources
  for insert to authenticated with check (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id) and p.status <> 'validated')
  );

drop policy if exists "workspace members can update organizational_pattern_sources" on public.organizational_pattern_sources;
create policy "workspace members can update organizational_pattern_sources" on public.organizational_pattern_sources
  for update to authenticated
  using (exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id) and p.status <> 'validated'))
  with check (exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id) and p.status <> 'validated'));

drop policy if exists "workspace members can delete organizational_pattern_sources" on public.organizational_pattern_sources;
create policy "workspace members can delete organizational_pattern_sources" on public.organizational_pattern_sources
  for delete to authenticated using (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id) and p.status <> 'validated')
  );

-- organizational_pattern_observations
drop policy if exists "workspace members can read organizational_pattern_observations" on public.organizational_pattern_observations;
create policy "workspace members can read organizational_pattern_observations" on public.organizational_pattern_observations
  for select to authenticated using (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id))
  );

drop policy if exists "workspace members can create organizational_pattern_observations" on public.organizational_pattern_observations;
create policy "workspace members can create organizational_pattern_observations" on public.organizational_pattern_observations
  for insert to authenticated with check (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id))
  );

drop policy if exists "workspace members can delete organizational_pattern_observations" on public.organizational_pattern_observations;
create policy "workspace members can delete organizational_pattern_observations" on public.organizational_pattern_observations
  for delete to authenticated using (
    exists (select 1 from public.organizational_patterns p where p.id = pattern_id and public.is_workspace_member(p.workspace_id))
  );

comment on table public.organizational_patterns is 'Sovereign organizational pattern registry: explicit, inspectable, explainable, exportable, auditable, and traceable to source evidence. No AI, no automatic discovery.';
comment on table public.organizational_pattern_sources is 'Lineage table linking every organizational pattern to source evidence. Patterns must reference evidence.';
comment on table public.organizational_pattern_observations is 'Observation log: accumulating observations strengthens a pattern. Minimum 3 observations required for validation.';
comment on column public.organizational_patterns.metadata is 'Customer-owned structured metadata only. No embeddings, vector payloads, or automatic learning artifacts.';
