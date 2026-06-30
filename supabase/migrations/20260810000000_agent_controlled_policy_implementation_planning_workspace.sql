-- ─────────────────────────────────────────────────────────────────────────────
-- PMO Controlled Policy Implementation Planning Workspace
-- Migration: 20260810000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, free text rationale, or blocked identifiers.
-- Does NOT mutate policies, routing, or scoring values.
-- Does NOT apply policy changes — creates planning workspace records only.
-- Planning workspace records are NOT authorizations to implement policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Stub tables for approval pack prerequisites ──────────────────────────────

create table if not exists public.agent_pmo_approval_packs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'created',
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_packs enable row level security;

create policy "workspace members can read approval packs"
  on public.agent_pmo_approval_packs for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_packs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_packs_workspace_idx
  on public.agent_pmo_approval_packs(workspace_id);

create index if not exists agent_pmo_approval_packs_created_idx
  on public.agent_pmo_approval_packs(workspace_id, created_at desc);

create table if not exists public.agent_pmo_signoff_packets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid not null references public.agent_pmo_approval_packs(id) on delete cascade,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_signoff_packets enable row level security;

create policy "workspace members can read signoff packets"
  on public.agent_pmo_signoff_packets for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_signoff_packets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_signoff_packets_workspace_idx
  on public.agent_pmo_signoff_packets(workspace_id);

create index if not exists agent_pmo_signoff_packets_approval_pack_idx
  on public.agent_pmo_signoff_packets(approval_pack_id);

create table if not exists public.agent_pmo_implementation_ticket_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_ticket_drafts enable row level security;

create policy "workspace members can read implementation ticket drafts"
  on public.agent_pmo_implementation_ticket_drafts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_ticket_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_implementation_ticket_drafts_workspace_idx
  on public.agent_pmo_implementation_ticket_drafts(workspace_id);

-- ─── agent_pmo_implementation_planning_workspaces ─────────────────────────────

create table if not exists public.agent_pmo_implementation_planning_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  signoff_packet_id uuid references public.agent_pmo_signoff_packets(id) on delete set null,
  implementation_ticket_draft_id uuid references public.agent_pmo_implementation_ticket_drafts(id) on delete set null,
  planning_owner_role text,
  planning_version integer not null default 1,
  status text not null default 'created',
  title text not null,
  summary text not null default '',
  safe_planning_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_planning_workspaces enable row level security;

create policy "workspace members can read implementation planning workspaces"
  on public.agent_pmo_implementation_planning_workspaces for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_planning_workspaces.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_planning_workspaces_workspace_idx
  on public.agent_pmo_implementation_planning_workspaces(workspace_id);

create index if not exists agent_pmo_impl_planning_workspaces_status_idx
  on public.agent_pmo_implementation_planning_workspaces(workspace_id, status);

