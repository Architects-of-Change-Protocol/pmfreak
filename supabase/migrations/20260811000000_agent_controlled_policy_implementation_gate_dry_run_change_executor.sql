-- ─────────────────────────────────────────────────────────────────────────────
-- PMO Controlled Policy Implementation Gate & Dry-Run Change Executor
-- Migration: 20260811000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- Does NOT store raw payloads, secrets, or customer identifiers.
-- Does NOT mutate policies, routing, scoring, evidence requirements.
-- Does NOT activate policy changes — creates dry-run simulation records only.
-- Dry-run records are NOT authorizations to implement or activate policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_pmo_dry_run_execution_requests ────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_execution_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  request_reason text not null default '',
  request_status text not null default 'created',
  request_version integer not null default 1,
  safe_request_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_execution_requests enable row level security;

create policy "workspace members can read dry run execution requests"
  on public.agent_pmo_dry_run_execution_requests for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_execution_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run execution requests"
  on public.agent_pmo_dry_run_execution_requests for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_execution_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run execution requests"
  on public.agent_pmo_dry_run_execution_requests for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_execution_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_requests_workspace_idx
  on public.agent_pmo_dry_run_execution_requests(workspace_id);

create index if not exists agent_pmo_dry_run_requests_planning_workspace_idx
  on public.agent_pmo_dry_run_execution_requests(planning_workspace_id);

create index if not exists agent_pmo_dry_run_requests_status_idx
  on public.agent_pmo_dry_run_execution_requests(workspace_id, request_status);

