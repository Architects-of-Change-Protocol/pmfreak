/**
 * Founder Circle Program — feedback ownership, eligibility, validation,
 * triage, and the feedback_active promotion.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  listOwnFounderFeedback,
  submitFounderFeedback,
  triageFounderFeedback,
  validateFounderFeedbackInput,
} from "../src/lib/founder-program/feedback";
import { createFounderFakeDb, type FounderFakeDb } from "./founder-program-test-helpers";

function seedParticipant(db: FounderFakeDb, state: string, userId: string, extra: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  db.tables.founder_participants.push({
    id,
    invitation_id: crypto.randomUUID(),
    user_id: userId,
    email: `${id.slice(0, 8)}@example.com`,
    archetype: "consultant",
    lifecycle_state: state,
    workspace_id: extra.workspace_id ?? null,
    agreement_version_accepted: null,
    cohort: null,
    ...extra,
  });
  return id;
}

const validFeedback = () => {
  const validated = validateFounderFeedbackInput({
    feedbackType: "defect",
    severity: "high",
    productArea: "command-center",
    body: "The task list loses my filter after refresh.",
    allowContact: true,
  });
  assert.ok(validated.ok);
  return validated.value;
};

test("validation enforces type/severity enums and body bounds", () => {
  assert.equal(validateFounderFeedbackInput({ feedbackType: "rant", body: "x" }).ok, false);
  assert.equal(validateFounderFeedbackInput({ feedbackType: "defect", body: "" }).ok, false);
  assert.equal(validateFounderFeedbackInput({ feedbackType: "defect", body: "x".repeat(4001) }).ok, false);
  assert.equal(validateFounderFeedbackInput({ feedbackType: "defect", body: "ok", productArea: "x".repeat(121) }).ok, false);
  const defaulted = validateFounderFeedbackInput({ feedbackType: "general", body: "fine", severity: "not-a-severity" });
  assert.ok(defaulted.ok && defaulted.value.severity === "medium", "unknown severity falls back to medium");
});

test("non-participants and terminal-state participants cannot submit", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const stranger = await submitFounderFeedback({ userId: "stranger", feedback: validFeedback() }, { client: db.client as never });
  assert.equal(stranger.ok === false && stranger.code, "not_a_participant");

  seedParticipant(db, "revoked", "revoked-user");
  const revoked = await submitFounderFeedback({ userId: "revoked-user", feedback: validFeedback() }, { client: db.client as never });
  assert.equal(revoked.ok === false && revoked.code, "not_eligible");
});

test("submission stores the participant's own workspace, never a client-supplied one", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  seedParticipant(db, "activated", "user-1", { workspace_id: "ws-own" });
  const feedback = { ...validFeedback(), workspaceId: "ws-foreign" };
  const result = await submitFounderFeedback({ userId: "user-1", feedback }, { client: db.client as never });
  assert.equal(result.ok, true);
  assert.equal(db.tables.founder_feedback[0].workspace_id, "ws-own");
});

test("first feedback promotes activated → feedback_active and records the checkpoint", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const id = seedParticipant(db, "activated", "user-1", { workspace_id: "ws-1" });
  const result = await submitFounderFeedback({ userId: "user-1", feedback: validFeedback() }, { client: db.client as never });
  assert.equal(result.ok, true);
  assert.equal(db.tables.founder_participants.find((p) => p.id === id)?.lifecycle_state, "feedback_active");
  assert.ok(db.tables.founder_onboarding_checkpoints.some((c) => c.checkpoint === "first_feedback_submitted"));

  // A second feedback stays in feedback_active without a duplicate transition.
  const second = await submitFounderFeedback({ userId: "user-1", feedback: validFeedback() }, { client: db.client as never });
  assert.equal(second.ok, true);
  assert.equal(db.tables.founder_membership_transitions.filter((t) => t.to_state === "feedback_active").length, 1);
});

test("participants read ONLY their own feedback, and never internal triage fields", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  seedParticipant(db, "activated", "user-a", { workspace_id: "ws-a" });
  seedParticipant(db, "activated", "user-b", { workspace_id: "ws-b" });
  await submitFounderFeedback({ userId: "user-a", feedback: validFeedback() }, { client: db.client as never });
  await submitFounderFeedback({ userId: "user-b", feedback: validFeedback() }, { client: db.client as never });

  db.tables.founder_feedback.forEach((row) => {
    row.internal_notes = "internal-only triage note";
    row.internal_owner_user_id = "op-1";
  });

  const own = await listOwnFounderFeedback("user-a", { client: db.client as never });
  assert.equal(own.length, 1);
  const serialized = JSON.stringify(own);
  assert.ok(!serialized.includes("internal-only triage note"), "internal notes must never reach a participant");
  assert.ok(!serialized.includes("internal_owner_user_id"));
});

test("triage updates status/owner/notes, validates status, and 404s on unknown ids", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  seedParticipant(db, "activated", "user-1", { workspace_id: "ws-1" });
  await submitFounderFeedback({ userId: "user-1", feedback: validFeedback() }, { client: db.client as never });
  const feedbackId = String(db.tables.founder_feedback[0].id);

  const badStatus = await triageFounderFeedback(
    { feedbackId, operatorUserId: "op-1", status: "wontfix" as never },
    { client: db.client as never },
  );
  assert.equal(badStatus.ok === false && badStatus.code, "invalid_status");

  const triaged = await triageFounderFeedback(
    { feedbackId, operatorUserId: "op-1", status: "triaged", internalOwnerUserId: "op-1", internalNotes: "dup of X", resolutionRef: "PR #500" },
    { client: db.client as never },
  );
  assert.equal(triaged.ok, true);
  assert.equal(db.tables.founder_feedback[0].status, "triaged");
  assert.equal(db.tables.founder_feedback[0].internal_owner_user_id, "op-1");

  const missing = await triageFounderFeedback(
    { feedbackId: crypto.randomUUID(), operatorUserId: "op-1", status: "resolved" },
    { client: db.client as never },
  );
  assert.equal(missing.ok === false && missing.code, "not_found");
});
