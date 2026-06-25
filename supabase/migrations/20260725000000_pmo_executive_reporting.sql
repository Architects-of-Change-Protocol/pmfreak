-- PMO Executive Reporting & Alerts
-- EPIC 6 Sprint 7: Executive-facing PMO reporting and alert payloads.
--
-- Read-model persistence. These tables capture deterministically derived
-- executive reports and alert payloads from existing PMO read aggregations
-- (PMO Command Center + Operating Discipline Snapshot + Intervention actions).
-- No PM assignments, capacity data, performance records, or intervention
-- statuses are mutated by this feature.
--
-- Tables created:
--   pmo_executive_reports  — Persisted executive report documents
--   pmo_alert_payloads     — Persisted executive alert payloads

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_executive_reports
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_executive_reports (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,

  report_type             text        not null,
  report_period_start     timestamptz,
  report_period_end       timestamptz,
  generated_at            timestamptz not null default now(),
  generated_by            text,

  executive_status        text        not null,
  executive_risk          text        not null,

  report_title            text,
  executive_summary       jsonb,
  key_metrics             jsonb,
  sections                jsonb,
  source_refs             jsonb,
  report_payload          jsonb,

  archived_at             timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pmo_executive_reports_workspace_idx
  on pmo_executive_reports (workspace_id, generated_at desc);

create index if not exists pmo_executive_reports_workspace_type_idx
  on pmo_executive_reports (workspace_id, report_type);

alter table pmo_executive_reports enable row level security;

create policy "workspace members can read pmo_executive_reports"
  on pmo_executive_reports for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_executive_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pmo_executive_reports"
  on pmo_executive_reports for insert
  with check (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_executive_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update pmo_executive_reports"
  on pmo_executive_reports for update
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_executive_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_alert_payloads
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_alert_payloads (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,

  alert_type              text        not null,
  severity                text        not null
                            check (severity in ('low', 'medium', 'high', 'critical')),
  status                  text        not null default 'new'
                            check (status in ('new', 'reviewed', 'archived')),

  title                   text        not null,
  message                 text        not null,

  target_type             text,
  target_id               text,
  pm_id                   text,
  project_id              text,

  source_type             text,
  source_id               text,
  source_ref              jsonb,
  payload                 jsonb,

  recommended_action      text,

  created_by              text,
  created_at              timestamptz not null default now(),

  reviewed_by             text,
  reviewed_at             timestamptz,

  archived_at             timestamptz,
  updated_at              timestamptz not null default now()
);

create index if not exists pmo_alert_payloads_workspace_idx
  on pmo_alert_payloads (workspace_id, created_at desc);

create index if not exists pmo_alert_payloads_workspace_status_idx
  on pmo_alert_payloads (workspace_id, status);

create index if not exists pmo_alert_payloads_workspace_severity_idx
  on pmo_alert_payloads (workspace_id, severity);

alter table pmo_alert_payloads enable row level security;

create policy "workspace members can read pmo_alert_payloads"
  on pmo_alert_payloads for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_alert_payloads.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pmo_alert_payloads"
  on pmo_alert_payloads for insert
  with check (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_alert_payloads.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update pmo_alert_payloads"
  on pmo_alert_payloads for update
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_alert_payloads.workspace_id
        and wm.user_id = auth.uid()
    )
  );