create index if not exists agent_pmo_dry_run_requests_created_idx
  on public.agent_pmo_dry_run_execution_requests(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_preflight_validations ─────────────────────────────────

create table if not exists public.agent_pmo_dry_run_preflight_validations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  preflight_status text not null default 'pending',
  checks_total integer not null default 0,
  checks_passed integer not null default 0,
  checks_failed integer not null default 0,
  checks_blocked integer not null default 0,
  safe_preflight_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_preflight_validations enable row level security;

create policy "workspace members can read dry run preflight validations"
  on public.agent_pmo_dry_run_preflight_validations for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_preflight_validations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run preflight validations"
  on public.agent_pmo_dry_run_preflight_validations for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_preflight_validations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run preflight validations"
  on public.agent_pmo_dry_run_preflight_validations for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_preflight_validations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_preflight_workspace_idx
  on public.agent_pmo_dry_run_preflight_validations(workspace_id);

create index if not exists agent_pmo_dry_run_preflight_request_idx
  on public.agent_pmo_dry_run_preflight_validations(dry_run_request_id);

create index if not exists agent_pmo_dry_run_preflight_status_idx
  on public.agent_pmo_dry_run_preflight_validations(workspace_id, preflight_status);

create index if not exists agent_pmo_dry_run_preflight_created_idx
  on public.agent_pmo_dry_run_preflight_validations(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_gate_approvals ────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_gate_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  gate_approval_status text not null default 'created',
  reviewed_by uuid references auth.users(id) on delete set null,
  safe_approval_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_gate_approvals enable row level security;

create policy "workspace members can read dry run gate approvals"
  on public.agent_pmo_dry_run_gate_approvals for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_gate_approvals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run gate approvals"
  on public.agent_pmo_dry_run_gate_approvals for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_gate_approvals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run gate approvals"
  on public.agent_pmo_dry_run_gate_approvals for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_gate_approvals.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_gate_approvals_workspace_idx
  on public.agent_pmo_dry_run_gate_approvals(workspace_id);

create index if not exists agent_pmo_dry_run_gate_approvals_request_idx
  on public.agent_pmo_dry_run_gate_approvals(dry_run_request_id);

create index if not exists agent_pmo_dry_run_gate_approvals_status_idx
  on public.agent_pmo_dry_run_gate_approvals(workspace_id, gate_approval_status);

create index if not exists agent_pmo_dry_run_gate_approvals_created_idx
  on public.agent_pmo_dry_run_gate_approvals(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_gate_decisions ────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_gate_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  gate_approval_id uuid not null references public.agent_pmo_dry_run_gate_approvals(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  decision_type text not null,
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_gate_decisions enable row level security;

create policy "workspace members can read dry run gate decisions"
  on public.agent_pmo_dry_run_gate_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run gate decisions"
  on public.agent_pmo_dry_run_gate_decisions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_gate_decisions_workspace_idx
  on public.agent_pmo_dry_run_gate_decisions(workspace_id);

create index if not exists agent_pmo_dry_run_gate_decisions_approval_idx
  on public.agent_pmo_dry_run_gate_decisions(gate_approval_id);

create index if not exists agent_pmo_dry_run_gate_decisions_request_idx
  on public.agent_pmo_dry_run_gate_decisions(dry_run_request_id);

create index if not exists agent_pmo_dry_run_gate_decisions_created_idx
  on public.agent_pmo_dry_run_gate_decisions(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_change_sets ───────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_change_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  planning_workspace_id uuid not null references public.agent_pmo_implementation_planning_workspaces(id) on delete cascade,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  simulated_change_count integer not null default 0,
  policy_area text,
  safe_change_summary text not null default '',
  safe_change_set_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_change_sets enable row level security;

create policy "workspace members can read dry run change sets"
  on public.agent_pmo_dry_run_change_sets for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_change_sets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run change sets"
  on public.agent_pmo_dry_run_change_sets for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_change_sets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_change_sets_workspace_idx
  on public.agent_pmo_dry_run_change_sets(workspace_id);

create index if not exists agent_pmo_dry_run_change_sets_request_idx
  on public.agent_pmo_dry_run_change_sets(dry_run_request_id);

create index if not exists agent_pmo_dry_run_change_sets_created_idx
  on public.agent_pmo_dry_run_change_sets(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_change_set_items ──────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_change_set_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  change_set_id uuid not null references public.agent_pmo_dry_run_change_sets(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  change_type text not null,
  safe_change_summary text not null default '',
  safe_change_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_change_set_items enable row level security;

create policy "workspace members can read dry run change set items"
  on public.agent_pmo_dry_run_change_set_items for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_change_set_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run change set items"
  on public.agent_pmo_dry_run_change_set_items for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_change_set_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_change_set_items_workspace_idx
  on public.agent_pmo_dry_run_change_set_items(workspace_id);

create index if not exists agent_pmo_dry_run_change_set_items_change_set_idx
  on public.agent_pmo_dry_run_change_set_items(change_set_id);

create index if not exists agent_pmo_dry_run_change_set_items_request_idx
  on public.agent_pmo_dry_run_change_set_items(dry_run_request_id);

create index if not exists agent_pmo_dry_run_change_set_items_created_idx
  on public.agent_pmo_dry_run_change_set_items(workspace_id, created_at desc);

-- ─── agent_pmo_simulated_policy_versions ─────────────────────────────────────

create table if not exists public.agent_pmo_simulated_policy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  change_set_id uuid references public.agent_pmo_dry_run_change_sets(id) on delete set null,
  simulated_version_label text not null,
  baseline_label text not null,
  target_label text not null,
  unknown_baseline boolean not null default false,
  simulated_policy_payload_json jsonb not null default '{}'::jsonb,
  safe_diff_payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_simulated_policy_versions enable row level security;

create policy "workspace members can read simulated policy versions"
  on public.agent_pmo_simulated_policy_versions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulated_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create simulated policy versions"
  on public.agent_pmo_simulated_policy_versions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulated_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update simulated policy versions"
  on public.agent_pmo_simulated_policy_versions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_simulated_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_simulated_policy_versions_workspace_idx
  on public.agent_pmo_simulated_policy_versions(workspace_id);

create index if not exists agent_pmo_simulated_policy_versions_request_idx
  on public.agent_pmo_simulated_policy_versions(dry_run_request_id);

create index if not exists agent_pmo_simulated_policy_versions_status_idx
  on public.agent_pmo_simulated_policy_versions(workspace_id, status);

create index if not exists agent_pmo_simulated_policy_versions_created_idx
  on public.agent_pmo_simulated_policy_versions(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_simulation_executions ─────────────────────────────────

create table if not exists public.agent_pmo_dry_run_simulation_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  preflight_validation_id uuid references public.agent_pmo_dry_run_preflight_validations(id) on delete set null,
  gate_approval_id uuid references public.agent_pmo_dry_run_gate_approvals(id) on delete set null,
  change_set_id uuid references public.agent_pmo_dry_run_change_sets(id) on delete set null,
  simulated_policy_version_id uuid references public.agent_pmo_simulated_policy_versions(id) on delete set null,
  execution_status text not null default 'created',
  started_at timestamptz,
  completed_at timestamptz,
  safe_execution_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_simulation_executions enable row level security;

create policy "workspace members can read dry run simulation executions"
  on public.agent_pmo_dry_run_simulation_executions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_simulation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run simulation executions"
  on public.agent_pmo_dry_run_simulation_executions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_simulation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run simulation executions"
  on public.agent_pmo_dry_run_simulation_executions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_simulation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_sim_executions_workspace_idx
  on public.agent_pmo_dry_run_simulation_executions(workspace_id);

create index if not exists agent_pmo_dry_run_sim_executions_request_idx
  on public.agent_pmo_dry_run_simulation_executions(dry_run_request_id);

create index if not exists agent_pmo_dry_run_sim_executions_status_idx
  on public.agent_pmo_dry_run_simulation_executions(workspace_id, execution_status);

create index if not exists agent_pmo_dry_run_sim_executions_created_idx
  on public.agent_pmo_dry_run_simulation_executions(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_simulated_impacts ─────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_simulated_impacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_execution_id uuid not null references public.agent_pmo_dry_run_simulation_executions(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  impact_domain text not null,
  impact_level text not null default 'unknown',
  impact_summary text not null default '',
  affected_count integer not null default 0,
  safe_impact_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_simulated_impacts enable row level security;

create policy "workspace members can read dry run simulated impacts"
  on public.agent_pmo_dry_run_simulated_impacts for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_simulated_impacts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run simulated impacts"
  on public.agent_pmo_dry_run_simulated_impacts for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_simulated_impacts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_simulated_impacts_workspace_idx
  on public.agent_pmo_dry_run_simulated_impacts(workspace_id);

create index if not exists agent_pmo_dry_run_simulated_impacts_execution_idx
  on public.agent_pmo_dry_run_simulated_impacts(dry_run_execution_id);

create index if not exists agent_pmo_dry_run_simulated_impacts_request_idx
  on public.agent_pmo_dry_run_simulated_impacts(dry_run_request_id);

create index if not exists agent_pmo_dry_run_simulated_impacts_created_idx
  on public.agent_pmo_dry_run_simulated_impacts(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_evidence_packages ─────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_evidence_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  package_status text not null default 'created',
  safe_package_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_evidence_packages enable row level security;

create policy "workspace members can read dry run evidence packages"
  on public.agent_pmo_dry_run_evidence_packages for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_evidence_packages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run evidence packages"
  on public.agent_pmo_dry_run_evidence_packages for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_evidence_packages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run evidence packages"
  on public.agent_pmo_dry_run_evidence_packages for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_evidence_packages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_evidence_packages_workspace_idx
  on public.agent_pmo_dry_run_evidence_packages(workspace_id);

create index if not exists agent_pmo_dry_run_evidence_packages_request_idx
  on public.agent_pmo_dry_run_evidence_packages(dry_run_request_id);

create index if not exists agent_pmo_dry_run_evidence_packages_status_idx
  on public.agent_pmo_dry_run_evidence_packages(workspace_id, package_status);

create index if not exists agent_pmo_dry_run_evidence_packages_created_idx
  on public.agent_pmo_dry_run_evidence_packages(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_evidence_sections ─────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_evidence_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  evidence_package_id uuid not null references public.agent_pmo_dry_run_evidence_packages(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  section_type text not null,
  safe_section_content text not null default '',
  safe_markdown text not null default '',
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_evidence_sections enable row level security;

create policy "workspace members can read dry run evidence sections"
  on public.agent_pmo_dry_run_evidence_sections for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_evidence_sections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run evidence sections"
  on public.agent_pmo_dry_run_evidence_sections for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_evidence_sections.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_evidence_sections_workspace_idx
  on public.agent_pmo_dry_run_evidence_sections(workspace_id);

create index if not exists agent_pmo_dry_run_evidence_sections_package_idx
  on public.agent_pmo_dry_run_evidence_sections(evidence_package_id);

create index if not exists agent_pmo_dry_run_evidence_sections_request_idx
  on public.agent_pmo_dry_run_evidence_sections(dry_run_request_id);

create index if not exists agent_pmo_dry_run_evidence_sections_created_idx
  on public.agent_pmo_dry_run_evidence_sections(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_blockers ──────────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_blockers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  blocker_type text not null,
  blocker_status text not null default 'open',
  severity text not null default 'medium',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_blockers enable row level security;

create policy "workspace members can read dry run blockers"
  on public.agent_pmo_dry_run_blockers for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_blockers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run blockers"
  on public.agent_pmo_dry_run_blockers for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_blockers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run blockers"
  on public.agent_pmo_dry_run_blockers for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_blockers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_blockers_workspace_idx
  on public.agent_pmo_dry_run_blockers(workspace_id);

create index if not exists agent_pmo_dry_run_blockers_request_idx
  on public.agent_pmo_dry_run_blockers(dry_run_request_id);

create index if not exists agent_pmo_dry_run_blockers_status_idx
  on public.agent_pmo_dry_run_blockers(workspace_id, blocker_status);

create index if not exists agent_pmo_dry_run_blockers_severity_idx
  on public.agent_pmo_dry_run_blockers(workspace_id, severity);

create index if not exists agent_pmo_dry_run_blockers_created_idx
  on public.agent_pmo_dry_run_blockers(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_operator_reviews ──────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_operator_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  evidence_package_id uuid references public.agent_pmo_dry_run_evidence_packages(id) on delete set null,
  review_status text not null default 'created',
  review_decision text,
  review_rationale text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_operator_reviews enable row level security;

create policy "workspace members can read dry run operator reviews"
  on public.agent_pmo_dry_run_operator_reviews for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_operator_reviews.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run operator reviews"
  on public.agent_pmo_dry_run_operator_reviews for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_operator_reviews.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update dry run operator reviews"
  on public.agent_pmo_dry_run_operator_reviews for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_operator_reviews.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_operator_reviews_workspace_idx
  on public.agent_pmo_dry_run_operator_reviews(workspace_id);

create index if not exists agent_pmo_dry_run_operator_reviews_request_idx
  on public.agent_pmo_dry_run_operator_reviews(dry_run_request_id);

create index if not exists agent_pmo_dry_run_operator_reviews_status_idx
  on public.agent_pmo_dry_run_operator_reviews(workspace_id, review_status);

create index if not exists agent_pmo_dry_run_operator_reviews_created_idx
  on public.agent_pmo_dry_run_operator_reviews(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_decisions ─────────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  decision_type text not null,
  decision_status text not null default 'created',
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_decisions enable row level security;

create policy "workspace members can read dry run decisions"
  on public.agent_pmo_dry_run_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run decisions"
  on public.agent_pmo_dry_run_decisions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_decisions_workspace_idx
  on public.agent_pmo_dry_run_decisions(workspace_id);

create index if not exists agent_pmo_dry_run_decisions_request_idx
  on public.agent_pmo_dry_run_decisions(dry_run_request_id);

create index if not exists agent_pmo_dry_run_decisions_type_idx
  on public.agent_pmo_dry_run_decisions(workspace_id, decision_type);

create index if not exists agent_pmo_dry_run_decisions_created_idx
  on public.agent_pmo_dry_run_decisions(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_exports ───────────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid not null references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  export_format text not null,
  export_status text not null default 'created',
  safe_export_content text not null default '',
  export_size_bytes integer not null default 0,
  safety_validation_passed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_exports enable row level security;

create policy "workspace members can read dry run exports"
  on public.agent_pmo_dry_run_exports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run exports"
  on public.agent_pmo_dry_run_exports for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_exports_workspace_idx
  on public.agent_pmo_dry_run_exports(workspace_id);

create index if not exists agent_pmo_dry_run_exports_request_idx
  on public.agent_pmo_dry_run_exports(dry_run_request_id);

create index if not exists agent_pmo_dry_run_exports_created_idx
  on public.agent_pmo_dry_run_exports(workspace_id, created_at desc);

-- ─── agent_pmo_dry_run_events ────────────────────────────────────────────────

create table if not exists public.agent_pmo_dry_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid references public.agent_pmo_dry_run_execution_requests(id) on delete cascade,
  event_type text not null,
  message text,
  safe_event_payload_json jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_dry_run_events enable row level security;

create policy "workspace members can read dry run events"
  on public.agent_pmo_dry_run_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create dry run events"
  on public.agent_pmo_dry_run_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_dry_run_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_dry_run_events_workspace_idx
  on public.agent_pmo_dry_run_events(workspace_id);

create index if not exists agent_pmo_dry_run_events_request_idx
  on public.agent_pmo_dry_run_events(dry_run_request_id);

create index if not exists agent_pmo_dry_run_events_type_idx
  on public.agent_pmo_dry_run_events(workspace_id, event_type);

create index if not exists agent_pmo_dry_run_events_created_idx
  on public.agent_pmo_dry_run_events(workspace_id, created_at desc);
