import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DECISION_ALLOWED_TRANSITIONS,
  DECISION_TERMINAL_STATES,
  validateDecisionTransition,
} from '../src/lib/project-constitution/decision-state-machine.ts';
import { explainConstitutionalDecisionGovernance } from '../src/lib/project-constitution/decision-explanation.ts';

const types = readFileSync('src/lib/project-constitution/decision-types.ts', 'utf8');
const service = readFileSync('src/lib/project-constitution/decision-service.ts', 'utf8');
const stateMachine = readFileSync('src/lib/project-constitution/decision-state-machine.ts', 'utf8');
const impactAnalysis = readFileSync('src/lib/project-constitution/decision-impact-analysis.ts', 'utf8');
const amendmentIntegration = readFileSync('src/lib/project-constitution/decision-amendment-integration.ts', 'utf8');
const explanation = readFileSync('src/lib/project-constitution/decision-explanation.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260625000000_project_constitutional_decision_governance.sql', 'utf8');
const dbContract = readFileSync('src/lib/db/database-contract.ts', 'utf8');
const platformEvents = readFileSync('src/lib/platform-events/types.ts', 'utf8');
const docs = readFileSync('docs/project-constitutional-decision-governance.md', 'utf8');

// ─── Decision Lifecycle: valid transitions ────────────────────────────────────

test('state machine allows all valid decision transitions', () => {
  const validPairs = [
    ['draft', 'proposed'],
    ['draft', 'cancelled'],
    ['proposed', 'approved'],
    ['proposed', 'rejected'],
    ['proposed', 'cancelled'],
    ['approved', 'executed'],
    ['approved', 'cancelled'],
  ];
  for (const [from, to] of validPairs) {
    const result = validateDecisionTransition(from, to);
    assert.equal(result.ok, true, `${from} -> ${to} should be valid`);
  }
});

// ─── Decision Lifecycle: invalid transitions ──────────────────────────────────

test('state machine rejects invalid and terminal decision transitions', () => {
  const invalidPairs = [
    ['draft', 'approved'],
    ['draft', 'executed'],
    ['draft', 'rejected'],
    ['proposed', 'executed'],
    ['rejected', 'draft'],
    ['rejected', 'proposed'],
    ['executed', 'draft'],
    ['executed', 'approved'],
    ['cancelled', 'draft'],
    ['cancelled', 'approved'],
  ];
  for (const [from, to] of invalidPairs) {
    const result = validateDecisionTransition(from, to);
    assert.equal(result.ok, false, `${from} -> ${to} should be invalid`);
    assert.equal(result.error.code, 'invalid_decision_transition');
  }
});

// ─── Terminal states ──────────────────────────────────────────────────────────

test('terminal states are rejected, executed, cancelled', () => {
  assert.equal(DECISION_TERMINAL_STATES.has('rejected'), true);
  assert.equal(DECISION_TERMINAL_STATES.has('executed'), true);
  assert.equal(DECISION_TERMINAL_STATES.has('cancelled'), true);
  assert.equal(DECISION_TERMINAL_STATES.has('draft'), false);
  assert.equal(DECISION_TERMINAL_STATES.has('proposed'), false);
  assert.equal(DECISION_TERMINAL_STATES.has('approved'), false);
  assert.equal(DECISION_ALLOWED_TRANSITIONS.rejected.length, 0);
  assert.equal(DECISION_ALLOWED_TRANSITIONS.executed.length, 0);
  assert.equal(DECISION_ALLOWED_TRANSITIONS.cancelled.length, 0);
});

// ─── Decision types ───────────────────────────────────────────────────────────

test('all 12 decision types are declared in database contract', () => {
  for (const t of ['scope', 'schedule', 'cost', 'quality', 'risk', 'resource',
                   'architecture', 'governance', 'constitutional', 'technical', 'vendor', 'operational']) {
    assert.match(dbContract, new RegExp(`"${t}"`));
  }
});

// ─── Decision authorities ─────────────────────────────────────────────────────

