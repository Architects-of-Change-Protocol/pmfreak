-- Workspace → PMO → Project hierarchy
-- UX Architecture Refactoring Sprint: introduce the PMO as a first-class
-- entity between the Workspace (tenant root) and Projects.
--
-- Before this migration the hierarchy was implicitly two-level:
--   workspaces (doubling as the "Command Center"/PMO) → projects
-- After this migration:
--   workspaces → pmos → projects
--
-- Tables created:
--   pmos                   — first-class PMO containers inside a workspace
--   context_conversations  — one isolated chat thread per context scope
--   context_messages       — messages belonging to a context conversation
--
-- Columns added:
--   projects.pmo_id        — parent PMO for every project (nullable for
--                            backward compatibility; backfilled below)
--
-- Backfill:
--   Every workspace that already has projects or an activated PMO tenant
--   (workspace_governance schema_version 2) receives a default PMO named
--   after its governance identity (or the workspace name), and all its
--   existing projects are attached to that PMO.

-- ─────────────────────────────────────────────────────────────────────────────
-- pmos
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmos (
  id                  uuid        primary key default gen_random_uuid(),

  workspace_id        uuid        not null references workspaces(id) on delete cascade,

  name                text        not null,
  description         text,
  pmo_type            text        not null default 'company_pmo'
                        check (pmo_type in ('company_pmo', 'team_portfolio', 'independent', 'client_portfolio', 'improvement_program', 'personal')),
  icon                text,
  color               text,
  status              text        not null default 'active'
                        check (status in ('active', 'archived')),

  created_by_user_id  uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pmos_workspace_idx
  on pmos (workspace_id, status, created_at);

alter table pmos enable row level security;

create policy "workspace members can read pmos"
  on pmos for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmos.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace managers can manage pmos"
  on pmos for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmos.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'pm')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- projects.pmo_id — parent PMO
-- Nullable so that 148 prior migrations and existing writes keep working;
-- application code treats NULL as "unassigned" and the backfill below
-- attaches every existing project to its workspace's default PMO.
-- ─────────────────────────────────────────────────────────────────────────────

alter table projects add column if not exists pmo_id uuid references pmos(id) on delete set null;

-- Project administration metadata (Change 4: methodology / color / icon are
-- now user-manageable per project).
alter table projects add column if not exists methodology text
  check (methodology is null or methodology in ('predictive', 'agile', 'hybrid', 'kanban', 'other'));
alter table projects add column if not exists icon text;
alter table projects add column if not exists color text;

create index if not exists projects_workspace_pmo_idx
  on projects (workspace_id, pmo_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- context_conversations — one isolated conversational context per scope.
--
-- Scope shape is enforced by CHECK constraint:
--   workspace scope → pmo_id NULL,      project_id NULL
--   pmo scope       → pmo_id NOT NULL,  project_id NULL
--   project scope   → project_id NOT NULL (pmo_id optional denormalization)
--
-- The AI layer must never join conversations across scopes: each row is a
-- fully isolated context (its own history, its own memory feed).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists context_conversations (
  id                  uuid        primary key default gen_random_uuid(),

  workspace_id        uuid        not null references workspaces(id) on delete cascade,
  context_type        text        not null
                        check (context_type in ('workspace', 'pmo', 'project')),
  pmo_id              uuid        references pmos(id) on delete cascade,
  project_id          uuid        references projects(id) on delete cascade,

  title               text        not null default 'Conversation',
  status              text        not null default 'active'
                        check (status in ('active', 'archived')),

  created_by_user_id  uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint context_conversations_scope_shape check (
    (context_type = 'workspace' and pmo_id is null and project_id is null)
    or (context_type = 'pmo' and pmo_id is not null and project_id is null)
    or (context_type = 'project' and project_id is not null)
  )
);

create unique index if not exists context_conversations_scope_unique_idx
  on context_conversations (
    workspace_id,
    context_type,
    coalesce(pmo_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active';

create index if not exists context_conversations_workspace_idx
  on context_conversations (workspace_id, context_type);

alter table context_conversations enable row level security;

create policy "workspace members can read context_conversations"
  on context_conversations for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = context_conversations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can manage context_conversations"
  on context_conversations for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = context_conversations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- context_messages
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists context_messages (
  id                  uuid        primary key default gen_random_uuid(),

  conversation_id     uuid        not null references context_conversations(id) on delete cascade,
  workspace_id        uuid        not null references workspaces(id) on delete cascade,

  role                text        not null
                        check (role in ('user', 'assistant', 'system')),
  content             text        not null,
  metadata            jsonb,

  created_by_user_id  uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists context_messages_conversation_idx
  on context_messages (conversation_id, created_at);

alter table context_messages enable row level security;

create policy "workspace members can read context_messages"
  on context_messages for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = context_messages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can manage context_messages"
  on context_messages for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = context_messages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: default PMO per configured workspace + project attachment
-- ─────────────────────────────────────────────────────────────────────────────

insert into pmos (workspace_id, name, pmo_type, created_by_user_id)
select
  w.id,
  coalesce(
    nullif(wg.governance_jsonb -> 'identity' ->> 'pmoName', ''),
    nullif(w.name, 'Workspace'),
    'General PMO'
  ),
  case
    when w.command_center_type in ('company_pmo', 'team_portfolio', 'independent', 'client_portfolio', 'improvement_program')
      then w.command_center_type
    else 'company_pmo'
  end,
  w.created_by_user_id
from workspaces w
left join workspace_governance wg
  on wg.workspace_id = w.id::text
 and wg.status = 'active'
where (
    exists (select 1 from projects p where p.workspace_id = w.id)
    or wg.workspace_id is not null
  )
  and not exists (select 1 from pmos pm where pm.workspace_id = w.id);

update projects p
set pmo_id = pm.id
from pmos pm
where p.pmo_id is null
  and pm.workspace_id = p.workspace_id
  and pm.status = 'active'
  and pm.id = (
    select pm2.id from pmos pm2
    where pm2.workspace_id = p.workspace_id
      and pm2.status = 'active'
    order by pm2.created_at asc
    limit 1
  );
