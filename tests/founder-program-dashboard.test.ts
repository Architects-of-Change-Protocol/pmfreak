/**
 * Founder Circle Program — dashboard honesty and decision-gate behavior.
 *
 * Every metric must be derived from real records; metrics without evidence
 * report available:false with a reason (no demo numbers, no fabricated
 * retention cohorts before real time has elapsed). Decisions are
 * human-ratified with server-computed evidence counts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { computeFounderProgramDashboard, type Metric } from "../src/lib/founder-program/dashboard";
import { listFounderProgramDecisions, recordFounderProgramDecision } from "../src/lib/founder-program/decisions";
import { parseFounderProgramSettingsRow } from "../src/lib/founder-program/config";
import { createFounderFakeDb, type FounderFakeDb } from "./founder-program-test-helpers";

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

function seedParticipant(db: FounderFakeDb, state: string, extra: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  db.tables.founder_participants.push({
    id,
    invitation_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    email: `${id.slice(0, 8)}@example.com`,
    archetype: "consultant",
    lifecycle_state: state,
    agreement_version_accepted: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...extra,
  });
  return id;
}

test("an empty program reports zeros and explicitly unavailable metrics — nothing fabricated", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const dashboard = await computeFounderProgramDashboard(settings(), { client: db.client as never });

  assert.equal(dashboard.counts.participants, 0);
  assert.equal(dashboard.funnel.invited, 0);
  assert.equal(dashboard.invitations.total, 0);
  for (const key of ["day1", "day7", "day14"] as const) {
    const metric = dashboard.retention[key] as Metric<unknown>;
    assert.equal(metric.available, false, `${key} retention must be unavailable with no participants`);
    assert.equal(metric.value, null);
    assert.ok((metric as { reason?: string }).reason, "unavailable metrics must carry a reason");
  }
  for (const key of ["inviteToApplicationHoursMedian", "approvalToAgreementHoursMedian", "agreementToActivationHoursMedian"] as const) {
    assert.equal((dashboard.timings[key] as Metric<unknown>).available, false);
  }
  const serialized = JSON.stringify(dashboard);
  assert.ok(!/demo|sample|placeholder|fake/i.test(serialized), "no demo-flavored values may appear");
});

test("funnel counts come from the transition audit trail, not guesses", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const a = seedParticipant(db, "applied");
  const b = seedParticipant(db, "activated", { activated_at: new Date().toISOString() });
  const push = (participant_id: string, to_state: string, at: string) =>
    db.tables.founder_membership_transitions.push({
      id: crypto.randomUUID(), participant_id, from_state: "x", to_state, actor_type: "system", actor_user_id: null, reason: null, created_at: at,
    });
  push(a, "invited", "2026-07-01T00:00:00Z");
  push(a, "applied", "2026-07-02T12:00:00Z");
  push(b, "invited", "2026-07-01T00:00:00Z");
  push(b, "applied", "2026-07-01T06:00:00Z");
  push(b, "approved", "2026-07-02T00:00:00Z");
  push(b, "agreement_accepted", "2026-07-03T00:00:00Z");
  push(b, "onboarding_active", "2026-07-04T00:00:00Z");

  const dashboard = await computeFounderProgramDashboard(settings(), { client: db.client as never });
  assert.equal(dashboard.funnel.invited, 2);
  assert.equal(dashboard.funnel.applied, 2);
  assert.equal(dashboard.funnel.approved, 1);
  assert.equal(dashboard.funnel.activated, 1);

  const inviteToApply = dashboard.timings.inviteToApplicationHoursMedian as Metric<number>;
  assert.equal(inviteToApply.available, true);
  // Median of 36h (a) and 6h (b) = 21h.
  assert.equal(inviteToApply.value, 21);
});

test("retention becomes available only when real time has elapsed since activation", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const id = seedParticipant(db, "activated", { activated_at: eightDaysAgo });
  db.tables.founder_program_events.push({
    id: crypto.randomUUID(),
    event_name: "founder_return_visit",
    schema_version: 1,
    participant_id: id,
    properties: {},
    occurred_at: new Date().toISOString(),
  });

  const dashboard = await computeFounderProgramDashboard(settings(), { client: db.client as never });
  const day7 = dashboard.retention.day7 as Metric<{ eligible: number; returned: number }>;
  assert.equal(day7.available, true);
  assert.deepEqual(day7.value, { eligible: 1, returned: 1 });
  const day14 = dashboard.retention.day14 as Metric<unknown>;
  assert.equal(day14.available, false, "day-14 cannot exist after only 8 days");
});

test("capacity and agreement-renewal counts reflect the live rows", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  seedParticipant(db, "activated", { agreement_version_accepted: "0.0-old", activated_at: new Date().toISOString() });
  seedParticipant(db, "approved");
  seedParticipant(db, "waitlisted");

  const dashboard = await computeFounderProgramDashboard(settings(), { client: db.client as never });
  assert.equal(dashboard.capacity.approvedUsed, 2);
  assert.equal(dashboard.capacity.activeUsed, 1);
  assert.equal(dashboard.onboarding.agreementRenewalRequired, 1);
  assert.equal(dashboard.counts.waitlisted, 1);
});

test("decision records validate input, compute evidence counts server-side, and are append-only", async () => {
  const db = createFounderFakeDb();
  db.seedSettings();
  seedParticipant(db, "applied");
  seedParticipant(db, "activated", { activated_at: new Date().toISOString() });

  const invalid = await recordFounderProgramDecision(
    { operatorUserId: "op-1", body: { decision: "ship_it", decidedOn: "2026-07-16" } },
    { client: db.client as never },
  );
  assert.equal(invalid.ok, false);

  const noRationale = await recordFounderProgramDecision(
    { operatorUserId: "op-1", body: { decision: "continue", decidedOn: "2026-07-16", evidenceWindowStart: "2026-07-01", evidenceWindowEnd: "2026-07-15" } },
    { client: db.client as never },
  );
  assert.equal(noRationale.ok, false);

  const result = await recordFounderProgramDecision(
    {
      operatorUserId: "op-1",
      body: {
        decision: "continue_with_remediation",
        decidedOn: "2026-07-16",
        evidenceWindowStart: "2026-07-01",
        evidenceWindowEnd: "2026-07-15",
        rationale: "Two of five activated participants hit the same onboarding defect; remediation planned.",
        // A client-supplied participant count is IGNORED — computed from records.
        participantCount: 999,
      },
    },
    { client: db.client as never },
  );
  assert.equal(result.ok, true);

  const stored = db.tables.founder_program_decisions[0];
  assert.equal(stored.participant_count, 2, "participant count must come from real records, not the request body");
  assert.equal(stored.activation_count, 1);
  assert.equal(stored.decision_owner_user_id, "op-1");

  const listed = await listFounderProgramDecisions("op-1", { client: db.client as never });
  assert.equal(listed.length, 1);
});
