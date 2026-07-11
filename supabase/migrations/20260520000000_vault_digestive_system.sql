-- Vault Digestive System schema
-- Introduces three tables:
--   vault_digestion_runs  — one record per digestVaultMaterial() call
--   vault_nutrients       — semantic nutrients extracted during digestion
--   vault_semantic_residue — weak/ambiguous signals preserved for future reference
--
-- All tables are scoped to workspace_id for tenant isolation.
-- RLS uses the existing is_workspace_member() helper.

-- ─── Digestion Runs ───────────────────────────────────────────────────────────

create table if not exists public.vault_digestion_runs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  raw_material_id text null,
  extraction_method text not null default 'rule_based'
    check (extraction_method in ('rule_based')),
  nutrient_count integer not null default 0,
  residue_count integer not null default 0,
  entity_count integer not null default 0,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists vault_digestion_runs_workspace_idx
  on public.vault_digestion_runs(workspace_id, created_at desc);

create index if not exists vault_digestion_runs_project_idx
  on public.vault_digestion_runs(workspace_id, project_id, created_at desc)
  where project_id is not null;

alter table public.vault_digestion_runs enable row level security;

drop policy if exists "workspace members can read vault_digestion_runs" on public.vault_digestion_runs;

create policy "workspace members can read vault_digestion_runs"
  on public.vault_digestion_runs
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_digestion_runs" on public.vault_digestion_runs;

create policy "workspace members can insert vault_digestion_runs"
  on public.vault_digestion_runs
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

-- ─── Nutrients ────────────────────────────────────────────────────────────────

create table if not exists public.vault_nutrients (
  id uuid primary key,
  digestion_run_id uuid not null references public.vault_digestion_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  nutrient_type text not null check (nutrient_type in (
    'risk_signal',
    'blocker_signal',
    'stakeholder_signal',
    'dependency_signal',
    'decision_signal',
    'commitment_signal',
    'delivery_drift_signal',
    'financial_impediment_signal',
    'governance_gap_signal',
    'escalation_signal',
    'recovery_signal',
    'ambiguity_signal',
    'contradiction_signal',
    'timeline_pressure_signal'
  )),
  summary text not null,
  entities jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  scoring jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vault_nutrients_workspace_type_idx
  on public.vault_nutrients(workspace_id, nutrient_type, created_at desc);

create index if not exists vault_nutrients_project_idx
  on public.vault_nutrients(workspace_id, project_id, created_at desc)
  where project_id is not null;

create index if not exists vault_nutrients_run_idx
  on public.vault_nutrients(digestion_run_id);

alter table public.vault_nutrients enable row level security;

drop policy if exists "workspace members can read vault_nutrients" on public.vault_nutrients;

create policy "workspace members can read vault_nutrients"
  on public.vault_nutrients
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_nutrients" on public.vault_nutrients;

create policy "workspace members can insert vault_nutrients"
  on public.vault_nutrients
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

-- ─── Semantic Residue ─────────────────────────────────────────────────────────

create table if not exists public.vault_semantic_residue (
  id uuid primary key,
  digestion_run_id uuid not null references public.vault_digestion_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  residue_category text not null check (residue_category in (
    'vague_concern',
    'unclear_dependency',
    'incomplete_stakeholder_mention',
    'possible_risk',
    'unresolved_timeline_reference',
    'ambiguous_ownership'
  )),
  raw_excerpt text not null,
  rationale text not null,
  created_at timestamptz not null default now()
);

create index if not exists vault_semantic_residue_workspace_idx
  on public.vault_semantic_residue(workspace_id, created_at desc);

create index if not exists vault_semantic_residue_run_idx
  on public.vault_semantic_residue(digestion_run_id);

alter table public.vault_semantic_residue enable row level security;

drop policy if exists "workspace members can read vault_semantic_residue" on public.vault_semantic_residue;

create policy "workspace members can read vault_semantic_residue"
  on public.vault_semantic_residue
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_semantic_residue" on public.vault_semantic_residue;

create policy "workspace members can insert vault_semantic_residue"
  on public.vault_semantic_residue
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
