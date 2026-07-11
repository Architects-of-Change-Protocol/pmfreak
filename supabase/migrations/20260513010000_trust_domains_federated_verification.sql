create table if not exists public.capability_trust_domains (
  id uuid primary key default gen_random_uuid(),
  domain_key text not null unique,
  name text not null,
  issuer_app text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  status text not null check (status in ('active','suspended','revoked')),
  verification_mode text not null check (verification_mode in ('local','trusted_external','federation_ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create table if not exists public.capability_signing_keys (
  id uuid primary key default gen_random_uuid(),
  trust_domain_id uuid not null references public.capability_trust_domains(id) on delete cascade,
  key_id text not null,
  algorithm text not null,
  status text not null check (status in ('active','rotated','revoked')),
  public_metadata jsonb not null default '{}'::jsonb,
  secret_ref text null,
  valid_from timestamptz not null,
  valid_until timestamptz null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  unique (trust_domain_id, key_id),
  check (public_metadata::text not ilike '%secret%')
);

create table if not exists public.capability_verifier_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  allowed_trust_domain_id uuid not null references public.capability_trust_domains(id) on delete cascade,
  allowed_issuer_app text not null,
  allowed_actions jsonb null,
  allowed_resource_types jsonb null,
  status text not null check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.capability_trust_domains enable row level security;
alter table public.capability_signing_keys enable row level security;
alter table public.capability_verifier_policies enable row level security;

drop policy if exists capability_trust_domains_read_workspace_admin on public.capability_trust_domains;
create policy capability_trust_domains_read_workspace_admin on public.capability_trust_domains
for select using (
  workspace_id is null or exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = capability_trust_domains.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  )
);

drop policy if exists capability_signing_keys_read_workspace_admin on public.capability_signing_keys;
create policy capability_signing_keys_read_workspace_admin on public.capability_signing_keys
for select using (
  exists (
    select 1 from public.capability_trust_domains td
    join public.workspace_memberships wm on wm.workspace_id = td.workspace_id
    where td.id = capability_signing_keys.trust_domain_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  )
);

drop policy if exists capability_verifier_policies_read_workspace_admin on public.capability_verifier_policies;
create policy capability_verifier_policies_read_workspace_admin on public.capability_verifier_policies
for select using (
  exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = capability_verifier_policies.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  )
);

-- server-only writes via service role; no client insert/update/delete policies are created.
