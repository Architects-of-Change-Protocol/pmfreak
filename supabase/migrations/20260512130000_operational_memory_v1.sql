create table if not exists public.operational_memory_entries (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  project_id text null,
  memory_type text not null check (memory_type in ('risks','blockers','decisions','stakeholders','action_items','unresolved_questions','dependencies','milestones','escalations')),
  memory_text text not null,
  status text not null default 'active' check (status in ('active','resolved')),
  source_type text not null check (source_type in ('upload','copilot_message','ingestion_summary','manual')),
  source_reference text not null,
  created_at timestamptz not null default now()
);

create index if not exists operational_memory_entries_project_idx on public.operational_memory_entries(company_id, project_id, status, created_at desc);
create index if not exists operational_memory_entries_type_idx on public.operational_memory_entries(company_id, project_id, memory_type, created_at desc);

alter table public.operational_memory_entries enable row level security;

drop policy if exists "tenant access operational_memory_entries" on public.operational_memory_entries;

create policy "tenant access operational_memory_entries"
  on public.operational_memory_entries
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
