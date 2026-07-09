import {
  PMFREAK_AOC_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB,
  PMFREAK_AOC_GOVERNANCE_DEFAULT_TIMEOUT_MS,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
} from "./pmfreak-aoc-governance-client-constants";
import type {
  PMFreakAocGovernanceClientEnvironment,
  PMFreakAocGovernanceRedactionMode,
  PMFreakAocGovernanceRequestMode,
  PMFreakAocGovernanceTransportKind,
} from "./pmfreak-aoc-governance-client-types";

export type PMFreakAocGovernanceRequestClientConfig = {
  clientId: string;
  environment: PMFreakAocGovernanceClientEnvironment;
  transportKind: PMFreakAocGovernanceTransportKind;

  aocBaseUrl?: string;
  tenantId?: string;
  workspaceId?: string;

  requestMode: PMFreakAocGovernanceRequestMode;

  allowProductionMutations: false;
  allowActionExecution: false;
  allowDecisionWriteback: false;

  timeoutMs?: number;
  maxPayloadSizeKb?: number;

  redactionMode: PMFreakAocGovernanceRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` here relies on
// bypassing the (already `false`-typed) input field at the call site — the
// same `as unknown as false` pattern used by this repo's other safety-gated
// config factories (see jurisdiction-pack-validator.test.ts) — so runtime
// callers cannot enable execution/mutation/writeback even if they try.
export function createPMFreakAocGovernanceRequestClientConfig(
  input?: Partial<PMFreakAocGovernanceRequestClientConfig>,
): PMFreakAocGovernanceRequestClientConfig {
  const notes = [...(input?.notes ?? [])];
  const warnings = [...(input?.warnings ?? [])];

  const rawInput = (input ?? {}) as Record<string, unknown>;

  if (rawInput.allowProductionMutations === true) {
    warnings.push(
      "allowProductionMutations was requested as true but is forced to false: PMFreak AOC Governance Request Client v1 is non-mutating in v1.",
    );
  }
  if (rawInput.allowActionExecution === true) {
    warnings.push(
      "allowActionExecution was requested as true but is forced to false: PMFreak AOC Governance Request Client v1 does not execute actions in v1.",
    );
  }
  if (rawInput.allowDecisionWriteback === true) {
    warnings.push(
      "allowDecisionWriteback was requested as true but is forced to false: PMFreak AOC Governance Request Client v1 does not write back decisions in v1.",
    );
  }

  return {
    clientId: input?.clientId ?? PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
    environment: input?.environment ?? "demo",
    transportKind: input?.transportKind ?? "local_mock",
    aocBaseUrl: input?.aocBaseUrl,
    tenantId: input?.tenantId,
    workspaceId: input?.workspaceId,
    requestMode: input?.requestMode ?? "dry_run",
    allowProductionMutations: false,
    allowActionExecution: false,
    allowDecisionWriteback: false,
    timeoutMs: input?.timeoutMs ?? PMFREAK_AOC_GOVERNANCE_DEFAULT_TIMEOUT_MS,
    maxPayloadSizeKb: input?.maxPayloadSizeKb ?? PMFREAK_AOC_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB,
    redactionMode: input?.redactionMode ?? "safe_demo",
    notes,
    warnings,
  };
}