test('all 8 decision authorities are declared in database contract', () => {
  for (const a of ['sponsor', 'project_manager', 'steering_committee', 'governance_board',
                   'product_owner', 'client', 'architect', 'technical_lead']) {
    assert.match(dbContract, new RegExp(`"${a}"`));
  }
});

// ─── Evidence types ───────────────────────────────────────────────────────────

test('all 10 evidence types are declared in database contract', () => {
  for (const e of ['document', 'email', 'meeting', 'risk', 'issue',
                   'change_request', 'file', 'link', 'chat', 'approval']) {
    assert.match(dbContract, new RegExp(`"${e}"`));
  }
});

// ─── Link types ───────────────────────────────────────────────────────────────

test('all 8 link types are declared in database contract', () => {
  for (const l of ['objective', 'constraint', 'amendment', 'risk', 'issue',
                   'milestone', 'deliverable', 'constitution_version']) {
    assert.match(dbContract, new RegExp(`"${l}"`));
  }
});

// ─── Decision Options: uniqueness rule ────────────────────────────────────────

test('selectDecisionOption deselects all before selecting one (uniqueness)', () => {
  assert.match(service, /update\({ selected: false }\)/);
  assert.match(service, /update\({ selected: true }\)/);
  assert.match(service, /eq\("decision_id", input\.decisionId\)/);
});

test('addDecisionOption inserts with selected false', () => {
  assert.match(service, /selected: false/);
});

// ─── Approval requires selected option ────────────────────────────────────────

test('approveDecision validates selected option exists before approving', () => {
  assert.match(service, /eq\("selected", true\)/);
  assert.match(service, /Cannot approve a constitutional decision without a selected option/);
  assert.match(service, /governance_violation/);
});

// ─── Evidence attachment ──────────────────────────────────────────────────────

test('attachDecisionEvidence persists evidence and emits event', () => {
  assert.match(service, /\.from\("constitutional_decision_evidence"\)/);
  assert.match(service, /CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED/);
  assert.match(service, /rawReferenceTable: "constitutional_decision_evidence"/);
});

// ─── Constitutional links ─────────────────────────────────────────────────────

test('linkDecisionEntity persists link and emits event', () => {
  assert.match(service, /\.from\("constitutional_decision_links"\)/);
  assert.match(service, /CONSTITUTIONAL_DECISION_LINK_CREATED/);
  assert.match(service, /rawReferenceTable: "constitutional_decision_links"/);
});

// ─── Impact analysis ──────────────────────────────────────────────────────────

test('generateDecisionImpactAnalysis categorises links by type', () => {
  assert.match(impactAnalysis, /affectedObjectives/);
  assert.match(impactAnalysis, /affectedConstraints/);
  assert.match(impactAnalysis, /relatedRisks/);
  assert.match(impactAnalysis, /relatedAmendments/);
  assert.match(impactAnalysis, /relatedDeliverables/);
  assert.match(impactAnalysis, /relatedMilestones/);
  assert.match(impactAnalysis, /totalImpactedEntities/);
});

// ─── Amendment integration ────────────────────────────────────────────────────

test('generateAmendmentFromDecision rejects non-approved decisions', () => {
  assert.match(amendmentIntegration, /status !== "approved" && decision\.status !== "executed"/);
  assert.match(amendmentIntegration, /Cannot generate an amendment from a decision in status/);
  assert.match(amendmentIntegration, /governance_violation/);
});

