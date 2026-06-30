-- ─────────────────────────────────────────────────────────────────────────────
-- PMO Controlled Policy Version Activation & Rollback Gate
-- Migration: 20260812000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT execute adapters, mutate projects, or create external tickets.
-- Does NOT store raw payloads, secrets, or customer identifiers.
-- Updates ONLY dedicated PMO governance policy activation records and
-- workspace-scoped active policy pointer records after explicit approval.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_pmo_policy_activation_requests ────────────────────────────────────

create table if not exists public.agent_pmo_policy_activation_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dry_run_request_id uuid references public.agent_pmo_dry_run_execution_requests(id) on delete set null,
  dry_run_decision_id uuid,
  evidence_package_id uuid,
  simulated_policy_version_id uuid,
  planning_workspace_id uuid references public.agent_pmo_implementation_planning_workspaces(id) on delete set null,
  approval_pack_id uuid references public.agent_pmo_approval_packs(id) on delete set null,
  change_request_id uuid references public.agent_pmo_policy_change_requests(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  request_reason text not null default '',
  activation_status text not null default 'created',
  request_version integer not null default 1,
  safe_request_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_requests enable row level security;

create policy "workspace members can read policy activation requests"
  on public.agent_pmo_policy_activation_requests for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create policy activation requests"
  on public.agent_pmo_policy_activation_requests for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update policy activation requests"
  on public.agent_pmo_policy_activation_requests for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_requests_workspace_idx
  on public.agent_pmo_policy_activation_requests(workspace_id);
create index if not exists agent_pmo_activation_requests_status_idx
  on public.agent_pmo_policy_activation_requests(workspace_id, activation_status);
create index if not exists agent_pmo_activation_requests_created_idx
  on public.agent_pmo_policy_activation_requests(workspace_id, created_at desc);

-- ─── agent_pmo_policy_activation_preconditions ───────────────────────────────

create table if not exists public.agent_pmo_policy_activation_preconditions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  precondition_key text not null,
  precondition_status text not null default 'pending',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_preconditions enable row level security;

create policy "workspace members can read activation preconditions"
  on public.agent_pmo_policy_activation_preconditions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_preconditions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation preconditions"
  on public.agent_pmo_policy_activation_preconditions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_preconditions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update activation preconditions"
  on public.agent_pmo_policy_activation_preconditions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_preconditions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_preconditions_request_idx
  on public.agent_pmo_policy_activation_preconditions(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_activation_gates ───────────────────────────────────────

create table if not exists public.agent_pmo_policy_activation_gates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  gate_status text not null default 'under_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  safe_gate_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_gates enable row level security;

create policy "workspace members can read activation gates"
  on public.agent_pmo_policy_activation_gates for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation gates"
  on public.agent_pmo_policy_activation_gates for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update activation gates"
  on public.agent_pmo_policy_activation_gates for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_gates_request_idx
  on public.agent_pmo_policy_activation_gates(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_activation_gate_decisions ──────────────────────────────

create table if not exists public.agent_pmo_policy_activation_gate_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_gate_id uuid not null references public.agent_pmo_policy_activation_gates(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  decision_type text not null,
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_gate_decisions enable row level security;

create policy "workspace members can read activation gate decisions"
  on public.agent_pmo_policy_activation_gate_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation gate decisions"
  on public.agent_pmo_policy_activation_gate_decisions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_gate_decisions_request_idx
  on public.agent_pmo_policy_activation_gate_decisions(workspace_id, activation_request_id);

-- ─── agent_pmo_controlled_policy_versions ────────────────────────────────────

create table if not exists public.agent_pmo_controlled_policy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  dry_run_request_id uuid references public.agent_pmo_dry_run_execution_requests(id) on delete set null,
  simulated_policy_version_id uuid,
  version_label text not null default '',
  version_number integer not null default 1,
  policy_area text not null default '',
  version_status text not null default 'created',
  safe_policy_payload_json jsonb not null default '{}'::jsonb,
  safe_diff_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_controlled_policy_versions enable row level security;

create policy "workspace members can read controlled policy versions"
  on public.agent_pmo_controlled_policy_versions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_controlled_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create controlled policy versions"
  on public.agent_pmo_controlled_policy_versions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_controlled_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update controlled policy versions"
  on public.agent_pmo_controlled_policy_versions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_controlled_policy_versions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_controlled_versions_workspace_idx
  on public.agent_pmo_controlled_policy_versions(workspace_id);
create index if not exists agent_pmo_controlled_versions_area_idx
  on public.agent_pmo_controlled_policy_versions(workspace_id, policy_area);
create index if not exists agent_pmo_controlled_versions_status_idx
  on public.agent_pmo_controlled_policy_versions(workspace_id, version_status);

-- ─── agent_pmo_active_policy_pointers ────────────────────────────────────────
-- At most one active pointer per workspace + policy area (unique constraint).

create table if not exists public.agent_pmo_active_policy_pointers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  policy_area text not null,
  active_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  previous_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  activation_request_id uuid references public.agent_pmo_policy_activation_requests(id) on delete set null,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz,
  rollback_available boolean not null default false,
  safe_pointer_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_pmo_active_policy_pointers_workspace_area_unique unique (workspace_id, policy_area)
);

alter table public.agent_pmo_active_policy_pointers enable row level security;

create policy "workspace members can read active policy pointers"
  on public.agent_pmo_active_policy_pointers for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_active_policy_pointers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create active policy pointers"
  on public.agent_pmo_active_policy_pointers for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_active_policy_pointers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update active policy pointers"
  on public.agent_pmo_active_policy_pointers for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_active_policy_pointers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_active_pointers_workspace_idx
  on public.agent_pmo_active_policy_pointers(workspace_id);

-- ─── agent_pmo_policy_activation_executions ──────────────────────────────────

create table if not exists public.agent_pmo_policy_activation_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  activation_gate_id uuid references public.agent_pmo_policy_activation_gates(id) on delete set null,
  controlled_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  active_policy_pointer_id uuid references public.agent_pmo_active_policy_pointers(id) on delete set null,
  execution_status text not null default 'created',
  started_at timestamptz,
  completed_at timestamptz,
  safe_execution_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_executions enable row level security;

create policy "workspace members can read activation executions"
  on public.agent_pmo_policy_activation_executions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation executions"
  on public.agent_pmo_policy_activation_executions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update activation executions"
  on public.agent_pmo_policy_activation_executions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_executions_request_idx
  on public.agent_pmo_policy_activation_executions(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_rollback_requests ──────────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  controlled_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  active_policy_pointer_id uuid references public.agent_pmo_active_policy_pointers(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  request_reason text not null default '',
  rollback_status text not null default 'rollback_review_required',
  safe_rollback_request_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_requests enable row level security;

create policy "workspace members can read rollback requests"
  on public.agent_pmo_policy_rollback_requests for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create rollback requests"
  on public.agent_pmo_policy_rollback_requests for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update rollback requests"
  on public.agent_pmo_policy_rollback_requests for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_requests_activation_idx
  on public.agent_pmo_policy_rollback_requests(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_rollback_gates ─────────────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_gates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rollback_request_id uuid not null references public.agent_pmo_policy_rollback_requests(id) on delete cascade,
  gate_status text not null default 'under_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  safe_gate_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_gates enable row level security;

create policy "workspace members can read rollback gates"
  on public.agent_pmo_policy_rollback_gates for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create rollback gates"
  on public.agent_pmo_policy_rollback_gates for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update rollback gates"
  on public.agent_pmo_policy_rollback_gates for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_gates_request_idx
  on public.agent_pmo_policy_rollback_gates(workspace_id, rollback_request_id);

-- ─── agent_pmo_policy_rollback_gate_decisions ────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_gate_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rollback_gate_id uuid not null references public.agent_pmo_policy_rollback_gates(id) on delete cascade,
  rollback_request_id uuid not null references public.agent_pmo_policy_rollback_requests(id) on delete cascade,
  decision_type text not null,
  rationale text not null default '',
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_gate_decisions enable row level security;

create policy "workspace members can read rollback gate decisions"
  on public.agent_pmo_policy_rollback_gate_decisions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create rollback gate decisions"
  on public.agent_pmo_policy_rollback_gate_decisions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_gate_decisions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_gate_decisions_request_idx
  on public.agent_pmo_policy_rollback_gate_decisions(workspace_id, rollback_request_id);

-- ─── agent_pmo_policy_rollback_executions ────────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rollback_request_id uuid not null references public.agent_pmo_policy_rollback_requests(id) on delete cascade,
  rollback_gate_id uuid references public.agent_pmo_policy_rollback_gates(id) on delete set null,
  activation_request_id uuid references public.agent_pmo_policy_activation_requests(id) on delete set null,
  controlled_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  previous_policy_version_id uuid references public.agent_pmo_controlled_policy_versions(id) on delete set null,
  active_policy_pointer_id uuid references public.agent_pmo_active_policy_pointers(id) on delete set null,
  execution_status text not null default 'created',
  started_at timestamptz,
  completed_at timestamptz,
  safe_rollback_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_executions enable row level security;

create policy "workspace members can read rollback executions"
  on public.agent_pmo_policy_rollback_executions for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create rollback executions"
  on public.agent_pmo_policy_rollback_executions for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update rollback executions"
  on public.agent_pmo_policy_rollback_executions for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_executions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_executions_request_idx
  on public.agent_pmo_policy_rollback_executions(workspace_id, rollback_request_id);

-- ─── agent_pmo_policy_rollback_verifications ─────────────────────────────────

create table if not exists public.agent_pmo_policy_rollback_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rollback_execution_id uuid not null references public.agent_pmo_policy_rollback_executions(id) on delete cascade,
  rollback_request_id uuid references public.agent_pmo_policy_rollback_requests(id) on delete set null,
  verification_status text not null default 'pending',
  checks_total integer not null default 0,
  checks_passed integer not null default 0,
  checks_failed integer not null default 0,
  safe_verification_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_rollback_verifications enable row level security;

create policy "workspace members can read rollback verifications"
  on public.agent_pmo_policy_rollback_verifications for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_verifications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create rollback verifications"
  on public.agent_pmo_policy_rollback_verifications for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_verifications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update rollback verifications"
  on public.agent_pmo_policy_rollback_verifications for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_rollback_verifications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_rollback_verifications_execution_idx
  on public.agent_pmo_policy_rollback_verifications(workspace_id, rollback_execution_id);

-- ─── agent_pmo_policy_activation_audit_entries ───────────────────────────────

create table if not exists public.agent_pmo_policy_activation_audit_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid references public.agent_pmo_policy_activation_requests(id) on delete set null,
  entry_type text not null,
  summary text not null default '',
  actor_id uuid references auth.users(id) on delete set null,
  safe_audit_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_audit_entries enable row level security;

create policy "workspace members can read activation audit entries"
  on public.agent_pmo_policy_activation_audit_entries for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_audit_entries.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation audit entries"
  on public.agent_pmo_policy_activation_audit_entries for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_audit_entries.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_audit_entries_request_idx
  on public.agent_pmo_policy_activation_audit_entries(workspace_id, activation_request_id);
create index if not exists agent_pmo_activation_audit_entries_created_idx
  on public.agent_pmo_policy_activation_audit_entries(workspace_id, created_at desc);

-- ─── agent_pmo_post_activation_monitoring_hooks ──────────────────────────────

create table if not exists public.agent_pmo_post_activation_monitoring_hooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  hook_type text not null,
  hook_status text not null default 'active',
  summary text not null default '',
  safe_hook_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_pmo_post_activation_monitoring_hooks enable row level security;

create policy "workspace members can read monitoring hooks"
  on public.agent_pmo_post_activation_monitoring_hooks for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_post_activation_monitoring_hooks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create monitoring hooks"
  on public.agent_pmo_post_activation_monitoring_hooks for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_post_activation_monitoring_hooks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update monitoring hooks"
  on public.agent_pmo_post_activation_monitoring_hooks for update
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_post_activation_monitoring_hooks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_monitoring_hooks_request_idx
  on public.agent_pmo_post_activation_monitoring_hooks(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_activation_exports ─────────────────────────────────────

create table if not exists public.agent_pmo_policy_activation_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid not null references public.agent_pmo_policy_activation_requests(id) on delete cascade,
  export_format text not null,
  export_status text not null default 'created',
  safe_export_content text not null default '',
  export_size_bytes integer not null default 0,
  safety_validation_passed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_exports enable row level security;

create policy "workspace members can read activation exports"
  on public.agent_pmo_policy_activation_exports for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation exports"
  on public.agent_pmo_policy_activation_exports for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_exports.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_exports_request_idx
  on public.agent_pmo_policy_activation_exports(workspace_id, activation_request_id);

-- ─── agent_pmo_policy_activation_events ──────────────────────────────────────

create table if not exists public.agent_pmo_policy_activation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  activation_request_id uuid references public.agent_pmo_policy_activation_requests(id) on delete set null,
  event_type text not null,
  message text,
  safe_event_payload_json jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.agent_pmo_policy_activation_events enable row level security;

create policy "workspace members can read activation events"
  on public.agent_pmo_policy_activation_events for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can create activation events"
  on public.agent_pmo_policy_activation_events for insert
  with check (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = agent_pmo_policy_activation_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create index if not exists agent_pmo_activation_events_request_idx
  on public.agent_pmo_policy_activation_events(workspace_id, activation_request_id);
create index if not exists agent_pmo_activation_events_created_idx
  on public.agent_pmo_policy_activation_events(workspace_id, created_at desc);
