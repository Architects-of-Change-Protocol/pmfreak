/**
 * Founder Circle Program — analytics privacy and schema behavior.
 *
 * Events must be allowlisted (names AND property keys), values restricted to
 * enum-like scalars (no emails, tokens, URLs, or free text), carry the
 * schema version, respect the fail-closed flag, and never throw into the
 * calling workflow.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FOUNDER_EVENT_SCHEMA_VERSION,
  FOUNDER_PROGRAM_EVENT_NAMES,
  recordFounderProgramEvent,
  validateFounderProgramEvent,
} from "../src/lib/founder-program/analytics";

const enabledEnv = { PMFREAK_FOUNDER_PROGRAM_ANALYTICS_ENABLED: "true" };

function captureClient(rows: Record<string, unknown>[] = [], failInsert = false) {
  return {
    rows,
    client: {
      from: (_table: string) => ({
        insert: async (row: Record<string, unknown>) => {
          if (failInsert) return { error: { message: "insert failed" } };
          rows.push(row);
          return { error: null };
        },
      }),
    },
  };
}

test("unknown event names and property keys are rejected", () => {
  assert.deepEqual(validateFounderProgramEvent("founder_made_up_event"), { ok: false, problem: "unknown_event" });
  assert.deepEqual(validateFounderProgramEvent("founder_feedback_submitted", { email: "a@b.com" }), { ok: false, problem: "unknown_property" });
  assert.deepEqual(validateFounderProgramEvent("founder_feedback_submitted", { token: "abc" }), { ok: false, problem: "unknown_property" });
  assert.deepEqual(validateFounderProgramEvent("founder_feedback_submitted", { body: "free text" }), { ok: false, problem: "unknown_property" });
});

test("property values must be enum-like scalars — emails, URLs, and free text are impossible", () => {
  for (const bad of ["user@example.com", "https://example.com/x", "two words", "x".repeat(65)]) {
    const result = validateFounderProgramEvent("founder_lifecycle_transition", { from_state: bad });
    assert.equal(result.ok, false, `must reject ${JSON.stringify(bad)}`);
  }
  assert.equal(validateFounderProgramEvent("founder_lifecycle_transition", { from_state: "invite_viewed", to_state: "applied", actor_type: "participant" }).ok, true);
  assert.equal(validateFounderProgramEvent("founder_checkpoint_reached", { checkpoint: "first_login" }).ok, true);
  assert.equal(validateFounderProgramEvent("founder_lifecycle_transition", { batch_size: 3, capacity_override: false }).ok, true);
  assert.equal(validateFounderProgramEvent("founder_lifecycle_transition", { batch_size: Number.POSITIVE_INFINITY }).ok, false);
});

test("analytics is OFF by default (fail-closed flag) and reports skipped", async () => {
  const { rows, client } = captureClient();
  const result = await recordFounderProgramEvent(
    { eventName: "founder_return_visit", participantId: "p1" },
    { client: client as never, env: {} },
  );
  assert.deepEqual(result, { ok: false, skipped: "analytics_disabled" });
  assert.equal(rows.length, 0);
});

test("enabled analytics inserts the schema version and allowlisted payload only", async () => {
  const { rows, client } = captureClient();
  const result = await recordFounderProgramEvent(
    { eventName: "founder_feedback_submitted", participantId: "p1", cohort: "c1", properties: { feedback_type: "defect", severity: "high" } },
    { client: client as never, env: enabledEnv },
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_name, "founder_feedback_submitted");
  assert.equal(rows[0].schema_version, FOUNDER_EVENT_SCHEMA_VERSION);
  assert.deepEqual(rows[0].properties, { feedback_type: "defect", severity: "high" });
});

test("invalid events are skipped (never inserted, never thrown)", async () => {
  const { rows, client } = captureClient();
  const result = await recordFounderProgramEvent(
    { eventName: "founder_feedback_submitted", properties: { note: "secret" } as never },
    { client: client as never, env: enabledEnv },
  );
  assert.deepEqual(result, { ok: false, skipped: "invalid_event" });
  assert.equal(rows.length, 0);
});

test("insert failures are non-destructive: reported, not thrown", async () => {
  const { client } = captureClient([], true);
  const result = await recordFounderProgramEvent(
    { eventName: "founder_return_visit" },
    { client: client as never, env: enabledEnv },
  );
  assert.deepEqual(result, { ok: false, skipped: "insert_failed" });
});

test("a throwing client is contained", async () => {
  const throwingClient = {
    from: () => ({
      insert: async () => {
        throw new Error("connection reset");
      },
    }),
  };
  const result = await recordFounderProgramEvent(
    { eventName: "founder_return_visit" },
    { client: throwingClient as never, env: enabledEnv },
  );
  assert.deepEqual(result, { ok: false, skipped: "insert_failed" });
});

test("every canonical event name stays inside the founder_ namespace pinned by the migration", () => {
  for (const name of FOUNDER_PROGRAM_EVENT_NAMES) {
    assert.match(name, /^founder_[a-z0-9_]{1,64}$/);
  }
});
