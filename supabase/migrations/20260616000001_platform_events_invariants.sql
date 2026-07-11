-- Platform event invariants: append-only history, recursive sensitive payload validation,
-- and workspace/project ownership integrity.

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid null references public.projects(id) on delete restrict,
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'system', 'ai_agent')),
  actor_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint platform_events_user_actor_requires_actor_id
    check (actor_type <> 'user' or actor_id is not null)
);

create index if not exists platform_events_workspace_created_idx
  on public.platform_events(workspace_id, created_at desc);

create index if not exists platform_events_project_created_idx
  on public.platform_events(project_id, created_at desc)
  where project_id is not null;

create unique index if not exists projects_workspace_id_id_uniq
  on public.projects(workspace_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_events_project_workspace_fkey'
      and conrelid = 'public.platform_events'::regclass
  ) then
    alter table public.platform_events
      add constraint platform_events_project_workspace_fkey
      foreign key (workspace_id, project_id)
      references public.projects(workspace_id, id)
      on delete restrict;
  end if;
end $$;

create or replace function public.prevent_platform_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'platform_events are append-only. Emit a compensating event instead of mutating history.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists platform_events_prevent_update on public.platform_events;
create trigger platform_events_prevent_update
  before update on public.platform_events
  for each row
  execute function public.prevent_platform_event_mutation();

drop trigger if exists platform_events_prevent_delete on public.platform_events;
create trigger platform_events_prevent_delete
  before delete on public.platform_events
  for each row
  execute function public.prevent_platform_event_mutation();

create or replace function public.find_forbidden_platform_event_payload_key(value jsonb, path text default '')
returns text
language plpgsql
immutable
as $$
declare
  forbidden_keys constant text[] := array[
    'full_email_body',
    'full_contract_text',
    'raw_document_text',
    'password',
    'secret',
    'token',
    'api_key'
  ];
  item record;
  child_path text;
  found_path text;
begin
  if value is null then
    return null;
  end if;

  if jsonb_typeof(value) = 'object' then
    for item in select key, value from jsonb_each(value) loop
      child_path := case when path = '' then item.key else path || '.' || item.key end;

      if lower(item.key) = any (forbidden_keys) then
        return child_path;
      end if;

      found_path := public.find_forbidden_platform_event_payload_key(item.value, child_path);
      if found_path is not null then
        return found_path;
      end if;
    end loop;
  elsif jsonb_typeof(value) = 'array' then
    for item in select ordinality - 1 as idx, value from jsonb_array_elements(value) with ordinality loop
      child_path := path || '[' || item.idx || ']';
      found_path := public.find_forbidden_platform_event_payload_key(item.value, child_path);
      if found_path is not null then
        return found_path;
      end if;
    end loop;
  end if;

  return null;
end;
$$;

create or replace function public.validate_platform_event_payload()
returns trigger
language plpgsql
as $$
declare
  forbidden_path text;
begin
  forbidden_path := public.find_forbidden_platform_event_payload_key(new.payload);

  if forbidden_path is not null then
    raise exception 'Forbidden payload key detected: %', forbidden_path
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists platform_events_validate_payload on public.platform_events;
create trigger platform_events_validate_payload
  before insert on public.platform_events
  for each row
  execute function public.validate_platform_event_payload();

create or replace function public.validate_platform_event_project_workspace()
returns trigger
language plpgsql
as $$
begin
  if new.project_id is not null and not exists (
    select 1
    from public.projects p
    where p.id = new.project_id
      and p.workspace_id = new.workspace_id
  ) then
    raise exception 'platform_events workspace/project ownership mismatch: project_id does not belong to workspace_id.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists platform_events_validate_project_workspace on public.platform_events;
create trigger platform_events_validate_project_workspace
  before insert on public.platform_events
  for each row
  execute function public.validate_platform_event_project_workspace();

alter table public.platform_events enable row level security;

grant insert, select on public.platform_events to service_role;
revoke update, delete on public.platform_events from anon, authenticated, service_role;
