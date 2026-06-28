-- ─── Agent Observability & Audit Trail ───────────────────────────────────────
-- Sprint: Agent Observability & Audit Trail
-- Purpose: Unified observability and audit trail for governed agent behavior.

-- ─── agent_audit_events ───────────────────────────────────────────────────────

create table if not exists public.agent_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  correlation_id text,
  category text not null,
  event_type text not null,
  severity text not null default 'info',
  outcome text not null default 'success',
  source_type text not null,
  scope_type text not null,
  scope_id uuid,
  agent_id uuid,
  agent_type text,
  actor_id uuid references auth.users(id) on delete set null,
  project_id uuid,
  pm_id uuid,
  portfolio_id uuid,
  tool_key text,
  tool_request_id uuid,
  approval_request_id uuid,
  memory_id uuid,
  context_policy_id uuid,
  report_id uuid,
  title text not null,
  message text,
  reason_code text,
  payload_json jsonb,
  redacted_payload_json jsonb,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_audit_events_workspace_idx
  on public.agent_audit_events(workspace_id);

create index if not exists agent_audit_events_correlation_idx
  on public.agent_audit_events(workspace_id, correlation_id);

create index if not exists agent_audit_events_category_idx
  on public.agent_audit_events(workspace_id, category);

create index if not exists agent_audit_events_event_type_idx
  on public.agent_audit_events(workspace_id, event_type);

create index if not exists agent_audit_events_severity_idx
  on public.agent_audit_events(workspace_id, severity);

create index if not exists agent_audit_events_outcome_idx
  on public.agent_audit_events(workspace_id, outcome);

create index if not exists agent_audit_events_source_idx
  on public.agent_audit_events(workspace_id, source_type);

create index if not exists agent_audit_events_scope_idx
  on public.agent_audit_events(workspace_id, scope_type, scope_id);

create index if not exists agent_audit_events_agent_idx
  on public.agent_audit_events(workspace_id, agent_id);

create index if not exists agent_audit_events_agent_type_idx
  on public.agent_audit_events(workspace_id, agent_type);

create index if not exists agent_audit_events_project_idx
  on public.agent_audit_events(workspace_id, project_id);

create index if not exists agent_audit_events_pm_idx
  on public.agent_audit_events(workspace_id, pm_id);

create index if not exists agent_audit_events_occurred_idx
  on public.agent_audit_events(workspace_id, occurred_at desc);

-- ─── agent_decision_events ────────────────────────────────────────────────────

create table if not exists public.agent_decision_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  audit_event_id uuid references public.agent_audit_events(id) on delete set null,
  correlation_id text,
  agent_id uuid,
  agent_type text,
  decision_type text not null,
  status text not null default 'draft',
  scope_type text not null,
  scope_id uuid,
  project_id uuid,
  pm_id uuid,
  portfolio_id uuid,
  title text not null,
  summary text,
  rationale text,
  confidence_score numeric,
  risk_level text,
  evidence_refs_json jsonb not null default '[]'::jsonb,
  decision_payload_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_decision_events_workspace_idx
  on public.agent_decision_events(workspace_id);

create index if not exists agent_decision_events_audit_idx
  on public.agent_decision_events(audit_event_id);

create index if not exists agent_decision_events_correlation_idx
  on public.agent_decision_events(workspace_id, correlation_id);

create index if not exists agent_decision_events_agent_idx
  on public.agent_decision_events(workspace_id, agent_id);

create index if not exists agent_decision_events_agent_type_idx
  on public.agent_decision_events(workspace_id, agent_type);

create index if not exists agent_decision_events_decision_type_idx
  on public.agent_decision_events(workspace_id, decision_type);

create index if not exists agent_decision_events_status_idx
  on public.agent_decision_events(workspace_id, status);

create index if not exists agent_decision_events_scope_idx
  on public.agent_decision_events(workspace_id, scope_type, scope_id);

create index if not exists agent_decision_events_created_idx
  on public.agent_decision_events(workspace_id, created_at desc);

-- ─── agent_audit_exports ──────────────────────────────────────────────────────

create table if not exists public.agent_audit_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  export_format text not null,
  filter_payload_json jsonb,
  artifact_title text not null,
  artifact_content text not null,
  artifact_metadata_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_audit_exports_workspace_idx
  on public.agent_audit_exports(workspace_id);

create index if not exists agent_audit_exports_format_idx
  on public.agent_audit_exports(workspace_id, export_format);

create index if not exists agent_audit_exports_created_idx
  on public.agent_audit_exports(workspace_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.agent_audit_events enable row level security;
alter table public.agent_decision_events enable row level security;
alter table public.agent_audit_exports enable row level security;

-- agent_audit_events: workspace members read/insert; admins can also read sensitive events
create policy "workspace_members_read_audit_events"
  on public.agent_audit_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_audit_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_audit_events"
  on public.agent_audit_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_audit_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_decision_events: workspace members read/insert; admins update
create policy "workspace_members_read_decision_events"
  on public.agent_decision_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_decision_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_decision_events"
  on public.agent_decision_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_decision_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_admins_update_decision_events"
  on public.agent_decision_events for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_decision_events.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- agent_audit_exports: owner/admin read/insert
create policy "workspace_admins_read_audit_exports"
  on public.agent_audit_exports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_audit_exports.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

create policy "workspace_admins_insert_audit_exports"
  on public.agent_audit_exports for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_audit_exports.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
