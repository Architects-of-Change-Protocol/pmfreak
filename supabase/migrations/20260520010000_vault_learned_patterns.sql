-- Vault Learned Pattern Layer schema
-- Introduces two tables:
--   vault_learned_patterns        — one record per detected longitudinal pattern
--   vault_learned_pattern_evidence — evidence items backing each pattern
--
-- All tables are workspace-scoped for tenant isolation.
-- RLS uses the existing is_workspace_member() helper.
-- This migration must be applied AFTER 20260520000000_vault_digestive_system.sql

-- ─── Learned Patterns ─────────────────────────────────────────────────────────

create table if not exists public.vault_learned_patterns (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  pattern_type text not null check (pattern_type in (
    'recurring_blocker_pattern',
    'recurring_dependency_pattern',
    'financial_friction_pattern',
    'governance_degradation_pattern',
    'escalation_trajectory_pattern',
    'stakeholder_pressure_pattern',
    'delivery_drift_pattern',
    'ambiguity_accumulation_pattern',
    'recovery_pattern',
    'chronic_risk_pattern'
  )),
  title text not null,
  summary text not null,
  status text not null check (status in (
    'emerging', 'confirmed', 'chronic', 'recovering', 'resolved', 'stale'
  )),
  trajectory text not null check (trajectory in (
    'increasing', 'stable', 'decreasing', 'intermittent', 'recovered', 'unknown'
  )),
  recurrence_count integer not null default 0,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  promotion_reason text not null check (promotion_reason in (
    'repeated_blocker_threshold_met',
    'repeated_dependency_threshold_met',
    'financial_friction_threshold_met',
    'governance_gap_accumulation',
    'escalation_frequency_threshold',
    'stakeholder_pressure_accumulation',
    'delivery_drift_accumulation',
    'ambiguity_accumulation_threshold',
    'recovery_after_blockers',
    'chronic_risk_persistence'
  )),
  -- jsonb metadata stores recurrenceProfile + involvedNutrientIds + involvedResidueIds
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vault_learned_patterns_workspace_idx
  on public.vault_learned_patterns(workspace_id, created_at desc);

create index if not exists vault_learned_patterns_project_idx
  on public.vault_learned_patterns(workspace_id, project_id, created_at desc)
  where project_id is not null;

create index if not exists vault_learned_patterns_type_idx
  on public.vault_learned_patterns(workspace_id, pattern_type, status);

create index if not exists vault_learned_patterns_severity_idx
  on public.vault_learned_patterns(workspace_id, severity, status);

alter table public.vault_learned_patterns enable row level security;

drop policy if exists "workspace members can read vault_learned_patterns" on public.vault_learned_patterns;

create policy "workspace members can read vault_learned_patterns"
  on public.vault_learned_patterns
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_learned_patterns" on public.vault_learned_patterns;

create policy "workspace members can insert vault_learned_patterns"
  on public.vault_learned_patterns
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update vault_learned_patterns" on public.vault_learned_patterns;

create policy "workspace members can update vault_learned_patterns"
  on public.vault_learned_patterns
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─── Pattern Evidence ─────────────────────────────────────────────────────────

create table if not exists public.vault_learned_pattern_evidence (
  id uuid primary key,
  pattern_id uuid not null references public.vault_learned_patterns(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  -- nullable: evidence may come from nutrients, residue, or other sources
  nutrient_id uuid null,
  residue_id uuid null,
  source_id text null,
  excerpt text not null,
  evidence_timestamp timestamptz not null,
  contribution_reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists vault_learned_pattern_evidence_pattern_idx
  on public.vault_learned_pattern_evidence(pattern_id);

create index if not exists vault_learned_pattern_evidence_workspace_idx
  on public.vault_learned_pattern_evidence(workspace_id, created_at desc);

alter table public.vault_learned_pattern_evidence enable row level security;

drop policy if exists "workspace members can read vault_learned_pattern_evidence" on public.vault_learned_pattern_evidence;

create policy "workspace members can read vault_learned_pattern_evidence"
  on public.vault_learned_pattern_evidence
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_learned_pattern_evidence" on public.vault_learned_pattern_evidence;

create policy "workspace members can insert vault_learned_pattern_evidence"
  on public.vault_learned_pattern_evidence
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
