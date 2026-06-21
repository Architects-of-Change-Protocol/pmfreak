-- program_roadmap_parse_results
-- Stores deterministic parse results from the Program Roadmap Parser.
-- Each row represents one parse pass over a ProgramRoadmapSource.
-- Source rawText is never modified; parse results are append-only and soft-deleted.

CREATE TABLE public.program_roadmap_parse_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  program_id      uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  source_id       uuid        NOT NULL REFERENCES public.program_roadmap_sources(id) ON DELETE CASCADE,
  status          text        NOT NULL,
  result_json     jsonb       NOT NULL DEFAULT '{}',
  error_count     integer     NOT NULL DEFAULT 0,
  warning_count   integer     NOT NULL DEFAULT 0,
  epic_count      integer     NOT NULL DEFAULT 0,
  sprint_count    integer     NOT NULL DEFAULT 0,
  parsed_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  CONSTRAINT program_roadmap_parse_results_status_valid CHECK (status IN (
    'VALID', 'VALID_WITH_WARNINGS', 'INVALID'
  )),
  CONSTRAINT program_roadmap_parse_results_error_count_non_negative CHECK (error_count >= 0),
  CONSTRAINT program_roadmap_parse_results_warning_count_non_negative CHECK (warning_count >= 0),
  CONSTRAINT program_roadmap_parse_results_epic_count_non_negative CHECK (epic_count >= 0),
  CONSTRAINT program_roadmap_parse_results_sprint_count_non_negative CHECK (sprint_count >= 0)
);

ALTER TABLE public.program_roadmap_parse_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can select program_roadmap_parse_results"
  ON public.program_roadmap_parse_results FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can insert program_roadmap_parse_results"
  ON public.program_roadmap_parse_results FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace members can update program_roadmap_parse_results"
  ON public.program_roadmap_parse_results FOR UPDATE TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX program_roadmap_parse_results_workspace_id_idx ON public.program_roadmap_parse_results (workspace_id);
CREATE INDEX program_roadmap_parse_results_program_id_idx   ON public.program_roadmap_parse_results (program_id);
CREATE INDEX program_roadmap_parse_results_source_id_idx    ON public.program_roadmap_parse_results (source_id);
CREATE INDEX program_roadmap_parse_results_parsed_at_idx    ON public.program_roadmap_parse_results (parsed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX program_roadmap_parse_results_deleted_at_idx   ON public.program_roadmap_parse_results (deleted_at) WHERE deleted_at IS NULL;
