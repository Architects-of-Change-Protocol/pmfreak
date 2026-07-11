-- program_roadmap_sources
CREATE TABLE public.program_roadmap_sources (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id    uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  raw_text      text        NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 500000),
  source_type   text        NOT NULL,
  title         text        CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 200),
  version       integer     NOT NULL DEFAULT 1,
  status        text        NOT NULL DEFAULT 'DRAFT',
  metadata      jsonb,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,

  CONSTRAINT program_roadmap_sources_source_type_valid CHECK (source_type IN (
    'TEXT','MARKDOWN','CLAUDE_PLAN','AOC_PLAN','INFRASTRUCTURE_PLAN','CUSTOM'
  )),
  CONSTRAINT program_roadmap_sources_status_valid CHECK (status IN (
    'DRAFT','ACTIVE','SUPERSEDED','ARCHIVED'
  )),
  CONSTRAINT program_roadmap_sources_version_positive CHECK (version > 0)
);

ALTER TABLE public.program_roadmap_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can select program_roadmap_sources"
  ON public.program_roadmap_sources FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert program_roadmap_sources"
  ON public.program_roadmap_sources FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update program_roadmap_sources"
  ON public.program_roadmap_sources FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX program_roadmap_sources_workspace_id_idx  ON public.program_roadmap_sources (workspace_id);
CREATE INDEX program_roadmap_sources_program_id_idx    ON public.program_roadmap_sources (program_id);
CREATE INDEX program_roadmap_sources_status_idx        ON public.program_roadmap_sources (status) WHERE deleted_at IS NULL;
CREATE INDEX program_roadmap_sources_deleted_at_idx    ON public.program_roadmap_sources (deleted_at) WHERE deleted_at IS NULL;
