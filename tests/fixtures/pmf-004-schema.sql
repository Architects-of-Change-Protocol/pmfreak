-- Minimal schema fixture for PMF-004 concurrency tests.
--
-- Reproduces just the tables/columns ensure_default_pmo() and
-- ensure_user_workspace() actually touch, verbatim from
-- supabase/migrations/20260512160000_workspace_authorization_rewrite.sql and
-- supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql, so
-- the test exercises the real production function bodies against real
-- column/constraint shapes. RLS/policies are intentionally omitted: they
-- depend on Supabase's auth.uid() (GoTrue-specific, unavailable in plain
-- Postgres) and are irrelevant to PMF-004, which is about concurrency, not
-- authorization — RLS is exercised elsewhere by the app-layer test suite.
-- `auth.users` is a minimal stand-in sufficient to satisfy the real
-- migrations' FK references.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Workspace',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','pm','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.pmos (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references workspaces(id) on delete cascade,
  name                text        not null,
  description         text,
  pmo_type            text        not null default 'company_pmo'
                        check (pmo_type in ('company_pmo', 'team_portfolio', 'independent', 'client_portfolio', 'improvement_program', 'personal')),
  icon                text,
  color               text,
  status              text        not null default 'active'
                        check (status in ('active', 'archived')),
  created_by_user_id  uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pmos_workspace_idx
  on pmos (workspace_id, status, created_at);
