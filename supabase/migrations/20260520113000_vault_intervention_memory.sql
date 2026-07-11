create table if not exists public.vault_interventions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  target_pattern_id uuid null references public.vault_learned_patterns(id) on delete set null,
  intervention_type text not null check (intervention_type in ('follow_up','escalation','technical_session','approval_request','vendor_coordination','customer_alignment','internal_alignment','risk_acceptance','recovery_action','governance_clarification','logistics_push','financial_escalation')),
  title text not null,
  summary text not null,
  attempted_at timestamptz not null,
  actor_user_id uuid null,
  outcome text not null check (outcome in ('helped','failed','worsened','stalled','inconclusive','pending','recovered')),
  efficacy_score integer not null check (efficacy_score >= 0 and efficacy_score <= 100),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  fatigue_level text not null check (fatigue_level in ('none','low','medium','high')),
  repeated_attempt_count integer not null default 1,
  failed_attempt_count integer not null default 0,
  recommended_next_escalation text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_interventions_workspace_idx on public.vault_interventions(workspace_id);
create index if not exists vault_interventions_project_idx on public.vault_interventions(project_id);
create index if not exists vault_interventions_target_pattern_idx on public.vault_interventions(target_pattern_id);
create index if not exists vault_interventions_type_idx on public.vault_interventions(intervention_type);
create index if not exists vault_interventions_outcome_idx on public.vault_interventions(outcome);
create index if not exists vault_interventions_attempted_desc_idx on public.vault_interventions(attempted_at desc);
create index if not exists vault_interventions_workspace_project_attempted_idx on public.vault_interventions(workspace_id, project_id, attempted_at desc);
alter table public.vault_interventions enable row level security;
drop policy if exists "workspace members can read vault_interventions" on public.vault_interventions;
create policy "workspace members can read vault_interventions" on public.vault_interventions for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can insert vault_interventions" on public.vault_interventions;
create policy "workspace members can insert vault_interventions" on public.vault_interventions for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can update vault_interventions" on public.vault_interventions;
create policy "workspace members can update vault_interventions" on public.vault_interventions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create table if not exists public.vault_intervention_evidence (
  id uuid primary key,
  intervention_id uuid not null references public.vault_interventions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nutrient_id uuid null,
  source_artifact_id text null,
  excerpt text not null,
  evidence_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists vault_intervention_evidence_intervention_idx on public.vault_intervention_evidence(intervention_id);
create index if not exists vault_intervention_evidence_workspace_idx on public.vault_intervention_evidence(workspace_id);
create index if not exists vault_intervention_evidence_nutrient_idx on public.vault_intervention_evidence(nutrient_id);
create index if not exists vault_intervention_evidence_timestamp_desc_idx on public.vault_intervention_evidence(evidence_timestamp desc);
alter table public.vault_intervention_evidence enable row level security;
drop policy if exists "workspace members can read vault_intervention_evidence" on public.vault_intervention_evidence;
create policy "workspace members can read vault_intervention_evidence" on public.vault_intervention_evidence for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can insert vault_intervention_evidence" on public.vault_intervention_evidence;
create policy "workspace members can insert vault_intervention_evidence" on public.vault_intervention_evidence for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can update vault_intervention_evidence" on public.vault_intervention_evidence;
create policy "workspace members can update vault_intervention_evidence" on public.vault_intervention_evidence for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create table if not exists public.vault_intervention_outcomes (
  id uuid primary key,
  intervention_id uuid not null references public.vault_interventions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  outcome text not null check (outcome in ('helped','failed','worsened','stalled','inconclusive','pending','recovered')),
  efficacy_score integer not null check (efficacy_score >= 0 and efficacy_score <= 100),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  outcome_reasons jsonb not null default '[]'::jsonb,
  time_to_effect_days integer null,
  recurrence_after_attempt integer not null default 0,
  severity_delta numeric not null default 0,
  confidence_delta numeric not null default 0,
  fatigue_profile jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists vault_intervention_outcomes_intervention_idx on public.vault_intervention_outcomes(intervention_id);
create index if not exists vault_intervention_outcomes_workspace_idx on public.vault_intervention_outcomes(workspace_id);
create index if not exists vault_intervention_outcomes_outcome_idx on public.vault_intervention_outcomes(outcome);
create index if not exists vault_intervention_outcomes_created_desc_idx on public.vault_intervention_outcomes(created_at desc);
alter table public.vault_intervention_outcomes enable row level security;
drop policy if exists "workspace members can read vault_intervention_outcomes" on public.vault_intervention_outcomes;
create policy "workspace members can read vault_intervention_outcomes" on public.vault_intervention_outcomes for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can insert vault_intervention_outcomes" on public.vault_intervention_outcomes;
create policy "workspace members can insert vault_intervention_outcomes" on public.vault_intervention_outcomes for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists "workspace members can update vault_intervention_outcomes" on public.vault_intervention_outcomes;
create policy "workspace members can update vault_intervention_outcomes" on public.vault_intervention_outcomes for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
