-- ─────────────────────────────────────────────────────────────────────────────
-- Operational Decision Engine
-- EPIC 4 — Sprint 4
--
-- Transforms Consequence Analyses into structured decision recommendations.
-- Answers: what is the best available decision?
-- Never executes decisions automatically — recommendations only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── operational_decisions ───────────────────────────────────────────────────

create table if not exists public.operational_decisions (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  consequence_id          uuid not null,

  decision_category       text not null check (decision_category in (
                            'governance',
                            'authority',
                            'ratification',
                            'execution',
                            'commitment',
                            'risk',
                            'resource',
                            'escalation',
                            'projection',
                            'portfolio'
                          )),

  decision_status         text not null default 'generated'
                            check (decision_status in (
                              'generated',
                              'evaluated',
                              'recommended',
                              'accepted',
                              'rejected',
                              'archived'
                            )),

  recommended_option_id   uuid,          -- set after evaluation; FK added below

  decision_score          numeric(5,2) not null default 0
                            check (decision_score between 0 and 100),

  decision_confidence     numeric(4,3) not null default 0
                            check (decision_confidence between 0 and 1),

  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id),

  -- enforce source consequence belongs to same workspace
  constraint od_consequence_workspace_fk
    foreign key (consequence_id, workspace_id)
    references public.operational_consequences(id, workspace_id)
    on delete cascade
);

create index if not exists od_workspace_id_idx
  on public.operational_decisions(workspace_id, created_at desc);

create index if not exists od_consequence_id_idx
  on public.operational_decisions(workspace_id, consequence_id);

create index if not exists od_category_idx
  on public.operational_decisions(workspace_id, decision_category);

create index if not exists od_status_idx
  on public.operational_decisions(workspace_id, decision_status);

create index if not exists od_score_idx
  on public.operational_decisions(workspace_id, decision_score desc);

alter table public.operational_decisions enable row level security;

create policy "workspace_members_can_access_operational_decisions"
  on public.operational_decisions
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_decision_options ────────────────────────────────────────────

create table if not exists public.operational_decision_options (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  decision_id             uuid not null,

  option_name             text not null,
  option_description      text not null,
  option_type             text not null check (option_type in (
                            'governance',
                            'authority',
                            'execution',
                            'commitment',
                            'escalation',
                            'resource',
                            'risk',
                            'structural'
                          )),

  pros                    text not null default '[]',
  cons                    text not null default '[]',

  estimated_effort        text not null default 'medium'
                            check (estimated_effort in ('low', 'medium', 'high')),

  estimated_risk          text not null default 'medium'
                            check (estimated_risk in ('low', 'medium', 'high', 'critical')),

  created_at              timestamptz not null default now(),

  -- composite unique for FK target
  unique (id, workspace_id),

  -- enforce decision belongs to same workspace
  constraint odo_decision_workspace_fk
    foreign key (decision_id, workspace_id)
    references public.operational_decisions(id, workspace_id)
    on delete cascade
);

create index if not exists odo_workspace_id_idx
  on public.operational_decision_options(workspace_id, created_at desc);

create index if not exists odo_decision_id_idx
  on public.operational_decision_options(decision_id);

alter table public.operational_decision_options enable row level security;

create policy "workspace_members_can_access_operational_decision_options"
  on public.operational_decision_options
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── Add FK from operational_decisions.recommended_option_id ─────────────────

alter table public.operational_decisions
  add constraint od_recommended_option_fk
    foreign key (recommended_option_id, workspace_id)
    references public.operational_decision_options(id, workspace_id)
    on delete set null;

-- ─── operational_decision_evaluations ────────────────────────────────────────

create table if not exists public.operational_decision_evaluations (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  decision_id             uuid not null,
  option_id               uuid not null,

  governance_score        numeric(5,2) not null default 0 check (governance_score between 0 and 100),
  execution_score         numeric(5,2) not null default 0 check (execution_score between 0 and 100),
  risk_score              numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  health_score            numeric(5,2) not null default 0 check (health_score between 0 and 100),
  overall_score           numeric(5,2) not null default 0 check (overall_score between 0 and 100),

  created_at              timestamptz not null default now(),

  -- enforce decision belongs to same workspace
  constraint ode_decision_workspace_fk
    foreign key (decision_id, workspace_id)
    references public.operational_decisions(id, workspace_id)
    on delete cascade
);

create index if not exists ode_workspace_id_idx
  on public.operational_decision_evaluations(workspace_id, created_at desc);

create index if not exists ode_decision_id_idx
  on public.operational_decision_evaluations(decision_id);

create index if not exists ode_option_id_idx
  on public.operational_decision_evaluations(option_id);

alter table public.operational_decision_evaluations enable row level security;

create policy "workspace_members_can_access_operational_decision_evaluations"
  on public.operational_decision_evaluations
  for all
  to authenticated
  using (is_workspace_member(workspace_id));

-- ─── operational_decision_tradeoffs ──────────────────────────────────────────

create table if not exists public.operational_decision_tradeoffs (
  id                      uuid primary key default gen_random_uuid(),

  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  decision_id             uuid not null,
  option_id               uuid not null,

  tradeoff_type           text not null check (tradeoff_type in ('pro', 'con')),
  description             text not null,
  impact_score            numeric(5,2) not null default 0 check (impact_score between 0 and 100),

  created_at              timestamptz not null default now(),

  -- enforce decision belongs to same workspace
  constraint odt_decision_workspace_fk
    foreign key (decision_id, workspace_id)
    references public.operational_decisions(id, workspace_id)
    on delete cascade
);

create index if not exists odt_workspace_id_idx
  on public.operational_decision_tradeoffs(workspace_id, created_at desc);

create index if not exists odt_decision_id_idx
  on public.operational_decision_tradeoffs(decision_id);

create index if not exists odt_option_id_idx
  on public.operational_decision_tradeoffs(option_id);

alter table public.operational_decision_tradeoffs enable row level security;

create policy "workspace_members_can_access_operational_decision_tradeoffs"
  on public.operational_decision_tradeoffs
  for all
  to authenticated
  using (is_workspace_member(workspace_id));
