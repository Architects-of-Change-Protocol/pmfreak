-- Organizational Memory Foundation.
-- Explicit, auditable, customer-owned memory. No AI, no embeddings, no automatic learning.

create table if not exists public.organizational_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  memory_scope text not null check (memory_scope in ('workspace','project','team')),
  memory_category text not null check (memory_category in (
    'risk_pattern','decision_pattern','stakeholder_pattern','schedule_pattern','delivery_pattern',
    'dependency_pattern','resource_pattern','governance_pattern','execution_pattern','other'
  )),
  title text not null,
  summary text not null,
  confidence text not null check (confidence in ('low','medium','high','very_high')),
  status text not null default 'active' check (status in ('active','archived','frozen','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint organizational_memory_project_scope_check check ((memory_scope = 'project') = (project_id is not null) or memory_scope <> 'project')
);

create table if not exists public.organizational_memory_sources (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.organizational_memory(id) on delete cascade,
  source_type text not null check (source_type in ('platform_event','decision','outcome','risk','task','milestone','dependency','stakeholder','recommendation')),
  source_id uuid not null,
  relationship_type text not null default 'supports' check (relationship_type in ('supports','contradicts','caused_by','derived_from','reviewed_during','supersedes','related_to')),
  created_at timestamptz not null default now()
);

create index if not exists organizational_memory_workspace_idx on public.organizational_memory(workspace_id, updated_at desc);
create index if not exists organizational_memory_project_idx on public.organizational_memory(project_id, updated_at desc) where project_id is not null;
create index if not exists organizational_memory_status_idx on public.organizational_memory(workspace_id, status, updated_at desc);
create index if not exists organizational_memory_category_idx on public.organizational_memory(workspace_id, memory_category, updated_at desc);
create index if not exists organizational_memory_sources_memory_idx on public.organizational_memory_sources(memory_id, created_at);
create index if not exists organizational_memory_sources_source_idx on public.organizational_memory_sources(source_type, source_id);

create or replace function public.organizational_memory_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists organizational_memory_touch_updated_at on public.organizational_memory;
create trigger organizational_memory_touch_updated_at
  before update on public.organizational_memory
  for each row execute function public.organizational_memory_touch_updated_at();

create or replace function public.organizational_memory_frozen_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'frozen' and new.status <> 'archived' then
    raise exception 'Frozen organizational memory cannot be edited or mutated; it can only be archived.';
  end if;
  if tg_op = 'DELETE' and old.status = 'frozen' then
    raise exception 'Frozen organizational memory cannot be deleted; archive it instead.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists organizational_memory_frozen_guard on public.organizational_memory;
create trigger organizational_memory_frozen_guard
  before update or delete on public.organizational_memory
  for each row execute function public.organizational_memory_frozen_guard();

create or replace function public.organizational_memory_sources_frozen_guard()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.organizational_memory m
    where m.id = coalesce(new.memory_id, old.memory_id)
      and m.status = 'frozen'
  ) then
    raise exception 'Frozen organizational memory sources cannot be mutated.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists organizational_memory_sources_frozen_guard on public.organizational_memory_sources;
create trigger organizational_memory_sources_frozen_guard
  before insert or update or delete on public.organizational_memory_sources
  for each row execute function public.organizational_memory_sources_frozen_guard();

-- Temporary workspace-role governance bridge for memory preservation.
-- Existing PMFreak runtime/capability governance is not invoked from RLS policies;
-- keep the privileged owner/admin/pm role assumption centralized in this function only.
create or replace function public.is_organizational_memory_governor(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','pm')
  )
$$;

alter table public.organizational_memory enable row level security;
alter table public.organizational_memory_sources enable row level security;

drop policy if exists "workspace members can read organizational_memory" on public.organizational_memory;
create policy "workspace members can read organizational_memory" on public.organizational_memory
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create organizational_memory" on public.organizational_memory;
create policy "workspace members can create organizational_memory" on public.organizational_memory
  for insert to authenticated with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "workspace members can update active organizational_memory" on public.organizational_memory;
create policy "workspace members can update active organizational_memory" on public.organizational_memory
  for update to authenticated using (public.is_workspace_member(workspace_id) and status = 'active')
  with check (public.is_workspace_member(workspace_id) and status = 'active');

drop policy if exists "governance users can preserve organizational_memory" on public.organizational_memory;
create policy "governance users can preserve organizational_memory" on public.organizational_memory
  for update to authenticated using (public.is_organizational_memory_governor(workspace_id))
  with check (public.is_organizational_memory_governor(workspace_id));

drop policy if exists "workspace members can delete nonfrozen organizational_memory" on public.organizational_memory;
create policy "workspace members can delete nonfrozen organizational_memory" on public.organizational_memory
  for delete to authenticated using (public.is_workspace_member(workspace_id) and status <> 'frozen');

drop policy if exists "workspace members can read organizational_memory_sources" on public.organizational_memory_sources;
create policy "workspace members can read organizational_memory_sources" on public.organizational_memory_sources
  for select to authenticated using (exists (select 1 from public.organizational_memory m where m.id = memory_id and public.is_workspace_member(m.workspace_id)));

drop policy if exists "workspace members can create organizational_memory_sources" on public.organizational_memory_sources;
create policy "workspace members can create organizational_memory_sources" on public.organizational_memory_sources
  for insert to authenticated with check (exists (select 1 from public.organizational_memory m where m.id = memory_id and public.is_workspace_member(m.workspace_id) and m.status <> 'frozen'));

drop policy if exists "workspace members can update organizational_memory_sources" on public.organizational_memory_sources;
create policy "workspace members can update organizational_memory_sources" on public.organizational_memory_sources
  for update to authenticated using (exists (select 1 from public.organizational_memory m where m.id = memory_id and public.is_workspace_member(m.workspace_id) and m.status <> 'frozen'))
  with check (exists (select 1 from public.organizational_memory m where m.id = memory_id and public.is_workspace_member(m.workspace_id) and m.status <> 'frozen'));

drop policy if exists "workspace members can delete organizational_memory_sources" on public.organizational_memory_sources;
create policy "workspace members can delete organizational_memory_sources" on public.organizational_memory_sources
  for delete to authenticated using (exists (select 1 from public.organizational_memory m where m.id = memory_id and public.is_workspace_member(m.workspace_id) and m.status <> 'frozen'));

comment on table public.organizational_memory is 'Sovereign organizational memory registry: explicit, inspectable, explainable, exportable, editable, auditable, deletable, and traceable to source events.';
comment on table public.organizational_memory_sources is 'Lineage table linking every organizational memory record to source evidence. No memory may be created without explicit sources at the service layer.';
comment on column public.organizational_memory.metadata is 'Customer-owned structured metadata only. No embeddings, vector payloads, LLM hidden memory, or automatic learning artifacts.';
