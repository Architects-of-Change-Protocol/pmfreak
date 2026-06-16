-- ─────────────────────────────────────────────────────────────────────────────
-- platform_events — P0 hardening
--
-- This migration adds three protections identified in the architectural review:
--
-- P0-1: Immutability trigger — enforce append-only at the database level.
--       Even the service role cannot UPDATE or DELETE platform_events rows.
--       Corrections must be represented as new compensating events.
--
-- P0-3: Cross-workspace project_id validation — strengthen the INSERT RLS
--       policy to verify that project_id, when supplied, belongs to the
--       same workspace as workspace_id.
--
-- Depends on: 20260616000000_platform_events_foundation.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── P0-1: Immutability trigger ──────────────────────────────────────────────

create or replace function public.prevent_platform_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'platform_events are append-only. '
    'History must not be rewritten. '
    'Emit a compensating event instead of mutating or deleting an existing record. '
    '(operation: %, table: platform_events, id: %)',
    tg_op,
    coalesce(old.id::text, '?');
end;
$$;

-- Fires before any UPDATE or DELETE attempt — blocks both service role and anon role.
create trigger platform_events_immutability_guard
  before update or delete
  on public.platform_events
  for each row
  execute function public.prevent_platform_event_mutation();

-- ─── P0-3: Cross-workspace project_id validation ─────────────────────────────
-- Drop the existing INSERT policy and replace it with one that also validates
-- that project_id, when present, belongs to the declared workspace.

drop policy if exists "workspace members can insert platform_events" on public.platform_events;

create policy "workspace members can insert platform_events"
  on public.platform_events for insert
  with check (
    -- Caller must be a member of the declared workspace
    is_workspace_member(workspace_id)
    and
    -- If a project is referenced, it must belong to the same workspace
    (
      project_id is null
      or exists (
        select 1
        from public.projects p
        where p.id = project_id
          and p.workspace_id = platform_events.workspace_id
      )
    )
  );

-- ─── Comment updates ─────────────────────────────────────────────────────────

comment on function public.prevent_platform_event_mutation() is
  'Enforces append-only semantics on platform_events at the database level. '
  'Fires before UPDATE or DELETE. Cannot be bypassed by the service role. '
  'Corrections must be recorded as new compensating events.';
