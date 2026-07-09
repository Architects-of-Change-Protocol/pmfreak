import type { PMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import type { PMFreakAocGovernanceTransportKind } from "./pmfreak-aoc-governance-client-types";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";

export type PMFreakAocGovernanceTransport = {
  transportKind: PMFreakAocGovernanceTransportKind;

  evaluateGovernanceRequest(
    request: PMFreakAocGovernanceRequest,
    config: PMFreakAocGovernanceRequestClientConfig,
  ): Promise<PMFreakAocGovernanceResponse>;
};
