-- ─── Agent Human Review & Action Inbox ────────────────────────────────────────
-- Sprint: Human Review & Action Inbox
-- Creates tables for the human review and action inbox layer.

-- ─── agent_review_queues ──────────────────────────────────────────────────────

create table if not exists agent_review_queues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  queue_key text not null,
  queue_type text not null,
  queue_status text not null default 'active',
  name text not null,
  description text,
  default_assignee_id uuid references auth.users(id),
  visibility text not null default 'workspace',
  metadata_json jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, queue_key)
);

create index if not exists idx_agent_review_queues_workspace on agent_review_queues(workspace_id);
create index if not exists idx_agent_review_queues_queue_type on agent_review_queues(workspace_id, queue_type);

alter table agent_review_queues enable row level security;

create policy workspace_members_read_review_queues
  on agent_review_queues for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_review_queues
  on agent_review_queues for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_update_review_queues
  on agent_review_queues for update
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

-- ─── agent_review_items ───────────────────────────────────────────────────────

create table if not exists agent_review_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  queue_id uuid not null references agent_review_queues(id) on delete cascade,
  source_type text not null,
  source_id text,
  item_status text not null default 'queued',
  priority text not null default 'normal',
  risk_level text not null default 'medium',
  title text not null,
  summary text,
  confidence_score integer not null default 0,
  assigned_to uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  due_at timestamptz,
  tags text[] not null default '{}',
  payload_json jsonb,
  safe_payload_json jsonb,
  visibility text not null default 'workspace',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_review_items_workspace on agent_review_items(workspace_id);
create index if not exists idx_agent_review_items_queue on agent_review_items(queue_id);
create index if not exists idx_agent_review_items_status on agent_review_items(workspace_id, item_status);
create index if not exists idx_agent_review_items_priority on agent_review_items(workspace_id, priority);
create index if not exists idx_agent_review_items_assigned on agent_review_items(workspace_id, assigned_to);

alter table agent_review_items enable row level security;

create policy workspace_members_read_review_items
  on agent_review_items for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_review_items
  on agent_review_items for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_update_review_items
  on agent_review_items for update
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

-- ─── agent_review_assignments ─────────────────────────────────────────────────

create table if not exists agent_review_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  review_item_id uuid not null references agent_review_items(id) on delete cascade,
  assigned_to uuid not null references auth.users(id),
  assigned_by uuid references auth.users(id),
  assignment_status text not null default 'assigned',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_review_assignments_workspace on agent_review_assignments(workspace_id);
create index if not exists idx_agent_review_assignments_item on agent_review_assignments(review_item_id);
create index if not exists idx_agent_review_assignments_assignee on agent_review_assignments(workspace_id, assigned_to);

alter table agent_review_assignments enable row level security;

create policy workspace_members_read_review_assignments
  on agent_review_assignments for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_review_assignments
  on agent_review_assignments for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_update_review_assignments
  on agent_review_assignments for update
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

-- ─── agent_review_decisions ───────────────────────────────────────────────────

create table if not exists agent_review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  review_item_id uuid not null references agent_review_items(id) on delete cascade,
  decision_type text not null,
  decided_by uuid references auth.users(id),
  rationale text,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_review_decisions_workspace on agent_review_decisions(workspace_id);
create index if not exists idx_agent_review_decisions_item on agent_review_decisions(review_item_id);

alter table agent_review_decisions enable row level security;

create policy workspace_members_read_review_decisions
  on agent_review_decisions for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_review_decisions
  on agent_review_decisions for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

-- ─── agent_review_action_drafts ───────────────────────────────────────────────

create table if not exists agent_review_action_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  review_item_id uuid references agent_review_items(id) on delete set null,
  draft_type text not null,
  draft_status text not null default 'draft',
  title text not null,
  summary text,
  draft_payload_json jsonb,
  safe_draft_payload_json jsonb,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_review_action_drafts_workspace on agent_review_action_drafts(workspace_id);
create index if not exists idx_agent_review_action_drafts_item on agent_review_action_drafts(review_item_id);
create index if not exists idx_agent_review_action_drafts_status on agent_review_action_drafts(workspace_id, draft_status);

alter table agent_review_action_drafts enable row level security;

create policy workspace_members_read_action_drafts
  on agent_review_action_drafts for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_action_drafts
  on agent_review_action_drafts for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_update_action_drafts
  on agent_review_action_drafts for update
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

-- ─── agent_review_events ──────────────────────────────────────────────────────

create table if not exists agent_review_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  review_item_id uuid references agent_review_items(id) on delete cascade,
  queue_id uuid references agent_review_queues(id) on delete cascade,
  action_draft_id uuid references agent_review_action_drafts(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id),
  payload_json jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_review_events_workspace on agent_review_events(workspace_id);
create index if not exists idx_agent_review_events_item on agent_review_events(review_item_id);
create index if not exists idx_agent_review_events_queue on agent_review_events(queue_id);
create index if not exists idx_agent_review_events_occurred on agent_review_events(workspace_id, occurred_at desc);

alter table agent_review_events enable row level security;

create policy workspace_members_read_review_events
  on agent_review_events for select
  using (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));

create policy workspace_members_insert_review_events
  on agent_review_events for insert
  with check (workspace_id in (select workspace_id from workspace_memberships where user_id = auth.uid()));
