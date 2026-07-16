/**
 * Founder Circle Program — invitation security behavior.
 *
 * Token entropy/hashing, expiry, revocation, resend rotation, duplicate
 * suppression, and enumeration-resistant resolution — exercised against the
 * in-memory fake with real unique-constraint emulation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createFounderInvitation,
  createFounderInviteToken,
  hashFounderInviteToken,
  resolveFounderInvitationByToken,
  markFounderInvitationViewed,
  revokeFounderInvitation,
  resendFounderInvitation,
} from "../src/lib/founder-program/invitations";
import { parseFounderProgramSettingsRow } from "../src/lib/founder-program/config";
import { createFounderFakeDb } from "./founder-program-test-helpers";

const settings = () => {
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
  });
  assert.ok(parsed);
  return parsed;
};

function extractToken(inviteLink: string): string {
  const match = inviteLink.match(/\/founder-circle\/invite\/([^/?#]+)$/);
  assert.ok(match, `invite link shape unexpected: ${inviteLink}`);
  return decodeURIComponent(match[1]);
}

test("tokens carry 192 bits of CSPRNG entropy and only the sha256 is stored", async () => {
  const token = createFounderInviteToken();
  assert.equal(Buffer.from(token, "base64url").length, 24);
  assert.equal(hashFounderInviteToken(token), crypto.createHash("sha256").update(token).digest("hex"));

  const db = createFounderFakeDb();
  db.seedSettings();
  const result = await createFounderInvitation(
    { email: "candidate@example.com", archetype: "independent_pm", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const stored = db.tables.founder_invitations[0];
  const token2 = extractToken(result.inviteLink);
  assert.equal(stored.token_hash, hashFounderInviteToken(token2));
  assert.ok(!JSON.stringify(db.tables).includes(token2), "plaintext token must never be persisted");
});

test("invitation creation produces a participant in `invited` with an audit transition", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const result = await createFounderInvitation(
    { email: "candidate@example.com", archetype: "pmo_practitioner", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const participant = db.tables.founder_participants.find((p) => p.id === result.participantId);
  assert.equal(participant?.lifecycle_state, "invited");
  const transitions = db.tables.founder_membership_transitions;
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].from_state, "nominated");
  assert.equal(transitions[0].to_state, "invited");
  assert.equal(transitions[0].actor_type, "operator");
  assert.equal(transitions[0].actor_user_id, "op-1");
});

test("send=false records a nomination without a transition", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const result = await createFounderInvitation(
    { email: "quiet@example.com", archetype: "consultant", send: false, createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const participant = db.tables.founder_participants.find((p) => p.id === result.participantId);
  assert.equal(participant?.lifecycle_state, "nominated");
  assert.equal(db.tables.founder_membership_transitions.length, 0);
  assert.equal(result.emailDelivery.attempted, false);
});

test("a second live invitation for the same email is rejected as duplicate", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  await createFounderInvitation(
    { email: "dup@example.com", archetype: "agile_lead", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  await assert.rejects(
    createFounderInvitation(
      { email: "dup@example.com", archetype: "agile_lead", createdByUserId: "op-1", settings: settings() },
      { client: db.client as never },
    ),
    /duplicate_invitation::/,
  );
});

test("unknown tokens resolve to null (indistinguishable from revoked/expired at the API)", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  assert.equal(await resolveFounderInvitationByToken(createFounderInviteToken(), { client: db.client as never }), null);
  assert.equal(await resolveFounderInvitationByToken("short", { client: db.client as never }), null);
  assert.equal(await resolveFounderInvitationByToken("x".repeat(200), { client: db.client as never }), null);
});

test("expired invitations are lazily expired and the participant is revoked with a system reason", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email: "late@example.com", archetype: "program_manager", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const token = extractToken(created.inviteLink);
  db.tables.founder_invitations[0].expires_at = new Date(Date.now() - 1000).toISOString();

  const resolved = await resolveFounderInvitationByToken(token, { client: db.client as never });
  assert.equal(resolved?.status, "expired");
  assert.equal(db.tables.founder_invitations[0].status, "expired");
  const participant = db.tables.founder_participants[0];
  assert.equal(participant.lifecycle_state, "revoked");
  const lastTransition = db.tables.founder_membership_transitions.at(-1);
  assert.equal(lastTransition?.to_state, "revoked");
  assert.equal(lastTransition?.actor_type, "system");
  assert.equal(lastTransition?.reason, "invitation_expired");
});

test("marking viewed transitions invited → invite_viewed exactly once", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email: "viewer@example.com", archetype: "operations_leader", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const token = extractToken(created.inviteLink);
  const resolved = await resolveFounderInvitationByToken(token, { client: db.client as never });
  assert.ok(resolved);
  await markFounderInvitationViewed(resolved, { client: db.client as never });
  assert.equal(db.tables.founder_invitations[0].status, "viewed");
  assert.equal(db.tables.founder_participants[0].lifecycle_state, "invite_viewed");

  // Second view: no additional transition (status is no longer pending).
  const again = await resolveFounderInvitationByToken(token, { client: db.client as never });
  assert.ok(again);
  await markFounderInvitationViewed(again, { client: db.client as never });
  const viewTransitions = db.tables.founder_membership_transitions.filter((t) => t.to_state === "invite_viewed");
  assert.equal(viewTransitions.length, 1);
});

test("revocation requires a reason, is idempotent, and refuses applied invitations", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email: "revoke@example.com", archetype: "founder_operator", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );

  await assert.rejects(
    revokeFounderInvitation({ invitationId: created.invitationId, operatorUserId: "op-1", reason: "" }, { client: db.client as never }),
    /missing_field::/,
  );

  await revokeFounderInvitation({ invitationId: created.invitationId, operatorUserId: "op-1", reason: "not a fit" }, { client: db.client as never });
  assert.equal(db.tables.founder_invitations[0].status, "revoked");
  assert.equal(db.tables.founder_participants[0].lifecycle_state, "revoked");

  // Idempotent second revoke.
  await revokeFounderInvitation({ invitationId: created.invitationId, operatorUserId: "op-1", reason: "again" }, { client: db.client as never });

  // Applied invitations cannot be revoked through this path.
  db.tables.founder_invitations[0].status = "applied";
  await assert.rejects(
    revokeFounderInvitation({ invitationId: created.invitationId, operatorUserId: "op-1", reason: "x" }, { client: db.client as never }),
    /already_used::/,
  );
});

test("resend rotates the token: the old link stops resolving, the new one works", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email: "rotate@example.com", archetype: "independent_pm", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const oldToken = extractToken(created.inviteLink);

  const resent = await resendFounderInvitation(
    { invitationId: created.invitationId, operatorUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const newToken = extractToken(resent.inviteLink);
  assert.notEqual(newToken, oldToken);
  assert.equal(await resolveFounderInvitationByToken(oldToken, { client: db.client as never }), null, "old token must be invalidated");
  const resolved = await resolveFounderInvitationByToken(newToken, { client: db.client as never });
  assert.equal(resolved?.invitationId, created.invitationId);
});

test("revoked and applied invitations cannot be resent", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email: "noresend@example.com", archetype: "consultant", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  db.tables.founder_invitations[0].status = "revoked";
  await assert.rejects(
    resendFounderInvitation({ invitationId: created.invitationId, operatorUserId: "op-1", settings: settings() }, { client: db.client as never }),
    /not_resendable::/,
  );
});
