-- Atomic quota enforcement via PostgreSQL transactional RPCs.
--
-- Replaces the non-atomic canUploadDocuments + incrementUploadUsage pair with a
-- two-phase reservation model:
--
--   1. reserve_upload_quota  — atomic check + INSERT reservation (pending)
--                              company_usage.upload_count is NOT yet modified.
--   2. commit_upload_quota   — increment upload_count, delete reservation.
--   3. cancel_upload_quota   — delete reservation (rollback path); no count change.
--
-- Effective usage = upload_count (committed) + SUM(pending reservations, same month, not expired).
-- This prevents race conditions under concurrency: SELECT FOR UPDATE on company_usage
-- serialises all reservation attempts within a single lock scope.
--
-- Idempotency: UNIQUE constraint on request_id prevents double-reservation from
-- immediate retries. Second call with same request_id returns the existing reservation.
--
-- TTL: pending reservations expire after 5 minutes. Expired reservations are excluded
-- from effective-usage calculations and cleaned up lazily on commit/reserve.

-- ── Reservation table ────────────────────────────────────────────────────────

create table if not exists public.quota_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.company_usage(company_id) on delete cascade,
  amount integer not null check (amount > 0),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  request_id text not null,
  status text not null default 'pending' check (status in ('pending', 'committed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes'
);

create unique index if not exists quota_reservations_request_id_idx
  on public.quota_reservations (request_id);

create index if not exists quota_reservations_company_pending_idx
  on public.quota_reservations (company_id, expires_at)
  where status = 'pending';

alter table public.quota_reservations enable row level security;

drop policy if exists "tenant access quota_reservations" on public.quota_reservations;

create policy "tenant access quota_reservations"
  on public.quota_reservations
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);

-- ── reserve_upload_quota ─────────────────────────────────────────────────────
--
-- INPUT:
--   p_company_id    — tenant identifier
--   p_upload_amount — number of files being uploaded
--   p_upload_limit  — monthly limit from the subscription plan (NULL = unlimited)
--   p_month_key     — current month in YYYY-MM format (UTC, provided by caller)
--   p_request_id    — unique request identifier for idempotency deduplication
--
-- OUTPUT (JSONB):
--   allowed         — whether the reservation was created
--   reason          — 'quota_approved' | 'quota_exceeded' | 'idempotent_replay'
--   reservation_id  — UUID of the created reservation (NULL if rejected)
--   previous_usage  — effective usage before this reservation
--   new_usage       — effective usage after this reservation
--   limit           — the plan limit (echoed back, NULL = unlimited)
--   reset_period    — the month_key used for accounting

