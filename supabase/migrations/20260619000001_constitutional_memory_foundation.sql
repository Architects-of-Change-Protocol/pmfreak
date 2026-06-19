-- ─────────────────────────────────────────────────────────────────────────────
-- Constitutional Memory Foundation
-- EPIC 2 Sprint 1: Sovereign Project Vault — Constitutional Memory Foundation
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ─── constitutional_artifacts ─────────────────────────────────────────────────
-- Registers external artifacts (PDFs, emails, meeting transcripts, etc.).
-- The Vault stores references only; the client controls actual file storage.

create table if not exists public.constitutional_artifacts (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  artifact_type       text not null check (artifact_type in (
                        'document', 'email', 'meeting', 'transcript',
                        'spreadsheet', 'image', 'video', 'link', 'chat', 'other'
                      )),

  title               text not null,
  description         text null,

  -- Where the actual file lives (client-controlled)
  storage_provider    text not null check (storage_provider in (
                        'local', 'supabase', 's3', 'azure_blob',
                        'google_drive', 'sharepoint', 'dropbox', 'custom'
                      )),

  -- Opaque reference identifier in the external storage system
  storage_reference   text not null,

  -- Optional path within the storage system
  storage_path        text null,

  -- SHA-256 or similar checksum for integrity verification
  checksum            text not null,

  uploaded_by         uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz null   -- soft delete only
);

create index if not exists constitutional_artifacts_workspace_idx
  on public.constitutional_artifacts(workspace_id);

create index if not exists constitutional_artifacts_type_idx
  on public.constitutional_artifacts(artifact_type);

create index if not exists constitutional_artifacts_deleted_idx
  on public.constitutional_artifacts(deleted_at)
  where deleted_at is null;

alter table public.constitutional_artifacts enable row level security;

create policy "workspace members can read constitutional artifacts"
  on public.constitutional_artifacts
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert constitutional artifacts"
  on public.constitutional_artifacts
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and uploaded_by = auth.uid()
  );

create policy "workspace members can update constitutional artifacts"
  on public.constitutional_artifacts
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── constitutional_memory_records ───────────────────────────────────────────
-- Structured constitutional knowledge derived from artifacts.
-- Separates physical storage from institutional knowledge representation.

create table if not exists public.constitutional_memory_records (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  -- The artifact this memory was derived from (required for traceability)
  artifact_id         uuid not null,

  -- Composite FK enforces workspace isolation at DB level
  constraint constitutional_memory_records_artifact_fk
    foreign key (artifact_id, workspace_id)
    references public.constitutional_artifacts(id, workspace_id)
    on delete restrict,

  memory_type         text not null check (memory_type in (
                        'decision', 'objective', 'constraint', 'risk',
                        'issue', 'amendment', 'ratification', 'authority',
                        'evidence', 'other'
                      )),

  title               text not null,

  -- The canonical text representation of this memory
  canonical_text      text not null,

  -- Human-readable summary (shorter than canonical_text)
  summary             text null,

  created_at          timestamptz not null default now(),
  created_by          uuid not null references auth.users(id) on delete restrict
);

create index if not exists constitutional_memory_records_workspace_idx
  on public.constitutional_memory_records(workspace_id);

create index if not exists constitutional_memory_records_artifact_idx
  on public.constitutional_memory_records(artifact_id);

create index if not exists constitutional_memory_records_type_idx
  on public.constitutional_memory_records(memory_type);

alter table public.constitutional_memory_records enable row level security;

create policy "workspace members can read constitutional memory records"
  on public.constitutional_memory_records
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert constitutional memory records"
  on public.constitutional_memory_records
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "workspace members can update constitutional memory records"
  on public.constitutional_memory_records
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ─── constitutional_memory_links ─────────────────────────────────────────────
-- Links a memory record to governance entities (decisions, amendments, etc.)
-- enabling full lineage reconstruction: Artifact → Memory → Governance Entity.

create table if not exists public.constitutional_memory_links (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,

  -- The memory record being linked
  memory_record_id    uuid not null,

  constraint constitutional_memory_links_record_fk
    foreign key (memory_record_id, workspace_id)
    references public.constitutional_memory_records(id, workspace_id)
    on delete cascade,

  entity_type         text not null check (entity_type in (
                        'constitution', 'decision', 'amendment',
                        'ratification', 'authority', 'violation', 'escalation'
                      )),

  entity_id           uuid not null,

  created_at          timestamptz not null default now()
);

create index if not exists constitutional_memory_links_workspace_idx
  on public.constitutional_memory_links(workspace_id);

create index if not exists constitutional_memory_links_record_idx
  on public.constitutional_memory_links(memory_record_id);

create index if not exists constitutional_memory_links_entity_idx
  on public.constitutional_memory_links(entity_type, entity_id);

alter table public.constitutional_memory_links enable row level security;

create policy "workspace members can read constitutional memory links"
  on public.constitutional_memory_links
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert constitutional memory links"
  on public.constitutional_memory_links
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

commit;
