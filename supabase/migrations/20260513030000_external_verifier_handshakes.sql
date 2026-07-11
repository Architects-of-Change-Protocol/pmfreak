create table if not exists public.capability_verifier_handshakes (
  id uuid primary key default gen_random_uuid(),
  verifier_name text not null,
  verifier_workspace_id uuid null references public.workspaces(id) on delete set null,
  verifier_domain text null,
  requested_trust_domain text not null,
  requested_actions jsonb null,
  requested_resource_types jsonb null,
  status text not null check (status in ('requested','approved','rejected','revoked')),
  handshake_token_hash text not null unique,
  approved_by_user_id uuid null references auth.users(id) on delete set null,
  rejected_by_user_id uuid null references auth.users(id) on delete set null,
  revoked_by_user_id uuid null references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (metadata::text not ilike '%token%')
);

alter table public.capability_verifier_handshakes enable row level security;

drop policy if exists capability_verifier_handshakes_read_workspace_admin on public.capability_verifier_handshakes;
create policy capability_verifier_handshakes_read_workspace_admin on public.capability_verifier_handshakes
for select using (
  verifier_workspace_id is null
  or exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = capability_verifier_handshakes.verifier_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
  )
);

-- server-only writes via service role; no client insert/update/delete policies.
