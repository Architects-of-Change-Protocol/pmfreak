-- ─────────────────────────────────────────────────────────────────────────────
-- Constitutional Ratification Framework
-- Sprint 5: Constitutional Signatures & Ratification
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_signatures ───────────────────────────────────────────────

create table if not exists public.constitutional_signatures (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,

  entity_type       text not null check (entity_type in ('constitution', 'amendment', 'decision')),
  entity_id         uuid not null,
  entity_version    integer not null default 1,

  authority_type    text not null check (authority_type in (
                      'sponsor', 'project_manager', 'client',
                      'steering_committee', 'governance_board',
                      'product_owner', 'architect', 'technical_lead',
                      'external_approver'
                    )),
  authority_id      uuid not null references auth.users(id) on delete restrict,

  status            text not null default 'pending'
                      check (status in ('pending', 'signed', 'rejected', 'expired', 'withdrawn')),

  signature_hash    text null,
  comments          text null,

  requested_at      timestamptz not null default now(),
  signed_at         timestamptz null,
  rejected_at       timestamptz null,
  expired_at        timestamptz null,
  withdrawn_at      timestamptz null,

  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Rule 2: cannot sign same authority + entity twice
  constraint constitutional_signatures_unique_authority_entity
    unique (workspace_id, entity_type, entity_id, authority_id)
);

create index if not exists constitutional_signatures_workspace_idx
  on public.constitutional_signatures(workspace_id);

create index if not exists constitutional_signatures_entity_idx
  on public.constitutional_signatures(entity_type, entity_id);

alter table public.constitutional_signatures enable row level security;

create policy "workspace members can read signatures"
  on public.constitutional_signatures
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert signatures"
  on public.constitutional_signatures
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "workspace members can update signatures"
  on public.constitutional_signatures
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── constitutional_signature_requests ──────────────────────────────────────

create table if not exists public.constitutional_signature_requests (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  entity_type         text not null check (entity_type in ('constitution', 'amendment', 'decision')),
  entity_id           uuid not null,

  requested_authority text not null check (requested_authority in (
                          'sponsor', 'project_manager', 'client',
                          'steering_committee', 'governance_board',
                          'product_owner', 'architect', 'technical_lead',
                          'external_approver'
                        )),

  requested_by        uuid not null references auth.users(id) on delete restrict,

  status              text not null default 'pending'
                        check (status in ('pending', 'fulfilled', 'declined', 'expired')),

  deadline            timestamptz null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists constitutional_signature_requests_workspace_idx
  on public.constitutional_signature_requests(workspace_id);

create index if not exists constitutional_signature_requests_entity_idx
  on public.constitutional_signature_requests(entity_type, entity_id);

alter table public.constitutional_signature_requests enable row level security;

create policy "workspace members can read signature requests"
  on public.constitutional_signature_requests
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert signature requests"
  on public.constitutional_signature_requests
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and requested_by = auth.uid()
  );

create policy "workspace members can update signature requests"
  on public.constitutional_signature_requests
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── constitutional_ratification_policies ───────────────────────────────────

create table if not exists public.constitutional_ratification_policies (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,

  entity_type             text not null check (entity_type in ('constitution', 'amendment', 'decision')),

  minimum_signatures      integer not null default 1 check (minimum_signatures >= 1),

  required_authorities    text[] not null default '{}',

  allow_unanimous_override boolean not null default false,

  created_at              timestamptz not null default now(),

  -- one policy per entity type per workspace
  constraint constitutional_ratification_policies_unique_type
    unique (workspace_id, entity_type)
);

create index if not exists constitutional_ratification_policies_workspace_idx
  on public.constitutional_ratification_policies(workspace_id);

alter table public.constitutional_ratification_policies enable row level security;

create policy "workspace members can read ratification policies"
  on public.constitutional_ratification_policies
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert ratification policies"
  on public.constitutional_ratification_policies
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can update ratification policies"
  on public.constitutional_ratification_policies
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));
