-- Command Center foundational architecture.
--
-- PMFreak's governance container is the "Command Center": every project, agent,
-- repository, document, and memory item is scoped to one. Today that container
-- is implemented by the existing `workspaces` table (a user may belong to many).
-- This migration adds the governance/typing metadata required to treat a
-- workspace row as a first-class, typed Command Center, without renaming the
-- underlying `workspace_id` foreign keys already relied on throughout the schema.
--
-- command_center_type is intentionally nullable: a workspace is bootstrapped
-- automatically on first login (see ensureUserWorkspace) before the user has
-- chosen a Command Center type. NULL means "not yet configured" and is treated
-- by the app as "no Command Center exists yet" for first-launch UX purposes.

alter table public.workspaces
  add column if not exists command_center_type text
    check (command_center_type in ('company_pmo', 'team_portfolio', 'independent', 'client_portfolio', 'improvement_program')),
  add column if not exists owner_type text
    check (owner_type in ('personal', 'company', 'team', 'client', 'program')),
  add column if not exists data_owner uuid references auth.users(id) on delete set null,
  add column if not exists visibility_scope text not null default 'command_center'
    check (visibility_scope in ('user', 'command_center', 'organization', 'client', 'public')),
  add column if not exists confidentiality_level text not null default 'internal'
    check (confidentiality_level in ('public', 'internal', 'confidential', 'restricted')),
  add column if not exists governance_policy_id uuid,
  add column if not exists source_context text;

-- Backfill: default data_owner to the creator for existing rows.
update public.workspaces
set data_owner = created_by_user_id
where data_owner is null;

comment on column public.workspaces.command_center_type is
  'Command Center type: company_pmo | team_portfolio | independent | client_portfolio | improvement_program. NULL = not yet configured (bootstrap-only workspace).';
comment on column public.workspaces.owner_type is
  'Governance owner context: personal | company | team | client | program.';
comment on column public.workspaces.data_owner is
  'User who owns the data within this Command Center for governance/audit purposes.';
comment on column public.workspaces.visibility_scope is
  'Default visibility for content created in this Command Center: user | command_center | organization | client | public.';
comment on column public.workspaces.confidentiality_level is
  'Default confidentiality classification for content created in this Command Center: public | internal | confidential | restricted.';
comment on column public.workspaces.governance_policy_id is
  'Reserved for future governance policy attachment (no policy engine wired yet).';
comment on column public.workspaces.source_context is
  'Free-text description of the strategic objective / context seed used to bootstrap this Command Center.';
