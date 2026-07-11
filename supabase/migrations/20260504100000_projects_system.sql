create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

drop policy if exists "users can select own projects" on public.projects;

create policy "users can select own projects"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own projects" on public.projects;

create policy "users can insert own projects"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own projects" on public.projects;

create policy "users can update own projects"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own projects" on public.projects;

create policy "users can delete own projects"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

alter table public.onboarding_analyses
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists onboarding_analyses_project_id_created_at_idx
  on public.onboarding_analyses (project_id, created_at desc);
