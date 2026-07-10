create table if not exists dashboard_task_lifecycle_records (
  tenant_id text not null,
  workspace_id text null,
  lifecycle_id text not null,
  envelope_id text not null,
  action_id text not null,
  adapter text not null,
  status text not null,
  external_task_id text null,
  retry_count integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  payload_json jsonb not null,
  approval_request_json jsonb null,
  approval_decisions_json jsonb not null default '[]'::jsonb,
  primary key (tenant_id, workspace_id, lifecycle_id)
);

create table if not exists dashboard_task_lifecycle_events (
  tenant_id text not null,
  workspace_id text null,
  event_id text primary key,
  lifecycle_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  actor text null,
  message text not null,
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_dash_lifecycle_records_tenant on dashboard_task_lifecycle_records(tenant_id);
create index if not exists idx_dash_lifecycle_records_workspace on dashboard_task_lifecycle_records(workspace_id);
create index if not exists idx_dash_lifecycle_records_lifecycle on dashboard_task_lifecycle_records(lifecycle_id);
create index if not exists idx_dash_lifecycle_records_updated on dashboard_task_lifecycle_records(updated_at);
create index if not exists idx_dash_lifecycle_events_tenant on dashboard_task_lifecycle_events(tenant_id);
create index if not exists idx_dash_lifecycle_events_workspace on dashboard_task_lifecycle_events(workspace_id);
create index if not exists idx_dash_lifecycle_events_lifecycle on dashboard_task_lifecycle_events(lifecycle_id);
create index if not exists idx_dash_lifecycle_events_occurred on dashboard_task_lifecycle_events(occurred_at);

alter table dashboard_task_lifecycle_records enable row level security;
alter table dashboard_task_lifecycle_events enable row level security;

create policy dashboard_task_lifecycle_records_tenant_scope on dashboard_task_lifecycle_records
  using (tenant_id = current_company_id()) with check (tenant_id = current_company_id());

create policy dashboard_task_lifecycle_events_tenant_scope on dashboard_task_lifecycle_events
  using (tenant_id = current_company_id()) with check (tenant_id = current_company_id());
