import {
  PMFREAK_AOC_GATE_RESULT_UI_CAPABILITIES,
  PMFREAK_AOC_GATE_RESULT_UI_DISCLAIMERS,
  PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_GATE_RESULT_UI_ID,
  PMFREAK_AOC_GATE_RESULT_UI_NAME,
  PMFREAK_AOC_GATE_RESULT_UI_SAFE_LABELS,
} from "./pmfreak-aoc-gate-result-ui-constants";

export type PMFreakAocGateResultUIDescriptor = {
  featureId: string;
  featureName: string;
  version: "v1";
  mode: "gate_result_ui";
  runtimeDirection: "pmfreak_consumes_aoc_governance";

  presentationOnly: true;

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

export function createPMFreakAocGateResultUIDescriptor(): PMFreakAocGateResultUIDescriptor {
  return {
    featureId: PMFREAK_AOC_GATE_RESULT_UI_ID,
    featureName: PMFREAK_AOC_GATE_RESULT_UI_NAME,
    version: "v1",
    mode: "gate_result_ui",
    runtimeDirection: "pmfreak_consumes_aoc_governance",

    presentationOnly: true,

    actionExecutionCapable: false,
    productionMutationCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    legalCertificationCapable: false,
    complianceCertificationCapable: false,

    capabilities: Object.values(PMFREAK_AOC_GATE_RESULT_UI_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_GATE_RESULT_UI_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_GATE_RESULT_UI_DISCLAIMERS],
  };
}
