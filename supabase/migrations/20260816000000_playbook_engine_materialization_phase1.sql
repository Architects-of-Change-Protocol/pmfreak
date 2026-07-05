-- Playbook Engine Materialization — Phase 1
-- Persists the read-only / governed layer of the Playbook Engine's governance
-- snapshot: playbook_snapshots, playbook_recommendations, playbook_audit_events.
--
-- The Playbook Engine (src/lib/playbook-engine/) remains a pure, in-memory
-- generator. This migration only adds the tables that let a materialization
-- layer (src/lib/playbook-engine/materialization-service.ts) persist what the
-- engine already generated, idempotently, without ever overwriting a human
-- decision. No UI, no communication/operational draft persistence, no
-- closure/billing persistence, no real conversions to RAID/decisions/tasks,
-- and no platform_events materialization happen in this phase.

-- ─────────────────────────────────────────────────────────────────────────────
-- playbook_snapshots
-- Header/provenance row for one run of generatePlaybookGovernanceSnapshot().
-- Regenerable: a new fingerprint always creates a new row; an unchanged
-- fingerprint is a no-op (nothing to preserve since content is deterministic).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.playbook_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  fingerprint text not null,
  playbook_id text not null,
  playbook_version text not null,

  status text not null default 'generated' check (status in ('generated')),
  generated_at timestamptz not null default now(),

  source_context_hash text,

  rules_summary jsonb not null default '{}'::jsonb,
  missing_evidence_summary jsonb not null default '[]'::jsonb,
  approval_required_summary jsonb not null default '{}'::jsonb,
  next_best_actions jsonb not null default '[]'::jsonb,
  demo_summary jsonb not null default '{}'::jsonb,
  snapshot_payload jsonb not null default '{}'::jsonb,

  content_stale boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists playbook_snapshots_workspace_project_fingerprint_uidx
  on public.playbook_snapshots(workspace_id, project_id, fingerprint);

create index if not exists playbook_snapshots_workspace_project_idx
  on public.playbook_snapshots(workspace_id, project_id);

create index if not exists playbook_snapshots_project_generated_at_idx
  on public.playbook_snapshots(project_id, generated_at desc);

drop trigger if exists playbook_snapshots_set_updated_at on public.playbook_snapshots;
create trigger playbook_snapshots_set_updated_at
  before update on public.playbook_snapshots
  for each row execute procedure public.set_updated_at();

alter table public.playbook_snapshots enable row level security;

