-- ─────────────────────────────────────────────────────────────────────────────
-- Controlled Governance Policy Simulation Report & PMO Approval Pack
-- Migration: 20260809000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, free text rationale, or blocked identifiers.
-- Does NOT mutate policies, routing, or scoring values.
-- Does NOT apply policy changes — creates report/pack/checklist/sign-off records only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_pmo_simulation_reports ────────────────────────────────────────────

create table if not exists public.agent_pmo_simulation_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  backlog_item_id uuid references public.agent_pmo_policy_backlog_items(id) on delete set null,
  simulation_id uuid references public.agent_pmo_policy_simulations(id) on delete set null,
  impact_preview_id uuid references public.agent_pmo_policy_impact_previews(id) on delete set null,
  policy_draft_id uuid references public.agent_pmo_governance_policy_drafts(id) on delete set null,
  approval_workflow_id uuid references public.agent_pmo_policy_approval_workflows(id) on delete set null,
  rollback_plan_id uuid references public.agent_pmo_policy_rollback_plans(id) on delete set null,
  implementation_readiness_id uuid references public.agent_pmo_policy_implementation_readiness(id) on delete set null,
  status text not null default 'created',
  report_version integer not null default 1,
  title text not null,
  executive_summary text not null default '',
  safe_report_payload_json jsonb not null default '{}'::jsonb,
  section_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_simulation_reports enable row level security;

create policy "workspace members can read simulation reports"
  on public.agent_pmo_simulation_reports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulation_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert simulation reports"
  on public.agent_pmo_simulation_reports for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulation_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update simulation reports"
  on public.agent_pmo_simulation_reports for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulation_reports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_simulation_reports_workspace_idx
  on public.agent_pmo_simulation_reports(workspace_id);

create index if not exists agent_pmo_simulation_reports_change_request_idx
  on public.agent_pmo_simulation_reports(workspace_id, change_request_id);

create index if not exists agent_pmo_simulation_reports_status_idx
  on public.agent_pmo_simulation_reports(workspace_id, status);

create index if not exists agent_pmo_simulation_reports_created_idx
  on public.agent_pmo_simulation_reports(workspace_id, created_at desc);

-- ─── agent_pmo_simulation_report_sections ────────────────────────────────────

create table if not exists public.agent_pmo_simulation_report_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_id uuid not null references public.agent_pmo_simulation_reports(id) on delete cascade,
  section_type text not null,
  section_title text not null default '',
  section_order integer not null default 0,
  safe_markdown text not null default '',
  safe_payload_json jsonb not null default '{}'::jsonb,
  source_record_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_simulation_report_sections enable row level security;

create policy "workspace members can read report sections"
  on public.agent_pmo_simulation_report_sections for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulation_report_sections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert report sections"
  on public.agent_pmo_simulation_report_sections for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulation_report_sections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_simulation_report_sections_report_idx
  on public.agent_pmo_simulation_report_sections(report_id, section_order);

create index if not exists agent_pmo_simulation_report_sections_workspace_idx
  on public.agent_pmo_simulation_report_sections(workspace_id);

-- ─── agent_pmo_policy_impact_summaries ───────────────────────────────────────

create table if not exists public.agent_pmo_policy_impact_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  simulation_id uuid references public.agent_pmo_policy_simulations(id) on delete set null,
  impact_preview_id uuid references public.agent_pmo_policy_impact_previews(id) on delete set null,
  impact_level text not null default 'low',
  affected_domains_json jsonb not null default '[]'::jsonb,
  affected_action_types_json jsonb not null default '[]'::jsonb,
  affected_adapters_json jsonb not null default '[]'::jsonb,
  estimated_review_load_change integer not null default 0,
  estimated_evidence_burden_change integer not null default 0,
  risk_posture_estimate text not null default 'standard',
  implementation_complexity text not null default 'moderate',
  confidence_score numeric(4,3) not null default 0.5,
  summary text not null default '',
  safe_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_impact_summaries enable row level security;

create policy "workspace members can read impact summaries"
  on public.agent_pmo_policy_impact_summaries for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_impact_summaries.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert impact summaries"
  on public.agent_pmo_policy_impact_summaries for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_impact_summaries.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_impact_summaries_workspace_idx
  on public.agent_pmo_policy_impact_summaries(workspace_id);

