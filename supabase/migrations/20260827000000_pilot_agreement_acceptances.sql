-- Pilot Gate Sprint 01 — Task 9: pilot agreement acceptance records
-- (technical support for the signed pilot agreement; no legal text here).
--
-- Records which user accepted which agreement version for which workspace,
-- whether in-product (click-through) or offline (founder records a signed
-- paper/PDF agreement). Append-only from the client's perspective.

create table if not exists public.pilot_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_version text not null,
  method text not null check (method in ('in_product', 'offline_signed')),
  accepted_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  unique (workspace_id, user_id, agreement_version)
);

create index if not exists pilot_agreement_acceptances_workspace_idx
  on public.pilot_agreement_acceptances (workspace_id);

alter table public.pilot_agreement_acceptances enable row level security;

-- Members read their workspace's acceptances.
drop policy if exists pilot_agreement_acceptances_member_read on public.pilot_agreement_acceptances;
create policy pilot_agreement_acceptances_member_read
  on public.pilot_agreement_acceptances for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = pilot_agreement_acceptances.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- A user records only their own acceptance, only for a workspace they belong to.
drop policy if exists pilot_agreement_acceptances_self_insert on public.pilot_agreement_acceptances;
create policy pilot_agreement_acceptances_self_insert
  on public.pilot_agreement_acceptances for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = pilot_agreement_acceptances.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- No client updates/deletes: acceptance history is immutable from the app.
revoke update, delete on table public.pilot_agreement_acceptances from anon, authenticated;
