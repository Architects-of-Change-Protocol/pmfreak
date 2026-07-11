create table if not exists public.intervention_memory (
  intervention_id text primary key,
  company_id uuid not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null check (source in ('copilot','runtime','governance','execution_engine','stakeholder_engine')),
  intervention_type text not null check (intervention_type in ('escalation','mitigation','stakeholder_alignment','dependency_resolution','timeline_recovery','governance_action','execution_coordination','risk_containment')),
  operational_domain text not null check (operational_domain in ('delivery','risk','governance','stakeholder','financial','timeline','general')),
  severity text not null check (severity in ('low','medium','high','critical')),
  intervention_text text not null,
  target_stakeholders text[] not null default '{}',
  related_patterns text[] not null default '{}',
  related_nutrients text[] not null default '{}',
  runtime_decision_id text null,
  lineage jsonb not null default '{}'::jsonb,
  outcome_status text not null default 'pending' check (outcome_status in ('pending','accepted','ignored','resolved','escalated','failed','partially_resolved')),
  outcome_summary text null,
  outcome_updated_at timestamptz null,
  freshness_score numeric(5,2) not null default 0
);

create index if not exists intervention_memory_workspace_created_idx on public.intervention_memory(workspace_id, created_at desc);
create index if not exists intervention_memory_workspace_project_idx on public.intervention_memory(workspace_id, project_id, created_at desc);
create index if not exists intervention_memory_domain_severity_idx on public.intervention_memory(workspace_id, operational_domain, severity, created_at desc);

alter table public.intervention_memory enable row level security;

drop policy if exists "workspace members can read intervention_memory" on public.intervention_memory;
create policy "workspace members can read intervention_memory" on public.intervention_memory
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert intervention_memory" on public.intervention_memory;
create policy "workspace members can insert intervention_memory" on public.intervention_memory
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update intervention_memory" on public.intervention_memory;
create policy "workspace members can update intervention_memory" on public.intervention_memory
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "service role full access intervention_memory" on public.intervention_memory;
create policy "service role full access intervention_memory" on public.intervention_memory
  for all to service_role
  using (true)
  with check (true);
