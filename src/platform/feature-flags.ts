/**
 * Server-evaluated feature flags for PR9's canonical experience.
 * Session/Server state per 07-frontend-state-and-data-architecture.md §6 —
 * no client-side override store.
 */
export const FEATURE_FLAGS = ["FEATURE_COMMAND_CENTER", "FEATURE_AGENT_VIEW"] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return process.env[flag] === "true";
}
