import {
  PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID,
  PMFREAK_AOC_DECISION_DISPLAY_INBOX_NAME,
  PMFREAK_AOC_DECISION_INBOX_CAPABILITIES,
  PMFREAK_AOC_DECISION_INBOX_DISCLAIMERS,
  PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_DECISION_INBOX_SAFE_LABELS,
} from "./pmfreak-aoc-decision-inbox-constants";

export type PMFreakAocDecisionInboxDescriptor = {
  featureId: string;
  featureName: string;
  version: "v1";
  mode: "decision_display_inbox";
  runtimeDirection: "pmfreak_consumes_aoc_governance";
  displayOnly: true;
  productionMutationCapable: false;
  actionExecutionCapable: false;
  decisionWritebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  enforcementCapable: false;
  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export function createPMFreakAocDecisionInboxDescriptor(): PMFreakAocDecisionInboxDescriptor {
  return {
    featureId: PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID,
    featureName: PMFREAK_AOC_DECISION_DISPLAY_INBOX_NAME,
    version: "v1",
    mode: "decision_display_inbox",
    runtimeDirection: "pmfreak_consumes_aoc_governance",
    displayOnly: true,
    productionMutationCapable: false,
    actionExecutionCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    enforcementCapable: false,
    capabilities: Object.values(PMFREAK_AOC_DECISION_INBOX_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_DECISION_INBOX_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_DECISION_INBOX_DISCLAIMERS],
  };
}
