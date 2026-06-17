-- Pattern Extraction Foundation.
-- Deterministic, evidence-based candidate pattern discovery with mandatory human review.
-- No AI, no embeddings, no automatic promotion, no autonomous pattern creation.

-- ─── Candidate Registry ──────────────────────────────────────────────────────

create table if not exists public.organizational_pattern_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pattern_category text not null check (pattern_category in (
    'risk_pattern','decision_pattern','schedule_pattern','stakeholder_pattern','delivery_pattern',
    'resource_pattern','dependency_pattern','governance_pattern','execution_pattern','memory_pattern','other'
  )),
  candidate_title text not null,
  candidate_summary text not null,
  observation_count integer not null default 0 check (observation_count >= 0),
  confidence text not null check (confidence in ('low','medium','high','very_high')),
  status text not null default 'candidate' check (status in ('candidate','promoted','rejected','archived')),
  rule_id text not null,
  promoted_pattern_id uuid null references public.organizational_patterns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pattern_candidates_workspace_status_idx
  on public.organizational_pattern_candidates(workspace_id, status, updated_at desc);
create index if not exists pattern_candidates_workspace_category_idx
  on public.organizational_pattern_candidates(workspace_id, pattern_category, updated_at desc);
create index if not exists pattern_candidates_rule_idx
  on public.organizational_pattern_candidates(workspace_id, rule_id);

-- ─── Candidate Sources ────────────────────────────────────────────────────────

create table if not exists public.pattern_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.organizational_pattern_candidates(id) on delete cascade,
  source_type text not null check (source_type in (
    'platform_event','project_decision','decision_outcome','raid_item','organizational_memory','other'
  )),
  source_id uuid not null,
  source_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists pattern_candidate_sources_candidate_idx
  on public.pattern_candidate_sources(candidate_id, created_at);

-- ─── Extraction Runs ──────────────────────────────────────────────────────────

create table if not exists public.pattern_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  rule_count integer not null default 0 check (rule_count >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pattern_extraction_runs_workspace_idx
  on public.pattern_extraction_runs(workspace_id, started_at desc);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

create or replace function public.pattern_candidates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists pattern_candidates_touch_updated_at on public.organizational_pattern_candidates;
create trigger pattern_candidates_touch_updated_at
  before update on public.organizational_pattern_candidates
  for each row execute function public.pattern_candidates_touch_updated_at();

-- Promoted candidates are immutable; to change, archive and re-run extraction.
create or replace function public.pattern_candidates_promoted_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'promoted' then
    raise exception 'Promoted pattern candidates are immutable. Archive and re-run extraction to create a new candidate.';
  end if;
  return new;
end $$;

drop trigger if exists pattern_candidates_promoted_guard on public.organizational_pattern_candidates;
create trigger pattern_candidates_promoted_guard
  before update on public.organizational_pattern_candidates
  for each row execute function public.pattern_candidates_promoted_guard();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.organizational_pattern_candidates enable row level security;
alter table public.pattern_candidate_sources enable row level security;
alter table public.pattern_extraction_runs enable row level security;

-- organizational_pattern_candidates
drop policy if exists "workspace members can read pattern candidates" on public.organizational_pattern_candidates;
create policy "workspace members can read pattern candidates" on public.organizational_pattern_candidates
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create pattern candidates" on public.organizational_pattern_candidates;
create policy "workspace members can create pattern candidates" on public.organizational_pattern_candidates
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update candidate pattern candidates" on public.organizational_pattern_candidates;
create policy "workspace members can update candidate pattern candidates" on public.organizational_pattern_candidates
  for update to authenticated
  using (public.is_workspace_member(workspace_id) and status in ('candidate','rejected','archived'))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace governors can promote pattern candidates" on public.organizational_pattern_candidates;
create policy "workspace governors can promote pattern candidates" on public.organizational_pattern_candidates
  for update to authenticated
  using (public.is_organizational_pattern_governor(workspace_id))
  with check (public.is_organizational_pattern_governor(workspace_id));

-- pattern_candidate_sources
drop policy if exists "workspace members can read pattern candidate sources" on public.pattern_candidate_sources;
create policy "workspace members can read pattern candidate sources" on public.pattern_candidate_sources
  for select to authenticated using (
    exists (
      select 1 from public.organizational_pattern_candidates c
      where c.id = candidate_id and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists "workspace members can create pattern candidate sources" on public.pattern_candidate_sources;
create policy "workspace members can create pattern candidate sources" on public.pattern_candidate_sources
  for insert to authenticated with check (
    exists (
      select 1 from public.organizational_pattern_candidates c
      where c.id = candidate_id and public.is_workspace_member(c.workspace_id)
    )
  );

-- pattern_extraction_runs
drop policy if exists "workspace members can read pattern extraction runs" on public.pattern_extraction_runs;
create policy "workspace members can read pattern extraction runs" on public.pattern_extraction_runs
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create pattern extraction runs" on public.pattern_extraction_runs;
create policy "workspace members can create pattern extraction runs" on public.pattern_extraction_runs
  for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update pattern extraction runs" on public.pattern_extraction_runs;
create policy "workspace members can update pattern extraction runs" on public.pattern_extraction_runs
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

comment on table public.organizational_pattern_candidates is 'Evidence-based candidate patterns awaiting human review. Created by deterministic rules only. No AI, no automatic promotion.';
comment on table public.pattern_candidate_sources is 'Source evidence records that triggered each candidate. Preserved for auditor inspection.';
comment on table public.pattern_extraction_runs is 'Audit log of every extraction run. Every candidate is traceable to a run.';
comment on column public.organizational_pattern_candidates.rule_id is 'Identifies the deterministic rule that produced this candidate. Enables auditors to reconstruct why it was created.';
comment on column public.organizational_pattern_candidates.promoted_pattern_id is 'Links promoted candidates to their resulting organizational_patterns record, preserving constitutional lineage.';