create index if not exists agent_pmo_policy_impact_summaries_change_request_idx
  on public.agent_pmo_policy_impact_summaries(workspace_id, change_request_id);

-- ─── agent_pmo_policy_draft_diffs ────────────────────────────────────────────

create table if not exists public.agent_pmo_policy_draft_diffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  policy_draft_id uuid references public.agent_pmo_governance_policy_drafts(id) on delete set null,
  unknown_baseline boolean not null default true,
  baseline_label text not null default 'conceptual_current_policy',
  draft_label text not null default 'non_live_governance_policy_draft',
  added_rules_json jsonb not null default '[]'::jsonb,
  removed_rules_json jsonb not null default '[]'::jsonb,
  changed_rules_json jsonb not null default '[]'::jsonb,
  unchanged_rules_json jsonb not null default '[]'::jsonb,
  total_rule_count integer not null default 0,
  safe_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_draft_diffs enable row level security;

create policy "workspace members can read draft diffs"
  on public.agent_pmo_policy_draft_diffs for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_draft_diffs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert draft diffs"
  on public.agent_pmo_policy_draft_diffs for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_draft_diffs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_policy_draft_diffs_workspace_idx
  on public.agent_pmo_policy_draft_diffs(workspace_id);

create index if not exists agent_pmo_policy_draft_diffs_change_request_idx
  on public.agent_pmo_policy_draft_diffs(workspace_id, change_request_id);

-- ─── agent_pmo_approval_checklists ───────────────────────────────────────────

create table if not exists public.agent_pmo_approval_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  approval_pack_id uuid,
  overall_status text not null default 'not_started',
  item_count integer not null default 0,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  pending_count integer not null default 0,
  safe_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_checklists enable row level security;

create policy "workspace members can read approval checklists"
  on public.agent_pmo_approval_checklists for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert approval checklists"
  on public.agent_pmo_approval_checklists for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update approval checklists"
  on public.agent_pmo_approval_checklists for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_checklists_workspace_idx
  on public.agent_pmo_approval_checklists(workspace_id);

create index if not exists agent_pmo_approval_checklists_change_request_idx
  on public.agent_pmo_approval_checklists(workspace_id, change_request_id);

-- ─── agent_pmo_approval_checklist_items ──────────────────────────────────────

create table if not exists public.agent_pmo_approval_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checklist_id uuid not null references public.agent_pmo_approval_checklists(id) on delete cascade,
  item_key text not null,
  item_label text not null default '',
  item_order integer not null default 0,
  status text not null default 'not_started',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_checklist_items enable row level security;

create policy "workspace members can read checklist items"
  on public.agent_pmo_approval_checklist_items for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_checklist_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert checklist items"
  on public.agent_pmo_approval_checklist_items for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_checklist_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_checklist_items_checklist_idx
  on public.agent_pmo_approval_checklist_items(checklist_id, item_order);

-- ─── agent_pmo_rollback_readiness_checklists ─────────────────────────────────

create table if not exists public.agent_pmo_rollback_readiness_checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  rollback_plan_id uuid references public.agent_pmo_policy_rollback_plans(id) on delete set null,
  approval_pack_id uuid,
  overall_status text not null default 'not_started',
  item_count integer not null default 0,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  pending_count integer not null default 0,
  safe_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_rollback_readiness_checklists enable row level security;

create policy "workspace members can read rollback checklists"
  on public.agent_pmo_rollback_readiness_checklists for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_readiness_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert rollback checklists"
  on public.agent_pmo_rollback_readiness_checklists for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_readiness_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update rollback checklists"
  on public.agent_pmo_rollback_readiness_checklists for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_readiness_checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_readiness_checklists_workspace_idx
  on public.agent_pmo_rollback_readiness_checklists(workspace_id);

create index if not exists agent_pmo_rollback_readiness_checklists_change_request_idx
  on public.agent_pmo_rollback_readiness_checklists(workspace_id, change_request_id);

-- ─── agent_pmo_rollback_readiness_checklist_items ────────────────────────────

create table if not exists public.agent_pmo_rollback_readiness_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  checklist_id uuid not null references public.agent_pmo_rollback_readiness_checklists(id) on delete cascade,
  item_key text not null,
  item_label text not null default '',
  item_order integer not null default 0,
  status text not null default 'not_started',
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_rollback_readiness_checklist_items enable row level security;

