begin;

-- ─── agent_tool_requests ──────────────────────────────────────────────────────
-- Records an agent's request to use a tool that requires human approval.

create table if not exists public.agent_tool_requests (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  agent_id             text not null,
  agent_type           text not null,
  tool_id              uuid not null references public.agent_tools(id) on delete cascade,
  tool_key             text not null,
  status               text not null default 'pending' check (status in (
    'pending','approved','rejected','cancelled','expired'
  )),
  request_reason       text,
  request_context_json text not null default '{}',
  requested_by         text,
  requested_at         timestamptz not null default timezone('utc', now()),
  expires_at           timestamptz,
  resolved_at          timestamptz,
  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now())
);

create index if not exists agent_tool_requests_workspace_idx
  on public.agent_tool_requests(workspace_id, status, requested_at desc);

create index if not exists agent_tool_requests_agent_idx
  on public.agent_tool_requests(workspace_id, agent_id, status);

create index if not exists agent_tool_requests_tool_idx
  on public.agent_tool_requests(workspace_id, tool_id, status);

-- ─── agent_tool_approvals ─────────────────────────────────────────────────────
-- Records the human decision on a tool request.

create table if not exists public.agent_tool_approvals (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.agent_tool_requests(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  decision      text not null check (decision in ('approved','rejected')),
  decided_by    text not null,
  decision_note text,
  decided_at    timestamptz not null default timezone('utc', now()),
  revoked_at    timestamptz,
  revoked_by    text,
  revocation_note text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists agent_tool_approvals_request_idx
  on public.agent_tool_approvals(request_id);

create index if not exists agent_tool_approvals_workspace_idx
  on public.agent_tool_approvals(workspace_id, decided_at desc);

-- ─── agent_tool_approval_events ───────────────────────────────────────────────
-- Audit trail for all state transitions in the approval lifecycle.

create table if not exists public.agent_tool_approval_events (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.agent_tool_requests(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type   text not null check (event_type in (
    'request_created','request_approved','request_rejected',
    'request_cancelled','request_expired','approval_revoked'
  )),
  actor        text,
  note         text,
  metadata_json text not null default '{}',
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists agent_tool_approval_events_request_idx
  on public.agent_tool_approval_events(request_id, created_at asc);

create index if not exists agent_tool_approval_events_workspace_idx
  on public.agent_tool_approval_events(workspace_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.agent_tool_requests enable row level security;
alter table public.agent_tool_approvals enable row level security;
alter table public.agent_tool_approval_events enable row level security;

-- agent_tool_requests: workspace members can read, admins can write

create policy if not exists agent_tool_requests_workspace_read on public.agent_tool_requests
  for select using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tool_requests_member_insert on public.agent_tool_requests
  for insert with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tool_requests_admin_update on public.agent_tool_requests
  for update using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_requests.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_requests.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

-- agent_tool_approvals: workspace members can read, admins can write

create policy if not exists agent_tool_approvals_workspace_read on public.agent_tool_approvals
  for select using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approvals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tool_approvals_admin_write on public.agent_tool_approvals
  for all using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approvals.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approvals.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

-- agent_tool_approval_events: workspace members can read, admins can write

create policy if not exists agent_tool_approval_events_workspace_read on public.agent_tool_approval_events
  for select using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approval_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy if not exists agent_tool_approval_events_admin_write on public.agent_tool_approval_events
  for all using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approval_events.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_tool_approval_events.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner','admin')
    )
  );

commit;
