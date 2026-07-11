create table if not exists public.capability_trust_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  event_type text not null check (event_type in ('trust_domain_suspended','trust_domain_revoked','signing_key_revoked','signing_key_rotated','capability_claim_revoked','delegation_revoked','issuer_distrusted','verifier_policy_revoked')),
  issuer_app text not null,
  trust_domain text not null,
  key_id text,
  claim_hash text,
  delegation_id uuid,
  grant_id uuid,
  workspace_id uuid,
  source_verifier text,
  severity text not null check (severity in ('info','warning','critical')),
  reason text,
  event_payload jsonb not null default '{}'::jsonb,
  signature text,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  propagated_at timestamptz
);

create table if not exists public.capability_revocation_registry (
  id uuid primary key default gen_random_uuid(),
  revocation_type text not null check (revocation_type in ('claim','key','trust_domain','delegation','grant','verifier_policy')),
  trust_domain text not null,
  key_id text,
  claim_hash text,
  delegation_id uuid,
  grant_id uuid,
  revoked_by text,
  reason text,
  severity text not null check (severity in ('info','warning','critical')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  source_event_id text
);

create table if not exists public.capability_trust_graph_edges (
  id uuid primary key default gen_random_uuid(),
  source_domain text not null,
  target_domain text not null,
  relationship text not null check (relationship in ('trusts','distrusts','verifies','revoked')),
  scope jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_capability_trust_graph_edge_unique on public.capability_trust_graph_edges(source_domain, target_domain, relationship);
create index if not exists idx_capability_trust_events_domain_created on public.capability_trust_events(trust_domain, created_at desc);
create index if not exists idx_capability_revocation_registry_lookup on public.capability_revocation_registry(trust_domain, revocation_type, key_id, claim_hash);

alter table public.capability_trust_events enable row level security;
alter table public.capability_revocation_registry enable row level security;
alter table public.capability_trust_graph_edges enable row level security;

drop policy if exists "trust_events_workspace_read" on public.capability_trust_events;
create policy "trust_events_workspace_read" on public.capability_trust_events
for select using (
  workspace_id is null or exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = capability_trust_events.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  )
);

drop policy if exists "trust_events_server_write" on public.capability_trust_events;
create policy "trust_events_server_write" on public.capability_trust_events for all using (false) with check (false);

drop policy if exists "revocation_registry_workspace_read" on public.capability_revocation_registry;
create policy "revocation_registry_workspace_read" on public.capability_revocation_registry for select using (false);
drop policy if exists "revocation_registry_server_write" on public.capability_revocation_registry;
create policy "revocation_registry_server_write" on public.capability_revocation_registry for all using (false) with check (false);

drop policy if exists "trust_graph_workspace_read" on public.capability_trust_graph_edges;
create policy "trust_graph_workspace_read" on public.capability_trust_graph_edges for select using (true);
drop policy if exists "trust_graph_server_write" on public.capability_trust_graph_edges;
create policy "trust_graph_server_write" on public.capability_trust_graph_edges for all using (false) with check (false);
