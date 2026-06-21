-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 6 — Materialization Engine
-- Creates the program_materializations table and extends program_cards with
-- materialization tracing columns.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── program_materializations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS program_materializations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES workspaces(id),
  program_id       UUID        NOT NULL REFERENCES programs(id),
  source_id        UUID        NOT NULL REFERENCES program_roadmap_sources(id),
  parse_result_id  UUID        NOT NULL REFERENCES program_roadmap_parse_results(id),

  status           TEXT        NOT NULL DEFAULT 'NOT_STARTED'
                               CHECK (status IN ('NOT_STARTED', 'RUNNING', 'COMPLETED', 'ARCHIVED')),

  epics_created    INTEGER     NOT NULL DEFAULT 0 CHECK (epics_created >= 0),
  sprints_created  INTEGER     NOT NULL DEFAULT 0 CHECK (sprints_created >= 0),
  cards_created    INTEGER     NOT NULL DEFAULT 0 CHECK (cards_created >= 0),

  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- Only one active (non-deleted) materialization per program + parse result
CREATE UNIQUE INDEX program_materializations_unique_active
  ON program_materializations (program_id, parse_result_id)
  WHERE deleted_at IS NULL;

CREATE INDEX program_materializations_workspace_program
  ON program_materializations (workspace_id, program_id)
  WHERE deleted_at IS NULL;

-- Row-level security: workspace isolation
ALTER TABLE program_materializations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_isolation"
  ON program_materializations
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid()
    )
  );

-- ─── Extend program_cards with materialization tracing ───────────────────────

ALTER TABLE program_cards
  ADD COLUMN IF NOT EXISTS materialization_source  TEXT,
  ADD COLUMN IF NOT EXISTS materialization_type    TEXT
    CHECK (materialization_type IS NULL OR materialization_type IN ('CAPABILITY', 'DELIVERABLE')),
  ADD COLUMN IF NOT EXISTS source_line_number      INTEGER;

COMMIT;
