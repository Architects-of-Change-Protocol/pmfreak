-- ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Migration ──────────
-- Does NOT create real customer records or production tenants.
-- All tables are workspace-scoped with RLS enabled.
-- No public access. No `using (true)` policies.

-- ─── Beta Readiness Plans ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  title text NOT NULL DEFAULT '',
  description text,
  triggered_by text,
  started_at timestamptz,
  completed_at timestamptz,
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_plans_workspace ON agent_beta_readiness_plans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_beta_readiness_plans_status ON agent_beta_readiness_plans(workspace_id, status);

ALTER TABLE agent_beta_readiness_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_plans"
  ON agent_beta_readiness_plans FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_plans"
  ON agent_beta_readiness_plans FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_beta_readiness_plans"
  ON agent_beta_readiness_plans FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Workspace Readiness ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_workspace_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  checklist_passed boolean NOT NULL DEFAULT false,
  demo_passed boolean NOT NULL DEFAULT false,
  validation_passed boolean NOT NULL DEFAULT false,
  safe_check_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_workspace_readiness_plan ON agent_beta_workspace_readiness(workspace_id, plan_id);

ALTER TABLE agent_beta_workspace_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_workspace_readiness"
  ON agent_beta_workspace_readiness FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_workspace_readiness"
  ON agent_beta_workspace_readiness FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Demo Data Bundles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_demo_data_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  bundle_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  project_scenario_count integer NOT NULL DEFAULT 0,
  governance_scenario_count integer NOT NULL DEFAULT 0,
  handoff_scenario_count integer NOT NULL DEFAULT 0,
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_data_bundles_plan ON agent_demo_data_bundles(workspace_id, plan_id);

ALTER TABLE agent_demo_data_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_demo_data_bundles"
  ON agent_demo_data_bundles FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_demo_data_bundles"
  ON agent_demo_data_bundles FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_demo_data_bundles"
  ON agent_demo_data_bundles FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Demo Project Scenarios ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_demo_project_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  bundle_id uuid NOT NULL REFERENCES agent_demo_data_bundles(id),
  scenario_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  fictional_project_name text NOT NULL DEFAULT '',
  fictional_pm_name text NOT NULL DEFAULT '',
  fictional_client_name text NOT NULL DEFAULT '',
  safe_scenario_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_project_scenarios_bundle ON agent_demo_project_scenarios(workspace_id, bundle_id);

ALTER TABLE agent_demo_project_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_demo_project_scenarios"
  ON agent_demo_project_scenarios FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_demo_project_scenarios"
  ON agent_demo_project_scenarios FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Demo Governance Scenarios ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_demo_governance_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  bundle_id uuid NOT NULL REFERENCES agent_demo_data_bundles(id),
  scenario_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  fictional_policy_title text NOT NULL DEFAULT '',
  fictional_requestor_name text NOT NULL DEFAULT '',
  safe_scenario_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_governance_scenarios_bundle ON agent_demo_governance_scenarios(workspace_id, bundle_id);

ALTER TABLE agent_demo_governance_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_demo_governance_scenarios"
  ON agent_demo_governance_scenarios FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_demo_governance_scenarios"
  ON agent_demo_governance_scenarios FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Demo Handoff Scenarios ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_demo_handoff_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  bundle_id uuid NOT NULL REFERENCES agent_demo_data_bundles(id),
  scenario_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  fictional_from_pm_name text NOT NULL DEFAULT '',
  fictional_to_pm_name text NOT NULL DEFAULT '',
  fictional_project_name text NOT NULL DEFAULT '',
  safe_scenario_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_handoff_scenarios_bundle ON agent_demo_handoff_scenarios(workspace_id, bundle_id);

ALTER TABLE agent_demo_handoff_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_demo_handoff_scenarios"
  ON agent_demo_handoff_scenarios FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_demo_handoff_scenarios"
  ON agent_demo_handoff_scenarios FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Onboarding Checklists ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  total_items integer NOT NULL DEFAULT 0,
  passed_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  waived_items integer NOT NULL DEFAULT 0,
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_onboarding_checklists_plan ON agent_beta_onboarding_checklists(workspace_id, plan_id);

ALTER TABLE agent_beta_onboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_onboarding_checklists"
  ON agent_beta_onboarding_checklists FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_onboarding_checklists"
  ON agent_beta_onboarding_checklists FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_beta_onboarding_checklists"
  ON agent_beta_onboarding_checklists FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Onboarding Checklist Items ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  checklist_id uuid NOT NULL REFERENCES agent_beta_onboarding_checklists(id),
  item_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  title text NOT NULL DEFAULT '',
  notes text,
  waived_reason text,
  checked_at timestamptz,
  safe_item_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_checklist_items_checklist ON agent_beta_onboarding_checklist_items(workspace_id, checklist_id);

ALTER TABLE agent_beta_onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_checklist_items"
  ON agent_beta_onboarding_checklist_items FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_checklist_items"
  ON agent_beta_onboarding_checklist_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta User Readiness ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_user_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  role text NOT NULL,
  fictional_user_label text NOT NULL DEFAULT '',
  known_limitations jsonb NOT NULL DEFAULT '[]',
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_user_readiness_plan ON agent_beta_user_readiness(workspace_id, plan_id);