create or replace function public.reserve_upload_quota(
  p_company_id text,
  p_upload_amount integer,
  p_upload_limit integer,   -- NULL = unlimited
  p_month_key text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_row public.company_usage%rowtype;
  v_committed_count integer;
  v_pending_count integer;
  v_effective_usage integer;
  v_reservation_id uuid;
begin
  -- Ensure company_usage row exists before attempting to lock it.
  -- ON CONFLICT DO NOTHING is safe under concurrent inserts.
  insert into public.company_usage (company_id, current_month, upload_count)
  values (p_company_id, p_month_key, 0)
  on conflict (company_id) do nothing;

  -- Acquire a row-level lock on company_usage for this company.
  -- All concurrent reservations for the same company will serialise here.
  select * into v_usage_row
  from public.company_usage
  where company_id = p_company_id
  for update;

  -- Monthly reset: if stored month differs from current month, reset the counter
  -- and purge stale pending reservations atomically within this transaction.
  if v_usage_row.current_month != p_month_key then
    update public.company_usage
    set current_month = p_month_key,
        upload_count  = 0,
        updated_at    = now()
    where company_id = p_company_id;

    delete from public.quota_reservations
    where company_id = p_company_id
      and month_key  != p_month_key
      and status      = 'pending';

    v_usage_row.upload_count  := 0;
    v_usage_row.current_month := p_month_key;
  end if;

  v_committed_count := v_usage_row.upload_count;

  -- Sum all non-expired pending reservations for this company in the current month.
  select coalesce(sum(amount), 0) into v_pending_count
  from public.quota_reservations
  where company_id = p_company_id
    and status     = 'pending'
    and month_key  = p_month_key
    and expires_at > now();

  v_effective_usage := v_committed_count + v_pending_count;

  -- Idempotency: if this request_id was already reserved, return the existing result
  -- without creating a duplicate reservation.
  select id into v_reservation_id
  from public.quota_reservations
  where request_id = p_request_id
  limit 1;

  if found then
    return jsonb_build_object(
      'allowed',         true,
      'reason',          'idempotent_replay',
      'reservation_id',  v_reservation_id,
      'previous_usage',  v_effective_usage,
      'new_usage',       v_effective_usage,
      'limit',           p_upload_limit,
      'reset_period',    p_month_key
    );
  end if;

  -- Quota check: NULL limit means unlimited.
  if p_upload_limit is not null and v_effective_usage + p_upload_amount > p_upload_limit then
    return jsonb_build_object(
      'allowed',         false,
      'reason',          'quota_exceeded',
      'reservation_id',  null,
      'previous_usage',  v_effective_usage,
      'new_usage',       v_effective_usage,
      'limit',           p_upload_limit,
      'reset_period',    p_month_key
    );
  end if;

  -- Create the pending reservation. The row is not committed to upload_count yet.
  insert into public.quota_reservations (
    company_id, amount, month_key, request_id, status, expires_at
  ) values (
    p_company_id, p_upload_amount, p_month_key, p_request_id, 'pending',
    now() + interval '5 minutes'
  ) returning id into v_reservation_id;

  return jsonb_build_object(
    'allowed',         true,
    'reason',          'quota_approved',
    'reservation_id',  v_reservation_id,
    'previous_usage',  v_effective_usage,
    'new_usage',       v_effective_usage + p_upload_amount,
    'limit',           p_upload_limit,
    'reset_period',    p_month_key
  );
end;
$$;

grant execute on function public.reserve_upload_quota(text, integer, integer, text, text)
  to authenticated, service_role;

-- ── commit_upload_quota ──────────────────────────────────────────────────────
--
-- Atomically promotes a pending reservation to permanent committed usage.
-- Called only after all storage uploads in the batch have succeeded.
--
-- OUTPUT (JSONB):
--   committed   — true if the commit succeeded
--   reason      — 'quota_committed' | 'already_committed' | 'reservation_not_found'
--                 | 'usage_row_not_found' | 'month_boundary_crossed'
--   amount      — the number of uploads committed
--   new_usage   — the resulting upload_count after commit

create or replace function public.commit_upload_quota(
  p_reservation_id uuid,
  p_company_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.quota_reservations%rowtype;
  v_usage_row public.company_usage%rowtype;
  v_new_count integer;
begin
  -- Lock the reservation row first to prevent concurrent commits of the same reservation.
  select * into v_reservation
  from public.quota_reservations
  where id         = p_reservation_id
    and company_id = p_company_id
  for update;

  if not found then
    return jsonb_build_object(
      'committed', false,
      'reason',    'reservation_not_found'
    );
  end if;

  if v_reservation.status = 'committed' then
    return jsonb_build_object(
      'committed', true,
      'reason',    'already_committed',
      'amount',    v_reservation.amount
    );
  end if;

  -- Lock the usage row for the final increment.
  select * into v_usage_row
  from public.company_usage
  where company_id = p_company_id
  for update;

  if not found then
    return jsonb_build_object(
      'committed', false,
      'reason',    'usage_row_not_found'
    );
  end if;

  -- If a monthly reset happened between reserve and commit, the reservation is stale.
  -- Delete it silently — the upload already succeeded, so we do not penalise the user.
  if v_usage_row.current_month != v_reservation.month_key then
    delete from public.quota_reservations where id = p_reservation_id;
    return jsonb_build_object(
      'committed', false,
      'reason',    'month_boundary_crossed'
    );
  end if;

  v_new_count := v_usage_row.upload_count + v_reservation.amount;

  update public.company_usage
  set upload_count = v_new_count,
      updated_at   = now()
  where company_id = p_company_id;

  -- Delete the committed reservation and clean up any other expired pending ones.
  delete from public.quota_reservations
  where company_id = p_company_id
    and (
      id = p_reservation_id
      or (status = 'pending' and expires_at <= now())
    );

  return jsonb_build_object(
    'committed', true,
    'reason',    'quota_committed',
    'amount',    v_reservation.amount,
    'new_usage', v_new_count
  );
end;
$$;

grant execute on function public.commit_upload_quota(uuid, text)
  to authenticated, service_role;

-- ── cancel_upload_quota ──────────────────────────────────────────────────────
--
-- Deletes a pending reservation on the rollback path.
-- upload_count in company_usage is never touched — the reservation was the only
-- record of the intended usage, and deleting it fully releases the quota.
--
-- OUTPUT (JSONB):
--   cancelled   — true if the reservation was found and deleted
--   reason      — 'reservation_cancelled' | 'reservation_not_found_or_already_committed'
--   amount      — the number of uploads released (present on success)

create or replace function public.cancel_upload_quota(
  p_reservation_id uuid,
  p_company_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.quota_reservations%rowtype;
begin
  delete from public.quota_reservations
  where id         = p_reservation_id
    and company_id = p_company_id
    and status     = 'pending'
  returning * into v_reservation;

  if not found then
    return jsonb_build_object(
      'cancelled', false,
      'reason',    'reservation_not_found_or_already_committed'
    );
  end if;

  return jsonb_build_object(
    'cancelled', true,
    'reason',    'reservation_cancelled',
    'amount',    v_reservation.amount
  );
end;
$$;

grant execute on function public.cancel_upload_quota(uuid, text)
  to authenticated, service_role;

-- ── down migration ───────────────────────────────────────────────────────────
--
-- To roll back this migration run:
--
--   drop function if exists public.cancel_upload_quota(uuid, text);
--   drop function if exists public.commit_upload_quota(uuid, text);
--   drop function if exists public.reserve_upload_quota(text, integer, integer, text, text);
--   drop table if exists public.quota_reservations;
