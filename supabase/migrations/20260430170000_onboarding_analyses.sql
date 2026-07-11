create table if not exists public.onboarding_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  user_id uuid,
  workspace text not null,
  role text not null,
  project_type text not null,
  problem text not null,
  analysis text not null,
  source text not null default 'onboarding' check (source = 'onboarding'),
  created_at timestamptz not null default now()
);

create index if not exists onboarding_analyses_company_created_at_idx
  on public.onboarding_analyses (company_id, created_at desc);

alter table public.onboarding_analyses enable row level security;

drop policy if exists "tenant access onboarding_analyses" on public.onboarding_analyses;

create policy "tenant access onboarding_analyses"
  on public.onboarding_analyses
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
