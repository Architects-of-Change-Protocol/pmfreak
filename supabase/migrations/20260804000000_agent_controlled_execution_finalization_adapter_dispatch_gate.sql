-- ─────────────────────────────────────────────────────────────────────────────
-- Controlled Execution Finalization & Adapter Dispatch Gate
-- Migration: 20260804000000
-- Does NOT call LLMs, external APIs, or send communications.
-- Does NOT perform real external side effects.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── agent_execution_finalizations ───────────────────────────────────────────

create table if not exists public.agent_execution_finalizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  action_conversion_id uuid references public.agent_action_conversions(id) on delete set null,
  action_draft_id uuid references public.agent_review_action_drafts(id) on delete set null,
  review_item_id uuid references public.agent_review_items(id) on delete set null,
  source_result_id uuid references public.agent_execution_results(id) on delete set null,
  source_evidence_id uuid references public.agent_execution_evidence_items(id) on delete set null,
  status text not null default 'created',
  readiness text not null default 'not_ready',
  execution_mode text not null,
  risk_level text not null default 'medium',
  selected_tool_key text,
  selected_adapter_key text,
  side_effect_mode text not null default 'none',
  confirmation_requirement text not null default 'not_required',
  confirmation_status text not null default 'not_required',
  approval_verified boolean not null default false,
  lock_status text not null default 'available',
  idempotency_status text not null default 'new',
  dispatch_gate_id uuid,
  latest_dispatch_attempt_id uuid,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  evidence_ids_json jsonb not null default '[]'::jsonb,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  finalization_payload_json jsonb,
  safe_finalization_payload_json jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_finalizations_workspace_idx
  on public.agent_execution_finalizations(workspace_id);

create index if not exists agent_execution_finalizations_request_idx
  on public.agent_execution_finalizations(execution_request_id);

create index if not exists agent_execution_finalizations_conversion_idx
  on public.agent_execution_finalizations(action_conversion_id);

create index if not exists agent_execution_finalizations_status_idx
  on public.agent_execution_finalizations(workspace_id, status);

create index if not exists agent_execution_finalizations_readiness_idx
  on public.agent_execution_finalizations(workspace_id, readiness);

create index if not exists agent_execution_finalizations_adapter_idx
  on public.agent_execution_finalizations(workspace_id, selected_adapter_key);

create index if not exists agent_execution_finalizations_tool_idx
  on public.agent_execution_finalizations(workspace_id, selected_tool_key);

create index if not exists agent_execution_finalizations_confirmation_idx
  on public.agent_execution_finalizations(workspace_id, confirmation_status);

create index if not exists agent_execution_finalizations_created_idx
  on public.agent_execution_finalizations(workspace_id, created_at desc);

-- ─── agent_execution_dispatch_gates ──────────────────────────────────────────

create table if not exists public.agent_execution_dispatch_gates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finalization_id uuid not null references public.agent_execution_finalizations(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  status text not null default 'created',
  selected_tool_key text,
  selected_adapter_key text,
  execution_mode text not null,
  side_effect_mode text not null default 'none',
  dispatch_allowed boolean not null default false,
  requires_final_confirmation boolean not null default false,
  confirmation_status text not null default 'not_required',
  lock_id uuid,
  idempotency_id uuid,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_dispatch_gates_workspace_idx
  on public.agent_execution_dispatch_gates(workspace_id);

create index if not exists agent_execution_dispatch_gates_finalization_idx
  on public.agent_execution_dispatch_gates(finalization_id);

create index if not exists agent_execution_dispatch_gates_request_idx
  on public.agent_execution_dispatch_gates(execution_request_id);

create index if not exists agent_execution_dispatch_gates_status_idx
  on public.agent_execution_dispatch_gates(workspace_id, status);

create index if not exists agent_execution_dispatch_gates_adapter_idx
  on public.agent_execution_dispatch_gates(workspace_id, selected_adapter_key);

create index if not exists agent_execution_dispatch_gates_allowed_idx
  on public.agent_execution_dispatch_gates(workspace_id, dispatch_allowed);

-- ─── agent_execution_dispatch_locks ──────────────────────────────────────────

create table if not exists public.agent_execution_dispatch_locks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete cascade,
  lock_key text not null,
  status text not null default 'available',
  acquired_by uuid references auth.users(id) on delete set null,
  acquired_at timestamptz,
  expires_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, lock_key)
);

