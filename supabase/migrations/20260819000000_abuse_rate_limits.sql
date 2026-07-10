-- Perilla 9 — Invite / Signup / Billing Abuse Protection Hardening.
--
-- Persistent fixed-window rate-limit counter backing
-- src/lib/security/abuse-protection.ts. Service-role only: the counters
-- themselves are not tenant data and must never be readable/writable by an
-- authenticated client — every read/write goes through the
-- abuse_rate_limit_increment() RPC, called only from the server-side
-- privileged client created inside enforceAbuseLimit().
--
-- See docs/security/abuse-protection-boundary.md.

create table if not exists public.abuse_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  identifier_hash text not null,
  window_start timestamptz not null,
  attempt_count integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, identifier_hash, window_start)
);

create index if not exists abuse_rate_limits_scope_window_idx
  on public.abuse_rate_limits (scope, window_start);

alter table public.abuse_rate_limits enable row level security;

-- No policy is created for `authenticated` or `anon` — RLS with zero
-- policies denies all access to those roles by default. Only `service_role`
-- (which bypasses RLS entirely) can read or write this table.

-- Atomic upsert-and-increment. Using an RPC (rather than a client-side
-- select-then-update) avoids a lost-update race between two concurrent
-- requests incrementing the same (scope, identifier_hash, window_start)
-- bucket — the ON CONFLICT DO UPDATE is a single statement.
create or replace function public.abuse_rate_limit_increment(
  p_scope text,
  p_identifier_hash text,
  p_window_start timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.abuse_rate_limits (scope, identifier_hash, window_start, attempt_count, last_attempt_at, metadata)
  values (p_scope, p_identifier_hash, p_window_start, 1, now(), coalesce(p_metadata, '{}'::jsonb))
  on conflict (scope, identifier_hash, window_start)
  do update set
    attempt_count = public.abuse_rate_limits.attempt_count + 1,
    last_attempt_at = now(),
    updated_at = now()
  returning attempt_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.abuse_rate_limit_increment(text, text, timestamptz, jsonb) from public;
revoke all on function public.abuse_rate_limit_increment(text, text, timestamptz, jsonb) from anon;
revoke all on function public.abuse_rate_limit_increment(text, text, timestamptz, jsonb) from authenticated;
grant execute on function public.abuse_rate_limit_increment(text, text, timestamptz, jsonb) to service_role;