drop policy if exists "workspace members can read playbook_snapshots" on public.playbook_snapshots;
create policy "workspace members can read playbook_snapshots"
  on public.playbook_snapshots
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert playbook_snapshots" on public.playbook_snapshots;
create policy "workspace members can insert playbook_snapshots"
  on public.playbook_snapshots
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update playbook_snapshots" on public.playbook_snapshots;
create policy "workspace members can update playbook_snapshots"
  on public.playbook_snapshots
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- playbook_recommendations
-- Lifecycle mirrors PlaybookRecommendationStatus (recommendation-state.ts) 1:1.
-- Content (title/severity/evidence/...) is only regenerable while status
-- remains 'new'; once a human moves it forward, the materialization layer
-- must preserve status/timestamps and only flag content_stale.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.playbook_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_id uuid references public.playbook_snapshots(id) on delete cascade,

  fingerprint text not null,
  playbook_rule_id text not null,

  title text not null,
  status text not null default 'new' check (status in (
    'new',
    'viewed',
    'accepted',
    'dismissed',
    'converted_to_task',
    'converted_to_draft',
    'requires_approval',
    'approved',
    'executed'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  phase text check (phase is null or phase in ('iniciacion', 'planificacion', 'ejecucion', 'monitoreo_control', 'cierre', 'any')),

  detected_situation text,
  recommended_action text,

  approval_required boolean not null default false,

  evidence_used jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  suggested_actions jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  recommendation_payload jsonb not null default '{}'::jsonb,

  content_stale boolean not null default false,

  viewed_at timestamptz,
  accepted_at timestamptz,
  dismissed_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,

  reviewed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists playbook_recommendations_workspace_project_fingerprint_uidx
  on public.playbook_recommendations(workspace_id, project_id, fingerprint);

create index if not exists playbook_recommendations_snapshot_idx
  on public.playbook_recommendations(snapshot_id);

create index if not exists playbook_recommendations_workspace_project_status_idx
  on public.playbook_recommendations(workspace_id, project_id, status);

create index if not exists playbook_recommendations_project_severity_idx
  on public.playbook_recommendations(project_id, severity);

drop trigger if exists playbook_recommendations_set_updated_at on public.playbook_recommendations;
create trigger playbook_recommendations_set_updated_at
  before update on public.playbook_recommendations
  for each row execute procedure public.set_updated_at();

alter table public.playbook_recommendations enable row level security;

drop policy if exists "workspace members can read playbook_recommendations" on public.playbook_recommendations;
create policy "workspace members can read playbook_recommendations"
  on public.playbook_recommendations
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert playbook_recommendations" on public.playbook_recommendations;
create policy "workspace members can insert playbook_recommendations"
  on public.playbook_recommendations
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update playbook_recommendations" on public.playbook_recommendations;
create policy "workspace members can update playbook_recommendations"
  on public.playbook_recommendations
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- playbook_audit_events
-- Append-only trail of what the Playbook Engine evaluated/generated. Never
-- represents an executed action. Deduplicated by fingerprint — a fingerprint
-- already present is never inserted again and never updated (no update/delete
-- RLS policy at all, mirroring platform_events' immutability pattern).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.playbook_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  snapshot_id uuid references public.playbook_snapshots(id) on delete cascade,

  related_entity_type text not null check (related_entity_type in (
    'rules_evaluation',
    'project_constitution_draft',
    'recommendation',
    'communication_draft',
    'operational_draft',
    'closure_billing_assessment',
    'closure_billing_blocker',
    'closure_billing_next_action',
    'governance_snapshot'
  )),
  related_entity_id text not null,

  fingerprint text not null,
  event_type text not null check (event_type in (
    'playbook_rules_evaluated',
    'project_constitution_draft_generated',
    'recommendation_generated',
    'recommendation_state_changed',
    'communication_draft_generated',
    'communication_draft_state_changed',
    'operational_draft_generated',
    'operational_draft_state_changed',
    'closure_billing_assessment_generated',
    'closure_billing_blocker_detected',
    'closure_billing_next_action_recommended',
    'governance_snapshot_generated'
  )),

  actor_type text not null check (actor_type in ('system', 'ai', 'user')),
  actor_id uuid references auth.users(id) on delete set null,

  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  summary text not null,

  evidence_used jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  approval_required boolean not null default false,

  metadata jsonb not null default '{}'::jsonb,
  audit_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index if not exists playbook_audit_events_workspace_project_fingerprint_uidx
  on public.playbook_audit_events(workspace_id, project_id, fingerprint);

create index if not exists playbook_audit_events_snapshot_idx
  on public.playbook_audit_events(snapshot_id);

create index if not exists playbook_audit_events_workspace_project_created_at_idx
  on public.playbook_audit_events(workspace_id, project_id, created_at desc);

create index if not exists playbook_audit_events_event_type_idx
  on public.playbook_audit_events(event_type);

create index if not exists playbook_audit_events_related_entity_idx
  on public.playbook_audit_events(related_entity_type, related_entity_id);

alter table public.playbook_audit_events enable row level security;

-- Insert-only: no update/delete policy at all — immutable once written.
drop policy if exists "workspace members can read playbook_audit_events" on public.playbook_audit_events;
create policy "workspace members can read playbook_audit_events"
  on public.playbook_audit_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert playbook_audit_events" on public.playbook_audit_events;
create policy "workspace members can insert playbook_audit_events"
  on public.playbook_audit_events
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
