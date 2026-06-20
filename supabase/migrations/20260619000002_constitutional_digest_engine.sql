-- ─────────────────────────────────────────────────────────────────────────────
-- Constitutional Digest Engine
-- EPIC 2 Sprint 2: Sovereign Project Vault
--
-- Transforms Constitutional Memory into anonymized, portable Constitutional
-- Digests that preserve institutional learning without retaining client PII.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── constitutional_digests ───────────────────────────────────────────────────

CREATE TABLE public.constitutional_digests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  memory_record_id      uuid NOT NULL,
  digest_version        integer NOT NULL DEFAULT 1,
  digest_status         text NOT NULL DEFAULT 'draft',
  source_memory_version integer NOT NULL DEFAULT 1,
  digest_payload        jsonb NOT NULL DEFAULT '{}',
  confidence_score      numeric(4,3),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid NOT NULL REFERENCES auth.users(id),
  deleted_at            timestamptz,

  CONSTRAINT constitutional_digests_memory_fk
    FOREIGN KEY (memory_record_id)
    REFERENCES public.constitutional_memory_records(id)
    ON DELETE CASCADE,

  CONSTRAINT constitutional_digests_status_check CHECK (
    digest_status IN ('draft', 'generated', 'validated', 'published', 'archived')
  ),

  CONSTRAINT constitutional_digests_confidence_range CHECK (
    confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)
  ),

  CONSTRAINT constitutional_digests_version_positive CHECK (
    digest_version >= 1 AND source_memory_version >= 1
  )
);

CREATE INDEX idx_constitutional_digests_workspace
  ON public.constitutional_digests(workspace_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_constitutional_digests_memory_record
  ON public.constitutional_digests(memory_record_id, workspace_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_constitutional_digests_status
  ON public.constitutional_digests(workspace_id, digest_status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.constitutional_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read constitutional digests"
  ON public.constitutional_digests FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace members can insert constitutional digests"
  ON public.constitutional_digests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );

-- UPDATE is restricted to service role; application code performs lifecycle
-- transitions server-side where business rules are enforced.
CREATE POLICY "service role can update constitutional digests"
  ON public.constitutional_digests FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── constitutional_digest_classifications ────────────────────────────────────

CREATE TABLE public.constitutional_digest_classifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  digest_id             uuid NOT NULL,
  classification_type   text NOT NULL,
  classification_value  text NOT NULL,
  confidence_score      numeric(4,3) NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT constitutional_digest_classifications_digest_fk
    FOREIGN KEY (digest_id)
    REFERENCES public.constitutional_digests(id)
    ON DELETE CASCADE,

  CONSTRAINT constitutional_digest_classifications_type_check CHECK (
    classification_type IN (
      'industry',
      'project_type',
      'risk',
      'decision',
      'outcome',
      'governance',
      'delivery',
      'authority'
    )
  ),

  CONSTRAINT constitutional_digest_classifications_confidence_range CHECK (
    confidence_score >= 0.0 AND confidence_score <= 1.0
  )
);

CREATE INDEX idx_constitutional_digest_classifications_digest
  ON public.constitutional_digest_classifications(digest_id, workspace_id);

CREATE INDEX idx_constitutional_digest_classifications_type
  ON public.constitutional_digest_classifications(workspace_id, classification_type, classification_value);

ALTER TABLE public.constitutional_digest_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read digest classifications"
  ON public.constitutional_digest_classifications FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace members can insert digest classifications"
  ON public.constitutional_digest_classifications FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));
