import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_WORKSPACE_ONBOARDING_PREFERENCES,
  WORKSPACE_ACTIVATION_STEP_IDS,
  WORKSPACE_ONBOARDING_VERSION,
  type WorkspaceActivationStepId,
  type WorkspaceOnboardingPreferences,
} from "./types";

/**
 * Per-user, per-workspace onboarding DISPLAY preferences.
 *
 * This table never stores derived progress — only how the current user wants
 * the guided setup panel displayed (collapsed/dismissed), which OPTIONAL
 * steps they chose to skip, and the insights first-view interaction event.
 * Dismissing hides the guide; it never marks the workspace as configured.
 */

type PreferenceClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;

type PreferenceRow = {
  workspace_id: string;
  user_id: string;
  onboarding_version: number;
  collapsed: boolean;
  dismissed_at: string | null;
  skipped_step_ids: string[] | null;
  insights_first_viewed_at: string | null;
};

const PREFERENCE_COLUMNS =
  "workspace_id,user_id,onboarding_version,collapsed,dismissed_at,skipped_step_ids,insights_first_viewed_at";

const KNOWN_STEP_IDS = new Set<string>(WORKSPACE_ACTIVATION_STEP_IDS);

/** Step ids a user may never skip: skipping is reserved for non-essential
 *  steps. Essential progress can only be satisfied by real evidence. */
const UNSKIPPABLE_STEP_IDS: ReadonlySet<WorkspaceActivationStepId> = new Set([
  "workspace_created",
  "project_created",
  "task_created",
]);

export class OnboardingPreferenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnboardingPreferenceValidationError";
  }
}

export function sanitizeSkippedStepIds(value: unknown): WorkspaceActivationStepId[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new OnboardingPreferenceValidationError("skippedStepIds must be an array of step ids.");
  }
  if (value.length > 32) {
    throw new OnboardingPreferenceValidationError("skippedStepIds is too large.");
  }
  const result: WorkspaceActivationStepId[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !KNOWN_STEP_IDS.has(raw)) {
      throw new OnboardingPreferenceValidationError(`Unknown onboarding step id: ${String(raw)}`);
    }
    const id = raw as WorkspaceActivationStepId;
    if (UNSKIPPABLE_STEP_IDS.has(id)) {
      throw new OnboardingPreferenceValidationError(`Essential step "${id}" cannot be skipped.`);
    }
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

function rowToPreferences(row: PreferenceRow): WorkspaceOnboardingPreferences {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    onboardingVersion: row.onboarding_version,
    collapsed: Boolean(row.collapsed),
    dismissedAt: row.dismissed_at,
    skippedStepIds: (row.skipped_step_ids ?? []).filter((id): id is WorkspaceActivationStepId =>
      KNOWN_STEP_IDS.has(id),
    ),
    insightsFirstViewedAt: row.insights_first_viewed_at,
  };
}

export async function getOnboardingPreferences(
  input: {
    workspaceId: string;
    userId: string;
    getClient?: () => Promise<PreferenceClient>;
  },
): Promise<WorkspaceOnboardingPreferences> {
  const getClient = input.getClient ?? (createSupabaseServerClient as () => Promise<PreferenceClient>);
  const client = await getClient();
  const { data, error } = await client
    .from("workspace_onboarding_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle<PreferenceRow>();

  if (error || !data) {
    return DEFAULT_WORKSPACE_ONBOARDING_PREFERENCES(input.workspaceId, input.userId);
  }
  return rowToPreferences(data);
}

export type OnboardingPreferencePatch = {
  collapsed?: boolean;
  /** true → stamp dismissed_at now (if unset); false → clear it (reopen). */
  dismissed?: boolean;
  skippedStepIds?: WorkspaceActivationStepId[];
  /** true → stamp insights_first_viewed_at once (never cleared). */
  insightsViewed?: boolean;
};

export function validateOnboardingPreferencePatch(body: unknown): OnboardingPreferencePatch {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new OnboardingPreferenceValidationError("Request body must be an object.");
  }
  const input = body as Record<string, unknown>;
  const patch: OnboardingPreferencePatch = {};
  let touched = false;

  if ("collapsed" in input) {
    if (typeof input.collapsed !== "boolean") {
      throw new OnboardingPreferenceValidationError("collapsed must be a boolean.");
    }
    patch.collapsed = input.collapsed;
    touched = true;
  }
  if ("dismissed" in input) {
    if (typeof input.dismissed !== "boolean") {
      throw new OnboardingPreferenceValidationError("dismissed must be a boolean.");
    }
    patch.dismissed = input.dismissed;
    touched = true;
  }
  if ("skippedStepIds" in input) {
    patch.skippedStepIds = sanitizeSkippedStepIds(input.skippedStepIds);
    touched = true;
  }
  if ("insightsViewed" in input) {
    if (input.insightsViewed !== true) {
      throw new OnboardingPreferenceValidationError("insightsViewed can only be set to true.");
    }
    patch.insightsViewed = true;
    touched = true;
  }

  if (!touched) {
    throw new OnboardingPreferenceValidationError("No recognized preference fields in request body.");
  }
  return patch;
}

export async function saveOnboardingPreferences(
  input: {
    workspaceId: string;
    userId: string;
    patch: OnboardingPreferencePatch;
    getClient?: () => Promise<PreferenceClient>;
    now?: () => Date;
  },
): Promise<WorkspaceOnboardingPreferences> {
  const getClient = input.getClient ?? (createSupabaseServerClient as () => Promise<PreferenceClient>);
  const now = input.now ?? (() => new Date());
  const client = await getClient();

  const current = await getOnboardingPreferences({
    workspaceId: input.workspaceId,
    userId: input.userId,
    getClient: async () => client,
  });

  const next: WorkspaceOnboardingPreferences = {
    ...current,
    onboardingVersion: WORKSPACE_ONBOARDING_VERSION,
    collapsed: input.patch.collapsed ?? current.collapsed,
    dismissedAt:
      input.patch.dismissed === undefined
        ? current.dismissedAt
        : input.patch.dismissed
          ? (current.dismissedAt ?? now().toISOString())
          : null,
    skippedStepIds: input.patch.skippedStepIds ?? current.skippedStepIds,
    insightsFirstViewedAt:
      input.patch.insightsViewed && !current.insightsFirstViewedAt
        ? now().toISOString()
        : current.insightsFirstViewedAt,
  };

  const { data, error } = await client
    .from("workspace_onboarding_preferences")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        onboarding_version: next.onboardingVersion,
        collapsed: next.collapsed,
        dismissed_at: next.dismissedAt,
        skipped_step_ids: next.skippedStepIds,
        insights_first_viewed_at: next.insightsFirstViewedAt,
      },
      { onConflict: "workspace_id,user_id" },
    )
    .select(PREFERENCE_COLUMNS)
    .maybeSingle<PreferenceRow>();

  if (error || !data) {
    throw new Error("Unable to save onboarding preferences.");
  }
  return rowToPreferences(data);
}