test('generateAmendmentFromDecision creates amendment and links back to decision', () => {
  assert.match(amendmentIntegration, /createAmendment\(/);
  assert.match(amendmentIntegration, /linkDecisionEntity\(/);
  assert.match(amendmentIntegration, /linkType: "amendment"/);
  assert.match(amendmentIntegration, /CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED/);
});

// ─── Traceability ─────────────────────────────────────────────────────────────

test('traceDecisionLineage returns full lineage: decision, options, evidence, links, timeline', () => {
  assert.match(service, /export async function traceDecisionLineage/);
  assert.match(service, /decision: decision\.data/);
  assert.match(service, /options:.*optionsResult\.data/);
  assert.match(service, /evidence:.*evidenceResult\.data/);
  assert.match(service, /links:.*linksResult\.data/);
  assert.match(service, /timeline: timelineResult\.data/);
});

test('getDecisionTimeline returns timeline entries with date, actor, action, status', () => {
  assert.match(service, /export async function getDecisionTimeline/);
  assert.match(service, /action: "created"/);
  assert.match(service, /action: "approved"/);
  assert.match(service, /action: "executed"/);
  assert.match(service, /action: "cancelled"/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('all 12 constitutional decision audit events are declared in platform events', () => {
  for (const event of [
    'CONSTITUTIONAL_DECISION_CREATED',
    'CONSTITUTIONAL_DECISION_UPDATED',
    'CONSTITUTIONAL_DECISION_PROPOSED',
    'CONSTITUTIONAL_DECISION_APPROVED',
    'CONSTITUTIONAL_DECISION_REJECTED',
    'CONSTITUTIONAL_DECISION_EXECUTED',
    'CONSTITUTIONAL_DECISION_CANCELLED',
    'CONSTITUTIONAL_DECISION_OPTION_ADDED',
    'CONSTITUTIONAL_DECISION_OPTION_SELECTED',
    'CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED',
    'CONSTITUTIONAL_DECISION_LINK_CREATED',
    'CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED',
  ]) {
    assert.match(platformEvents, new RegExp(`"${event}"`));
  }
});

test('ConstitutionalDecisionEventType is included in PlatformEventType union', () => {
  assert.match(platformEvents, /ConstitutionalDecisionEventType/);
  assert.match(platformEvents, /\| ConstitutionalDecisionEventType/);
});

// ─── Workspace isolation ──────────────────────────────────────────────────────

test('all service operations enforce workspace isolation via eq workspace_id', () => {
  const workspaceIsolationCount = (service.match(/\.eq\("workspace_id"/g) || []).length;
  assert.ok(workspaceIsolationCount >= 10, `Expected >= 10 workspace_id filters, found ${workspaceIsolationCount}`);
});

test('migration enables RLS on all four tables', () => {
  const rlsCount = (migration.match(/enable row level security/g) || []).length;
  assert.equal(rlsCount, 4, `Expected 4 RLS enablements, found ${rlsCount}`);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

// ─── Database contract ────────────────────────────────────────────────────────

test('database contract declares all four new tables with correct columns', () => {
  assert.match(dbContract, /ConstitutionalDecisionRow/);
  assert.match(dbContract, /ConstitutionalDecisionOptionRow/);
  assert.match(dbContract, /ConstitutionalDecisionEvidenceRow/);
  assert.match(dbContract, /ConstitutionalDecisionLinkRow/);
  assert.match(dbContract, /CONSTITUTIONAL_DECISION_SELECTABLE_COLUMNS/);
  assert.match(dbContract, /CONSTITUTIONAL_DECISION_OPTION_SELECTABLE_COLUMNS/);
  assert.match(dbContract, /CONSTITUTIONAL_DECISION_EVIDENCE_SELECTABLE_COLUMNS/);
  assert.match(dbContract, /CONSTITUTIONAL_DECISION_LINK_SELECTABLE_COLUMNS/);
});

test('database contract version includes sprint 4 marker', () => {
  assert.match(dbContract, /project-constitutional-decision-governance/);
});

// ─── Migration schema ─────────────────────────────────────────────────────────

test('migration creates constitutional_decisions with all required columns', () => {
  assert.match(migration, /create table if not exists public\.constitutional_decisions/);
  for (const col of ['workspace_id', 'constitution_id', 'title', 'decision_type',
                     'decision_authority', 'status', 'context', 'problem_statement',
                     'recommended_option', 'selected_option', 'created_by', 'approved_by',
                     'executed_by', 'cancelled_by', 'deleted_at']) {
    assert.match(migration, new RegExp(col));
  }
});

test('migration creates constitutional_decision_options with selected column', () => {
  assert.match(migration, /create table if not exists public\.constitutional_decision_options/);
  assert.match(migration, /selected.*boolean not null default false/);
  assert.match(migration, /estimated_cost/);
  assert.match(migration, /estimated_effort/);
});

test('migration creates constitutional_decision_evidence with evidence_type check', () => {
  assert.match(migration, /create table if not exists public\.constitutional_decision_evidence/);
  assert.match(migration, /evidence_type.*in \(/);
  for (const e of ['document', 'email', 'meeting', 'risk', 'issue']) {
    assert.match(migration, new RegExp(`'${e}'`));
  }
});

test('migration creates constitutional_decision_links with link_type check', () => {
  assert.match(migration, /create table if not exists public\.constitutional_decision_links/);
  assert.match(migration, /link_type.*in \(/);
  for (const l of ['objective', 'constraint', 'amendment', 'risk', 'milestone', 'deliverable']) {
    assert.match(migration, new RegExp(`'${l}'`));
  }
});

test('migration enforces composite FK workspace isolation on all tables', () => {
  const compositeFkCount = (migration.match(/constitutional_decisions.*workspace_id.*on delete cascade/gs) || []).length
    + (migration.match(/workspace_decision_fkey/g) || []).length;
  assert.ok(compositeFkCount >= 3, `Expected composite FK workspace isolation, found ${compositeFkCount}`);
});

// ─── Explain capability ───────────────────────────────────────────────────────

test('explainConstitutionalDecisionGovernance returns complete governance explanation', () => {
  const exp = explainConstitutionalDecisionGovernance();
  assert.ok(exp.whatIsAConstitutionalDecision.length > 0);
  assert.equal(exp.decisionAuthorities.length, 8);
  assert.equal(exp.evidenceTypes.length, 10);
  assert.equal(exp.linkTypes.length, 8);
  assert.equal(exp.states.length, 6);
  assert.equal(exp.terminalStates.length, 3);
  assert.equal(exp.auditEvents.length, 12);
  assert.ok(exp.governanceRules.length >= 14);
  assert.ok(exp.traceability.length > 0);
  assert.ok(exp.amendmentIntegration.length > 0);
  assert.ok(exp.constitutionIntegration.length > 0);
});

test('explain states match state machine transitions', () => {
  const exp = explainConstitutionalDecisionGovernance();
  for (const stateDesc of exp.states) {
    assert.deepEqual(
      stateDesc.allowedTransitions,
      DECISION_ALLOWED_TRANSITIONS[stateDesc.status],
      `State ${stateDesc.status} transitions mismatch`,
    );
    assert.equal(stateDesc.terminal, DECISION_TERMINAL_STATES.has(stateDesc.status));
  }
});

// ─── Service exports ──────────────────────────────────────────────────────────

test('service exports all required capabilities', () => {
  for (const fn of [
    'createConstitutionalDecision',
    'updateConstitutionalDecision',
    'addDecisionOption',
    'selectDecisionOption',
    'attachDecisionEvidence',
    'linkDecisionEntity',
    'proposeDecision',
    'approveDecision',
    'rejectDecision',
    'executeDecision',
    'cancelDecision',
    'listConstitutionalDecisions',
    'getDecisionTimeline',
    'traceDecisionLineage',
    'explainConstitutionalDecisionGovernance',
    'generateDecisionImpactAnalysis',
    'generateAmendmentFromDecision',
  ]) {
    assert.match(service, new RegExp(`${fn}`));
  }
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('documentation covers all major concepts', () => {
  for (const phrase of [
    'Decision Governance',
    'Decision Authorities',
    'Evidence',
    'Impact Analysis',
    'Amendment',
    'Traceability',
    'State Machine',
    'Workspace Isolation',
    'Audit',
  ]) {
    assert.match(docs, new RegExp(phrase), `Docs missing: ${phrase}`);
  }
});
