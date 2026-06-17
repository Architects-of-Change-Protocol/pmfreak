import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/20260616000002_evidence_linked_decisions.sql', 'utf8');
const types = readFileSync('src/lib/decision-governance/types.ts', 'utf8');
const service = readFileSync('src/lib/decision-governance/service.ts', 'utf8');
const platformTypes = readFileSync('src/lib/platform-events/types.ts', 'utf8');
const docs = readFileSync('docs/evidence-linked-decisions.md', 'utf8');

test('decision registry migration creates first-class decision and lineage tables', () => {
  assert.match(migration, /create table if not exists public\.project_decisions/);
  assert.match(migration, /create table if not exists public\.decision_evidence_links/);
  assert.match(migration, /create table if not exists public\.decision_outcome_links/);
});

test('decision creation, approval, and rejection statuses are constrained', () => {
  for (const status of ['draft','pending_review','approved','rejected','implemented','expired']) {
    assert.match(migration, new RegExp(`'${status}'`));
    assert.match(types, new RegExp(`"${status}"`));
  }
  assert.match(service, /createDecision/);
  assert.match(service, /approveDecision/);
  assert.match(service, /rejectDecision/);
});

test('evidence linking supports typed relationships without storing evidence content', () => {
  for (const relationship of ['supports','contradicts','required_for','reviewed_during','triggered_by']) {
    assert.match(migration, new RegExp(`'${relationship}'`));
    assert.match(types, new RegExp(`"${relationship}"`));
  }
  assert.match(service, /linkDecisionEvidence/);
  assert.doesNotMatch(migration, /raw_document_text|full_email_body|full_contract_text/);
});

test('decision lifecycle emits platform events', () => {
  for (const event of ['DECISION_CREATED','DECISION_SUBMITTED','DECISION_APPROVED','DECISION_REJECTED','DECISION_IMPLEMENTED','DECISION_EXPIRED']) {
    assert.match(types, new RegExp(`"${event}"`));
    assert.match(platformTypes, new RegExp(`"${event}"`));
    assert.match(service, new RegExp(event));
  }
  assert.match(service, /createPlatformEvent/);
  assert.match(service, /correlationId/);
  assert.match(service, /causationId/);
});

test('audit export and lineage reconstruction APIs are present', () => {
  assert.match(service, /buildDecisionLineage/);
  assert.match(service, /exportDecisionAuditPackage/);
  assert.match(types, /DecisionLineage/);
  assert.match(types, /DecisionAuditPackage/);
});

test('RLS denies cross-workspace access through workspace membership checks', () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /workspace_memberships wm/);
  assert.match(migration, /wm\.role in \('owner','admin','pm'\)/);
});

test('append-only event verification relies on platform_events rather than mutable logs', () => {
  assert.match(service, /getPlatformEvents/);
  assert.match(service, /rawReferenceTable: "project_decisions"/);
  assert.doesNotMatch(service, /\.from\("platform_events"\)\.update|\.from\("platform_events"\)\.delete/);
});

test('documentation explains governance lineage and future memory boundaries', () => {
  assert.match(docs, /Evidence\n  → Recommendation\n    → Human Decision\n      → Approval\n        → Outcome/);
  assert.match(docs, /Organizational Memory/);
  assert.match(docs, /Personal PM Memory/);
  assert.match(docs, /Sovereign Learning/);
  assert.match(docs, /does not build memory/i);
});
