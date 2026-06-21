-- program_epics
CREATE TABLE public.program_epics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id    uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  number        integer     NOT NULL,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description   text,
  status        text        NOT NULL DEFAULT 'DRAFT',
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT program_epics_status_valid CHECK (status IN (
    'DRAFT','BACKLOG','READY','IN_PROGRESS','IN_REVIEW','DONE','ARCHIVED'
  )),
  CONSTRAINT program_epics_number_positive CHECK (number > 0),
  CONSTRAINT program_epics_number_unique_per_program UNIQUE (program_id, number)
);

ALTER TABLE public.program_epics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can select program_epics"
  ON public.program_epics FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert program_epics"
  ON public.program_epics FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update program_epics"
  ON public.program_epics FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX program_epics_workspace_id_idx ON public.program_epics (workspace_id);
CREATE INDEX program_epics_program_id_idx   ON public.program_epics (program_id);
CREATE INDEX program_epics_deleted_at_idx   ON public.program_epics (deleted_at) WHERE deleted_at IS NULL;

-- program_sprints
CREATE TABLE public.program_sprints (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id    uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  epic_id       uuid        NOT NULL REFERENCES public.program_epics(id) ON DELETE CASCADE,
  number        integer     NOT NULL,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description   text,
  objective     text,
  status        text        NOT NULL DEFAULT 'DRAFT',
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT program_sprints_status_valid CHECK (status IN (
    'DRAFT','BACKLOG','READY','IN_PROGRESS','IN_REVIEW','DONE','ARCHIVED'
  )),
  CONSTRAINT program_sprints_number_positive CHECK (number > 0),
  CONSTRAINT program_sprints_number_unique_per_program UNIQUE (program_id, number)
);

ALTER TABLE public.program_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can select program_sprints"
  ON public.program_sprints FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert program_sprints"
  ON public.program_sprints FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update program_sprints"
  ON public.program_sprints FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX program_sprints_workspace_id_idx ON public.program_sprints (workspace_id);
CREATE INDEX program_sprints_program_id_idx   ON public.program_sprints (program_id);
CREATE INDEX program_sprints_epic_id_idx      ON public.program_sprints (epic_id);
CREATE INDEX program_sprints_deleted_at_idx   ON public.program_sprints (deleted_at) WHERE deleted_at IS NULL;

-- program_cards
CREATE TABLE public.program_cards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id    uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  epic_id       uuid        REFERENCES public.program_epics(id) ON DELETE SET NULL,
  sprint_id     uuid        REFERENCES public.program_sprints(id) ON DELETE SET NULL,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description   text,
  prompt_body   text,
  type          text        NOT NULL,
  status        text        NOT NULL DEFAULT 'DRAFT',
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT program_cards_type_valid CHECK (type IN (
    'EPIC','SPRINT','TASK','PROMPT','MILESTONE','DELIVERABLE','CUSTOM'
  )),
  CONSTRAINT program_cards_status_valid CHECK (status IN (
    'DRAFT','BACKLOG','READY','IN_PROGRESS','IN_REVIEW','DONE','ARCHIVED'
  ))
);

ALTER TABLE public.program_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can select program_cards"
  ON public.program_cards FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert program_cards"
  ON public.program_cards FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update program_cards"
  ON public.program_cards FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX program_cards_workspace_id_idx ON public.program_cards (workspace_id);
CREATE INDEX program_cards_program_id_idx   ON public.program_cards (program_id);
CREATE INDEX program_cards_sprint_id_idx    ON public.program_cards (sprint_id);
CREATE INDEX program_cards_deleted_at_idx   ON public.program_cards (deleted_at) WHERE deleted_at IS NULL;
