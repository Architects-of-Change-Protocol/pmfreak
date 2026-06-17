-- Constitutional decision lifecycle governance layer.
-- Enforces approved implementation metadata and records structured outcomes.

alter table public.project_decisions
  add column if not exists implemented_by uuid null references auth.users(id) on delete set null,
  add column if not exists implemented_at timestamptz null,
  add column if not exists implementation_notes text null;

create unique index if not exists project_decisions_id_workspace_project_uidx on public.project_decisions(id, workspace_id, project_id);

create table if not exists public.decision_outcomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  decision_id uuid not null references public.project_decisions(id) on delete cascade,
  outcome_type text not null check (outcome_type in (
    'risk_reduction','schedule_improvement','cost_avoidance','stakeholder_alignment',
    'resource_optimization','governance_compliance','other'
  )),
  outcome_status text not null check (outcome_status in (
    'success','partial_success','failure','unknown'
  )),
  summary text not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint decision_outcomes_decision_workspace_project_fkey foreign key (decision_id, workspace_id, project_id)
    references public.project_decisions(id, workspace_id, project_id) on delete cascade
);

create index if not exists decision_outcomes_decision_idx on public.decision_outcomes(decision_id, recorded_at desc);
create index if not exists decision_outcomes_workspace_project_status_idx on public.decision_outcomes(workspace_id, project_id, outcome_status, recorded_at desc);

alter table public.decision_outcomes enable row level security;

drop policy if exists "workspace members can read decision_outcomes" on public.decision_outcomes;
create policy "workspace members can read decision_outcomes" on public.decision_outcomes for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can record decision_outcomes" on public.decision_outcomes;
create policy "workspace members can record decision_outcomes" on public.decision_outcomes for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and recorded_by = auth.uid()
  and exists (select 1 from public.project_decisions d where d.id = decision_outcomes.decision_id and d.workspace_id = decision_outcomes.workspace_id and d.project_id = decision_outcomes.project_id)
);
