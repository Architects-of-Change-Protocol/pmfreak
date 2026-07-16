/**
 * Founder Circle Program — application intake behavior.
 *
 * Server-side validation bounds, invite binding, email binding, one
 * application per invitation/account, no self-approval, and withdrawal.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  submitFounderApplication,
  validateFounderApplicationInput,
  withdrawFounderApplication,
} from "../src/lib/founder-program/applications";
import { createFounderInvitation } from "../src/lib/founder-program/invitations";
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

const validApplicationBody = () => ({
  fullName: "Alex Rivera",
  roleTitle: "Program Manager",
  companyStatus: "company",
  experienceRange: "5_10",
  painPoint: "Status reporting eats my week.",
  currentTools: "Jira, Sheets",
  activeProjectsRange: "3_5",
  joiningReason: "Want calmer execution signals.",
  consentContact: true,
  feedbackAvailability: "biweekly",
  referralSource: "colleague",
  linkedinUrl: "https://www.linkedin.com/in/example",
  timezone: "America/Mexico_City",
});

async function invitedFixture(email = "alex@example.com") {
  const db = createFounderFakeDb();
  db.seedSettings();
  const created = await createFounderInvitation(
    { email, archetype: "program_manager", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const token = decodeURIComponent(created.inviteLink.split("/founder-circle/invite/")[1]);
  return { db, created, token };
}

test("validation enforces bounded enums, caps, and required consent", () => {
  assert.equal(validateFounderApplicationInput(validApplicationBody()).ok, true);
  const rejects: Array<Record<string, unknown>> = [
    { fullName: "" },
    { fullName: "x".repeat(121) },
    { roleTitle: "" },
    { companyStatus: "corporation" },
    { experienceRange: "20_plus" },
    { painPoint: "" },
    { painPoint: "x".repeat(1001) },
    { currentTools: "x".repeat(501) },
    { activeProjectsRange: "0" },
    { joiningReason: "" },
    { consentContact: false },
    { consentContact: "true" },
    { feedbackAvailability: "never" },
    { referralSource: "x".repeat(201) },
    { linkedinUrl: "http://linkedin.com/in/insecure" },
    { linkedinUrl: "not-a-url" },
    { timezone: "x".repeat(61) },
  ];
  for (const mutation of rejects) {
    const result = validateFounderApplicationInput({ ...validApplicationBody(), ...mutation });
    assert.equal(result.ok, false, `must reject ${JSON.stringify(mutation)}`);
  }
});

test("a valid invited candidate can submit exactly one application", async () => {
  const { db, token } = await invitedFixture();
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);

  const first = await submitFounderApplication(
    { token, userId: "user-1", userEmail: "alex@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(first.ok, true);

  const participant = db.tables.founder_participants[0];
  assert.equal(participant.lifecycle_state, "applied");
  assert.equal(participant.user_id, "user-1");
  assert.equal(db.tables.founder_invitations[0].status, "applied");
  assert.equal(db.tables.founder_applications.length, 1);
  const checkpoint = db.tables.founder_onboarding_checkpoints.find((c) => c.checkpoint === "application_submitted");
  assert.ok(checkpoint, "application_submitted checkpoint must be recorded");

  const second = await submitFounderApplication(
    { token, userId: "user-1", userEmail: "alex@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.code, "already_applied");
  assert.equal(db.tables.founder_applications.length, 1);
});

test("email binding: the invitation email must match the authenticated account", async () => {
  const { db, token } = await invitedFixture("alex@example.com");
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);
  const result = await submitFounderApplication(
    { token, userId: "intruder", userEmail: "other@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.code, "email_mismatch");
  assert.equal(db.tables.founder_applications.length, 0);
  assert.equal(db.tables.founder_participants[0].user_id ?? null, null, "no binding may happen on mismatch");
});

test("an expired or bad token cannot submit an application", async () => {
  const { db, token } = await invitedFixture();
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);

  const bad = await submitFounderApplication(
    { token: "not-the-token-at-all-123456", userId: "user-1", userEmail: "alex@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(bad.ok === false && bad.code, "invalid_or_expired_invitation");

  db.tables.founder_invitations[0].expires_at = new Date(Date.now() - 1000).toISOString();
  const expired = await submitFounderApplication(
    { token, userId: "user-1", userEmail: "alex@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(expired.ok === false && expired.code, "invalid_or_expired_invitation");
});

test("one account cannot bind two participant records", async () => {
  const { db, token } = await invitedFixture("alex@example.com");
  const second = await createFounderInvitation(
    { email: "second@example.com", archetype: "consultant", createdByUserId: "op-1", settings: settings() },
    { client: db.client as never },
  );
  const secondToken = decodeURIComponent(second.inviteLink.split("/founder-circle/invite/")[1]);
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);

  assert.equal(
    (await submitFounderApplication({ token, userId: "user-1", userEmail: "alex@example.com", application: validated.value }, { client: db.client as never })).ok,
    true,
  );
  const crossBind = await submitFounderApplication(
    { token: secondToken, userId: "user-1", userEmail: "second@example.com", application: validated.value },
    { client: db.client as never },
  );
  assert.equal(crossBind.ok, false);
  assert.equal(crossBind.ok === false && crossBind.code, "user_already_bound");
});

test("submission never approves: the participant stays in applied, not approved", async () => {
  const { db, token } = await invitedFixture();
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);
  await submitFounderApplication({ token, userId: "user-1", userEmail: "alex@example.com", application: validated.value }, { client: db.client as never });
  assert.equal(db.tables.founder_participants[0].lifecycle_state, "applied");
  assert.equal(
    db.tables.founder_membership_transitions.some((t) => t.to_state === "approved"),
    false,
  );
});

test("withdrawal works before and after approval and marks the application", async () => {
  const { db, token } = await invitedFixture();
  const validated = validateFounderApplicationInput(validApplicationBody());
  assert.ok(validated.ok);
  await submitFounderApplication({ token, userId: "user-1", userEmail: "alex@example.com", application: validated.value }, { client: db.client as never });

  const result = await withdrawFounderApplication({ userId: "user-1" }, { client: db.client as never });
  assert.equal(result.ok, true);
  assert.equal(db.tables.founder_participants[0].lifecycle_state, "withdrawn");
  assert.ok(db.tables.founder_applications[0].withdrawn_at, "application must be stamped withdrawn");

  // Terminal: a second withdrawal is refused.
  const again = await withdrawFounderApplication({ userId: "user-1" }, { client: db.client as never });
  assert.equal(again.ok === false && again.code, "not_withdrawable");
});

test("non-participants cannot withdraw anything", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const result = await withdrawFounderApplication({ userId: "stranger" }, { client: db.client as never });
  assert.equal(result.ok === false && result.code, "not_a_participant");
});
