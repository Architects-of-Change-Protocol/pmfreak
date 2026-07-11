begin;

alter table public.onboarding_analyses
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

update public.onboarding_analyses oa
set workspace_id = p.workspace_id
from public.projects p
where oa.project_id = p.id and oa.workspace_id is null;

alter table public.onboarding_analyses
  alter column workspace_id set not null;

create index if not exists onboarding_analyses_workspace_project_idx on public.onboarding_analyses(workspace_id, project_id, created_at desc);

create unique index if not exists projects_workspace_id_id_uniq on public.projects(workspace_id, id);

alter table public.onboarding_analyses
  add constraint onboarding_analyses_workspace_project_fk
  foreign key (workspace_id, project_id)
  references public.projects(workspace_id, id)
  on delete cascade;

-- project_memories.project_id and operational_memory_entries.project_id are
-- legacy free-form text identifiers scoped by company_id (see
-- 20260428120000_p0_state_tables.sql / 20260512130000_operational_memory_v1.sql)
-- and are not guaranteed to hold public.projects(id) uuid values. A composite
-- foreign key to public.projects(workspace_id, id) is not valid here (type
-- mismatch: text vs uuid) and was never successfully applied to any
-- database. Left un-added; RR-RLS-LEGACY tracks the pre-uuid schema on these
-- tables as documented residual risk.

commit;
