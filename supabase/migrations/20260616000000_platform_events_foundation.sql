-- ─────────────────────────────────────────────────────────────────────────────
-- platform_events — Governance Event Layer (Event Sourcing Foundation)
--
-- Purpose:
--   Immutable, append-only event log recording structured facts about what
--   happened across projects, risks, dependencies, scope changes, AI
--   recommendations, human decisions, and governance activity.
--
--   This is NOT a raw data store. It captures governance-level facts:
--     Good: RISK_CREATED, DEPENDENCY_BLOCKED, HUMAN_DECISION_RECORDED
--     Bad:  full email body, contract text, personally sensitive data
--
--   Raw data belongs to the customer. Governance events record what happened.
--   Learning features will later derive minimized patterns from these events.
--
-- Scoping:
--   workspace_id is the tenant boundary (there is no separate tenant_id).
--   project_id is optional — events may be workspace-level or project-level.
--
-- References migration: 20260611000000_operational_evidence_decision_loop.sql
--   Note: the existing `governance_events` table in that migration is a
--   narrowly-scoped operational rule-check log for risk_issue_records.
--   This table (`platform_events`) is the broad event sourcing layer.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.platform_events (
  id                  uuid        primary key default gen_random_uuid(),

  -- Tenant / scope
  workspace_id        uuid        not null references public.workspaces(id) on delete cascade,
  project_id          uuid        null references public.projects(id) on delete cascade,

  -- Actor
  actor_id            uuid        null,
  actor_type          text        not null default 'user'
                                  check (actor_type in ('user', 'ai_agent', 'system', 'integration')),

  -- Event classification
  event_type          text        not null check (char_length(trim(event_type)) > 0),
  event_category      text        not null check (char_length(trim(event_category)) > 0),

  -- Structured payload — no raw content; references only
  event_payload       jsonb       not null default '{}',

  -- Origin
  source              text        not null default 'system'
                                  check (source in ('user_action', 'ai_agent', 'system', 'integration', 'migration', 'import')),

  -- Causality chain — correlate related events; trace cause-and-effect
  correlation_id      uuid        null,
  causation_id        uuid        null,

  -- Visibility and sensitivity
  visibility          text        not null default 'workspace'
                                  check (visibility in ('personal', 'project', 'workspace', 'tenant', 'global_anonymous')),
  sensitivity_level   text        not null default 'internal'
                                  check (sensitivity_level in ('public', 'internal', 'confidential', 'restricted')),

  -- Learning eligibility — governs whether this event may feed future patterns
  learning_eligible   boolean     not null default false,

  -- Raw data reference — point to source record without duplicating its content
  raw_reference_table text        null,
  raw_reference_id    uuid        null,

  -- Arbitrary structured context (e.g. request_id, session_id, trace_id)
  metadata            jsonb       not null default '{}',

  -- Timestamps
  occurred_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- Single-column
create index if not exists platform_events_workspace_id_idx         on public.platform_events(workspace_id);
create index if not exists platform_events_project_id_idx           on public.platform_events(project_id);
create index if not exists platform_events_actor_id_idx             on public.platform_events(actor_id);
create index if not exists platform_events_event_type_idx           on public.platform_events(event_type);
create index if not exists platform_events_event_category_idx       on public.platform_events(event_category);
create index if not exists platform_events_occurred_at_idx          on public.platform_events(occurred_at desc);
create index if not exists platform_events_correlation_id_idx       on public.platform_events(correlation_id);
create index if not exists platform_events_causation_id_idx         on public.platform_events(causation_id);
create index if not exists platform_events_learning_eligible_idx    on public.platform_events(learning_eligible) where learning_eligible = true;

-- Composite — common query patterns
create index if not exists platform_events_workspace_time_idx       on public.platform_events(workspace_id, occurred_at desc);
create index if not exists platform_events_workspace_project_time_idx on public.platform_events(workspace_id, project_id, occurred_at desc);
create index if not exists platform_events_workspace_type_time_idx  on public.platform_events(workspace_id, event_type, occurred_at desc);
create index if not exists platform_events_workspace_project_cat_idx on public.platform_events(workspace_id, project_id, event_category, occurred_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.platform_events enable row level security;

-- Workspace members can read events for their workspace
create policy "workspace members can read platform_events"
  on public.platform_events for select
  using (is_workspace_member(workspace_id));

-- Workspace members can insert events for their workspace
-- (server-side helpers enforce business rules before insert)
create policy "workspace members can insert platform_events"
  on public.platform_events for insert
  with check (is_workspace_member(workspace_id));

-- No UPDATE — governance events are append-only
-- No DELETE  — governance events are append-only
-- Service role (used by server-side helpers) bypasses RLS and can insert freely.

-- ─── Comments ────────────────────────────────────────────────────────────────

comment on table public.platform_events is
  'Immutable governance event log. Append-only. Records structured facts about what happened — not raw data content.';

comment on column public.platform_events.event_payload is
  'Structured, minimal facts. Must not contain full email bodies, contract text, passwords, tokens, or API keys.';

comment on column public.platform_events.correlation_id is
  'Groups related events that are part of the same logical operation (e.g. a scope change flow).';

comment on column public.platform_events.causation_id is
  'The platform_events.id that directly caused this event (e.g. an AI recommendation that led to a human decision).';

comment on column public.platform_events.learning_eligible is
  'When true, future learning pipelines may include this event in pattern extraction. Default false — must be opted in explicitly.';

comment on column public.platform_events.raw_reference_table is
  'Table name of the originating raw record (e.g. risk_issue_records). Do not copy that record''s content here.';
