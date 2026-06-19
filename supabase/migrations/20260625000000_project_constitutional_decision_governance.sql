-- ─────────────────────────────────────────────────────────────────────────────
-- Project Constitutional Decision Governance
-- Sprint 4: Constitutional Decision Governance
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_decisions ────────────────────────────────────────────────

create table if not exists public.constitutional_decisions (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  constitution_id     uuid not null references public.project_constitutions(id) on delete cascade,

  title               text not null check (char_length(trim(title)) > 0),
  description         text null,

  decision_type       text not null check (decision_type in (
                        'scope', 'schedule', 'cost', 'quality', 'risk',
                        'resource', 'architecture', 'governance', 'constitutional',
                        'technical', 'vendor', 'operational'
                      )),

  context             text null,
  problem_statement   text null,

  recommended_option  text null,
  selected_option     text null,

  decision_authority  text not null check (decision_authority in (
                        'sponsor', 'project_manager', 'steering_committee',
                        'governance_board', 'product_owner', 'client',
                        'architect', 'technical_lead'
                      )),

  status              text not null default 'draft'
                        check (status in ('draft', 'proposed', 'approved', 'rejected', 'executed', 'cancelled')),

  created_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  approved_by         uuid null references auth.users(id) on delete restrict,
  approved_at         timestamptz null,

  executed_by         uuid null references auth.users(id) on delete restrict,
  executed_at         timestamptz null,

  cancelled_by        uuid null references auth.users(id) on delete restrict,
  cancelled_at        timestamptz null,

  deleted_at          timestamptz null,

  -- workspace isolation via composite FK
  constraint constitutional_decisions_workspace_constitution_fkey
    foreign key (constitution_id, workspace_id)
    references public.project_constitutions(id, workspace_id) on delete cascade
);

create index if not exists constitutional_decisions_workspace_idx
  on public.constitutional_decisions(workspace_id);

create index if not exists constitutional_decisions_constitution_idx
  on public.constitutional_decisions(constitution_id, workspace_id);

create index if not exists constitutional_decisions_status_idx
  on public.constitutional_decisions(workspace_id, status);

create index if not exists constitutional_decisions_type_idx
  on public.constitutional_decisions(workspace_id, decision_type);

alter table public.constitutional_decisions enable row level security;

create policy "workspace members can read constitutional decisions"
  on public.constitutional_decisions
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert constitutional decisions"
  on public.constitutional_decisions
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "workspace members can update constitutional decisions"
  on public.constitutional_decisions
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─── constitutional_decision_options ─────────────────────────────────────────

create table if not exists public.constitutional_decision_options (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  decision_id     uuid not null references public.constitutional_decisions(id) on delete cascade,

  name            text not null check (char_length(trim(name)) > 0),
  description     text null,

  advantages      text null,
  disadvantages   text null,

  estimated_cost  text null,
  estimated_effort text null,

  selected        boolean not null default false,

  created_at      timestamptz not null default now(),

  -- workspace isolation
  constraint constitutional_decision_options_workspace_decision_fkey
    foreign key (decision_id, workspace_id)
    references public.constitutional_decisions(id, workspace_id) on delete cascade
);

create index if not exists constitutional_decision_options_decision_idx
  on public.constitutional_decision_options(decision_id, workspace_id);

create index if not exists constitutional_decision_options_workspace_idx
  on public.constitutional_decision_options(workspace_id);

alter table public.constitutional_decision_options enable row level security;

create policy "workspace members can read decision options"
  on public.constitutional_decision_options
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert decision options"
  on public.constitutional_decision_options
  for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can update decision options"
  on public.constitutional_decision_options
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can delete decision options"
  on public.constitutional_decision_options
  for delete
  using (public.is_workspace_member(workspace_id));

-- ─── constitutional_decision_evidence ────────────────────────────────────────

create table if not exists public.constitutional_decision_evidence (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  decision_id     uuid not null references public.constitutional_decisions(id) on delete cascade,

  evidence_type   text not null check (evidence_type in (
                    'document', 'email', 'meeting', 'risk', 'issue',
                    'change_request', 'file', 'link', 'chat', 'approval'
                  )),

  reference_id    text null,

  description     text not null check (char_length(trim(description)) > 0),

  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),

  -- workspace isolation
  constraint constitutional_decision_evidence_workspace_decision_fkey
    foreign key (decision_id, workspace_id)
    references public.constitutional_decisions(id, workspace_id) on delete cascade
);

create index if not exists constitutional_decision_evidence_decision_idx
  on public.constitutional_decision_evidence(decision_id, workspace_id);

create index if not exists constitutional_decision_evidence_workspace_idx
  on public.constitutional_decision_evidence(workspace_id);

alter table public.constitutional_decision_evidence enable row level security;

create policy "workspace members can read decision evidence"
  on public.constitutional_decision_evidence
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert decision evidence"
  on public.constitutional_decision_evidence
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

-- ─── constitutional_decision_links ────────────────────────────────────────────

create table if not exists public.constitutional_decision_links (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  decision_id       uuid not null references public.constitutional_decisions(id) on delete cascade,

  link_type         text not null check (link_type in (
                      'objective', 'constraint', 'amendment', 'risk', 'issue',
                      'milestone', 'deliverable', 'constitution_version'
                    )),

  linked_entity_id  uuid not null,

  created_at        timestamptz not null default now(),

  -- workspace isolation
  constraint constitutional_decision_links_workspace_decision_fkey
    foreign key (decision_id, workspace_id)
    references public.constitutional_decisions(id, workspace_id) on delete cascade
);

create index if not exists constitutional_decision_links_decision_idx
  on public.constitutional_decision_links(decision_id, workspace_id);

create index if not exists constitutional_decision_links_workspace_idx
  on public.constitutional_decision_links(workspace_id);

create index if not exists constitutional_decision_links_entity_idx
  on public.constitutional_decision_links(workspace_id, linked_entity_id);

alter table public.constitutional_decision_links enable row level security;

create policy "workspace members can read decision links"
  on public.constitutional_decision_links
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert decision links"
  on public.constitutional_decision_links
  for insert
  with check (public.is_workspace_member(workspace_id));