create index if not exists agent_execution_dispatch_locks_workspace_idx
  on public.agent_execution_dispatch_locks(workspace_id);

create index if not exists agent_execution_dispatch_locks_request_idx
  on public.agent_execution_dispatch_locks(execution_request_id);

create index if not exists agent_execution_dispatch_locks_finalization_idx
  on public.agent_execution_dispatch_locks(finalization_id);

create index if not exists agent_execution_dispatch_locks_status_idx
  on public.agent_execution_dispatch_locks(workspace_id, status);

create index if not exists agent_execution_dispatch_locks_key_idx
  on public.agent_execution_dispatch_locks(workspace_id, lock_key);

-- ─── agent_execution_dispatch_idempotency ────────────────────────────────────

create table if not exists public.agent_execution_dispatch_idempotency (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete cascade,
  idempotency_key text not null,
  idempotency_fingerprint text not null,
  status text not null default 'new',
  first_dispatch_attempt_id uuid,
  latest_dispatch_attempt_id uuid,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, idempotency_key)
);

create index if not exists agent_execution_dispatch_idempotency_workspace_idx
  on public.agent_execution_dispatch_idempotency(workspace_id);

create index if not exists agent_execution_dispatch_idempotency_request_idx
  on public.agent_execution_dispatch_idempotency(execution_request_id);

create index if not exists agent_execution_dispatch_idempotency_finalization_idx
  on public.agent_execution_dispatch_idempotency(finalization_id);

create index if not exists agent_execution_dispatch_idempotency_status_idx
  on public.agent_execution_dispatch_idempotency(workspace_id, status);

create index if not exists agent_execution_dispatch_idempotency_key_idx
  on public.agent_execution_dispatch_idempotency(workspace_id, idempotency_key);

-- ─── agent_execution_dispatch_attempts ───────────────────────────────────────

create table if not exists public.agent_execution_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finalization_id uuid not null references public.agent_execution_finalizations(id) on delete cascade,
  dispatch_gate_id uuid references public.agent_execution_dispatch_gates(id) on delete set null,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  adapter_key text,
  tool_key text,
  execution_mode text not null,
  status text not null default 'created',
  attempt_number integer not null default 1,
  started_at timestamptz,
  completed_at timestamptz,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  evidence_ids_json jsonb not null default '[]'::jsonb,
  error_message text,
  blocking_reasons_json jsonb not null default '[]'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_dispatch_attempts_workspace_idx
  on public.agent_execution_dispatch_attempts(workspace_id);

create index if not exists agent_execution_dispatch_attempts_finalization_idx
  on public.agent_execution_dispatch_attempts(finalization_id);

create index if not exists agent_execution_dispatch_attempts_gate_idx
  on public.agent_execution_dispatch_attempts(dispatch_gate_id);

create index if not exists agent_execution_dispatch_attempts_request_idx
  on public.agent_execution_dispatch_attempts(execution_request_id);

create index if not exists agent_execution_dispatch_attempts_adapter_idx
  on public.agent_execution_dispatch_attempts(workspace_id, adapter_key);

create index if not exists agent_execution_dispatch_attempts_status_idx
  on public.agent_execution_dispatch_attempts(workspace_id, status);

create index if not exists agent_execution_dispatch_attempts_created_idx
  on public.agent_execution_dispatch_attempts(workspace_id, created_at desc);

-- ─── agent_execution_final_confirmations ─────────────────────────────────────

create table if not exists public.agent_execution_final_confirmations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finalization_id uuid not null references public.agent_execution_finalizations(id) on delete cascade,
  execution_request_id uuid not null references public.agent_execution_requests(id) on delete cascade,
  requirement text not null,
  status text not null default 'required',
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_execution_final_confirmations_workspace_idx
  on public.agent_execution_final_confirmations(workspace_id);

create index if not exists agent_execution_final_confirmations_finalization_idx
  on public.agent_execution_final_confirmations(finalization_id);

create index if not exists agent_execution_final_confirmations_request_idx
  on public.agent_execution_final_confirmations(execution_request_id);

create index if not exists agent_execution_final_confirmations_status_idx
  on public.agent_execution_final_confirmations(workspace_id, status);

