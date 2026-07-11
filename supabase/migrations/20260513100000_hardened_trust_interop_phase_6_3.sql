alter table public.capability_trust_events
  add column if not exists sequence_number bigint,
  add column if not exists nonce text,
  add column if not exists previous_event_hash text;

create unique index if not exists idx_capability_trust_events_source_sequence
  on public.capability_trust_events(source_verifier, sequence_number)
  where source_verifier is not null and sequence_number is not null;

create unique index if not exists idx_capability_trust_events_source_nonce
  on public.capability_trust_events(source_verifier, nonce)
  where source_verifier is not null and nonce is not null;

create table if not exists public.capability_trust_anchors (
  id uuid primary key default gen_random_uuid(),
  anchor_id text unique not null,
  trust_domain text not null,
  anchor_type text not null check (anchor_type in ('verifier_key','root_signer','trusted_import_source','intermediary_signer')),
  public_key text not null,
  algorithm text not null,
  key_fingerprint text not null,
  status text not null check (status in ('active','suspended','revoked')),
  trust_level text not null check (trust_level in ('local','approved_external','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  rotated_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
);

create index if not exists idx_capability_trust_anchors_lookup
  on public.capability_trust_anchors(trust_domain, status, trust_level);

create table if not exists public.verifier_trust_policies (
  id uuid primary key default gen_random_uuid(),
  policy_id text unique,
  trust_domain text,
  target_domain text,
  policy_status text not null check (policy_status in ('active','suspended','revoked','expired')),
  allowed_event_types text[] not null default '{}',
  minimum_trust_level text not null,
  require_signed_events boolean not null default true,
  require_anchor_validation boolean not null default true,
  require_sequence_integrity boolean not null default true,
  max_event_age_seconds integer not null default 300,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create table if not exists public.capability_trust_event_quarantine (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  reason text not null,
  risk_score integer not null,
  quarantine_status text not null check (quarantine_status in ('pending','approved','rejected')),
  reviewer text,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create unique index if not exists idx_capability_trust_event_quarantine_event
  on public.capability_trust_event_quarantine(event_id);

alter table public.capability_trust_anchors enable row level security;
alter table public.verifier_trust_policies enable row level security;
alter table public.capability_trust_event_quarantine enable row level security;

drop policy if exists capability_trust_anchors_read on public.capability_trust_anchors;
create policy capability_trust_anchors_read on public.capability_trust_anchors for select using (true);
drop policy if exists capability_trust_anchors_server_write on public.capability_trust_anchors;
create policy capability_trust_anchors_server_write on public.capability_trust_anchors for all using (false) with check (false);

drop policy if exists verifier_trust_policies_read on public.verifier_trust_policies;
create policy verifier_trust_policies_read on public.verifier_trust_policies for select using (true);
drop policy if exists verifier_trust_policies_server_write on public.verifier_trust_policies;
create policy verifier_trust_policies_server_write on public.verifier_trust_policies for all using (false) with check (false);

drop policy if exists capability_trust_event_quarantine_read on public.capability_trust_event_quarantine;
create policy capability_trust_event_quarantine_read on public.capability_trust_event_quarantine for select using (true);
drop policy if exists capability_trust_event_quarantine_server_write on public.capability_trust_event_quarantine;
create policy capability_trust_event_quarantine_server_write on public.capability_trust_event_quarantine for all using (false) with check (false);
