-- ─────────────────────────────────────────────────────────────────────────────
-- Programs
-- Sprint 1 — Program Model Foundation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.programs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description   text        CHECK (description IS NULL OR char_length(description) <= 5000),
  type          text        NOT NULL,
  status        text        NOT NULL DEFAULT 'DRAFT',
  owner_id      uuid        REFERENCES auth.users(id),
  start_date    timestamptz,
  target_date   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT programs_type_valid CHECK (type IN (
    'SOFTWARE_DEVELOPMENT',
    'INFRASTRUCTURE_PROJECT',
    'CUSTOMER_ONBOARDING',
    'AOC_PROTOCOL_ADOPTION',
    'ORGANIZATIONAL_CHANGE',
    'STRATEGIC_INITIATIVE',
    'INTERNAL_PROGRAM',
    'CUSTOM'
  )),
  CONSTRAINT programs_status_valid CHECK (status IN (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED'
  )),
  CONSTRAINT programs_dates_valid CHECK (
    target_date IS NULL OR start_date IS NULL OR target_date >= start_date
  )
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Workspace members can read programs in their workspace
CREATE POLICY "workspace members can select programs"
  ON public.programs FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Workspace members can insert programs into their workspace
CREATE POLICY "workspace members can insert programs"
  ON public.programs FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Workspace members can update programs in their workspace
CREATE POLICY "workspace members can update programs"
  ON public.programs FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX programs_workspace_id_idx ON public.programs (workspace_id);
CREATE INDEX programs_status_idx        ON public.programs (status);
CREATE INDEX programs_deleted_at_idx    ON public.programs (deleted_at) WHERE deleted_at IS NULL;
