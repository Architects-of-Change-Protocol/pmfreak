import {
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH,
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB,
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_SHARED_SECRET_HEADER_NAME,
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_TIMEOUT_MS,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
} from "./pmfreak-aoc-remote-governance-transport-constants";
import type { PMFreakAocRemoteGovernanceAuthMode } from "./pmfreak-aoc-remote-governance-transport-types";
import type { PMFreakAocGovernanceRedactionMode } from "./pmfreak-aoc-governance-client-types";
import { createPMFreakAocRemoteGovernanceTransportError } from "./pmfreak-aoc-remote-governance-errors";

export type PMFreakAocRemoteGovernanceTransportConfig = {
  transportId: string;
  aocBaseUrl: string;
  endpointPath: string;

  authMode: PMFreakAocRemoteGovernanceAuthMode;

  sharedSecretHeaderName?: string;
  sharedSecretValue?: string;
  bearerToken?: string;

  timeoutMs: number;
  maxPayloadSizeKb: number;

  allowActionExecution: false;
  allowProductionMutations: false;
  allowDecisionWriteback: false;
  allowInvoiceCreation: false;
  allowCommunications: false;

  redactionMode: PMFreakAocGovernanceRedactionMode;

  notes: string[];
  warnings: string[];
};

// Forcing production-unsafe overrides back to `false` relies on bypassing
// the (already `false`-typed) input field at the call site — the same
// `as unknown as false` pattern used by
// pmfreak-aoc-governance-client-config.ts — so runtime callers cannot
// enable execution/mutation/writeback/invoice-creation/communications even
// if they try.
export function createPMFreakAocRemoteGovernanceTransportConfig(
  input: Partial<PMFreakAocRemoteGovernanceTransportConfig>,
): PMFreakAocRemoteGovernanceTransportConfig {
  if (!input?.aocBaseUrl) {
    throw createPMFreakAocRemoteGovernanceTransportError(
      "invalid_config",
      "aocBaseUrl is required to configure the PMFreak AOC Remote Governance Transport v1.",
    );
  }

  const notes = [...(input.notes ?? [])];
  const warnings = [...(input.warnings ?? [])];

  const rawInput = (input ?? {}) as Record<string, unknown>;

  if (rawInput.allowActionExecution === true) {
    warnings.push(
      "allowActionExecution was requested as true but is forced to false: PMFreak AOC Remote Governance Transport v1 does not execute actions in v1.",
    );
  }
  if (rawInput.allowProductionMutations === true) {
    warnings.push(
      "allowProductionMutations was requested as true but is forced to false: PMFreak AOC Remote Governance Transport v1 is non-mutating in v1.",
    );
  }
  if (rawInput.allowDecisionWriteback === true) {
    warnings.push(
      "allowDecisionWriteback was requested as true but is forced to false: PMFreak AOC Remote Governance Transport v1 does not write back decisions in v1.",
    );
  }
  if (rawInput.allowInvoiceCreation === true) {
    warnings.push(
      "allowInvoiceCreation was requested as true but is forced to false: PMFreak AOC Remote Governance Transport v1 does not create invoices in v1.",
    );
  }
  if (rawInput.allowCommunications === true) {
    warnings.push(
      "allowCommunications was requested as true but is forced to false: PMFreak AOC Remote Governance Transport v1 does not send communications in v1.",
    );
  }

  return {
    transportId: PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
    aocBaseUrl: input.aocBaseUrl,
    endpointPath: input.endpointPath ?? PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH,
    authMode: input.authMode ?? "none_demo",
    sharedSecretHeaderName: input.sharedSecretHeaderName ?? PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_SHARED_SECRET_HEADER_NAME,
    sharedSecretValue: input.sharedSecretValue,
    bearerToken: input.bearerToken,
    timeoutMs: input.timeoutMs ?? PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_TIMEOUT_MS,
    maxPayloadSizeKb: input.maxPayloadSizeKb ?? PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB,
    allowActionExecution: false,
    allowProductionMutations: false,
    allowDecisionWriteback: false,
    allowInvoiceCreation: false,
    allowCommunications: false,
    redactionMode: input.redactionMode ?? "safe_demo",
    notes,
    warnings,
  };
}
