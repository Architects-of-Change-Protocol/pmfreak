-- ─────────────────────────────────────────────────────────────────────────────
-- Governance Signal Engine — EPIC 3 Sprint 1
-- Transforms PMFreak from retrospective intelligence to active operational
-- intelligence by detecting, classifying, and managing governance signals.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── governance_signals ──────────────────────────────────────────────────────
-- Core signal registry. Every active condition detected in a workspace
-- that requires governance attention is tracked here.
-- Rule 1: Every signal must have a verifiable origin (source_entity_id).
-- Rule 2: Every signal must have evidence (enforced at service level).
-- Rule 5: Workspace isolation is mandatory.
-- Rule 6: Signals are not permanent — they resolve over time.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_signals (
  id                   uuid         primary key default gen_random_uuid(),
  workspace_id         uuid         not null references workspaces(id) on delete cascade,

  signal_type          text         not null check (signal_type in (
                                      'approval_delay',
                                      'authority_gap',
                                      'escalation_gap',
                                      'decision_bottleneck',
                                      'amendment_backlog',
                                      'ratification_stall',
                                      'risk_accumulation',
                                      'recommendation_ignored',
                                      'governance_violation',
                                      'delivery_drift'
                                    )),

  signal_source        text         not null check (signal_source in (
                                      'constitution',
                                      'decision',
                                      'amendment',
                                      'ratification',
                                      'authority',
                                      'delegation',
                                      'recommendation',
                                      'risk',
                                      'project'
                                    )),

  source_entity_type   text         not null,
  source_entity_id     uuid         not null,

  title                text         not null,
  description          text         not null,

  severity             text         not null check (severity in ('low', 'medium', 'high', 'critical')),
  confidence_score     numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),

  status               text         not null default 'active' check (status in ('active', 'acknowledged', 'resolved', 'dismissed')),

  detected_at          timestamptz  not null default now(),
  acknowledged_at      timestamptz  null,
  acknowledged_by      uuid         null,
  resolved_at          timestamptz  null,
  resolved_by          uuid         null,
  dismissed_at         timestamptz  null,
  dismissed_by         uuid         null,
  dismissed_reason     text         null,

  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now(),

  -- Unique constraint enables composite FK references for workspace isolation
  unique (id, workspace_id)
);

create index if not exists governance_signals_workspace_id_idx
  on governance_signals (workspace_id);
create index if not exists governance_signals_status_idx
  on governance_signals (workspace_id, status);
create index if not exists governance_signals_severity_idx
  on governance_signals (workspace_id, severity);
create index if not exists governance_signals_type_idx
  on governance_signals (workspace_id, signal_type);
create index if not exists governance_signals_detected_at_idx
  on governance_signals (workspace_id, detected_at desc);

alter table governance_signals enable row level security;

create policy "workspace_members_can_access_governance_signals"
  on governance_signals
  for all
  using (is_workspace_member(workspace_id));

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function touch_governance_signal_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger governance_signals_updated_at
  before update on governance_signals
  for each row execute function touch_governance_signal_updated_at();

-- ─── governance_signal_evidence ──────────────────────────────────────────────
-- Each signal must be supported by at least one piece of observable evidence.
-- Rule 2: No signal without evidence.
-- Rule 3: Every signal must be resolvable — evidence must be traceable.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_signal_evidence (
  id                      uuid         primary key default gen_random_uuid(),
  workspace_id            uuid         not null references workspaces(id) on delete cascade,
  signal_id               uuid         not null references governance_signals(id) on delete cascade,

  evidence_type           text         not null check (evidence_type in (
                                         'decision_observation',
                                         'amendment_observation',
                                         'authority_observation',
                                         'ratification_observation',
                                         'recommendation_observation',
                                         'violation_observation',
                                         'pattern_match',
                                         'historical_data'
                                       )),

  reference_entity_type   text         not null,
  reference_entity_id     uuid         not null,

  contribution_weight     numeric(4,3) not null default 1.0 check (contribution_weight between 0.0 and 1.0),

  created_at              timestamptz  not null default now(),

  -- Composite FK for workspace isolation
  constraint gse_signal_workspace_fk
    foreign key (signal_id, workspace_id)
    references governance_signals(id, workspace_id)
);

create index if not exists governance_signal_evidence_signal_id_idx
  on governance_signal_evidence (signal_id);
create index if not exists governance_signal_evidence_workspace_id_idx
  on governance_signal_evidence (workspace_id);

alter table governance_signal_evidence enable row level security;

create policy "workspace_members_can_access_governance_signal_evidence"
  on governance_signal_evidence
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_signal_recommendations ───────────────────────────────────────
-- Associates detected signals with existing constitutional recommendations.
-- Enables signals to drive actionable recommendations.
-- Rule 7: Signals must participate in Governance Health.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_signal_recommendations (
  id                uuid         primary key default gen_random_uuid(),
  workspace_id      uuid         not null references workspaces(id) on delete cascade,
  signal_id         uuid         not null references governance_signals(id) on delete cascade,
  recommendation_id uuid         not null references constitutional_recommendations(id) on delete cascade,
  confidence_score  numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),
  created_at        timestamptz  not null default now(),

  -- Prevent duplicate signal-recommendation links
  unique (workspace_id, signal_id, recommendation_id),

  -- Composite FK for workspace isolation
  constraint gsr_signal_workspace_fk
    foreign key (signal_id, workspace_id)
    references governance_signals(id, workspace_id)
);

create index if not exists governance_signal_recommendations_signal_id_idx
  on governance_signal_recommendations (signal_id);
create index if not exists governance_signal_recommendations_workspace_id_idx
  on governance_signal_recommendations (workspace_id);
create index if not exists governance_signal_recommendations_recommendation_id_idx
  on governance_signal_recommendations (recommendation_id);

alter table governance_signal_recommendations enable row level security;

create policy "workspace_members_can_access_governance_signal_recommendations"
  on governance_signal_recommendations
  for all
  using (is_workspace_member(workspace_id));
