-- Chat isolation scenario per sprint section 7: Workspace A/B, PMO1/PMO2, Alpha/Beta/Gamma/Delta.

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'a@example.com'),
  ('40000000-0000-0000-0000-000000000002', 'b@example.com');

insert into workspaces (id, name, created_by_user_id, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Workspace A', '40000000-0000-0000-0000-000000000001', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Workspace B', '40000000-0000-0000-0000-000000000002', 'active');

insert into workspace_memberships (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '40000000-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '40000000-0000-0000-0000-000000000002', 'owner');

-- PMO1 (Alpha+Beta) and PMO2 (Gamma) both in Workspace A; Workspace B has its own PMO (Delta project).
insert into pmos (id, workspace_id, name, pmo_type, created_by_user_id) values
  ('20000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'PMO1', 'company_pmo', '40000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'PMO2', 'company_pmo', '40000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'PMO-B', 'company_pmo', '40000000-0000-0000-0000-000000000002');

insert into projects (id, user_id, workspace_id, pmo_id, name, description, status) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '20000000-0000-0000-0000-000000000001', 'Project Alpha', 'Alpha description', 'active'),
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '20000000-0000-0000-0000-000000000001', 'Project Beta', 'Beta description', 'active'),
  ('10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '20000000-0000-0000-0000-000000000002', 'Project Gamma', 'Gamma description', 'active'),
  ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '20000000-0000-0000-0000-000000000003', 'Project Delta', 'Delta description', 'active');

insert into vault_documents (id, workspace_id, project_id, title, source_type, classification, raw_content, normalized_content, ingestion_status, created_by) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '10000000-0000-0000-0000-000000000001', 'Alpha doc', 'meeting_notes', 'operational', 'note', 'note', 'completed', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '10000000-0000-0000-0000-000000000003', 'Gamma doc', 'meeting_notes', 'operational', 'note', 'note', 'completed', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '30000000-0000-0000-0000-000000000001', 'Delta doc', 'meeting_notes', 'operational', 'note', 'note', 'completed', '40000000-0000-0000-0000-000000000002');

-- Secret markers embedded in `title` — the only raid_items column the real
-- responder (context-chat-responder.ts loadScopeData) actually selects.
insert into raid_items (id, workspace_id, project_id, source_document_id, category, title, description, status, fingerprint) values
  ('60000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'risk', 'Codigo secreto de validacion: ALPHA-4729', 'Alpha secret risk description', 'open', 'fp-alpha-secret'),
  ('60000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '10000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', 'risk', 'Codigo secreto: GAMMA-7731', 'Gamma secret risk description', 'open', 'fp-gamma-secret'),
  ('60000000-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004', 'risk', 'Codigo secreto: DELTA-2266', 'Delta secret risk description', 'open', 'fp-delta-secret');
