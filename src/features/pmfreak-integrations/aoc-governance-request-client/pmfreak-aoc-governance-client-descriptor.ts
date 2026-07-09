import {
  PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES,
  PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS,
  PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_NAME,
  PMFREAK_AOC_GOVERNANCE_SAFE_LABELS,
} from "./pmfreak-aoc-governance-client-constants";

export type PMFreakAocGovernanceRequestClientDescriptor = {
  clientId: string;
  clientName: string;
  providerId: "pmfreak";
  consumerOf: "aoc";
  version: "v1";
  mode: "governance_request_client";
  runtimeDirection: "pmfreak_consumes_aoc_governance";
  productionMutationCapable: false;
  productionEnforcementCapable: false;
  actionExecutionCapable: false;
  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export function createPMFreakAocGovernanceRequestClientDescriptor(): PMFreakAocGovernanceRequestClientDescriptor {
  return {
    clientId: PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
    clientName: PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_NAME,
    providerId: "pmfreak",
    consumerOf: "aoc",
    version: "v1",
    mode: "governance_request_client",
    runtimeDirection: "pmfreak_consumes_aoc_governance",
    productionMutationCapable: false,
    productionEnforcementCapable: false,
    actionExecutionCapable: false,
    capabilities: Object.values(PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_GOVERNANCE_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS],
  };
}
