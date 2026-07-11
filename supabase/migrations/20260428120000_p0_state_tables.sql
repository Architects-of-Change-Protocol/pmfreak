create extension if not exists pgcrypto;

create or replace function public.current_company_id()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'company_id',
    auth.uid()::text
  );
$$;

create table if not exists public.company_subscriptions (
  company_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  subscription_status text not null default 'inactive' check (
    subscription_status in (
      'inactive',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    )
  ),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_usage (
  company_id text primary key,
  current_month text not null,
  upload_count integer not null default 0 check (upload_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_month ~ '^\\d{4}-\\d{2}$')
);

create table if not exists public.project_memories (
  company_id text not null,
  project_id text not null,
  project_name text not null,
  upload_date timestamptz not null,
  executive_summary text not null,
  requirements text[] not null default '{}',
  risks text[] not null default '{}',
  dependencies text[] not null default '{}',
  ambiguities text[] not null default '{}',
  complexity text not null check (complexity in ('Low', 'Medium', 'High')),
  source_file_names text[] not null default '{}',
  similar_projects text[] not null default '{}',
  historical_risks text[] not null default '{}',
  estimated_relative_complexity text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, project_id)
);

create index if not exists project_memories_company_upload_date_idx
  on public.project_memories (company_id, upload_date desc);

alter table public.company_subscriptions enable row level security;
alter table public.company_usage enable row level security;
alter table public.project_memories enable row level security;

drop policy if exists "tenant access company_subscriptions" on public.company_subscriptions;

create policy "tenant access company_subscriptions"
  on public.company_subscriptions
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);

drop policy if exists "tenant access company_usage" on public.company_usage;

create policy "tenant access company_usage"
  on public.company_usage
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);

drop policy if exists "tenant access project_memories" on public.project_memories;

create policy "tenant access project_memories"
  on public.project_memories
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
