-- ─────────────────────────────────────────────────────────────────────────────
-- Project Creation & First Execution Experience
-- Allow execution_tasks to be created directly (manual "Quick Add Task"),
-- without requiring a task_drafts row — i.e. without requiring the RAID →
-- Recommended Action → Task Draft chain. The advanced conversion pipeline
-- (convertTaskDraftToExecutionTask) is unaffected: it always sets
-- task_draft_id, so this only widens what is *possible*, not what the
-- existing flow does.
--
-- The unique index on execution_tasks(task_draft_id) already permits an
-- unlimited number of NULLs (Postgres treats NULLs as distinct for unique
-- indexes), so no index change is required.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.execution_tasks
  alter column task_draft_id drop not null;
