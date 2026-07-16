/**
 * Founder Circle Program — configuration layer tests.
 *
 * The program must FAIL CLOSED: unknown environments (no flags) run fully
 * disabled; a missing/invalid/disabled settings row disables the program
 * with an explicit reason; only the literal string "true" enables a flag.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadFounderProgramConfig,
  parseFounderProgramSettingsRow,
  resolveFounderProgramFlags,
} from "../src/lib/founder-program/config";

const validRow = () => ({
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
  support_contact: "founder@pmfreak.com",
  feedback_cadence_days: 14,
  program_starts_on: null,
  review_due_on: null,
});

test("all flags default to OFF in an empty environment", () => {
  const flags = resolveFounderProgramFlags({});
  assert.deepEqual(Object.values(flags), [false, false, false, false, false, false, false]);
});

test("only the literal string 'true' enables a flag", () => {
  for (const value of ["TRUE", "True", "1", "yes", "on", "", undefined]) {
    const flags = resolveFounderProgramFlags({ PMFREAK_FOUNDER_PROGRAM_ENABLED: value });
    assert.equal(flags.programEnabled, false, `value ${JSON.stringify(value)} must not enable`);
  }
  assert.equal(resolveFounderProgramFlags({ PMFREAK_FOUNDER_PROGRAM_ENABLED: "true" }).programEnabled, true);
});

test("valid settings row parses with conservative defaults intact", () => {
  const settings = parseFounderProgramSettingsRow(validRow());
  assert.ok(settings);
  assert.equal(settings.maxApprovedParticipants, 10);
  assert.equal(settings.maxActiveParticipants, 5);
  assert.equal(settings.maxInvitationsPerBatch, 5);
  assert.equal(settings.invitationExpiryDays, 7);
  assert.equal(settings.capabilityProfile, "pilot");
  assert.equal(settings.inviteOnly, true);
});

test("settings row is rejected on any out-of-range or missing field", () => {
  const mutations: Array<Record<string, unknown>> = [
    { max_approved_participants: 0 },
    { max_approved_participants: 501 },
    { max_approved_participants: 2.5 },
    { max_active_participants: "5" },
    { max_invitations_per_batch: 26 },
    { invitation_expiry_days: 0 },
    { feedback_cadence_days: 91 },
    { display_name: "" },
    { required_agreement_version: "  " },
    { required_onboarding_version: null },
    { capability_profile: "founder" },
    { program_enabled: "true" },
    { invite_only: null },
    { applications_enabled: undefined },
  ];
  for (const mutation of mutations) {
    const row = { ...validRow(), ...mutation };
    assert.equal(parseFounderProgramSettingsRow(row), null, `must reject ${JSON.stringify(mutation)}`);
  }
  assert.equal(parseFounderProgramSettingsRow(null), null);
  assert.equal(parseFounderProgramSettingsRow(undefined), null);
});

test("loadFounderProgramConfig: flag off short-circuits without touching settings", async () => {
  let fetched = false;
  const config = await loadFounderProgramConfig({
    env: {},
    fetchSettingsRow: async () => {
      fetched = true;
      return validRow();
    },
  });
  assert.equal(config.enabled, false);
  assert.equal(config.enabled === false && config.disabledReason, "flag_disabled");
  assert.equal(fetched, false, "settings must not be read when the flag is off");
});

test("loadFounderProgramConfig: missing settings row fails closed", async () => {
  const config = await loadFounderProgramConfig({
    env: { PMFREAK_FOUNDER_PROGRAM_ENABLED: "true" },
    fetchSettingsRow: async () => null,
  });
  assert.equal(config.enabled, false);
  assert.equal(config.enabled === false && config.disabledReason, "settings_missing");
});

test("loadFounderProgramConfig: settings fetch error fails closed", async () => {
  const config = await loadFounderProgramConfig({
    env: { PMFREAK_FOUNDER_PROGRAM_ENABLED: "true" },
    fetchSettingsRow: async () => {
      throw new Error("database offline");
    },
  });
  assert.equal(config.enabled, false);
  assert.equal(config.enabled === false && config.disabledReason, "settings_missing");
});

test("loadFounderProgramConfig: invalid settings row fails closed", async () => {
  const config = await loadFounderProgramConfig({
    env: { PMFREAK_FOUNDER_PROGRAM_ENABLED: "true" },
    fetchSettingsRow: async () => ({ ...validRow(), capability_profile: "founder" }),
  });
  assert.equal(config.enabled, false);
  assert.equal(config.enabled === false && config.disabledReason, "settings_invalid");
});

test("loadFounderProgramConfig: DB-level disable wins over env flag", async () => {
  const config = await loadFounderProgramConfig({
    env: { PMFREAK_FOUNDER_PROGRAM_ENABLED: "true" },
    fetchSettingsRow: async () => ({ ...validRow(), program_enabled: false }),
  });
  assert.equal(config.enabled, false);
  assert.equal(config.enabled === false && config.disabledReason, "settings_disabled");
});

test("loadFounderProgramConfig: fully configured program resolves enabled", async () => {
  const config = await loadFounderProgramConfig({
    env: { PMFREAK_FOUNDER_PROGRAM_ENABLED: "true", PMFREAK_FOUNDER_PROGRAM_FEEDBACK_ENABLED: "true" },
    fetchSettingsRow: async () => validRow(),
  });
  assert.equal(config.enabled, true);
  if (config.enabled) {
    assert.equal(config.settings.displayName, "PMFreak Founder Circle");
    assert.equal(config.flags.feedbackEnabled, true);
    assert.equal(config.flags.invitationsEnabled, false, "unset sub-flags stay off");
  }
});