-- ─── agent_execution_dispatch_events ─────────────────────────────────────────

create table if not exists public.agent_execution_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finalization_id uuid references public.agent_execution_finalizations(id) on delete cascade,
  dispatch_gate_id uuid references public.agent_execution_dispatch_gates(id) on delete set null,
  dispatch_attempt_id uuid references public.agent_execution_dispatch_attempts(id) on delete set null,
  execution_request_id uuid references public.agent_execution_requests(id) on delete set null,
  adapter_execution_id uuid references public.agent_tool_adapter_executions(id) on delete set null,
  result_id uuid references public.agent_execution_results(id) on delete set null,
  event_type text not null,
  message text,
  event_payload_json jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_execution_dispatch_events_workspace_idx
  on public.agent_execution_dispatch_events(workspace_id);

create index if not exists agent_execution_dispatch_events_finalization_idx
  on public.agent_execution_dispatch_events(finalization_id);

create index if not exists agent_execution_dispatch_events_gate_idx
  on public.agent_execution_dispatch_events(dispatch_gate_id);

create index if not exists agent_execution_dispatch_events_attempt_idx
  on public.agent_execution_dispatch_events(dispatch_attempt_id);

create index if not exists agent_execution_dispatch_events_request_idx
  on public.agent_execution_dispatch_events(execution_request_id);

create index if not exists agent_execution_dispatch_events_type_idx
  on public.agent_execution_dispatch_events(workspace_id, event_type);

create index if not exists agent_execution_dispatch_events_created_idx
  on public.agent_execution_dispatch_events(workspace_id, created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.agent_execution_finalizations enable row level security;
alter table public.agent_execution_dispatch_gates enable row level security;
alter table public.agent_execution_dispatch_locks enable row level security;
alter table public.agent_execution_dispatch_idempotency enable row level security;
alter table public.agent_execution_dispatch_attempts enable row level security;
alter table public.agent_execution_final_confirmations enable row level security;
alter table public.agent_execution_dispatch_events enable row level security;

-- agent_execution_finalizations
create policy "workspace_members_read_execution_finalizations"
  on public.agent_execution_finalizations for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_finalizations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_execution_finalizations"
  on public.agent_execution_finalizations for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_finalizations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_execution_finalizations"
  on public.agent_execution_finalizations for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_finalizations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_dispatch_gates
create policy "workspace_members_read_dispatch_gates"
  on public.agent_execution_dispatch_gates for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_dispatch_gates"
  on public.agent_execution_dispatch_gates for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_dispatch_gates"
  on public.agent_execution_dispatch_gates for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_gates.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_dispatch_locks
create policy "workspace_members_read_dispatch_locks"
  on public.agent_execution_dispatch_locks for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_locks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_dispatch_locks"
  on public.agent_execution_dispatch_locks for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_locks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_dispatch_locks"
  on public.agent_execution_dispatch_locks for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_locks.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_dispatch_idempotency
create policy "workspace_members_read_dispatch_idempotency"
  on public.agent_execution_dispatch_idempotency for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_idempotency.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_dispatch_idempotency"
  on public.agent_execution_dispatch_idempotency for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_idempotency.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_dispatch_idempotency"
  on public.agent_execution_dispatch_idempotency for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_idempotency.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_dispatch_attempts
create policy "workspace_members_read_dispatch_attempts"
  on public.agent_execution_dispatch_attempts for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_attempts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_dispatch_attempts"
  on public.agent_execution_dispatch_attempts for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_attempts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_dispatch_attempts"
  on public.agent_execution_dispatch_attempts for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_attempts.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_final_confirmations
create policy "workspace_members_read_final_confirmations"
  on public.agent_execution_final_confirmations for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_final_confirmations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_final_confirmations"
  on public.agent_execution_final_confirmations for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_final_confirmations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_update_final_confirmations"
  on public.agent_execution_final_confirmations for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_final_confirmations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- agent_execution_dispatch_events
create policy "workspace_members_read_dispatch_events"
  on public.agent_execution_dispatch_events for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace_members_insert_dispatch_events"
  on public.agent_execution_dispatch_events for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = agent_execution_dispatch_events.workspace_id
        and wm.user_id = auth.uid()
    )
  );