create policy "workspace members can read rollback checklist items"
  on public.agent_pmo_rollback_readiness_checklist_items for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_readiness_checklist_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert rollback checklist items"
  on public.agent_pmo_rollback_readiness_checklist_items for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_rollback_readiness_checklist_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_readiness_checklist_items_checklist_idx
  on public.agent_pmo_rollback_readiness_checklist_items(checklist_id, item_order);

-- ─── agent_pmo_signoff_packets ────────────────────────────────────────────────

create table if not exists public.agent_pmo_signoff_packets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid,
  change_request_id uuid not null,
  simulation_report_id uuid references public.agent_pmo_simulation_reports(id) on delete set null,
  impact_summary_id uuid references public.agent_pmo_policy_impact_summaries(id) on delete set null,
  draft_diff_id uuid references public.agent_pmo_policy_draft_diffs(id) on delete set null,
  approval_checklist_id uuid references public.agent_pmo_approval_checklists(id) on delete set null,
  rollback_checklist_id uuid references public.agent_pmo_rollback_readiness_checklists(id) on delete set null,
  status text not null default 'created',
  packet_version integer not null default 1,
  sign_off_summary text not null default '',
  safe_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create policy "workspace members can insert signoff packets"
  on public.agent_pmo_signoff_packets for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_signoff_packets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update signoff packets"
  on public.agent_pmo_signoff_packets for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_signoff_packets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_signoff_packets_workspace_idx
  on public.agent_pmo_signoff_packets(workspace_id);

create index if not exists agent_pmo_signoff_packets_change_request_idx
  on public.agent_pmo_signoff_packets(workspace_id, change_request_id);

create index if not exists agent_pmo_signoff_packets_status_idx
  on public.agent_pmo_signoff_packets(workspace_id, status);

-- ─── agent_pmo_signoff_decisions ─────────────────────────────────────────────

create table if not exists public.agent_pmo_signoff_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sign_off_packet_id uuid not null references public.agent_pmo_signoff_packets(id) on delete cascade,
  approval_pack_id uuid,
  decision_type text not null,
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_signoff_decisions enable row level security;

create policy "workspace members can read signoff decisions"
  on public.agent_pmo_signoff_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_signoff_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert signoff decisions"
  on public.agent_pmo_signoff_decisions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_signoff_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_signoff_decisions_packet_idx
  on public.agent_pmo_signoff_decisions(sign_off_packet_id, created_at desc);

create index if not exists agent_pmo_signoff_decisions_workspace_idx
  on public.agent_pmo_signoff_decisions(workspace_id);

-- ─── agent_pmo_approval_packs ─────────────────────────────────────────────────

create table if not exists public.agent_pmo_approval_packs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_request_id uuid not null,
  backlog_item_id uuid references public.agent_pmo_policy_backlog_items(id) on delete set null,
  simulation_report_id uuid references public.agent_pmo_simulation_reports(id) on delete set null,
  impact_summary_id uuid references public.agent_pmo_policy_impact_summaries(id) on delete set null,
  draft_diff_id uuid references public.agent_pmo_policy_draft_diffs(id) on delete set null,
  approval_checklist_id uuid references public.agent_pmo_approval_checklists(id) on delete set null,
  rollback_checklist_id uuid references public.agent_pmo_rollback_readiness_checklists(id) on delete set null,
  sign_off_packet_id uuid references public.agent_pmo_signoff_packets(id) on delete set null,
  implementation_ticket_draft_id uuid,
  pack_status text not null default 'created',
  pack_version integer not null default 1,
  title text not null default '',
  safe_pack_payload_json jsonb not null default '{}'::jsonb,
  artifact_count integer not null default 0,
  export_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
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

create policy "workspace members can insert approval packs"
  on public.agent_pmo_approval_packs for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_packs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update approval packs"
  on public.agent_pmo_approval_packs for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_packs.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_packs_workspace_idx
  on public.agent_pmo_approval_packs(workspace_id);

create index if not exists agent_pmo_approval_packs_change_request_idx
  on public.agent_pmo_approval_packs(workspace_id, change_request_id);

create index if not exists agent_pmo_approval_packs_status_idx
  on public.agent_pmo_approval_packs(workspace_id, pack_status);

