-- ============================================================================
-- Perilla 11 (Beta Release Closure Gate): AI cost/usage accounting.
--
-- One row per inference call routed through src/lib/ai/providers/router.ts
-- (src/lib/ai/usage-accounting.ts). Backs the per-workspace daily cost
-- ceiling (AI_DAILY_COST_LIMIT_USD) and gives operators a queryable record
-- of provider/model/token/cost consumption during the pilot.
--
-- Service-role only: rows are written by the server-side accounting helper
-- and read by the ceiling check — no authenticated-role access at all, the
-- same posture as abuse_rate_limits (20260819000000).
-- ============================================================================

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  workspace_id uuid,
  user_id uuid,
  operation text not null,
  input_tokens integer,
  output_tokens integer,
  -- Null means "unpriced/unknown", which is deliberately distinct from 0.
  estimated_cost_usd numeric(12, 6),
  status text not null check (status in ('success', 'error', 'timeout', 'blocked')),
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- The daily ceiling reads by workspace + day; keep that path indexed.
create index if not exists ai_usage_events_workspace_created_at
  on public.ai_usage_events (workspace_id, created_at);

alter table public.ai_usage_events enable row level security;

drop policy if exists "service role manages ai_usage_events" on public.ai_usage_events;

create policy "service role manages ai_usage_events"
  on public.ai_usage_events
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.ai_usage_events from authenticated;
revoke all on public.ai_usage_events from anon;
