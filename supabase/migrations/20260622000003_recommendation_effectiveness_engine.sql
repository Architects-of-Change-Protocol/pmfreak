-- ─────────────────────────────────────────────────────────────────────────────
-- Recommendation Effectiveness Engine — EPIC 2 Sprint 5
-- Closes the institutional learning loop by measuring whether recommendations
-- actually produce better outcomes when applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_recommendation_outcomes ───────────────────────────────────
-- Records an observed result for each recommendation application.
-- Rule 1: Every measurement must originate from a real application.
-- Rule 2: No orphan outcomes — application_id is required.
-- Rule 6: Outcomes are immutable after creation.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendation_outcomes (
  id                   uuid         primary key default gen_random_uuid(),
  workspace_id         uuid         not null references workspaces(id) on delete cascade,
  recommendation_id    uuid         not null references constitutional_recommendations(id) on delete cascade,
  application_id       uuid         not null references constitutional_recommendation_applications(id) on delete cascade,
  outcome_type         text         not null check (outcome_type in (
                                      'risk_reduction',
                                      'schedule_improvement',
                                      'cost_reduction',
                                      'quality_improvement',
                                      'governance_improvement',
                                      'delivery_improvement',
                                      'authority_improvement',
                                      'ratification_improvement'
                                    )),
  outcome_status       text         not null check (outcome_status in (
                                      'successful',
                                      'neutral',
                                      'failed',
                                      'unknown'
                                    )),
  observed_value       numeric(6,3) null,
  expected_value       numeric(6,3) null,
  effectiveness_score  numeric(4,3) not null default 0.0 check (effectiveness_score between 0.0 and 1.0),
  observed_at          timestamptz  not null default now(),
  created_at           timestamptz  not null default now(),
  -- Composite FK for workspace isolation
  constraint cro_recommendation_workspace_fk
    foreign key (recommendation_id, workspace_id)
    references constitutional_recommendations(id, workspace_id),
  constraint cro_application_workspace_fk
    foreign key (application_id, workspace_id)
    references constitutional_recommendation_applications(id, workspace_id)
);

-- ─── constitutional_recommendation_feedback ───────────────────────────────────
-- Explicit user-submitted feedback on a recommendation application.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendation_feedback (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  recommendation_id uuid        not null references constitutional_recommendations(id) on delete cascade,
  application_id    uuid        not null references constitutional_recommendation_applications(id) on delete cascade,
  feedback_type     text        not null check (feedback_type in ('positive', 'neutral', 'negative')),
  rating            integer     not null check (rating between 1 and 5),
  comments          text        null,
  submitted_by      uuid        not null,
  created_at        timestamptz not null default now(),
  -- Composite FK for workspace isolation
  constraint crf_recommendation_workspace_fk
    foreign key (recommendation_id, workspace_id)
    references constitutional_recommendations(id, workspace_id),
  constraint crf_application_workspace_fk
    foreign key (application_id, workspace_id)
    references constitutional_recommendation_applications(id, workspace_id)
);

-- ─── constitutional_recommendation_effectiveness ──────────────────────────────
-- Aggregated effectiveness summary per recommendation.
-- Updated after every calculateRecommendationEffectiveness() call.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendation_effectiveness (
  id                    uuid         primary key default gen_random_uuid(),
  workspace_id          uuid         not null references workspaces(id) on delete cascade,
  recommendation_id     uuid         not null references constitutional_recommendations(id) on delete cascade,
  applications_count    integer      not null default 0 check (applications_count >= 0),
  successful_count      integer      not null default 0 check (successful_count >= 0),
  failed_count          integer      not null default 0 check (failed_count >= 0),
  neutral_count         integer      not null default 0 check (neutral_count >= 0),
  average_effectiveness numeric(4,3) not null default 0.0 check (average_effectiveness between 0.0 and 1.0),
  confidence_adjustment numeric(4,3) not null default 0.0 check (confidence_adjustment between -1.0 and 1.0),
  last_calculated_at    timestamptz  not null default now(),
  -- One effectiveness record per (workspace, recommendation)
  unique (workspace_id, recommendation_id),
  -- Composite FK for workspace isolation
  constraint cre2_recommendation_workspace_fk
    foreign key (recommendation_id, workspace_id)
    references constitutional_recommendations(id, workspace_id)
);

-- ─── Extend recommendation lifecycle with 'deprecated' status ────────────────
-- Adds 'deprecated' as a valid status alongside existing values.
-- Drop and recreate the check constraint to add the new value.

alter table constitutional_recommendations
  drop constraint if exists constitutional_recommendations_status_check;

alter table constitutional_recommendations
  add constraint constitutional_recommendations_status_check
    check (status in ('draft', 'generated', 'validated', 'published', 'retired', 'deprecated'));

-- ─── Add composite FKs to applications table for outcome/feedback isolation ───
-- Note: constitutional_recommendation_applications(id, workspace_id) composite
-- unique is needed for the FK targets above. Add it if not present.

alter table constitutional_recommendation_applications
  add constraint if not exists cra_id_workspace_unique unique (id, workspace_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table constitutional_recommendation_outcomes       enable row level security;
alter table constitutional_recommendation_feedback      enable row level security;
alter table constitutional_recommendation_effectiveness enable row level security;

-- outcomes
create policy "rec_outcomes_workspace_select"
  on constitutional_recommendation_outcomes for select
  using (is_workspace_member(workspace_id));

create policy "rec_outcomes_workspace_insert"
  on constitutional_recommendation_outcomes for insert
  with check (is_workspace_member(workspace_id));

-- feedback
create policy "rec_feedback_workspace_select"
  on constitutional_recommendation_feedback for select
  using (is_workspace_member(workspace_id));

create policy "rec_feedback_workspace_insert"
  on constitutional_recommendation_feedback for insert
  with check (is_workspace_member(workspace_id));

-- effectiveness
create policy "rec_effectiveness_workspace_select"
  on constitutional_recommendation_effectiveness for select
  using (is_workspace_member(workspace_id));

create policy "rec_effectiveness_workspace_insert"
  on constitutional_recommendation_effectiveness for insert
  with check (is_workspace_member(workspace_id));

create policy "rec_effectiveness_workspace_update"
  on constitutional_recommendation_effectiveness for update
  using (is_workspace_member(workspace_id));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists cro_workspace_recommendation_idx
  on constitutional_recommendation_outcomes (workspace_id, recommendation_id);

create index if not exists cro_workspace_status_idx
  on constitutional_recommendation_outcomes (workspace_id, outcome_status);

create index if not exists cro_workspace_type_idx
  on constitutional_recommendation_outcomes (workspace_id, outcome_type);

create index if not exists cro_observed_at_idx
  on constitutional_recommendation_outcomes (workspace_id, observed_at desc);

create index if not exists crf_workspace_recommendation_idx
  on constitutional_recommendation_feedback (workspace_id, recommendation_id);

create index if not exists cre2_workspace_recommendation_idx
  on constitutional_recommendation_effectiveness (workspace_id, recommendation_id);

create index if not exists cre2_workspace_effectiveness_idx
  on constitutional_recommendation_effectiveness (workspace_id, average_effectiveness desc);
