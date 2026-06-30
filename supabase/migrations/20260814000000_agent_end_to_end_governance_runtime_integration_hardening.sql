-- ─── PMO End-to-End Governance Runtime Integration & Production Hardening ─────
-- Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
-- Does NOT create beta tenants, demo customers, or mutate external systems.
-- Does NOT call LLMs, create embeddings, train models, or call external APIs.
-- Does NOT send emails, Slack messages, create Jira tickets, or calendar events.
-- Adds only dedicated runtime hardening audit, blocker, and remediation records.

-- ─── Runtime Hardening Runs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_runtime_hardening_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  triggered_by text,
  started_at timestamptz,
  completed_at timestamptz,
  layers_audited text[] NOT NULL DEFAULT '{}',
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  passed_check_count integer NOT NULL DEFAULT 0,
  failed_check_count integer NOT NULL DEFAULT 0,
  safe_run_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_hardening_runs_workspace ON agent_pmo_runtime_hardening_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pmo_hardening_runs_status ON agent_pmo_runtime_hardening_runs(workspace_id, status);

ALTER TABLE agent_pmo_runtime_hardening_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_hardening_runs"
  ON agent_pmo_runtime_hardening_runs FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_hardening_runs"
  ON agent_pmo_runtime_hardening_runs FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_hardening_runs"
  ON agent_pmo_runtime_hardening_runs FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Layer Integration Audits ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_layer_integration_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  layer text NOT NULL,
  type_file_exists boolean NOT NULL DEFAULT false,
  validation_file_exists boolean,
  registry_file_exists boolean,
  service_file_exists boolean,
  docs_exist boolean NOT NULL DEFAULT false,
  tests_exist boolean NOT NULL DEFAULT false,
  migration_exists boolean,
  api_routes_exist boolean,
  exports_exist boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_audit_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_layer_audits_run ON agent_pmo_layer_integration_audits(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_layer_integration_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_layer_audits"
  ON agent_pmo_layer_integration_audits FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_layer_audits"
  ON agent_pmo_layer_integration_audits FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Route Contract Audits ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_route_contract_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  route_path text NOT NULL,
  route_exists boolean NOT NULL DEFAULT false,
  exported_methods text[] NOT NULL DEFAULT '{}',
  dynamic_params_follow_convention boolean NOT NULL DEFAULT false,
  request_parsing_is_safe boolean NOT NULL DEFAULT false,
  responses_are_deterministic boolean NOT NULL DEFAULT false,
  errors_are_sanitized boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_audit_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_route_audits_run ON agent_pmo_route_contract_audits(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_route_contract_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_route_audits"
  ON agent_pmo_route_contract_audits FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_route_audits"
  ON agent_pmo_route_contract_audits FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Database Contract Audits ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_database_contract_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  table_name text NOT NULL,
  migration_exists boolean NOT NULL DEFAULT false,
  row_type_exists boolean NOT NULL DEFAULT false,
  column_constants_exist boolean NOT NULL DEFAULT false,
  contract_version_includes boolean NOT NULL DEFAULT false,
  indexes_exist boolean NOT NULL DEFAULT false,
  created_at_convention boolean NOT NULL DEFAULT true,
  updated_at_convention boolean NOT NULL DEFAULT true,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_audit_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_db_audits_run ON agent_pmo_database_contract_audits(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_database_contract_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_db_audits"
  ON agent_pmo_database_contract_audits FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_db_audits"
  ON agent_pmo_database_contract_audits FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── RLS Policy Audits ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_rls_policy_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  table_name text NOT NULL,
  rls_enabled boolean NOT NULL DEFAULT false,
  workspace_scoped_read_exists boolean NOT NULL DEFAULT false,
  write_policies_exist boolean NOT NULL DEFAULT false,
  no_public_access boolean NOT NULL DEFAULT true,
  no_broad_using_true boolean NOT NULL DEFAULT true,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_audit_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_rls_audits_run ON agent_pmo_rls_policy_audits(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_rls_policy_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_rls_audits"
  ON agent_pmo_rls_policy_audits FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_rls_audits"
  ON agent_pmo_rls_policy_audits FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Workspace Isolation Checks ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_workspace_isolation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  check_target text NOT NULL,
  workspace_id_required boolean NOT NULL DEFAULT false,
  list_functions_filter_by_workspace boolean NOT NULL DEFAULT false,
  get_functions_verify_workspace boolean NOT NULL DEFAULT false,
  api_routes_require_workspace_id boolean NOT NULL DEFAULT false,
  no_cross_workspace_leakage boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_workspace_isolation_run ON agent_pmo_workspace_isolation_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_workspace_isolation_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_workspace_isolation"
  ON agent_pmo_workspace_isolation_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_workspace_isolation"
  ON agent_pmo_workspace_isolation_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Observability Coverage Checks ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_observability_coverage_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  source_types_exist boolean NOT NULL DEFAULT false,
  event_types_exist boolean NOT NULL DEFAULT false,
  category_is_governance boolean NOT NULL DEFAULT false,
  no_circular_imports boolean NOT NULL DEFAULT false,
  no_unsafe_payload boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_obs_coverage_run ON agent_pmo_observability_coverage_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_observability_coverage_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_obs_coverage"
  ON agent_pmo_observability_coverage_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_obs_coverage"
  ON agent_pmo_observability_coverage_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Export Safety Checks ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_export_safety_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  export_target text NOT NULL,
  raw_payloads_excluded boolean NOT NULL DEFAULT false,
  secrets_excluded boolean NOT NULL DEFAULT false,
  tokens_excluded boolean NOT NULL DEFAULT false,
  credentials_excluded boolean NOT NULL DEFAULT false,
  stack_traces_excluded boolean NOT NULL DEFAULT false,
  unnecessary_personal_data_excluded boolean NOT NULL DEFAULT false,
  non_goals_included boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_export_safety_run ON agent_pmo_export_safety_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_export_safety_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_export_safety"
  ON agent_pmo_export_safety_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_export_safety"
  ON agent_pmo_export_safety_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Idempotency Checks ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_idempotency_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  check_target text NOT NULL,
  append_only_decisions_preserved boolean NOT NULL DEFAULT false,
  pointer_updates_preserve_previous boolean NOT NULL DEFAULT false,
  completion_requires_correct_status boolean NOT NULL DEFAULT false,
  activation_requires_approved_gate boolean NOT NULL DEFAULT false,
  rollback_requires_approved_gate boolean NOT NULL DEFAULT false,
  exports_regeneratable boolean NOT NULL DEFAULT false,
  archive_does_not_hard_delete boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_idempotency_run ON agent_pmo_idempotency_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_idempotency_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_idempotency"
  ON agent_pmo_idempotency_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_idempotency"
  ON agent_pmo_idempotency_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Error Handling Checks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_error_handling_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  check_target text NOT NULL,
  route_errors_sanitized boolean NOT NULL DEFAULT false,
  service_errors_do_not_leak_payloads boolean NOT NULL DEFAULT false,
  validation_errors_are_clear boolean NOT NULL DEFAULT false,
  missing_records_return_safe_messages boolean NOT NULL DEFAULT false,
  stack_traces_not_returned_from_api boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_error_handling_run ON agent_pmo_error_handling_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_error_handling_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_error_handling"
  ON agent_pmo_error_handling_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_error_handling"
  ON agent_pmo_error_handling_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── UI Dashboard Integration Checks ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_ui_dashboard_integration_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  dashboard_routes_exist boolean NOT NULL DEFAULT false,
  command_center_page_builds boolean NOT NULL DEFAULT false,
  no_uncontrolled_action_buttons boolean NOT NULL DEFAULT false,
  no_prohibited_labels boolean NOT NULL DEFAULT false,
  passed boolean NOT NULL DEFAULT false,
  warnings text[] NOT NULL DEFAULT '{}',
  findings text[] NOT NULL DEFAULT '{}',
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_ui_checks_run ON agent_pmo_ui_dashboard_integration_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_ui_dashboard_integration_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_ui_checks"
  ON agent_pmo_ui_dashboard_integration_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_ui_checks"
  ON agent_pmo_ui_dashboard_integration_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── CI Smoke Checks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_ci_smoke_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  typecheck_result text NOT NULL DEFAULT 'unknown',
  test_result text NOT NULL DEFAULT 'unknown',
  build_result text NOT NULL DEFAULT 'unknown',
  hardening_test_result text NOT NULL DEFAULT 'unknown',
  terminology_result text NOT NULL DEFAULT 'unknown',
  prohibited_behavior_result text NOT NULL DEFAULT 'unknown',
  safe_smoke_summary text NOT NULL DEFAULT '',
  passed boolean NOT NULL DEFAULT false,
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_ci_smoke_run ON agent_pmo_ci_smoke_checks(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_ci_smoke_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_ci_smoke"
  ON agent_pmo_ci_smoke_checks FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_ci_smoke"
  ON agent_pmo_ci_smoke_checks FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Production Readiness Gates ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_production_readiness_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  status text NOT NULL DEFAULT 'created',
  open_blocker_count integer NOT NULL DEFAULT 0,
  critical_blocker_count integer NOT NULL DEFAULT 0,
  safe_gate_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_readiness_gates_run ON agent_pmo_production_readiness_gates(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_production_readiness_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_readiness_gates"
  ON agent_pmo_production_readiness_gates FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_readiness_gates"
  ON agent_pmo_production_readiness_gates FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_readiness_gates"
  ON agent_pmo_production_readiness_gates FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Production Readiness Decisions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_production_readiness_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  gate_id uuid NOT NULL REFERENCES agent_pmo_production_readiness_gates(id),
  decision_type text NOT NULL,
  rationale text NOT NULL,
  decided_by_id text,
  safe_decision_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_readiness_decisions_gate ON agent_pmo_production_readiness_decisions(workspace_id, gate_id);

ALTER TABLE agent_pmo_production_readiness_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_readiness_decisions"
  ON agent_pmo_production_readiness_decisions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_readiness_decisions"
  ON agent_pmo_production_readiness_decisions FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Runtime Hardening Blockers ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_runtime_hardening_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  blocker_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text NOT NULL,
  affected_layer text,
  affected_file text,
  resolved_at timestamptz,
  safe_blocker_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_blockers_run ON agent_pmo_runtime_hardening_blockers(workspace_id, hardening_run_id);
CREATE INDEX IF NOT EXISTS idx_pmo_blockers_status ON agent_pmo_runtime_hardening_blockers(workspace_id, status);

ALTER TABLE agent_pmo_runtime_hardening_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_blockers"
  ON agent_pmo_runtime_hardening_blockers FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_blockers"
  ON agent_pmo_runtime_hardening_blockers FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_blockers"
  ON agent_pmo_runtime_hardening_blockers FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Runtime Remediation Items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_runtime_remediation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  blocker_id uuid REFERENCES agent_pmo_runtime_hardening_blockers(id),
  remediation_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  title text NOT NULL,
  description text NOT NULL,
  safe_remediation_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_remediation_run ON agent_pmo_runtime_remediation_items(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_runtime_remediation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_remediation"
  ON agent_pmo_runtime_remediation_items FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_remediation"
  ON agent_pmo_runtime_remediation_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_remediation"
  ON agent_pmo_runtime_remediation_items FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Runtime Hardening Exports ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_runtime_hardening_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid NOT NULL REFERENCES agent_pmo_runtime_hardening_runs(id),
  export_format text NOT NULL,
  export_status text NOT NULL DEFAULT 'created',
  safe_export_content text NOT NULL DEFAULT '',
  export_size_bytes integer NOT NULL DEFAULT 0,
  safety_validation_passed boolean NOT NULL DEFAULT false,
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_hardening_exports_run ON agent_pmo_runtime_hardening_exports(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_runtime_hardening_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_hardening_exports"
  ON agent_pmo_runtime_hardening_exports FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_hardening_exports"
  ON agent_pmo_runtime_hardening_exports FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Runtime Hardening Events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_pmo_runtime_hardening_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  hardening_run_id uuid REFERENCES agent_pmo_runtime_hardening_runs(id),
  event_type text NOT NULL,
  message text,
  safe_event_payload_json jsonb NOT NULL DEFAULT '{}',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmo_hardening_events_workspace ON agent_pmo_runtime_hardening_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pmo_hardening_events_run ON agent_pmo_runtime_hardening_events(workspace_id, hardening_run_id);

ALTER TABLE agent_pmo_runtime_hardening_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_hardening_events"
  ON agent_pmo_runtime_hardening_events FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_hardening_events"
  ON agent_pmo_runtime_hardening_events FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
