import {
  PMFREAK_AOC_GOVERNED_ACTION_GATE_CAPABILITIES,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_DISCLAIMERS,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_NAME,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS,
} from "./pmfreak-aoc-governed-action-gate-constants";

export type PMFreakAocGovernedActionGateDescriptor = {
  featureId: string;
  featureName: string;
  version: "v1";
  mode: "governed_action_gate";
  runtimeDirection: "pmfreak_consumes_aoc_governance";

  gateOnly: true;

  actionExecutionCapable: false;
  productionMutationCapable: false;
  decisionWritebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  legalCertificationCapable: false;
  complianceCertificationCapable: false;

  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export function createPMFreakAocGovernedActionGateDescriptor(): PMFreakAocGovernedActionGateDescriptor {
  return {
    featureId: PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,
    featureName: PMFREAK_AOC_GOVERNED_ACTION_GATE_NAME,
    version: "v1",
    mode: "governed_action_gate",
    runtimeDirection: "pmfreak_consumes_aoc_governance",

    gateOnly: true,

    actionExecutionCapable: false,
    productionMutationCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    legalCertificationCapable: false,
    complianceCertificationCapable: false,

    capabilities: Object.values(PMFREAK_AOC_GOVERNED_ACTION_GATE_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_GOVERNED_ACTION_GATE_DISCLAIMERS],
  };
}
