-- Personal Pattern Extraction Foundation.
-- Deterministic, evidence-based candidate personal PM pattern discovery.
-- Mandatory human review before any candidate becomes a Personal PM Pattern.
-- No AI, no embeddings, no automatic promotion, no autonomous pattern creation.
-- Personal patterns must never be inferred invisibly.

-- ─── Personal PM Pattern Candidate Registry ──────────────────────────────────

create table if not exists public.personal_pm_pattern_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pm_user_id uuid not null references auth.users(id) on delete cascade,
  candidate_category text not null check (candidate_category in (
    'decision_pattern','risk_response_pattern','stakeholder_management_pattern',
    'communication_pattern','execution_pattern','planning_pattern','escalation_pattern',
    'governance_pattern','delivery_pattern','approval_pattern','follow_up_pattern',
    'dependency_resolution_pattern','other'
  )),
  candidate_title text not null,
  candidate_summary text not null,
  confidence text not null check (confidence in ('low','medium','high','very_high')),
  status text not null default 'candidate' check (status in ('candidate','promoted','rejected','archived')),
  observation_count integer not null default 0 check (observation_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists personal_pm_pattern_candidates_pm_status_idx
  on public.personal_pm_pattern_candidates(workspace_id, pm_user_id, status, updated_at desc);
create index if not exists personal_pm_pattern_candidates_pm_category_idx
  on public.personal_pm_pattern_candidates(workspace_id, pm_user_id, candidate_category, updated_at desc);

-- ─── Personal PM Pattern Extraction Runs ─────────────────────────────────────

create table if not exists public.personal_pm_pattern_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pm_user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  rule_count integer not null default 0 check (rule_count >= 0),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists personal_pm_pattern_extraction_runs_pm_idx
  on public.personal_pm_pattern_extraction_runs(workspace_id, pm_user_id, started_at desc);

-- ─── Personal PM Pattern Candidate Sources ────────────────────────────────────

create table if not exists public.personal_pm_pattern_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.personal_pm_pattern_candidates(id) on delete cascade,
  source_type text not null check (source_type in (
    'platform_event','decision','decision_effectiveness','personal_memory',
    'personal_pattern','personal_effectiveness','organizational_pattern',
    'organizational_memory','outcome','risk','task','milestone'
  )),
  source_id uuid not null,
  relationship_type text not null check (relationship_type in (
    'supports','contradicts','caused_by','derived_from','reviewed_during','supersedes','related_to'
  )),
  created_at timestamptz not null default now()
);

create index if not exists personal_pm_pattern_candidate_sources_candidate_idx
  on public.personal_pm_pattern_candidate_sources(candidate_id, created_at);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

create or replace function public.personal_pm_pattern_candidates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists personal_pm_pattern_candidates_touch_updated_at on public.personal_pm_pattern_candidates;
create trigger personal_pm_pattern_candidates_touch_updated_at
  before update on public.personal_pm_pattern_candidates
  for each row execute function public.personal_pm_pattern_candidates_touch_updated_at();

-- Promoted personal candidates are immutable; must archive and re-run extraction.
create or replace function public.personal_pm_pattern_candidates_promoted_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.status = 'promoted' then
    raise exception 'Promoted personal pattern candidates are immutable. Archive and re-run extraction to create a new candidate.';
  end if;
  return new;
end $$;

drop trigger if exists personal_pm_pattern_candidates_promoted_guard on public.personal_pm_pattern_candidates;
create trigger personal_pm_pattern_candidates_promoted_guard
  before update on public.personal_pm_pattern_candidates
  for each row execute function public.personal_pm_pattern_candidates_promoted_guard();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.personal_pm_pattern_candidates enable row level security;
alter table public.personal_pm_pattern_extraction_runs enable row level security;
alter table public.personal_pm_pattern_candidate_sources enable row level security;

-- personal_pm_pattern_candidates: only the owning PM can see their own candidates
drop policy if exists "pm owner can read personal pattern candidates" on public.personal_pm_pattern_candidates;
create policy "pm owner can read personal pattern candidates" on public.personal_pm_pattern_candidates
  for select to authenticated using (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "pm owner can create personal pattern candidates" on public.personal_pm_pattern_candidates;
create policy "pm owner can create personal pattern candidates" on public.personal_pm_pattern_candidates
  for insert to authenticated with check (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "pm owner can update candidate personal pattern candidates" on public.personal_pm_pattern_candidates;
create policy "pm owner can update candidate personal pattern candidates" on public.personal_pm_pattern_candidates
  for update to authenticated
  using (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
    and status in ('candidate','rejected','archived')
  )
  with check (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

-- personal_pm_pattern_extraction_runs: only owning PM
drop policy if exists "pm owner can read personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs;
create policy "pm owner can read personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs
  for select to authenticated using (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "pm owner can create personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs;
create policy "pm owner can create personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs
  for insert to authenticated with check (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "pm owner can update personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs;
create policy "pm owner can update personal pattern extraction runs" on public.personal_pm_pattern_extraction_runs
  for update to authenticated
  using (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  )
  with check (
    pm_user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

-- personal_pm_pattern_candidate_sources: via candidate ownership
drop policy if exists "pm owner can read personal pattern candidate sources" on public.personal_pm_pattern_candidate_sources;
create policy "pm owner can read personal pattern candidate sources" on public.personal_pm_pattern_candidate_sources
  for select to authenticated using (
    exists (
      select 1 from public.personal_pm_pattern_candidates c
      where c.id = candidate_id
        and c.pm_user_id = auth.uid()
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists "pm owner can create personal pattern candidate sources" on public.personal_pm_pattern_candidate_sources;
create policy "pm owner can create personal pattern candidate sources" on public.personal_pm_pattern_candidate_sources
  for insert to authenticated with check (
    exists (
      select 1 from public.personal_pm_pattern_candidates c
      where c.id = candidate_id
        and c.pm_user_id = auth.uid()
        and public.is_workspace_member(c.workspace_id)
    )
  );

-- ─── Table comments ───────────────────────────────────────────────────────────

comment on table public.personal_pm_pattern_candidates is 'Evidence-based candidate personal PM patterns awaiting human review. Created by deterministic rules only. No AI, no automatic promotion. Personal to each PM — cross-PM reads are forbidden by RLS.';
comment on table public.personal_pm_pattern_extraction_runs is 'Audit log of every personal pattern extraction run. Every candidate is traceable to a run and a PM.';
comment on table public.personal_pm_pattern_candidate_sources is 'Source evidence records that triggered each personal candidate. Preserved for auditability and explainability.';
comment on column public.personal_pm_pattern_candidates.pm_user_id is 'The PM who owns this candidate. RLS enforces pm_user_id = auth.uid() — no cross-PM reads or writes.';
comment on column public.personal_pm_pattern_candidates.status is 'Lifecycle: candidate → (promoted|rejected|archived). Promoted candidates are immutable.';
comment on column public.personal_pm_pattern_candidates.metadata is 'Contains rule_id, groupKey, runId for full auditability without AI inference.';
