-- Sprint 9: Program Context Projection
-- Adds materialization_id to program_cards for full context traceability.
-- Card → Materialization → ParseResult → RoadmapSource

alter table program_cards
  add column if not exists materialization_id uuid null references program_materializations(id);

create index if not exists program_cards_materialization_id_idx
  on program_cards(materialization_id)
  where deleted_at is null;
