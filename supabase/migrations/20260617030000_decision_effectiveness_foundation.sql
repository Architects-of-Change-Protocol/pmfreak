-- Decision Effectiveness Foundation.
-- Structured effectiveness intelligence: inspectable, explainable, exportable, reproducible, auditable.
-- No AI, no ML, no scoring, no prediction, no recommendations, no forecasting, no ranking.

create table if not exists public.decision_effectiveness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  decision_id uuid not null,
  project_id uuid not null,
  effectiveness_status text not null default 'candidate' check (effectiveness_status in ('candidate','validated','archived')),
  outcome_classification text not null check (outcome_classification in ('success','partial_success','failure','unknown')),
  approval_duration_seconds bigint null,
  implementation_duration_seconds bigint null,
  time_to_outcome_seconds bigint null,
  evidence_count integer not null default 0,
  outcome_count integer not null default 0,
  pattern_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.decision_effectiveness_observations (
  id uuid primary key default gen_random_uuid(),
  effectiveness_id uuid not null references public.decision_effectiveness(id) on delete cascade,
  observation_type text not null,
  summary text not null,
  source_type text not null,
  source_id uuid not null,
  recorded_at timestamptz not null default now()
);

create index if not exists decision_effectiveness_workspace_idx on public.decision_effectiveness(workspace_id, updated_at desc);
create index if not exists decision_effectiveness_decision_idx on public.decision_effectiveness(decision_id, workspace_id);
create index if not exists decision_effectiveness_status_idx on public.decision_effectiveness(workspace_id, effectiveness_status, updated_at desc);
create index if not exists decision_effectiveness_observations_effectiveness_idx on public.decision_effectiveness_observations(effectiveness_id, recorded_at);

-- Auto-touch updated_at.
create or replace function public.decision_effectiveness_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists decision_effectiveness_touch_updated_at on public.decision_effectiveness;
create trigger decision_effectiveness_touch_updated_at
  before update on public.decision_effectiveness
  for each row execute function public.decision_effectiveness_touch_updated_at();

-- Validated effectiveness immutability: must archive and recreate.
create or replace function public.decision_effectiveness_validated_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.effectiveness_status = 'validated' then
    raise exception 'Validated effectiveness records are immutable. Archive and recreate to change.';
  end if;
  if tg_op = 'DELETE' and old.effectiveness_status = 'validated' then
    raise exception 'Validated effectiveness records cannot be deleted; archive them first.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists decision_effectiveness_validated_guard on public.decision_effectiveness;
create trigger decision_effectiveness_validated_guard
  before update or delete on public.decision_effectiveness
  for each row execute function public.decision_effectiveness_validated_guard();

-- Workspace-role governance bridge.
create or replace function public.is_decision_effectiveness_governor(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin','pm')
  )
$$;

alter table public.decision_effectiveness enable row level security;
alter table public.decision_effectiveness_observations enable row level security;

-- decision_effectiveness
drop policy if exists "workspace members can read decision_effectiveness" on public.decision_effectiveness;
create policy "workspace members can read decision_effectiveness" on public.decision_effectiveness
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create decision_effectiveness" on public.decision_effectiveness;
create policy "workspace members can create decision_effectiveness" on public.decision_effectiveness
  for insert to authenticated with check (public.is_workspace_member(workspace_id) and (created_by is null or created_by = auth.uid()));

drop policy if exists "workspace members can update candidate decision_effectiveness" on public.decision_effectiveness;
create policy "workspace members can update candidate decision_effectiveness" on public.decision_effectiveness
  for update to authenticated
  using (public.is_workspace_member(workspace_id) and effectiveness_status = 'candidate')
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "governance users can manage decision_effectiveness lifecycle" on public.decision_effectiveness;
create policy "governance users can manage decision_effectiveness lifecycle" on public.decision_effectiveness
  for update to authenticated
  using (public.is_decision_effectiveness_governor(workspace_id))
  with check (public.is_decision_effectiveness_governor(workspace_id));

drop policy if exists "workspace members can archive non-validated decision_effectiveness" on public.decision_effectiveness;
create policy "workspace members can archive non-validated decision_effectiveness" on public.decision_effectiveness
  for delete to authenticated using (public.is_workspace_member(workspace_id) and effectiveness_status <> 'validated');

-- decision_effectiveness_observations
drop policy if exists "workspace members can read decision_effectiveness_observations" on public.decision_effectiveness_observations;
create policy "workspace members can read decision_effectiveness_observations" on public.decision_effectiveness_observations
  for select to authenticated using (
    exists (select 1 from public.decision_effectiveness e where e.id = effectiveness_id and public.is_workspace_member(e.workspace_id))
  );

drop policy if exists "workspace members can create decision_effectiveness_observations" on public.decision_effectiveness_observations;
create policy "workspace members can create decision_effectiveness_observations" on public.decision_effectiveness_observations
  for insert to authenticated with check (
    exists (select 1 from public.decision_effectiveness e where e.id = effectiveness_id and public.is_workspace_member(e.workspace_id))
  );

drop policy if exists "workspace members can delete decision_effectiveness_observations" on public.decision_effectiveness_observations;
create policy "workspace members can delete decision_effectiveness_observations" on public.decision_effectiveness_observations
  for delete to authenticated using (
    exists (select 1 from public.decision_effectiveness e where e.id = effectiveness_id and public.is_workspace_member(e.workspace_id))
  );

comment on table public.decision_effectiveness is 'Sovereign decision effectiveness registry: inspectable, explainable, exportable, auditable. No AI, no scoring, no prediction.';
comment on table public.decision_effectiveness_observations is 'Observation log linking every effectiveness assessment to source evidence.';
comment on column public.decision_effectiveness.metadata is 'Customer-owned structured metadata only. No embeddings, no scoring artifacts, no ML payloads.';
