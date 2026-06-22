-- ─────────────────────────────────────────────────────────────────────────────
-- Sovereign Recommendation Engine — EPIC 2 Sprint 4
-- Transforms Institutional Learning Patterns into actionable recommendations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_recommendations ──────────────────────────────────────────
-- Each row represents a sovereign, auditable recommendation derived from
-- one or more Learning Patterns.
-- Sovereignty Rule 6: No clients, persons, vendors, project IDs, or URLs.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendations (
  id                       uuid         primary key default gen_random_uuid(),
  workspace_id             uuid         not null references workspaces(id) on delete cascade,
  recommendation_key       text         not null,
  recommendation_type      text         not null check (recommendation_type in (
                                          'risk_mitigation',
                                          'governance_control',
                                          'decision_guidance',
                                          'authority_control',
                                          'delivery_improvement',
                                          'ratification_control',
                                          'amendment_guidance',
                                          'portfolio_guidance'
                                        )),
  recommendation_scope     text         not null check (recommendation_scope in (
                                          'project',
                                          'decision',
                                          'risk',
                                          'governance',
                                          'amendment',
                                          'authority',
                                          'ratification',
                                          'delivery',
                                          'portfolio'
                                        )),
  title                    text         not null,
  description              text         not null,
  recommendation_text      text         not null,
  confidence_score         numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),
  supporting_pattern_count integer      not null default 0 check (supporting_pattern_count >= 0),
  status                   text         not null default 'draft' check (status in (
                                          'draft',
                                          'generated',
                                          'validated',
                                          'published',
                                          'retired'
                                        )),
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  deleted_at               timestamptz  null,
  -- One recommendation per (workspace, key) — keys are pattern-derived
  unique (workspace_id, recommendation_key)
);

-- ─── constitutional_recommendation_evidence ───────────────────────────────────
-- Links a Recommendation to the Learning Pattern(s) that justify it.
-- Sovereignty Rule 2: Every recommendation must be traceable to patterns.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendation_evidence (
  id                  uuid         primary key default gen_random_uuid(),
  workspace_id        uuid         not null references workspaces(id) on delete cascade,
  recommendation_id   uuid         not null references constitutional_recommendations(id) on delete cascade,
  learning_pattern_id uuid         not null references constitutional_learning_patterns(id) on delete cascade,
  contribution_weight numeric(4,3) not null default 1.0 check (contribution_weight between 0.0 and 1.0),
  created_at          timestamptz  not null default now(),
  -- Composite FK for workspace isolation
  constraint cre_recommendation_workspace_fk
    foreign key (recommendation_id, workspace_id)
    references constitutional_recommendations(id, workspace_id),
  unique (recommendation_id, learning_pattern_id)
);

-- ─── constitutional_recommendation_applications ───────────────────────────────
-- Records every application of a Recommendation to a project entity.
-- Sovereignty Rule 7: Every application must be registered.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_recommendation_applications (
  id                 uuid        primary key default gen_random_uuid(),
  workspace_id       uuid        not null references workspaces(id) on delete cascade,
  recommendation_id  uuid        not null references constitutional_recommendations(id) on delete cascade,
  entity_type        text        not null check (entity_type in (
                                   'constitution',
                                   'decision',
                                   'amendment',
                                   'risk',
                                   'authority',
                                   'project'
                                 )),
  entity_id          uuid        not null,
  application_status text        not null default 'applied' check (application_status in (
                                   'applied',
                                   'dismissed',
                                   'superseded'
                                 )),
  applied_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  -- Composite FK for workspace isolation
  constraint cra_recommendation_workspace_fk
    foreign key (recommendation_id, workspace_id)
    references constitutional_recommendations(id, workspace_id)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table constitutional_recommendations              enable row level security;
alter table constitutional_recommendation_evidence     enable row level security;
alter table constitutional_recommendation_applications enable row level security;

-- recommendations: workspace members can read; insert/update requires membership
create policy "recommendations_workspace_select"
  on constitutional_recommendations for select
  using (is_workspace_member(workspace_id));

create policy "recommendations_workspace_insert"
  on constitutional_recommendations for insert
  with check (is_workspace_member(workspace_id));

create policy "recommendations_workspace_update"
  on constitutional_recommendations for update
  using (is_workspace_member(workspace_id));

-- evidence: workspace members can read/insert
create policy "recommendation_evidence_workspace_select"
  on constitutional_recommendation_evidence for select
  using (is_workspace_member(workspace_id));

create policy "recommendation_evidence_workspace_insert"
  on constitutional_recommendation_evidence for insert
  with check (is_workspace_member(workspace_id));

-- applications: workspace members can read/insert
create policy "recommendation_applications_workspace_select"
  on constitutional_recommendation_applications for select
  using (is_workspace_member(workspace_id));

create policy "recommendation_applications_workspace_insert"
  on constitutional_recommendation_applications for insert
  with check (is_workspace_member(workspace_id));

create policy "recommendation_applications_workspace_update"
  on constitutional_recommendation_applications for update
  using (is_workspace_member(workspace_id));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists constitutional_recommendations_workspace_type_idx
  on constitutional_recommendations (workspace_id, recommendation_type);

create index if not exists constitutional_recommendations_workspace_scope_idx
  on constitutional_recommendations (workspace_id, recommendation_scope);

create index if not exists constitutional_recommendations_workspace_status_idx
  on constitutional_recommendations (workspace_id, status);

create index if not exists constitutional_recommendations_workspace_confidence_idx
  on constitutional_recommendations (workspace_id, confidence_score desc);

create index if not exists constitutional_recommendation_evidence_rec_idx
  on constitutional_recommendation_evidence (recommendation_id);

create index if not exists constitutional_recommendation_evidence_pattern_idx
  on constitutional_recommendation_evidence (learning_pattern_id);

create index if not exists constitutional_recommendation_applications_rec_idx
  on constitutional_recommendation_applications (recommendation_id);

create index if not exists constitutional_recommendation_applications_entity_idx
  on constitutional_recommendation_applications (workspace_id, entity_type, entity_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function update_recommendation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger constitutional_recommendations_updated_at
  before update on constitutional_recommendations
  for each row execute function update_recommendation_updated_at();