create index if not exists agent_pmo_impl_planning_workspaces_created_idx
  on public.agent_pmo_implementation_planning_workspaces(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_plan_drafts ────────────────────────────────────

create table if not exists public.agent_pmo_implementation_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  plan_version integer not null default 1,
  status text not null default 'created',
  implementation_objective text not null default '',
  implementation_scope text not null default '',
  non_goals text not null default '',
  assumptions text not null default '',
  constraints text not null default '',
  safe_plan_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_plan_drafts enable row level security;

create policy "workspace members can read implementation plan drafts"
  on public.agent_pmo_implementation_plan_drafts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_plan_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_plan_drafts_workspace_idx
  on public.agent_pmo_implementation_plan_drafts(workspace_id);

create index if not exists agent_pmo_impl_plan_drafts_planning_workspace_idx
  on public.agent_pmo_implementation_plan_drafts(planning_workspace_id);

create index if not exists agent_pmo_impl_plan_drafts_status_idx
  on public.agent_pmo_implementation_plan_drafts(workspace_id, status);

create index if not exists agent_pmo_impl_plan_drafts_created_idx
  on public.agent_pmo_implementation_plan_drafts(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_task_breakdowns ────────────────────────────────

create table if not exists public.agent_pmo_implementation_task_breakdowns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  plan_draft_id uuid references public.agent_pmo_implementation_plan_drafts(id) on delete set null,
  task_type text not null,
  status text not null default 'planned',
  task_order integer not null default 0,
  title text not null,
  description text not null default '',
  owner_role text,
  blocking_reason text,
  safe_task_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_task_breakdowns enable row level security;

create policy "workspace members can read implementation task breakdowns"
  on public.agent_pmo_implementation_task_breakdowns for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_task_breakdowns.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_task_breakdowns_workspace_idx
  on public.agent_pmo_implementation_task_breakdowns(workspace_id);

create index if not exists agent_pmo_impl_task_breakdowns_planning_workspace_idx
  on public.agent_pmo_implementation_task_breakdowns(planning_workspace_id);

create index if not exists agent_pmo_impl_task_breakdowns_status_idx
  on public.agent_pmo_implementation_task_breakdowns(workspace_id, status);

create index if not exists agent_pmo_impl_task_breakdowns_created_idx
  on public.agent_pmo_implementation_task_breakdowns(workspace_id, created_at desc);

-- ─── agent_pmo_pre_implementation_checklists ─────────────────────────────────

create table if not exists public.agent_pmo_pre_implementation_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  status text not null default 'not_started',
  total_items integer not null default 0,
  passed_items integer not null default 0,
  failed_items integer not null default 0,
  blocked_items integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_pre_implementation_checklists enable row level security;

create policy "workspace members can read pre implementation checklists"
  on public.agent_pmo_pre_implementation_checklists for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_pre_implementation_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_pre_impl_checklists_workspace_idx
  on public.agent_pmo_pre_implementation_checklists(workspace_id);

create index if not exists agent_pmo_pre_impl_checklists_planning_workspace_idx
  on public.agent_pmo_pre_implementation_checklists(planning_workspace_id);

create index if not exists agent_pmo_pre_impl_checklists_status_idx
  on public.agent_pmo_pre_implementation_checklists(workspace_id, status);

create index if not exists agent_pmo_pre_impl_checklists_created_idx
  on public.agent_pmo_pre_implementation_checklists(workspace_id, created_at desc);

-- ─── agent_pmo_pre_implementation_checklist_items ────────────────────────────

create table if not exists public.agent_pmo_pre_implementation_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checklist_id uuid not null references public.agent_pmo_pre_implementation_checklists(id) on delete cascade,
  item_key text not null,
  item_label text not null,
  status text not null default 'not_started',
  source_record_id uuid,
  blocking_reason text,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_pre_implementation_checklist_items enable row level security;

create policy "workspace members can read pre implementation checklist items"
  on public.agent_pmo_pre_implementation_checklist_items for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_pre_implementation_checklist_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_pre_impl_checklist_items_workspace_idx
  on public.agent_pmo_pre_implementation_checklist_items(workspace_id);

create index if not exists agent_pmo_pre_impl_checklist_items_checklist_idx
  on public.agent_pmo_pre_implementation_checklist_items(checklist_id);

create index if not exists agent_pmo_pre_impl_checklist_items_status_idx
  on public.agent_pmo_pre_implementation_checklist_items(workspace_id, status);

create index if not exists agent_pmo_pre_impl_checklist_items_created_idx
  on public.agent_pmo_pre_implementation_checklist_items(workspace_id, created_at desc);

-- ─── agent_pmo_stakeholder_readiness_records ─────────────────────────────────

create table if not exists public.agent_pmo_stakeholder_readiness_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  stakeholder_role text not null,
  status text not null default 'pending',
  rationale text,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_stakeholder_readiness_records enable row level security;

create policy "workspace members can read stakeholder readiness records"
  on public.agent_pmo_stakeholder_readiness_records for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_stakeholder_readiness_records.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_stakeholder_readiness_workspace_idx
  on public.agent_pmo_stakeholder_readiness_records(workspace_id);

create index if not exists agent_pmo_stakeholder_readiness_planning_workspace_idx
  on public.agent_pmo_stakeholder_readiness_records(planning_workspace_id);

create index if not exists agent_pmo_stakeholder_readiness_status_idx
  on public.agent_pmo_stakeholder_readiness_records(workspace_id, status);

create index if not exists agent_pmo_stakeholder_readiness_created_idx
  on public.agent_pmo_stakeholder_readiness_records(workspace_id, created_at desc);

-- ─── agent_pmo_change_window_plans ───────────────────────────────────────────

create table if not exists public.agent_pmo_change_window_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  window_type text not null,
  status text not null default 'draft',
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  timezone text,
  business_impact_estimate text,
  operational_constraints text,
  approval_required boolean not null default true,
  safe_window_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_change_window_plans enable row level security;

create policy "workspace members can read change window plans"
  on public.agent_pmo_change_window_plans for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_change_window_plans.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_change_window_plans_workspace_idx
  on public.agent_pmo_change_window_plans(workspace_id);

create index if not exists agent_pmo_change_window_plans_planning_workspace_idx
  on public.agent_pmo_change_window_plans(planning_workspace_id);

create index if not exists agent_pmo_change_window_plans_status_idx
  on public.agent_pmo_change_window_plans(workspace_id, status);

create index if not exists agent_pmo_change_window_plans_created_idx
  on public.agent_pmo_change_window_plans(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_risks ──────────────────────────────────────────

create table if not exists public.agent_pmo_implementation_risks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  risk_type text not null,
  severity text not null,
  status text not null default 'open',
  risk_summary text not null default '',
  mitigation_summary text,
  owner_role text,
  safe_risk_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_risks enable row level security;

create policy "workspace members can read implementation risks"
  on public.agent_pmo_implementation_risks for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_risks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_risks_workspace_idx
  on public.agent_pmo_implementation_risks(workspace_id);

create index if not exists agent_pmo_impl_risks_planning_workspace_idx
  on public.agent_pmo_implementation_risks(planning_workspace_id);

create index if not exists agent_pmo_impl_risks_status_idx
  on public.agent_pmo_implementation_risks(workspace_id, status);

create index if not exists agent_pmo_impl_risks_created_idx
  on public.agent_pmo_implementation_risks(workspace_id, created_at desc);

-- ─── agent_pmo_rollback_rehearsal_plans ──────────────────────────────────────

create table if not exists public.agent_pmo_rollback_rehearsal_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  rollback_plan_id uuid references public.agent_pmo_policy_rollback_plans(id) on delete set null,
  rehearsal_type text not null,
  status text not null default 'created',
  rehearsal_summary text not null default '',
  verification_steps_json jsonb not null default '[]'::jsonb,
  expected_evidence_json jsonb not null default '[]'::jsonb,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  safe_rehearsal_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_rollback_rehearsal_plans enable row level security;

create policy "workspace members can read rollback rehearsal plans"
  on public.agent_pmo_rollback_rehearsal_plans for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_rehearsal_plans.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_rehearsal_plans_workspace_idx
  on public.agent_pmo_rollback_rehearsal_plans(workspace_id);

create index if not exists agent_pmo_rollback_rehearsal_plans_planning_workspace_idx
  on public.agent_pmo_rollback_rehearsal_plans(planning_workspace_id);

create index if not exists agent_pmo_rollback_rehearsal_plans_status_idx
  on public.agent_pmo_rollback_rehearsal_plans(workspace_id, status);

create index if not exists agent_pmo_rollback_rehearsal_plans_created_idx
  on public.agent_pmo_rollback_rehearsal_plans(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_gate_prerequisites ─────────────────────────────

create table if not exists public.agent_pmo_implementation_gate_prerequisites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  prerequisite_type text not null,
  status text not null default 'pending',
  rationale text,
  source_record_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_gate_prerequisites enable row level security;

create policy "workspace members can read implementation gate prerequisites"
  on public.agent_pmo_implementation_gate_prerequisites for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_gate_prerequisites.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_gate_prereqs_workspace_idx
  on public.agent_pmo_implementation_gate_prerequisites(workspace_id);

create index if not exists agent_pmo_impl_gate_prereqs_planning_workspace_idx
  on public.agent_pmo_implementation_gate_prerequisites(planning_workspace_id);

create index if not exists agent_pmo_impl_gate_prereqs_status_idx
  on public.agent_pmo_implementation_gate_prerequisites(workspace_id, status);

create index if not exists agent_pmo_impl_gate_prereqs_created_idx
  on public.agent_pmo_implementation_gate_prerequisites(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_planning_decisions ─────────────────────────────

create table if not exists public.agent_pmo_implementation_planning_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  decision text not null,
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_planning_decisions enable row level security;

create policy "workspace members can read implementation planning decisions"
  on public.agent_pmo_implementation_planning_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_planning_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_planning_decisions_workspace_idx
  on public.agent_pmo_implementation_planning_decisions(workspace_id);

create index if not exists agent_pmo_impl_planning_decisions_planning_workspace_idx
  on public.agent_pmo_implementation_planning_decisions(planning_workspace_id);

create index if not exists agent_pmo_impl_planning_decisions_created_idx
  on public.agent_pmo_implementation_planning_decisions(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_planning_exports ───────────────────────────────

create table if not exists public.agent_pmo_implementation_planning_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  export_format text not null,
  status text not null default 'created',
  file_name text not null,
  content_type text not null,
  content_text text,
  content_json_safe jsonb,
  safe_export_payload_json jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_planning_exports enable row level security;

create policy "workspace members can read implementation planning exports"
  on public.agent_pmo_implementation_planning_exports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_planning_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_planning_exports_workspace_idx
  on public.agent_pmo_implementation_planning_exports(workspace_id);

create index if not exists agent_pmo_impl_planning_exports_planning_workspace_idx
  on public.agent_pmo_implementation_planning_exports(planning_workspace_id);

create index if not exists agent_pmo_impl_planning_exports_status_idx
  on public.agent_pmo_implementation_planning_exports(workspace_id, status);

create index if not exists agent_pmo_impl_planning_exports_created_idx
  on public.agent_pmo_implementation_planning_exports(workspace_id, created_at desc);

-- ─── agent_pmo_implementation_planning_events ────────────────────────────────

create table if not exists public.agent_pmo_implementation_planning_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid references public.agent_pmo_implementation_planning_workspaces(id) on delete set null,
  plan_draft_id uuid references public.agent_pmo_implementation_plan_drafts(id) on delete set null,
  checklist_id uuid references public.agent_pmo_pre_implementation_checklists(id) on delete set null,
  export_id uuid references public.agent_pmo_implementation_planning_exports(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_planning_events enable row level security;

create policy "workspace members can read implementation planning events"
  on public.agent_pmo_implementation_planning_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_planning_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_impl_planning_events_workspace_idx
  on public.agent_pmo_implementation_planning_events(workspace_id);

create index if not exists agent_pmo_impl_planning_events_planning_workspace_idx
  on public.agent_pmo_implementation_planning_events(planning_workspace_id);

create index if not exists agent_pmo_impl_planning_events_event_type_idx
  on public.agent_pmo_implementation_planning_events(workspace_id, event_type);

create index if not exists agent_pmo_impl_planning_events_created_idx
  on public.agent_pmo_implementation_planning_events(workspace_id, created_at desc);
