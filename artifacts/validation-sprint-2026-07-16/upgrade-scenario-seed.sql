-- Representative pre-refactor state for the upgrade migration proof.
-- Deterministic fixed UUIDs so post-migration assertions can reference them.

-- ─── Users ──────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111101', 'owner-a@example.com'),
  ('11111111-1111-1111-1111-111111111102', 'admin-a@example.com'),
  ('11111111-1111-1111-1111-111111111103', 'pm-a@example.com'),
  ('11111111-1111-1111-1111-111111111104', 'viewer-a@example.com'),
  ('11111111-1111-1111-1111-111111111105', 'owner-b@example.com'),
  ('11111111-1111-1111-1111-111111111106', 'member-c@example.com'); -- belongs to no-project workspace

-- ─── Workspaces ─────────────────────────────────────────────────────────────
-- WS-A: many-project workspace with an activated PMO tenant (governance schema v2)
insert into workspaces (id, name, created_by_user_id, status, command_center_type, owner_type, data_owner, visibility_scope, confidentiality_level, source_context) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Consulting Co PMO', '11111111-1111-1111-1111-111111111101', 'active', 'company_pmo', 'company', '11111111-1111-1111-1111-111111111101', 'command_center', 'internal', 'Grow the delivery portfolio');

-- WS-B: single-project workspace, PMO never configured (command_center_type NULL — bootstrap-only)
insert into workspaces (id, name, created_by_user_id, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Workspace', '11111111-1111-1111-1111-111111111105', 'active');

-- WS-C: workspace with zero projects
insert into workspaces (id, name, created_by_user_id, status, command_center_type, owner_type, data_owner) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'Empty Portfolio', '11111111-1111-1111-1111-111111111106', 'active', 'independent', 'personal', '11111111-1111-1111-1111-111111111106');

-- ─── Memberships (distinct roles) ───────────────────────────────────────────
insert into workspace_memberships (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111101', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111102', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111103', 'pm'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111104', 'viewer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111105', 'owner'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', '11111111-1111-1111-1111-111111111106', 'owner');

-- ─── PMO governance tenant for WS-A (schema_version 2 — activated Command Center) ──
insert into workspace_governance (workspace_id, schema_version, governance_jsonb, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 2, '{"identity":{"pmoName":"Consulting Co PMO","organizationName":"Consulting Co","pmoType":"company_pmo","operatingModel":"centralized"},"vault":{},"governance":{},"agents":[],"contextSeed":{"strategicObjective":"Grow the delivery portfolio"}}'::jsonb, 'active');

-- ─── Projects ───────────────────────────────────────────────────────────────
-- WS-A: 5 projects — mix of active/archived/completed
insert into projects (id, user_id, workspace_id, name, description, status, created_at) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Alpha Rollout', 'ERP phase 1', 'active', now() - interval '90 days'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Beta Migration', 'Data migration', 'active', now() - interval '60 days'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Gamma Legacy', 'Decommission legacy CRM', 'archived', now() - interval '400 days'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Delta Compliance', 'SOC2 program', 'completed', now() - interval '200 days'),
  ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Epsilon Analytics', 'BI platform', 'active', now() - interval '10 days');

-- WS-B: exactly one project
insert into projects (id, user_id, workspace_id, name, description, status, created_at) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111105', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Solo Website Redesign', 'Marketing site refresh', 'active', now() - interval '30 days');

-- WS-C: zero projects (deliberately left empty)

-- ─── Documents (vault_documents) — for two WS-A projects ───────────────────
insert into vault_documents (id, workspace_id, project_id, title, source_type, classification, raw_content, normalized_content, ingestion_status, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000001', 'Kickoff notes', 'meeting_notes', 'operational', 'Kickoff meeting raw text', 'Kickoff meeting normalized text', 'completed', '11111111-1111-1111-1111-111111111103'),
  ('d0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000002', 'Migration risk log', 'risk_log', 'operational', 'Migration risk raw text', 'Migration risk normalized text', 'completed', '11111111-1111-1111-1111-111111111103');

-- ─── RAID items (risks/issues) ──────────────────────────────────────────────
insert into raid_items (id, workspace_id, project_id, source_document_id, category, title, description, status, confidence_score, fingerprint) values
  ('e0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'risk', 'Vendor delay risk', 'Hardware vendor may slip 2 weeks', 'open', 0.7, 'fp-vendor-delay-alpha'),
  ('e0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'issue', 'Data quality issue', 'Source records missing keys', 'open', 0.9, 'fp-data-quality-beta');

-- ─── Existing conversations (runtime_conversation_state) — must be preserved verbatim ──
insert into runtime_conversation_state (id, company_id, workspace_id, project_id, session_key, active_domain, state, message_count, expires_at) values
  ('99999999-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000001', 'copilot-shell-v1', 'risk', '{"note":"pre-existing conversation state"}'::jsonb, 4, now() + interval '30 days');

-- Governance brief (legacy, pre-refactor operational memory)
insert into operational_governance_briefs (id, workspace_id, project_id, brief_payload, confidence_score) values
  ('brief-alpha-0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'a0000000-0000-0000-0000-000000000001', '{"summary":"Alpha Rollout Brief"}'::jsonb, 72);

-- Message analysis (commitments/decisions proxy)
insert into message_analyses (id, project_id, workspace_id, raw_message, audience, tone_score, blame_score, ambiguity_score, overall_risk, decision, ai_output) values
  ('90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'We are committing to the March 1 go-live.', 'sponsor', 0.6, 0.1, 0.2, 0.3, '{"committed_date":"2026-03-01"}'::jsonb, '{}'::jsonb);
