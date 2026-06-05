-- Recommended Actions Engine
-- Transforms RAID findings into actionable PM recommendations.
-- Human PM remains final decision authority — system only proposes.

create table if not exists public.recommended_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  raid_item_id uuid not null references public.raid_items(id) on delete cascade,

  title text not null,
  description text not null,

  recommended_action_type text not null check (recommended_action_type in (
    'schedule_meeting',
    'stakeholder_alignment',
    'request_approval',
    'create_mitigation_plan',
    'create_contingency_plan',
    'clarify_requirement',
    'escalate_issue',
    'confirm_dependency',
    'assign_owner',
    'review_assumption',
    'validate_scope',
    'follow_up',
    'other'
  )),

  status text not null default 'proposed' check (status in (
    'proposed',
    'accepted',
    'rejected',
    'deferred',
    'converted_to_task'
  )),

  confidence_score numeric(5,2) check (confidence_score >= 0 and confidence_score <= 100),

  impact_level text check (impact_level in ('low', 'medium', 'high', 'critical')),

  rationale jsonb,

  recommended_owner text,

  recommended_due_window text,

  evidence_summary jsonb,

  source_signal_id text,

  fingerprint text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recommended_actions_workspace_fingerprint_uidx
  on public.recommended_actions(workspace_id, fingerprint);

create index if not exists recommended_actions_workspace_idx
  on public.recommended_actions(workspace_id);

create index if not exists recommended_actions_project_idx
  on public.recommended_actions(project_id);

create index if not exists recommended_actions_raid_item_idx
  on public.recommended_actions(raid_item_id);

create index if not exists recommended_actions_status_idx
  on public.recommended_actions(workspace_id, project_id, status);

alter table public.recommended_actions enable row level security;

drop policy if exists "workspace members can read recommended_actions" on public.recommended_actions;
create policy "workspace members can read recommended_actions"
  on public.recommended_actions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert recommended_actions" on public.recommended_actions;
create policy "workspace members can insert recommended_actions"
  on public.recommended_actions
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update recommended_actions" on public.recommended_actions;
create policy "workspace members can update recommended_actions"
  on public.recommended_actions
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
