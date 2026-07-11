-- workspace_governance stores the PMO governance skeleton per workspace.
-- governance_jsonb holds the full PMOGovernanceSkeleton produced by the wizard.
-- This becomes the governance contract PMFreak hydrates into runtime context for
-- reasoning, escalation recommendations, delivery controls, and communication behavior.

create table if not exists public.workspace_governance (
  workspace_id  uuid        not null primary key references public.workspaces(id) on delete cascade,
  schema_version integer    not null default 1,
  governance_jsonb jsonb    not null default '{}'::jsonb,
  status        text        not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.workspace_governance enable row level security;

-- Any member of the workspace may read or write its governance skeleton.
drop policy if exists "workspace_governance_member_access" on public.workspace_governance;
create policy "workspace_governance_member_access"
  on public.workspace_governance
  for all
  using (
    workspace_id in (
      select workspace_id
      from public.workspace_memberships
      where user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id
      from public.workspace_memberships
      where user_id = auth.uid()
    )
  );
