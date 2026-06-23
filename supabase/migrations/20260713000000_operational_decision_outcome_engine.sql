-- ─────────────────────────────────────────────────────────────────────────────
-- Operational Decision Outcome Engine
-- EPIC 4 — Sprint 5
--
-- Closes the full decision intelligence cycle:
--   Decision → Outcome → Effectiveness → Learning Feedback → Recommendation Evolution
--
-- Never modifies historical decisions or recommendations automatically.
-- Soft-archive only. All evaluation preserves evidence.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── operational_decision_outcomes ───────────────────────────────────────────

create table if not exists public.operational_decision_outcomes (
  id                        uuid primary key default gen_random_uuid(),

  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  decision_id               uuid not null,

  outcome_status            text not null default 'pending'
                              check (outcome_status in (
                                'pending',
                                'observed',
                                'evaluated',
                                'successful',
                                'partially_successful',
                                'unsuccessful',
                                'archived'
                              )),

  expected_impact_score     numeric(5,2) not null default 0
                              check (expected_impact_score between 0 and 100),

  actual_impact_score       numeric(5,2) not null default 0
                              check (actual_impact_score between 0 and 100),

  effectiveness_score       numeric(5,2) not null default 0
                              check (effectiveness_score between 0 and 100),

  recommendation_quality    text not null default 'fair'
                              check (recommendation_quality in (
                                'poor',
                                'fair',
                                'good',
                                'very_good',
                                'excellent'
                              )),

  outcome_variance          numeric(7,4) not null default 0,

  observed_at               timestamptz,
  evaluated_at              timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id),

  -- enforce source decision belongs to same workspace
  constraint odo_decision_workspace_fk
    foreign key (decision_id, workspace_id)
    references public.operational_decisions(id, workspace_id)
    on delete cascade
);

create index if not exists odo_workspace_id_idx
  on public.operational_decision_outcomes(workspace_id, created_at desc);

create index if not exists odo_decision_id_idx
  on public.operational_decision_outcomes(workspace_id, decision_id);

create index if not exists odo_status_idx
  on public.operational_decision_outcomes(workspace_id, outcome_status);

create index if not exists odo_effectiveness_idx
  on public.operational_decision_outcomes(workspace_id, effectiveness_score desc);

alter table public.operational_decision_outcomes enable row level security;

create policy "workspace_members_can_access_operational_decision_outcomes"
  on public.operational_decision_outcomes
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.set_odo_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger odo_updated_at
  before update on public.operational_decision_outcomes
  for each row execute function public.set_odo_updated_at();

-- ─── operational_outcome_observations ────────────────────────────────────────

create table if not exists public.operational_outcome_observations (
  id                  uuid primary key default gen_random_uuid(),

  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  outcome_id          uuid not null,

  observation_type    text not null check (observation_type in (
                        'governance_health',
                        'execution_health',
                        'risk_reduction',
                        'authority_recovery',
                        'ratification_speed',
                        'commitment_completion',
                        'projection_accuracy',
                        'recommendation_effectiveness'
                      )),

  observation_value   numeric(7,4) not null,

  observation_source  text not null,

  observed_by         uuid not null,

  observed_at         timestamptz not null default now(),

  created_at          timestamptz not null default now(),

  -- FK to parent outcome scoped to workspace
  constraint ooo_outcome_workspace_fk
    foreign key (outcome_id, workspace_id)
    references public.operational_decision_outcomes(id, workspace_id)
    on delete cascade
);

create index if not exists ooo_workspace_idx
  on public.operational_outcome_observations(workspace_id, observed_at desc);

create index if not exists ooo_outcome_idx
  on public.operational_outcome_observations(workspace_id, outcome_id);

create index if not exists ooo_type_idx
  on public.operational_outcome_observations(workspace_id, observation_type);

alter table public.operational_outcome_observations enable row level security;

create policy "workspace_members_can_access_outcome_observations"
  on public.operational_outcome_observations
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_outcome_effects ─────────────────────────────────────────────

create table if not exists public.operational_outcome_effects (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  outcome_id              uuid not null,

  effect_type             text not null check (effect_type in (
                            'governance_health',
                            'execution_health',
                            'risk_reduction',
                            'authority_recovery',
                            'ratification_speed',
                            'commitment_completion',
                            'projection_accuracy',
                            'recommendation_effectiveness'
                          )),

  before_value            numeric(7,4) not null,
  after_value             numeric(7,4) not null,

  improvement_percentage  numeric(7,4) not null,

  created_at              timestamptz not null default now(),

  constraint ooe_outcome_workspace_fk
    foreign key (outcome_id, workspace_id)
    references public.operational_decision_outcomes(id, workspace_id)
    on delete cascade
);

create index if not exists ooe_workspace_idx
  on public.operational_outcome_effects(workspace_id, created_at desc);

create index if not exists ooe_outcome_idx
  on public.operational_outcome_effects(workspace_id, outcome_id);

alter table public.operational_outcome_effects enable row level security;

create policy "workspace_members_can_access_outcome_effects"
  on public.operational_outcome_effects
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_learning_feedback ───────────────────────────────────────────

create table if not exists public.operational_learning_feedback (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  outcome_id            uuid not null,

  learning_type         text not null check (learning_type in (
                          'decision_pattern',
                          'effectiveness_signal',
                          'quality_signal',
                          'risk_insight',
                          'governance_insight',
                          'recommendation_calibration'
                        )),

  learning_summary      text not null,

  confidence_score      numeric(4,3) not null default 0
                          check (confidence_score between 0 and 1),

  should_recommend_again  boolean not null default true,

  created_at            timestamptz not null default now(),

  constraint olf_outcome_workspace_fk
    foreign key (outcome_id, workspace_id)
    references public.operational_decision_outcomes(id, workspace_id)
    on delete cascade
);

create index if not exists olf_workspace_idx
  on public.operational_learning_feedback(workspace_id, created_at desc);

create index if not exists olf_outcome_idx
  on public.operational_learning_feedback(workspace_id, outcome_id);

create index if not exists olf_recommend_idx
  on public.operational_learning_feedback(workspace_id, should_recommend_again);

alter table public.operational_learning_feedback enable row level security;

create policy "workspace_members_can_access_learning_feedback"
  on public.operational_learning_feedback
  for all
  to authenticated
  using (is_workspace_member(workspace_id));
