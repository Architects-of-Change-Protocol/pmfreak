import {
  PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CAPABILITIES,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS,
} from "./pmfreak-aoc-remote-governance-transport-constants";

export type PMFreakAocRemoteGovernanceTransportDescriptor = {
  transportId: string;
  transportName: string;
  providerId: "pmfreak";
  consumerOf: "aoc";
  version: "v1";
  mode: "remote_http_transport";
  runtimeDirection: "pmfreak_consumes_aoc_governance";
  defaultEndpointPath: string;
  productionMutationCapable: false;
  actionExecutionCapable: false;
  decisionWritebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export function createPMFreakAocRemoteGovernanceTransportDescriptor(): PMFreakAocRemoteGovernanceTransportDescriptor {
  return {
    transportId: PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID,
    transportName: PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME,
    providerId: "pmfreak",
    consumerOf: "aoc",
    version: "v1",
    mode: "remote_http_transport",
    runtimeDirection: "pmfreak_consumes_aoc_governance",
    defaultEndpointPath: PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH,
    productionMutationCapable: false,
    actionExecutionCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    capabilities: Object.values(PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS],
  };
}