ALTER TABLE agent_beta_user_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_user_readiness"
  ON agent_beta_user_readiness FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_user_readiness"
  ON agent_beta_user_readiness FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Invitation Readiness ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_invitation_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  invitation_count integer NOT NULL DEFAULT 0,
  safe_invitation_template_json jsonb NOT NULL DEFAULT '{}',
  reviewed_at timestamptz,
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_invitation_readiness_plan ON agent_beta_invitation_readiness(workspace_id, plan_id);

ALTER TABLE agent_beta_invitation_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_invitation_readiness"
  ON agent_beta_invitation_readiness FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_invitation_readiness"
  ON agent_beta_invitation_readiness FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Admin Readiness ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_admin_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  workspace_isolation_verified boolean NOT NULL DEFAULT false,
  rls_verified boolean NOT NULL DEFAULT false,
  export_safety_verified boolean NOT NULL DEFAULT false,
  docs_reviewed boolean NOT NULL DEFAULT false,
  support_path_defined boolean NOT NULL DEFAULT false,
  safe_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_admin_readiness_plan ON agent_beta_admin_readiness(workspace_id, plan_id);

ALTER TABLE agent_beta_admin_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_admin_readiness"
  ON agent_beta_admin_readiness FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_admin_readiness"
  ON agent_beta_admin_readiness FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Tenant Readiness Validations ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_tenant_readiness_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'pending',
  check_name text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  warnings jsonb NOT NULL DEFAULT '[]',
  findings jsonb NOT NULL DEFAULT '[]',
  waived_reason text,
  safe_validation_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_readiness_validations_plan ON agent_tenant_readiness_validations(workspace_id, plan_id);

ALTER TABLE agent_tenant_readiness_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_tenant_readiness_validations"
  ON agent_tenant_readiness_validations FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_tenant_readiness_validations"
  ON agent_tenant_readiness_validations FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Gates ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  status text NOT NULL DEFAULT 'created',
  open_blocker_count integer NOT NULL DEFAULT 0,
  critical_blocker_count integer NOT NULL DEFAULT 0,
  safe_gate_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_gates_plan ON agent_beta_readiness_gates(workspace_id, plan_id);

ALTER TABLE agent_beta_readiness_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_gates"
  ON agent_beta_readiness_gates FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_gates"
  ON agent_beta_readiness_gates FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_beta_readiness_gates"
  ON agent_beta_readiness_gates FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Decisions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  gate_id uuid NOT NULL REFERENCES agent_beta_readiness_gates(id),
  decision_type text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  decided_by_id text,
  safe_decision_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_decisions_gate ON agent_beta_readiness_decisions(workspace_id, gate_id);

ALTER TABLE agent_beta_readiness_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_decisions"
  ON agent_beta_readiness_decisions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_decisions"
  ON agent_beta_readiness_decisions FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Blockers ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  blocker_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  safe_blocker_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_blockers_plan ON agent_beta_readiness_blockers(workspace_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_beta_readiness_blockers_status ON agent_beta_readiness_blockers(workspace_id, status);

ALTER TABLE agent_beta_readiness_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_blockers"
  ON agent_beta_readiness_blockers FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_blockers"
  ON agent_beta_readiness_blockers FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_beta_readiness_blockers"
  ON agent_beta_readiness_blockers FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Remediation Items ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_remediation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  blocker_id uuid REFERENCES agent_beta_readiness_blockers(id),
  remediation_type text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  safe_remediation_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_remediation_items_plan ON agent_beta_readiness_remediation_items(workspace_id, plan_id);

ALTER TABLE agent_beta_readiness_remediation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_remediation_items"
  ON agent_beta_readiness_remediation_items FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_remediation_items"
  ON agent_beta_readiness_remediation_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_update_beta_remediation_items"
  ON agent_beta_readiness_remediation_items FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Exports ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES agent_beta_readiness_plans(id),
  export_format text NOT NULL,
  export_status text NOT NULL DEFAULT 'created',
  safe_export_content text NOT NULL DEFAULT '',
  export_size_bytes integer NOT NULL DEFAULT 0,
  safety_validation_passed boolean NOT NULL DEFAULT false,
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_exports_plan ON agent_beta_readiness_exports(workspace_id, plan_id);

ALTER TABLE agent_beta_readiness_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_exports"
  ON agent_beta_readiness_exports FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_exports"
  ON agent_beta_readiness_exports FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ─── Beta Readiness Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_beta_readiness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  plan_id uuid REFERENCES agent_beta_readiness_plans(id),
  event_type text NOT NULL,
  message text,
  safe_event_payload_json jsonb NOT NULL DEFAULT '{}',
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_readiness_events_workspace ON agent_beta_readiness_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_beta_readiness_events_plan ON agent_beta_readiness_events(workspace_id, plan_id);

ALTER TABLE agent_beta_readiness_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_beta_readiness_events"
  ON agent_beta_readiness_events FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "workspace_member_insert_beta_readiness_events"
  ON agent_beta_readiness_events FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
