// Shared helpers for jurisdiction-pack-runtime-*.test.ts. Not itself a test
// file (tsx --test only picks up tests/*.test.ts), so it's safe to import
// from any of them without being run twice.

import type { JurisdictionPackResolutionInput } from "../src/features/domain-policy-pack-runtime/jurisdiction";

export function buildResolutionInput(
  overrides: Partial<JurisdictionPackResolutionInput> = {}
): JurisdictionPackResolutionInput {
  return {
    actionId: "action-1",
    agentId: "agent-1",
    actionType: "draft_contract_clause",
    jurisdiction: { known: true },
    requestedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
