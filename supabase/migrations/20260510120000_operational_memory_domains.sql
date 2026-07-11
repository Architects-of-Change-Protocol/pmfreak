create table if not exists public.operational_memory_records (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  project_id text null,
  domain text not null check (domain in ('stakeholder_intelligence','delivery_intelligence','risk_intelligence','pmo_governance','team_health','executive_context','operational_memory')),
  title text not null,
  data jsonb not null default '{}'::jsonb,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  completion_score integer not null default 0 check (completion_score between 0 and 100),
  missing_fields text[] not null default '{}',
  extracted_facts text[] not null default '{}',
  source_trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_memory_records_company_idx on public.operational_memory_records(company_id, domain, updated_at desc);

alter table public.operational_memory_records enable row level security;

drop policy if exists "tenant access operational_memory_records" on public.operational_memory_records;

create policy "tenant access operational_memory_records"
  on public.operational_memory_records
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
