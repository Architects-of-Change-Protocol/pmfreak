-- Vault Intake Reliability
-- Canonical evidence intake tables for pasted meeting notes, transcripts, email,
-- project updates, RAID logs and future operational memory feeds.

create table if not exists public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  title text not null,
  source_type text not null default 'meeting_notes' check (source_type in (
    'meeting_notes',
    'transcript',
    'email',
    'project_update',
    'risk_log',
    'issue_log',
    'action_log',
    'decision_log',
    'generic_note'
  )),
  classification text not null default 'operational' check (classification in (
    'operational',
    'governance',
    'commercial',
    'technical',
    'stakeholder',
    'mixed'
  )),
  raw_content text not null,
  normalized_content text not null,
  ingestion_status text not null default 'received' check (ingestion_status in (
    'received',
    'document_persisted',
    'completed',
    'extraction_failed',
    'signals_persistence_failed',
    'raid_persistence_failed',
    'executive_synthesis_failed',
    'document_persistence_failed'
  )),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create index if not exists vault_documents_workspace_created_idx
  on public.vault_documents(workspace_id, created_at desc);

create index if not exists vault_documents_project_created_idx
  on public.vault_documents(workspace_id, project_id, created_at desc)
  where project_id is not null;

create index if not exists vault_documents_classification_idx
  on public.vault_documents(workspace_id, classification, created_at desc);

create index if not exists vault_documents_source_type_idx
  on public.vault_documents(workspace_id, source_type, created_at desc);

alter table public.vault_documents enable row level security;

drop policy if exists "workspace members can read vault_documents" on public.vault_documents;
create policy "workspace members can read vault_documents"
  on public.vault_documents
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_documents" on public.vault_documents;
create policy "workspace members can insert vault_documents"
  on public.vault_documents
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update vault_documents" on public.vault_documents;
create policy "workspace members can update vault_documents"
  on public.vault_documents
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.vault_operational_signals (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.vault_documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  signal_type text not null check (signal_type in ('risk', 'issue', 'dependency', 'action', 'decision')),
  signal_text text not null,
  confidence_score numeric not null default 0 check (confidence_score >= 0 and confidence_score <= 1),
  created_at timestamptz not null default now()
);

create index if not exists vault_operational_signals_document_idx
  on public.vault_operational_signals(document_id, created_at desc);

create index if not exists vault_operational_signals_workspace_type_idx
  on public.vault_operational_signals(workspace_id, signal_type, created_at desc);

create index if not exists vault_operational_signals_project_type_idx
  on public.vault_operational_signals(workspace_id, project_id, signal_type, created_at desc)
  where project_id is not null;

alter table public.vault_operational_signals enable row level security;

drop policy if exists "workspace members can read vault_operational_signals" on public.vault_operational_signals;
create policy "workspace members can read vault_operational_signals"
  on public.vault_operational_signals
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert vault_operational_signals" on public.vault_operational_signals;
create policy "workspace members can insert vault_operational_signals"
  on public.vault_operational_signals
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
