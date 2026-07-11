-- Sprint 7: Program Execution Board
-- Adds board_column to program_cards for execution projection.

-- ─────────────────────────────────────────────────────────────────────────────
-- program_cards — board_column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE program_cards
  ADD COLUMN IF NOT EXISTS board_column TEXT NOT NULL DEFAULT 'BACKLOG'
    CHECK (board_column IN ('BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'));

-- Index for efficient board projection queries
CREATE INDEX IF NOT EXISTS program_cards_board_column_idx
  ON program_cards (program_id, workspace_id, board_column)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN program_cards.board_column IS
  'Execution board column. One of BACKLOG, READY, IN_PROGRESS, IN_REVIEW, DONE. Default BACKLOG.';
