-- ─────────────────────────────────────────────────────────────────────────────
-- H9: Critical Path & Schedule Variance Engine
-- Adds CPM fields to execution_tasks.
-- No Gantt, no Monte Carlo, no resource leveling.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.execution_tasks
  add column if not exists is_critical        boolean       not null default false,
  add column if not exists early_start        integer       null,
  add column if not exists early_finish       integer       null,
  add column if not exists late_start         integer       null,
  add column if not exists late_finish        integer       null,
  add column if not exists total_float        integer       null,
  add column if not exists free_float         integer       null,
  add column if not exists variance_days      integer       null,
  add column if not exists criticality_score  numeric(5,2)  null;

-- Indexes for critical path queries
create index if not exists execution_tasks_is_critical_idx
  on public.execution_tasks (project_id, is_critical);

create index if not exists execution_tasks_variance_days_idx
  on public.execution_tasks (project_id, variance_days);

create index if not exists execution_tasks_criticality_score_idx
  on public.execution_tasks (project_id, criticality_score);
