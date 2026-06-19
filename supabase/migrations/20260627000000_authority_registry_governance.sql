-- ─────────────────────────────────────────────────────────────────────────────
-- Authority Registry & Governance
-- Sprint 6: Constitutional Accountability & Authority Governance
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── authority_registrations ─────────────────────────────────────────────────
-- Records who holds what authority, its scope, validity window, and revocation.

create table if not exists public.authority_registrations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  actor_id            uuid not null references auth.users(id) on delete restrict,

  authority_type      text not null check (authority_type in (
                        'sponsor', 'project_manager', 'technical_lead',
                        'steering_committee', 'governance_board',
                        'product_owner', 'architect', 'client',
                        'external_approver'
                      )),

  -- Scope: workspace-wide or scoped to a specific project
  authority_scope     text not null check (authority_scope in ('workspace', 'project')) default 'project',
  project_id          uuid null,  -- null means workspace-scoped

  valid_from          timestamptz not null default now(),
  valid_until         timestamptz null,  -- null means indefinite

  status              text not null default 'active'
                        check (status in ('active', 'revoked', 'expired')),

  revoked_at          timestamptz null,
  revoked_by          uuid null references auth.users(id) on delete restrict,
  revocation_reason   text null,

  granted_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One active authority per actor+type+scope combination
  constraint authority_registrations_unique_active
    unique (workspace_id, actor_id, authority_type, authority_scope, project_id)
);

create index if not exists authority_registrations_workspace_idx
  on public.authority_registrations(workspace_id);

create index if not exists authority_registrations_actor_idx
  on public.authority_registrations(actor_id);

create index if not exists authority_registrations_status_idx
  on public.authority_registrations(status);

alter table public.authority_registrations enable row level security;

create policy "workspace members can read authority registrations"
  on public.authority_registrations
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert authority registrations"
  on public.authority_registrations
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and granted_by = auth.uid()
  );

create policy "workspace members can update authority registrations"
  on public.authority_registrations
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── authority_delegations ───────────────────────────────────────────────────
-- Tracks hierarchical delegation: Sponsor → PM → Technical Lead

create table if not exists public.authority_delegations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  -- Who is delegating
  delegator_id        uuid not null references auth.users(id) on delete restrict,
  delegator_authority text not null check (delegator_authority in (
                        'sponsor', 'project_manager', 'technical_lead',
                        'steering_committee', 'governance_board',
                        'product_owner', 'architect', 'client',
                        'external_approver'
                      )),

  -- Who receives the delegation
  delegate_id         uuid not null references auth.users(id) on delete restrict,
  delegate_authority  text not null check (delegate_authority in (
                        'sponsor', 'project_manager', 'technical_lead',
                        'steering_committee', 'governance_board',
                        'product_owner', 'architect', 'client',
                        'external_approver'
                      )),

  -- Scope
  project_id          uuid null,

  valid_from          timestamptz not null default now(),
  valid_until         timestamptz null,

  status              text not null default 'active'
                        check (status in ('active', 'revoked', 'expired')),

  revoked_at          timestamptz null,
  revoked_by          uuid null references auth.users(id) on delete restrict,
  revocation_reason   text null,

  -- Delegation depth guard: prevents unbounded chains
  delegation_depth    integer not null default 1 check (delegation_depth >= 1 and delegation_depth <= 3),

  -- Reference to the parent delegation (null for direct grants from root authority)
  parent_delegation_id uuid null references public.authority_delegations(id) on delete restrict,

  created_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists authority_delegations_workspace_idx
  on public.authority_delegations(workspace_id);

create index if not exists authority_delegations_delegator_idx
  on public.authority_delegations(delegator_id);

create index if not exists authority_delegations_delegate_idx
  on public.authority_delegations(delegate_id);

create index if not exists authority_delegations_status_idx
  on public.authority_delegations(status);

alter table public.authority_delegations enable row level security;

create policy "workspace members can read authority delegations"
  on public.authority_delegations
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert authority delegations"
  on public.authority_delegations
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "workspace members can update authority delegations"
  on public.authority_delegations
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── governance_violations ───────────────────────────────────────────────────
-- Detected governance violations: unauthorized actors, expired/revoked authority

create table if not exists public.governance_violations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  violation_type      text not null check (violation_type in (
                        'unauthorized_approval',
                        'unauthorized_amendment',
                        'unauthorized_ratification',
                        'expired_authority',
                        'revoked_authority',
                        'missing_authority_registration',
                        'delegation_depth_exceeded'
                      )),

  -- The action that was attempted
  action_type         text not null,  -- e.g. 'approve_decision', 'ratify_constitution'
  action_entity_type  text not null,  -- e.g. 'decision', 'constitution', 'amendment'
  action_entity_id    uuid not null,

  -- The actor who attempted the action
  actor_id            uuid not null references auth.users(id) on delete restrict,
  actor_authority     text null,  -- the authority they claimed

  -- Contextual authority details
  required_authority  text null,  -- what was required
  authority_id        uuid null,  -- reference to authority_registrations

  severity            text not null default 'high'
                        check (severity in ('low', 'medium', 'high', 'critical')),

  status              text not null default 'open'
                        check (status in ('open', 'acknowledged', 'resolved', 'escalated')),

  resolved_at         timestamptz null,
  resolved_by         uuid null references auth.users(id) on delete restrict,
  resolution_notes    text null,

  detected_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists governance_violations_workspace_idx
  on public.governance_violations(workspace_id);

create index if not exists governance_violations_status_idx
  on public.governance_violations(status);

create index if not exists governance_violations_actor_idx
  on public.governance_violations(actor_id);

alter table public.governance_violations enable row level security;

create policy "workspace members can read governance violations"
  on public.governance_violations
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert governance violations"
  on public.governance_violations
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can update governance violations"
  on public.governance_violations
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── authority_escalations ───────────────────────────────────────────────────
-- When no actor has sufficient authority, escalation routes to Governance Board

create table if not exists public.authority_escalations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  -- What triggered the escalation
  trigger_type        text not null check (trigger_type in (
                        'no_authority_holder',
                        'governance_violation',
                        'authority_gap',
                        'delegation_chain_broken',
                        'manual'
                      )),

  action_entity_type  text not null,
  action_entity_id    uuid not null,
  action_type         text not null,

  required_authority  text not null,

  -- Escalation target
  escalated_to        text not null default 'governance_board'
                        check (escalated_to in ('governance_board', 'steering_committee', 'sponsor', 'external_approver')),
  escalated_by        uuid not null references auth.users(id) on delete restrict,

  status              text not null default 'pending'
                        check (status in ('pending', 'acknowledged', 'resolved', 'closed')),

  resolution          text null,
  resolved_by         uuid null references auth.users(id) on delete restrict,
  resolved_at         timestamptz null,

  -- Optional link to governance violation that caused this escalation
  violation_id        uuid null references public.governance_violations(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists authority_escalations_workspace_idx
  on public.authority_escalations(workspace_id);

create index if not exists authority_escalations_status_idx
  on public.authority_escalations(status);

alter table public.authority_escalations enable row level security;

create policy "workspace members can read authority escalations"
  on public.authority_escalations
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert authority escalations"
  on public.authority_escalations
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and escalated_by = auth.uid()
  );

create policy "workspace members can update authority escalations"
  on public.authority_escalations
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));
