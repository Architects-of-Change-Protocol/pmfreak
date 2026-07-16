/**
 * Founder Circle Program — configuration layer (server-side authoritative).
 *
 * Two levels, both required, both fail-closed:
 *   1. Env flags (all default OFF): deployment-level switches. An unknown
 *      environment runs with everything disabled.
 *   2. `founder_program_settings` (DB singleton, operator-managed):
 *      capacity, expiry, versions, display name. Missing or invalid row
 *      disables the program with an explicit reason — never a fallback to
 *      permissive defaults.
 *
 * Env is used only for enablement switches; operational data (capacity,
 * dates, versions) is database-managed. See docs/founder-program/01 and 14.
 */
import { createFounderProgramDbClient } from "@/lib/founder-program/db";

export const FOUNDER_PROGRAM_DEFAULT_DISPLAY_NAME = "PMFreak Founder Circle";

export type FounderProgramFlags = {
  readonly programEnabled: boolean;
  readonly operatorUiEnabled: boolean;
  readonly invitationsEnabled: boolean;
  readonly applicationsEnabled: boolean;
  readonly activationEnabled: boolean;
  readonly feedbackEnabled: boolean;
  readonly analyticsEnabled: boolean;
};

type EnvLike = Record<string, string | undefined>;

const flagOn = (value: string | undefined): boolean => value === "true";

/** Every flag defaults to OFF; only the literal string "true" enables. */
export function resolveFounderProgramFlags(env: EnvLike = process.env): FounderProgramFlags {
  return {
    programEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_ENABLED),
    operatorUiEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_OPERATOR_UI_ENABLED),
    invitationsEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_INVITATIONS_ENABLED),
    applicationsEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_APPLICATIONS_ENABLED),
    activationEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_ACTIVATION_ENABLED),
    feedbackEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_FEEDBACK_ENABLED),
    analyticsEnabled: flagOn(env.PMFREAK_FOUNDER_PROGRAM_ANALYTICS_ENABLED),
  };
}

export type FounderProgramSettings = {
  readonly displayName: string;
  readonly programEnabled: boolean;
  readonly inviteOnly: boolean;
  readonly applicationsEnabled: boolean;
  readonly maxApprovedParticipants: number;
  readonly maxActiveParticipants: number;
  readonly maxInvitationsPerBatch: number;
  readonly invitationExpiryDays: number;
  readonly requiredAgreementVersion: string;
  readonly requiredOnboardingVersion: string;
  readonly capabilityProfile: "pilot";
  readonly supportContact: string | null;
  readonly feedbackCadenceDays: number;
  readonly programStartsOn: string | null;
  readonly reviewDueOn: string | null;
};

export type FounderProgramDisabledReason =
  | "flag_disabled"
  | "settings_missing"
  | "settings_invalid"
  | "settings_disabled";

export type FounderProgramConfig =
  | { readonly enabled: true; readonly flags: FounderProgramFlags; readonly settings: FounderProgramSettings }
  | { readonly enabled: false; readonly flags: FounderProgramFlags; readonly disabledReason: FounderProgramDisabledReason };

const boundedInt = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
};

/**
 * Validates the raw settings row. Any missing/out-of-range field returns
 * null — the program then reports `settings_invalid` and stays disabled
 * rather than running with a guessed default.
 */
export function parseFounderProgramSettingsRow(row: Record<string, unknown> | null | undefined): FounderProgramSettings | null {
  if (!row) return null;
  const maxApproved = boundedInt(row.max_approved_participants, 1, 500);
  const maxActive = boundedInt(row.max_active_participants, 1, 500);
  const maxBatch = boundedInt(row.max_invitations_per_batch, 1, 25);
  const expiryDays = boundedInt(row.invitation_expiry_days, 1, 90);
  const cadence = boundedInt(row.feedback_cadence_days, 1, 90);
  const displayName = typeof row.display_name === "string" && row.display_name.trim().length > 0 ? row.display_name.trim() : null;
  const agreementVersion = typeof row.required_agreement_version === "string" && row.required_agreement_version.trim().length > 0 ? row.required_agreement_version.trim() : null;
  const onboardingVersion = typeof row.required_onboarding_version === "string" && row.required_onboarding_version.trim().length > 0 ? row.required_onboarding_version.trim() : null;

  if (
    maxApproved === null || maxActive === null || maxBatch === null || expiryDays === null || cadence === null ||
    !displayName || !agreementVersion || !onboardingVersion ||
    typeof row.program_enabled !== "boolean" || typeof row.invite_only !== "boolean" ||
    typeof row.applications_enabled !== "boolean" ||
    row.capability_profile !== "pilot"
  ) {
    return null;
  }

  return {
    displayName,
    programEnabled: row.program_enabled,
    inviteOnly: row.invite_only,
    applicationsEnabled: row.applications_enabled,
    maxApprovedParticipants: maxApproved,
    maxActiveParticipants: maxActive,
    maxInvitationsPerBatch: maxBatch,
    invitationExpiryDays: expiryDays,
    requiredAgreementVersion: agreementVersion,
    requiredOnboardingVersion: onboardingVersion,
    capabilityProfile: "pilot",
    supportContact: typeof row.support_contact === "string" && row.support_contact.trim() ? row.support_contact.trim() : null,
    feedbackCadenceDays: cadence,
    programStartsOn: typeof row.program_starts_on === "string" ? row.program_starts_on : null,
    reviewDueOn: typeof row.review_due_on === "string" ? row.review_due_on : null,
  };
}

export type FounderProgramConfigDeps = {
  fetchSettingsRow?: () => Promise<Record<string, unknown> | null>;
  env?: EnvLike;
};

async function defaultFetchSettingsRow(): Promise<Record<string, unknown> | null> {
  const supabase = createFounderProgramDbClient({ operation: "load_settings" });
  const { data, error } = await supabase
    .from("founder_program_settings")
    .select(
      "display_name, program_enabled, invite_only, applications_enabled, max_approved_participants, max_active_participants, max_invitations_per_batch, invitation_expiry_days, required_agreement_version, required_onboarding_version, capability_profile, support_contact, feedback_cadence_days, program_starts_on, review_due_on",
    )
    .eq("singleton", true)
    .maybeSingle();
  if (error) return null;
  return data as Record<string, unknown> | null;
}

/**
 * Resolves the effective program configuration. Fail-closed at every step:
 * flag off → disabled; settings row unreadable/missing → disabled; row
 * invalid → disabled; row says disabled → disabled.
 */
export async function loadFounderProgramConfig(deps: FounderProgramConfigDeps = {}): Promise<FounderProgramConfig> {
  const flags = resolveFounderProgramFlags(deps.env ?? process.env);
  if (!flags.programEnabled) {
    return { enabled: false, flags, disabledReason: "flag_disabled" };
  }

  let row: Record<string, unknown> | null = null;
  try {
    row = await (deps.fetchSettingsRow ?? defaultFetchSettingsRow)();
  } catch {
    return { enabled: false, flags, disabledReason: "settings_missing" };
  }
  if (!row) {
    return { enabled: false, flags, disabledReason: "settings_missing" };
  }

  const settings = parseFounderProgramSettingsRow(row);
  if (!settings) {
    return { enabled: false, flags, disabledReason: "settings_invalid" };
  }
  if (!settings.programEnabled) {
    return { enabled: false, flags, disabledReason: "settings_disabled" };
  }

  return { enabled: true, flags, settings };
}
