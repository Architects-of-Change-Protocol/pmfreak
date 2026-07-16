/**
 * Founder Circle Program — operator review, capacity enforcement, agreement
 * gating, controlled activation, and pause/resume/revoke behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  activateFounderParticipant,
  applyFounderLifecycleAction,
  reviewFounderParticipant,
  syncFounderAgreementAcceptance,
  reconcileFounderAgreementVersion,
} from "../src/lib/founder-program/admission";
import { recordFounderCheckpoint } from "../src/lib/founder-program/checkpoints";
import { parseFounderProgramSettingsRow } from "../src/lib/founder-program/config";
import { createFounderFakeDb, type FounderFakeDb } from "./founder-program-test-helpers";

const settings = (overrides: Record<string, unknown> = {}) => {
  const parsed = parseFounderProgramSettingsRow({
    display_name: "PMFreak Founder Circle",
    program_enabled: true,
    invite_only: true,
    applications_enabled: true,
    max_approved_participants: 10,
    max_active_participants: 5,
    max_invitations_per_batch: 5,
    invitation_expiry_days: 7,
    required_agreement_version: "0.1-draft",
    required_onboarding_version: "v1",
    capability_profile: "pilot",
    support_contact: null,
    feedback_cadence_days: 14,
    program_starts_on: null,
    review_due_on: null,
    ...overrides,
  });
  assert.ok(parsed);
  return parsed;
};

function seedParticipant(db: FounderFakeDb, state: string, extra: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  db.tables.founder_participants.push({
    id,
    invitation_id: crypto.randomUUID(),
    user_id: extra.user_id ?? crypto.randomUUID(),
    email: `${id.slice(0, 8)}@example.com`,
    archetype: "independent_pm",
    lifecycle_state: state,
    workspace_id: null,
    agreement_version_accepted: null,
    cohort: null,
    ...extra,
  });
  return id;
}

test("approve moves applied → approved → agreement_pending with an approved checkpoint", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "applied", { user_id: userId });

  const result = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "approve" },
    { client: db.client as never },
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.state, "agreement_pending");
  const participant = db.tables.founder_participants.find((p) => p.id === id);
  assert.equal(participant?.lifecycle_state, "agreement_pending");
  assert.deepEqual(
    db.tables.founder_membership_transitions.map((t) => t.to_state),
    ["approved", "agreement_pending"],
  );
  assert.ok(db.tables.founder_onboarding_checkpoints.some((c) => c.checkpoint === "approved"));
});

test("reject and waitlist demand a reason; start_review does not", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const id = seedParticipant(db, "applied");

  const rejected = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "reject" },
    { client: db.client as never },
  );
  assert.equal(rejected.ok === false && rejected.code, "reason_required");

  const started = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "start_review" },
    { client: db.client as never },
  );
  assert.equal(started.ok, true);

  const waitlisted = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "waitlist", reason: "cohort full" },
    { client: db.client as never },
  );
  assert.equal(waitlisted.ok, true);
});

test("approval capacity is enforced and an explicit override bypasses it (audited)", async () => {
  const db = createFounderFakeDb();
  db.seedSettings({ max_approved_participants: 1 });
  seedParticipant(db, "approved");
  const id = seedParticipant(db, "applied");

  const blocked = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "approve" },
    { client: db.client as never },
  );
  assert.equal(blocked.ok === false && blocked.code, "capacity_reached");

  const overridden = await reviewFounderParticipant(
    { participantId: id, operatorUserId: "op-1", decision: "approve", capacityOverride: true, reason: "capacity_override" },
    { client: db.client as never },
  );
  assert.equal(overridden.ok, true);
  const auditRow = db.tables.founder_membership_transitions.find((t) => t.to_state === "approved");
  assert.equal(auditRow?.reason, "capacity_override");
});

test("agreement acceptance advances agreement_pending → onboarding_pending; stale versions do not", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "agreement_pending", { user_id: userId });

  await syncFounderAgreementAcceptance(
    { userId, agreementVersion: "0.0-old", requiredAgreementVersion: "0.1-draft" },
    { client: db.client as never },
  );
  assert.equal(db.tables.founder_participants.find((p) => p.id === id)?.lifecycle_state, "agreement_pending");

  await syncFounderAgreementAcceptance(
    { userId, agreementVersion: "0.1-draft", requiredAgreementVersion: "0.1-draft" },
    { client: db.client as never },
  );
  const participant = db.tables.founder_participants.find((p) => p.id === id);
  assert.equal(participant?.lifecycle_state, "onboarding_pending");
  assert.equal(participant?.agreement_version_accepted, "0.1-draft");
  assert.ok(db.tables.founder_onboarding_checkpoints.some((c) => c.checkpoint === "agreement_accepted"));
});

test("acceptance by a non-participant is a silent no-op", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  await syncFounderAgreementAcceptance(
    { userId: "stranger", agreementVersion: "0.1-draft", requiredAgreementVersion: "0.1-draft" },
    { client: db.client as never },
  );
  assert.equal(db.tables.founder_membership_transitions.length, 0);
});

test("activation requires onboarding_pending, a bound user, and a CURRENT agreement acceptance", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();

  const notReady = seedParticipant(db, "applied", { user_id: userId });
  const early = await activateFounderParticipant(
    { participantId: notReady, operatorUserId: "op-1", settings: settings() },
    { client: db.client as never, hasCurrentAgreementAcceptance: async () => true, ensureWorkspace: async () => ({ workspaceId: "ws-1" }) },
  );
  assert.equal(early.ok === false && early.code, "not_ready_for_activation");

  const ready = seedParticipant(db, "onboarding_pending", { user_id: crypto.randomUUID() });
  const noAgreement = await activateFounderParticipant(
    { participantId: ready, operatorUserId: "op-1", settings: settings() },
    { client: db.client as never, hasCurrentAgreementAcceptance: async () => false, ensureWorkspace: async () => ({ workspaceId: "ws-1" }) },
  );
  assert.equal(noAgreement.ok === false && noAgreement.code, "agreement_not_accepted");

  const unbound = seedParticipant(db, "onboarding_pending", { user_id: null });
  const noUser = await activateFounderParticipant(
    { participantId: unbound, operatorUserId: "op-1", settings: settings() },
    { client: db.client as never, hasCurrentAgreementAcceptance: async () => true, ensureWorkspace: async () => ({ workspaceId: "ws-1" }) },
  );
  assert.equal(noUser.ok === false && noUser.code, "no_bound_user");
});

test("successful activation associates the workspace, records checkpoints, and is idempotent", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "onboarding_pending", { user_id: userId });
  let ensureCalls = 0;

  const deps = {
    client: db.client as never,
    hasCurrentAgreementAcceptance: async () => true,
    ensureWorkspace: async () => {
      ensureCalls += 1;
      return { workspaceId: "ws-real" };
    },
  };

  const first = await activateFounderParticipant({ participantId: id, operatorUserId: "op-1", settings: settings() }, deps);
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.workspaceId, "ws-real");
  assert.equal(first.ok && first.alreadyActive, false);

  const participant = db.tables.founder_participants.find((p) => p.id === id);
  assert.equal(participant?.lifecycle_state, "onboarding_active");
  assert.equal(participant?.workspace_id, "ws-real");
  assert.ok(db.tables.founder_onboarding_checkpoints.some((c) => c.checkpoint === "workspace_ready"));

  const second = await activateFounderParticipant({ participantId: id, operatorUserId: "op-1", settings: settings() }, deps);
  assert.equal(second.ok, true);
  assert.equal(second.ok && second.alreadyActive, true);
  assert.equal(ensureCalls, 1, "workspace bootstrap must not run twice");
  assert.equal(db.tables.founder_membership_transitions.filter((t) => t.to_state === "onboarding_active").length, 1);
});

test("activation is blocked at active capacity", async () => {
  const db = createFounderFakeDb();
  db.seedSettings({ max_active_participants: 1 });
  seedParticipant(db, "activated");
  const id = seedParticipant(db, "onboarding_pending", { user_id: crypto.randomUUID() });

  const result = await activateFounderParticipant(
    { participantId: id, operatorUserId: "op-1", settings: settings({ max_active_participants: 1 }) },
    { client: db.client as never, hasCurrentAgreementAcceptance: async () => true, ensureWorkspace: async () => ({ workspaceId: "ws-1" }) },
  );
  assert.equal(result.ok === false && result.code, "capacity_reached");
});

test("activation grants no operator/founder authority — only lifecycle state and workspace association change", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "onboarding_pending", { user_id: userId });
  const before = JSON.stringify(Object.keys(db.tables.founder_participants[0]).sort());

  await activateFounderParticipant(
    { participantId: id, operatorUserId: "op-1", settings: settings() },
    { client: db.client as never, hasCurrentAgreementAcceptance: async () => true, ensureWorkspace: async () => ({ workspaceId: "ws-1" }) },
  );

  const participant = db.tables.founder_participants.find((p) => p.id === id)!;
  assert.equal(JSON.stringify(Object.keys(participant).sort()), before, "no privilege-shaped fields may appear");
  // No role/founder/operator markers exist anywhere in the participant row.
  for (const key of Object.keys(participant)) {
    assert.ok(!/role|founder_access|admin|privilege/.test(key), `unexpected privilege-like column ${key}`);
  }
});

test("pause requires a reason and removes access; resume re-promotes when criteria hold", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "onboarding_active", { user_id: userId, workspace_id: "ws-1" });

  const noReason = await applyFounderLifecycleAction(
    { participantId: id, operatorUserId: "op-1", action: "pause" },
    { client: db.client as never },
  );
  assert.equal(noReason.ok === false && noReason.code, "reason_required");

  const paused = await applyFounderLifecycleAction(
    { participantId: id, operatorUserId: "op-1", action: "pause", reason: "inactivity" },
    { client: db.client as never },
  );
  assert.equal(paused.ok, true);
  assert.ok(db.tables.founder_participants.find((p) => p.id === id)?.paused_at);

  // Satisfy the activation criteria, then resume: system promotion follows.
  for (const checkpoint of ["agreement_accepted", "first_login", "workspace_ready", "first_project_created", "first_core_capability_used"] as const) {
    db.tables.founder_onboarding_checkpoints.push({ id: crypto.randomUUID(), participant_id: id, user_id: userId, checkpoint, reached_at: new Date().toISOString() });
  }
  const resumed = await applyFounderLifecycleAction(
    { participantId: id, operatorUserId: "op-1", action: "resume" },
    { client: db.client as never },
  );
  assert.equal(resumed.ok, true);
  assert.equal(db.tables.founder_participants.find((p) => p.id === id)?.lifecycle_state, "activated");
});

test("revoke requires a reason and is terminal", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const id = seedParticipant(db, "activated", { workspace_id: "ws-1" });

  const revoked = await applyFounderLifecycleAction(
    { participantId: id, operatorUserId: "op-1", action: "revoke", reason: "pilot terms violated" },
    { client: db.client as never },
  );
  assert.equal(revoked.ok, true);

  const resumeAfter = await applyFounderLifecycleAction(
    { participantId: id, operatorUserId: "op-1", action: "resume" },
    { client: db.client as never },
  );
  assert.equal(resumeAfter.ok, false);
});

test("a newer required agreement version regresses pre-access states only", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const pre = seedParticipant(db, "onboarding_pending", { agreement_version_accepted: "0.1-draft" });
  const active = seedParticipant(db, "activated", { agreement_version_accepted: "0.1-draft", workspace_id: "ws-1" });

  const preRow = db.tables.founder_participants.find((p) => p.id === pre)!;
  const regressed = await reconcileFounderAgreementVersion(
    { id: pre, lifecycle_state: "onboarding_pending", agreement_version_accepted: "0.1-draft" },
    "0.2-draft",
    { client: db.client as never },
  );
  assert.equal(regressed, true);
  assert.equal(preRow.lifecycle_state, "agreement_pending");

  const activeRow = db.tables.founder_participants.find((p) => p.id === active)!;
  const untouched = await reconcileFounderAgreementVersion(
    { id: active, lifecycle_state: "activated", agreement_version_accepted: "0.1-draft" },
    "0.2-draft",
    { client: db.client as never },
  );
  assert.equal(untouched, false);
  assert.equal(activeRow.lifecycle_state, "activated", "access states are flagged, never silently downgraded");
});

test("full checkpoint set promotes onboarding_active → activated via the system", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const userId = crypto.randomUUID();
  const id = seedParticipant(db, "onboarding_active", { user_id: userId, workspace_id: "ws-1" });

  for (const checkpoint of ["agreement_accepted", "first_login", "workspace_ready", "first_project_created"] as const) {
    const result = await recordFounderCheckpoint({ participantId: id, userId, checkpoint }, { client: db.client as never });
    assert.equal(result.activationPromoted, false, `${checkpoint} alone must not activate`);
  }
  const final = await recordFounderCheckpoint(
    { participantId: id, userId, checkpoint: "first_core_capability_used" },
    { client: db.client as never },
  );
  assert.equal(final.activationPromoted, true);
  const participant = db.tables.founder_participants.find((p) => p.id === id);
  assert.equal(participant?.lifecycle_state, "activated");
  assert.ok(participant?.activated_at);
  assert.ok(db.tables.founder_onboarding_checkpoints.some((c) => c.checkpoint === "activation_completed"));
});
