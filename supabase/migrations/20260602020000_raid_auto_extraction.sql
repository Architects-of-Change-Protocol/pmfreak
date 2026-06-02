
-- Keep Prompt 7 vault status truthful when RAID persistence fails after the
-- document and operational signals have already been preserved.
do $$
begin
  alter table public.vault_documents drop constraint if exists vault_documents_ingestion_status_check;
  alter table public.vault_documents
    add constraint vault_documents_ingestion_status_check
    check (ingestion_status in (
      'received',
      'document_persisted',
      'completed',
      'extraction_failed',
      'signals_persistence_failed',
      'raid_persistence_failed',
      'executive_synthesis_failed',
      'document_persistence_failed'
    ));
end $$;

-- RAID Auto Extraction Engine
-- Canonical PMO RAID entities generated from deterministic vault signals.

create table if not exists public.raid_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  source_document_id uuid not null references public.vault_documents(id) on delete cascade,
  source_signal_id uuid null references public.vault_operational_signals(id) on delete set null,
  category text not null check (category in ('risk', 'assumption', 'issue', 'dependency')),
  title text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'monitoring', 'mitigated', 'closed')),
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  detected_by uuid null references auth.users(id) on delete set null,
  owner text null,
  due_date date null,
  auto_generated boolean not null default true,
  fingerprint text not null,
  occurrence_count integer not null default 1 check (occurrence_count >= 1)
);

create unique index if not exists raid_items_project_fingerprint_uidx
  on public.raid_items(workspace_id, project_id, category, fingerprint)
  where project_id is not null;

create unique index if not exists raid_items_workspace_fingerprint_uidx
  on public.raid_items(workspace_id, category, fingerprint)
  where project_id is null;

create index if not exists raid_items_workspace_status_idx
  on public.raid_items(workspace_id, status, category, detected_at desc);

create index if not exists raid_items_project_status_idx
  on public.raid_items(workspace_id, project_id, status, category, detected_at desc)
  where project_id is not null;

create index if not exists raid_items_source_document_idx
  on public.raid_items(source_document_id, detected_at desc);

create index if not exists raid_items_source_signal_idx
  on public.raid_items(source_signal_id, detected_at desc)
  where source_signal_id is not null;

alter table public.raid_items enable row level security;

drop policy if exists "workspace members can read raid_items" on public.raid_items;
create policy "workspace members can read raid_items"
  on public.raid_items
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert raid_items" on public.raid_items;
create policy "workspace members can insert raid_items"
  on public.raid_items
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update raid_items" on public.raid_items;
create policy "workspace members can update raid_items"
  on public.raid_items
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
