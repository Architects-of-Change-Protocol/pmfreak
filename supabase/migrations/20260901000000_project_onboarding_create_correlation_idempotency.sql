-- Release Gate 01 corrective fix: make retrying a failed/ambiguous
-- "Activate Project Brain" submission idempotent.
--
-- src/lib/projects/save-project-onboarding.ts's Retry action resubmits the
-- entire onboarding payload through a plain, unconditional `insert into
-- projects`. Nothing tied a submission back to the wizard's own
-- correlationId (generated once per wizard mount and unchanged across
-- Retry clicks — see create-project-wizard.tsx), so if the first attempt
-- actually committed server-side but the client never received/processed
-- the confirmation (e.g. the request's response was lost, or swallowed by
-- the transport-layer failure modes documented in
-- docs/audits/remediation/release-gate-01-brain-activation-honesty.md), a
-- Retry click performed a second, independent insert — a duplicate Project
-- (and duplicate governance brief) for the same logical submission.
--
-- This adds a nullable `create_correlation_id` column plus a partial unique
-- index scoped to (workspace_id, create_correlation_id), so two inserts
-- sharing the same correlation id in the same workspace can never both
-- succeed — the database itself is the idempotency boundary, not
-- check-then-insert application code (which would have the same race
-- ensure_default_pmo/ensure_user_workspace were already fixed for in
-- 20260828000002/20260831000000). Existing rows are unaffected (the column
-- is nullable and the index excludes nulls) — every project created before
-- this migration keeps working exactly as before.
alter table public.projects
  add column if not exists create_correlation_id text;

create unique index if not exists projects_workspace_create_correlation_unique
  on public.projects (workspace_id, create_correlation_id)
  where create_correlation_id is not null;
