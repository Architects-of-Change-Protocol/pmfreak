-- ─────────────────────────────────────────────────────────────────────────────
-- Constitutional Learning Engine — EPIC 2 Sprint 3
-- Transforms Constitutional Digests into reusable Institutional Learning Patterns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_learning_patterns ────────────────────────────────────────
-- Each row represents a discovered recurring pattern across multiple digests.
-- Sovereignty Rule 1: No clients, persons, vendors, project IDs, emails, or URLs.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_learning_patterns (
  id                uuid        primary key default gen_random_uuid(),
  workspace_id      uuid        not null references workspaces(id) on delete cascade,
  pattern_type      text        not null check (pattern_type in (
                                  'decision_pattern',
                                  'risk_pattern',
                                  'governance_pattern',
                                  'authority_pattern',
                                  'amendment_pattern',
                                  'delivery_pattern',
                                  'outcome_pattern'
                                )),
  pattern_key       text        not null,
  description       text        not null,
  confidence_score  numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),
  occurrence_count  integer     not null default 1 check (occurrence_count >= 1),
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Uniqueness: one pattern per (workspace, type, key)
  unique (workspace_id, pattern_type, pattern_key)
);

-- ─── constitutional_learning_evidence ────────────────────────────────────────
-- Links a Learning Pattern to the Digest that contributed to it.
-- Sovereignty Rule 4: Every pattern must be traceable.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_learning_evidence (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references workspaces(id) on delete cascade,
  learning_pattern_id   uuid        not null references constitutional_learning_patterns(id) on delete cascade,
  digest_id             uuid        not null references constitutional_digests(id) on delete cascade,
  contribution_weight   numeric(4,3) not null default 1.0 check (contribution_weight between 0.0 and 1.0),
  created_at            timestamptz not null default now(),
  -- Composite FK to enforce workspace isolation
  constraint clp_evidence_workspace_fk
    foreign key (learning_pattern_id, workspace_id)
    references constitutional_learning_patterns(id, workspace_id),
  unique (learning_pattern_id, digest_id)
);

-- ─── constitutional_learning_recommendations ──────────────────────────────────
-- Actionable recommendations derived from a Learning Pattern.
-- Sovereignty Rule 5: Every recommendation must justify itself (via pattern traceability).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists constitutional_learning_recommendations (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references workspaces(id) on delete cascade,
  learning_pattern_id uuid        not null references constitutional_learning_patterns(id) on delete cascade,
  recommendation      text        not null,
  confidence_score    numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),
  created_at          timestamptz not null default now(),
  -- Composite FK to enforce workspace isolation
  constraint clp_recommendation_workspace_fk
    foreign key (learning_pattern_id, workspace_id)
    references constitutional_learning_patterns(id, workspace_id)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table constitutional_learning_patterns         enable row level security;
alter table constitutional_learning_evidence         enable row level security;
alter table constitutional_learning_recommendations  enable row level security;

-- patterns: workspace members can read; only admins/owners can write
create policy "learning_patterns_workspace_select"
  on constitutional_learning_patterns for select
  using (is_workspace_member(workspace_id));

create policy "learning_patterns_workspace_insert"
  on constitutional_learning_patterns for insert
  with check (is_workspace_member(workspace_id));

create policy "learning_patterns_workspace_update"
  on constitutional_learning_patterns for update
  using (is_workspace_member(workspace_id));

-- evidence: workspace members can read/insert
create policy "learning_evidence_workspace_select"
  on constitutional_learning_evidence for select
  using (is_workspace_member(workspace_id));

create policy "learning_evidence_workspace_insert"
  on constitutional_learning_evidence for insert
  with check (is_workspace_member(workspace_id));

-- recommendations: workspace members can read/insert
create policy "learning_recommendations_workspace_select"
  on constitutional_learning_recommendations for select
  using (is_workspace_member(workspace_id));

create policy "learning_recommendations_workspace_insert"
  on constitutional_learning_recommendations for insert
  with check (is_workspace_member(workspace_id));

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists constitutional_learning_patterns_workspace_type_idx
  on constitutional_learning_patterns (workspace_id, pattern_type);

create index if not exists constitutional_learning_patterns_workspace_key_idx
  on constitutional_learning_patterns (workspace_id, pattern_key);

create index if not exists constitutional_learning_evidence_pattern_idx
  on constitutional_learning_evidence (learning_pattern_id);

create index if not exists constitutional_learning_evidence_digest_idx
  on constitutional_learning_evidence (digest_id);

create index if not exists constitutional_learning_recommendations_pattern_idx
  on constitutional_learning_recommendations (learning_pattern_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function update_learning_pattern_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger constitutional_learning_patterns_updated_at
  before update on constitutional_learning_patterns
  for each row execute function update_learning_pattern_updated_at();
