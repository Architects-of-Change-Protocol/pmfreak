alter table public.project_discovery
  add column if not exists discovery_payload_hash text;

create index if not exists project_discovery_project_payload_hash_idx
  on public.project_discovery(project_id, discovery_payload_hash);
