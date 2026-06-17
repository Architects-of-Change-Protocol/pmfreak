-- Evidence-linked decision governance foundation.
-- Decisions are first-class, evidence-linked, and event-lineage ready.

create unique index if not exists projects_id_workspace_id_uidx on public.projects(id, workspace_id);
create unique index if not exists recommended_actions_id_workspace_id_uidx on public.recommended_actions(id, workspace_id);

create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  decision_type text not null check (decision_type in (
    'risk_response','scope_change','schedule_change','budget_change','resource_change',
    'stakeholder_action','governance_exception','vendor_action','dependency_resolution','other'
  )),
  decision_status text not null default 'draft' check (decision_status in (
    'draft','pending_review','approved','rejected','implemented','expired'
  )),
  title text not null,
  summary text not null,
  decision_rationale text null,
  recommendation_id uuid null references public.recommended_actions(id) on delete set null,
  approved_by uuid null references auth.users(id) on delete set null,
  rejected_by uuid null references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  approved_at timestamptz null,
  rejected_at timestamptz null,
  closed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint project_decisions_project_workspace_fkey foreign key (project_id, workspace_id)
    references public.projects(id, workspace_id) on delete cascade,
  constraint project_decisions_recommendation_workspace_fkey foreign key (recommendation_id, workspace_id)
    references public.recommended_actions(id, workspace_id) on delete set null
);

create table if not exists public.decision_evidence_links (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.project_decisions(id) on delete cascade,
  evidence_id uuid not null,
  evidence_type text not null,
  relationship_type text not null check (relationship_type in (
    'supports','contradicts','required_for','reviewed_during','triggered_by'
  )),
  created_at timestamptz not null default now(),
  unique (decision_id, evidence_id, evidence_type, relationship_type)
);

create table if not exists public.decision_outcome_links (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.project_decisions(id) on delete cascade,
  outcome_reference_id uuid not null,
  outcome_type text not null,
  created_at timestamptz not null default now(),
  unique (decision_id, outcome_reference_id, outcome_type)
);

create index if not exists project_decisions_workspace_project_status_idx on public.project_decisions(workspace_id, project_id, decision_status, created_at desc);
create index if not exists project_decisions_recommendation_idx on public.project_decisions(recommendation_id) where recommendation_id is not null;
create index if not exists decision_evidence_links_decision_idx on public.decision_evidence_links(decision_id);
create index if not exists decision_evidence_links_evidence_idx on public.decision_evidence_links(evidence_type, evidence_id);
create index if not exists decision_outcome_links_decision_idx on public.decision_outcome_links(decision_id);

alter table public.project_decisions enable row level security;
alter table public.decision_evidence_links enable row level security;
alter table public.decision_outcome_links enable row level security;

drop policy if exists "workspace members can read project_decisions" on public.project_decisions;
create policy "workspace members can read project_decisions" on public.project_decisions for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can create project_decisions" on public.project_decisions;
create policy "workspace members can create project_decisions" on public.project_decisions for insert to authenticated with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can submit project_decisions" on public.project_decisions;
create policy "workspace members can submit project_decisions" on public.project_decisions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace approvers can approve project_decisions" on public.project_decisions;
create policy "workspace approvers can approve project_decisions" on public.project_decisions for update to authenticated using (
  exists (select 1 from public.workspace_memberships wm where wm.workspace_id = project_decisions.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin','pm'))
) with check (
  exists (select 1 from public.workspace_memberships wm where wm.workspace_id = project_decisions.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner','admin','pm'))
);

drop policy if exists "workspace members can read decision_evidence_links" on public.decision_evidence_links;
create policy "workspace members can read decision_evidence_links" on public.decision_evidence_links for select to authenticated using (
  exists (select 1 from public.project_decisions d where d.id = decision_evidence_links.decision_id and public.is_workspace_member(d.workspace_id))
);

drop policy if exists "workspace members can create decision_evidence_links" on public.decision_evidence_links;
create policy "workspace members can create decision_evidence_links" on public.decision_evidence_links for insert to authenticated with check (
  exists (select 1 from public.project_decisions d where d.id = decision_evidence_links.decision_id and public.is_workspace_member(d.workspace_id))
);

drop policy if exists "workspace members can read decision_outcome_links" on public.decision_outcome_links;
create policy "workspace members can read decision_outcome_links" on public.decision_outcome_links for select to authenticated using (
  exists (select 1 from public.project_decisions d where d.id = decision_outcome_links.decision_id and public.is_workspace_member(d.workspace_id))
);

drop policy if exists "workspace members can create decision_outcome_links" on public.decision_outcome_links;
create policy "workspace members can create decision_outcome_links" on public.decision_outcome_links for insert to authenticated with check (
  exists (select 1 from public.project_decisions d where d.id = decision_outcome_links.decision_id and public.is_workspace_member(d.workspace_id))
);
