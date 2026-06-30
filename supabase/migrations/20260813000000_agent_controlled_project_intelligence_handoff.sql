-- ─── PMO Controlled Project Intelligence Handoff ────────────────────────────
-- Does NOT delete project memory, overwrite project brain, or auto-assign PM.
-- Does NOT send emails, Slack messages, or create calendar events.
-- Does NOT execute adapters, mutate external systems, or create external tickets.
-- Adds only dedicated handoff, assignment pointer, and audit records.
-- Controlled assignment pointer update is the only project ownership mutation allowed.

-- ─── Handoff Requests ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  current_pm_id text,
  incoming_pm_id text NOT NULL,
  requested_by_id text,
  handoff_reason text NOT NULL,
  handoff_urgency text NOT NULL,
  request_reason text NOT NULL,
  status text NOT NULL DEFAULT 'context_validation_pending',
  effective_date timestamptz,
  request_version integer NOT NULL DEFAULT 1,
  safe_request_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_requests_workspace ON agent_pmo_project_handoff_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_requests_project ON agent_pmo_project_handoff_requests(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_requests_status ON agent_pmo_project_handoff_requests(workspace_id, status);

ALTER TABLE agent_pmo_project_handoff_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_handoff_requests"
  ON agent_pmo_project_handoff_requests FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_handoff_requests"
  ON agent_pmo_project_handoff_requests FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_handoff_requests"
  ON agent_pmo_project_handoff_requests FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Context Validations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_context_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  check_key text NOT NULL,
  check_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  finding text NOT NULL,
  limitation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_context_validations_request ON agent_pmo_project_context_validations(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_context_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_context_validations"
  ON agent_pmo_project_context_validations FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_context_validations"
  ON agent_pmo_project_context_validations FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_context_validations"
  ON agent_pmo_project_context_validations FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Handoff Gates ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  gate_status text NOT NULL DEFAULT 'under_review',
  reviewed_by_id text,
  safe_gate_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_gates_request ON agent_pmo_project_handoff_gates(workspace_id, handoff_request_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_gates_status ON agent_pmo_project_handoff_gates(workspace_id, gate_status);

ALTER TABLE agent_pmo_project_handoff_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_handoff_gates"
  ON agent_pmo_project_handoff_gates FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_handoff_gates"
  ON agent_pmo_project_handoff_gates FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_handoff_gates"
  ON agent_pmo_project_handoff_gates FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Gate Decisions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_gate_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_gates(id),
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  decision text NOT NULL,
  rationale text NOT NULL,
  decided_by_id text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_gate_decisions_gate ON agent_pmo_project_handoff_gate_decisions(workspace_id, handoff_gate_id);

ALTER TABLE agent_pmo_project_handoff_gate_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_gate_decisions"
  ON agent_pmo_project_handoff_gate_decisions FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_gate_decisions"
  ON agent_pmo_project_handoff_gate_decisions FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Handoff Packs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  current_pm_id text,
  incoming_pm_id text NOT NULL,
  handoff_reason text NOT NULL,
  pack_status text NOT NULL DEFAULT 'pmo_review_ready',
  executive_summary text NOT NULL DEFAULT '',
  current_project_state text NOT NULL DEFAULT '',
  health_summary text NOT NULL DEFAULT '',
  schedule_summary text NOT NULL DEFAULT '',
  delivery_summary text NOT NULL DEFAULT '',
  financial_summary text,
  risk_summary text NOT NULL DEFAULT '',
  blocker_summary text NOT NULL DEFAULT '',
  open_decision_summary text NOT NULL DEFAULT '',
  dependency_summary text NOT NULL DEFAULT '',
  stakeholder_summary text NOT NULL DEFAULT '',
  commitment_summary text NOT NULL DEFAULT '',
  milestone_summary text NOT NULL DEFAULT '',
  recommended_first_actions text NOT NULL DEFAULT '',
  limitations text NOT NULL DEFAULT '',
  safe_pack_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_packs_request ON agent_pmo_project_handoff_packs(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_handoff_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_handoff_packs"
  ON agent_pmo_project_handoff_packs FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_handoff_packs"
  ON agent_pmo_project_handoff_packs FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_handoff_packs"
  ON agent_pmo_project_handoff_packs FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Memory Snapshots ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_memory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  category text NOT NULL,
  snapshot_status text NOT NULL DEFAULT 'assembled',
  summary text NOT NULL DEFAULT '',
  limitation text,
  item_count integer NOT NULL DEFAULT 0,
  safe_snapshot_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_memory_snapshots_request ON agent_pmo_project_memory_snapshots(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_memory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_memory_snapshots"
  ON agent_pmo_project_memory_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_memory_snapshots"
  ON agent_pmo_project_memory_snapshots FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_memory_snapshots"
  ON agent_pmo_project_memory_snapshots FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Status Snapshots ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_status_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  project_health text NOT NULL DEFAULT 'unknown',
  schedule_health text NOT NULL DEFAULT 'unknown',
  scope_health text NOT NULL DEFAULT 'unknown',
  budget_health text NOT NULL DEFAULT 'not_applicable',
  delivery_phase text,
  completion_estimate text,
  upcoming_milestone_count integer NOT NULL DEFAULT 0,
  active_risk_count integer NOT NULL DEFAULT 0,
  active_blocker_count integer NOT NULL DEFAULT 0,
  open_decision_count integer NOT NULL DEFAULT 0,
  pending_action_count integer NOT NULL DEFAULT 0,
  safe_status_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_status_snapshots_request ON agent_pmo_project_status_snapshots(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_status_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_status_snapshots"
  ON agent_pmo_project_status_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_status_snapshots"
  ON agent_pmo_project_status_snapshots FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Snapshot Items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_snapshot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  item_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  item_status text NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'unknown',
  due_date timestamptz,
  source_ref text,
  safe_item_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_snapshot_items_request ON agent_pmo_project_handoff_snapshot_items(workspace_id, handoff_request_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_snapshot_items_type ON agent_pmo_project_handoff_snapshot_items(workspace_id, item_type);

ALTER TABLE agent_pmo_project_handoff_snapshot_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_snapshot_items"
  ON agent_pmo_project_handoff_snapshot_items FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_snapshot_items"
  ON agent_pmo_project_handoff_snapshot_items FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_snapshot_items"
  ON agent_pmo_project_handoff_snapshot_items FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Stakeholder Context ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_stakeholder_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  stakeholder_type text NOT NULL,
  role_label text NOT NULL,
  context_summary text NOT NULL DEFAULT '',
  stakeholder_status text NOT NULL DEFAULT 'active',
  safe_context_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_stakeholder_context_request ON agent_pmo_stakeholder_context_snapshots(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_stakeholder_context_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_stakeholder_context"
  ON agent_pmo_stakeholder_context_snapshots FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_stakeholder_context"
  ON agent_pmo_stakeholder_context_snapshots FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Outgoing PM Notes ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_outgoing_pm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  note_type text NOT NULL,
  note_text text NOT NULL,
  note_status text NOT NULL DEFAULT 'draft',
  author_id text,
  safe_note_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_outgoing_notes_request ON agent_pmo_outgoing_pm_notes(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_outgoing_pm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_outgoing_notes"
  ON agent_pmo_outgoing_pm_notes FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_outgoing_notes"
  ON agent_pmo_outgoing_pm_notes FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_outgoing_notes"
  ON agent_pmo_outgoing_pm_notes FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Incoming PM Acceptances ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_incoming_pm_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  handoff_pack_id uuid REFERENCES agent_pmo_project_handoff_packs(id),
  incoming_pm_id text NOT NULL,
  decision text NOT NULL,
  rationale text NOT NULL,
  acceptance_status text NOT NULL DEFAULT 'created',
  safe_acceptance_payload_json jsonb NOT NULL DEFAULT '{}',
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_incoming_acceptances_request ON agent_pmo_incoming_pm_acceptances(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_incoming_pm_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_incoming_acceptances"
  ON agent_pmo_incoming_pm_acceptances FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_incoming_acceptances"
  ON agent_pmo_incoming_pm_acceptances FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Controlled Project Assignment Pointers ───────────────────────────────────
-- At most one active pointer per workspace_id + project_id.
-- Assignment pointer update is the ONLY controlled project ownership mutation.

CREATE TABLE IF NOT EXISTS agent_pmo_controlled_project_assignment_pointers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  active_pm_id text NOT NULL,
  previous_pm_id text,
  handoff_request_id uuid REFERENCES agent_pmo_project_handoff_requests(id),
  handoff_completed_by_id text,
  handoff_completed_at timestamptz,
  assignment_version integer NOT NULL DEFAULT 1,
  handoff_reason text,
  safe_assignment_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_assignment_pointers_workspace ON agent_pmo_controlled_project_assignment_pointers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_assignment_pointers_project ON agent_pmo_controlled_project_assignment_pointers(workspace_id, project_id);

ALTER TABLE agent_pmo_controlled_project_assignment_pointers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_assignment_pointers"
  ON agent_pmo_controlled_project_assignment_pointers FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_assignment_pointers"
  ON agent_pmo_controlled_project_assignment_pointers FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_assignment_pointers"
  ON agent_pmo_controlled_project_assignment_pointers FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Assignment History ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  handoff_request_id uuid REFERENCES agent_pmo_project_handoff_requests(id),
  previous_pm_id text,
  new_pm_id text NOT NULL,
  assignment_reason text NOT NULL,
  assignment_source text NOT NULL DEFAULT 'controlled_handoff',
  effective_date timestamptz,
  completed_by_id text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  safe_history_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_assignment_history_workspace ON agent_pmo_project_assignment_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_assignment_history_project ON agent_pmo_project_assignment_history(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_assignment_history_request ON agent_pmo_project_assignment_history(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_assignment_history"
  ON agent_pmo_project_assignment_history FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_assignment_history"
  ON agent_pmo_project_assignment_history FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Continuity Checks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_handoff_continuity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  check_type text NOT NULL,
  check_status text NOT NULL DEFAULT 'pending',
  rationale text,
  completed_at timestamptz,
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_continuity_checks_request ON agent_pmo_handoff_continuity_checks(workspace_id, handoff_request_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_continuity_checks_status ON agent_pmo_handoff_continuity_checks(workspace_id, check_status);

ALTER TABLE agent_pmo_handoff_continuity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_continuity_checks"
  ON agent_pmo_handoff_continuity_checks FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_continuity_checks"
  ON agent_pmo_handoff_continuity_checks FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_update_continuity_checks"
  ON agent_pmo_handoff_continuity_checks FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Exports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid NOT NULL REFERENCES agent_pmo_project_handoff_requests(id),
  export_format text NOT NULL,
  export_status text NOT NULL DEFAULT 'generated',
  safe_export_content text NOT NULL DEFAULT '',
  export_size_bytes integer NOT NULL DEFAULT 0,
  safety_validation_passed boolean NOT NULL DEFAULT true,
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_exports_request ON agent_pmo_project_handoff_exports(workspace_id, handoff_request_id);

ALTER TABLE agent_pmo_project_handoff_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_handoff_exports"
  ON agent_pmo_project_handoff_exports FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_handoff_exports"
  ON agent_pmo_project_handoff_exports FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- ─── Audit Events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_project_handoff_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  handoff_request_id uuid REFERENCES agent_pmo_project_handoff_requests(id),
  event_type text NOT NULL,
  message text,
  safe_event_payload_json jsonb NOT NULL DEFAULT '{}',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_audit_events_workspace ON agent_pmo_project_handoff_audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_audit_events_request ON agent_pmo_project_handoff_audit_events(workspace_id, handoff_request_id);
CREATE INDEX IF NOT EXISTS idx_agent_pmo_handoff_audit_events_type ON agent_pmo_project_handoff_audit_events(workspace_id, event_type);

ALTER TABLE agent_pmo_project_handoff_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_handoff_audit_events"
  ON agent_pmo_project_handoff_audit_events FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_member_insert_handoff_audit_events"
  ON agent_pmo_project_handoff_audit_events FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