create index if not exists agent_pmo_approval_packs_created_idx
  on public.agent_pmo_approval_packs(workspace_id, created_at desc);

-- ─── agent_pmo_approval_pack_artifacts ───────────────────────────────────────

create table if not exists public.agent_pmo_approval_pack_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid not null references public.agent_pmo_approval_packs(id) on delete cascade,
  artifact_type text not null,
  artifact_ref_id uuid,
  artifact_label text not null default '',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_pack_artifacts enable row level security;

create policy "workspace members can read pack artifacts"
  on public.agent_pmo_approval_pack_artifacts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_artifacts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pack artifacts"
  on public.agent_pmo_approval_pack_artifacts for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_artifacts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_pack_artifacts_pack_idx
  on public.agent_pmo_approval_pack_artifacts(approval_pack_id, created_at desc);

create index if not exists agent_pmo_approval_pack_artifacts_workspace_idx
  on public.agent_pmo_approval_pack_artifacts(workspace_id);

-- ─── agent_pmo_implementation_ticket_drafts ──────────────────────────────────

create table if not exists public.agent_pmo_implementation_ticket_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid not null,
  ticket_title text not null,
  ticket_body text not null default '',
  ticket_type text not null default 'implementation_planning',
  target_future_sprint text not null default 'future_sprint_tbd',
  acceptance_criteria_json jsonb not null default '[]'::jsonb,
  blocked_until_sign_off boolean not null default true,
  status text not null default 'created',
  safe_ticket_payload_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_implementation_ticket_drafts enable row level security;

create policy "workspace members can read ticket drafts"
  on public.agent_pmo_implementation_ticket_drafts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_ticket_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert ticket drafts"
  on public.agent_pmo_implementation_ticket_drafts for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_ticket_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update ticket drafts"
  on public.agent_pmo_implementation_ticket_drafts for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_implementation_ticket_drafts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_implementation_ticket_drafts_workspace_idx
  on public.agent_pmo_implementation_ticket_drafts(workspace_id);

create index if not exists agent_pmo_implementation_ticket_drafts_change_request_idx
  on public.agent_pmo_implementation_ticket_drafts(workspace_id, change_request_id);

create index if not exists agent_pmo_implementation_ticket_drafts_created_idx
  on public.agent_pmo_implementation_ticket_drafts(workspace_id, created_at desc);

-- ─── agent_pmo_approval_pack_exports ─────────────────────────────────────────

create table if not exists public.agent_pmo_approval_pack_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_pack_id uuid not null references public.agent_pmo_approval_packs(id) on delete cascade,
  export_format text not null default 'markdown',
  export_status text not null default 'created',
  safe_export_content text not null default '',
  export_size_bytes integer not null default 0,
  safety_validation_passed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_pack_exports enable row level security;

create policy "workspace members can read pack exports"
  on public.agent_pmo_approval_pack_exports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pack exports"
  on public.agent_pmo_approval_pack_exports for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_pack_exports_pack_idx
  on public.agent_pmo_approval_pack_exports(approval_pack_id, created_at desc);

create index if not exists agent_pmo_approval_pack_exports_workspace_idx
  on public.agent_pmo_approval_pack_exports(workspace_id);

-- ─── agent_pmo_approval_pack_events ──────────────────────────────────────────

create table if not exists public.agent_pmo_approval_pack_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid,
  simulation_report_id uuid references public.agent_pmo_simulation_reports(id) on delete set null,
  sign_off_packet_id uuid references public.agent_pmo_signoff_packets(id) on delete set null,
  event_type text not null,
  message text,
  safe_event_payload_json jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_approval_pack_events enable row level security;

create policy "workspace members can read pack events"
  on public.agent_pmo_approval_pack_events for select
  using (
    workspace_id is null or exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pack events"
  on public.agent_pmo_approval_pack_events for insert
  with check (
    workspace_id is null or exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_approval_pack_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_approval_pack_events_workspace_idx
  on public.agent_pmo_approval_pack_events(workspace_id, created_at desc);

create index if not exists agent_pmo_approval_pack_events_pack_idx
  on public.agent_pmo_approval_pack_events(approval_pack_id, created_at desc);

create index if not exists agent_pmo_approval_pack_events_type_idx
  on public.agent_pmo_approval_pack_events(event_type);
