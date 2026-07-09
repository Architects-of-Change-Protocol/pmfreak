import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_DISCLAIMERS,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_NAME,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS,
} from "./pmfreak-aoc-evidence-requirement-handoff-constants";

export type PMFreakAocEvidenceRequirementHandoffDescriptor = {
  featureId: string;
  featureName: string;
  version: "v1";
  mode: "evidence_requirement_handoff";
  runtimeDirection: "pmfreak_consumes_aoc_governance";

  handoffOnly: true;

  evidenceAttachmentCapable: false;
  taskCreationCapable: false;
  actionExecutionCapable: false;
  productionMutationCapable: false;
  decisionWritebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  legalCertificationCapable: false;
  complianceCertificationCapable: false;
  customerAcceptanceCertificationCapable: false;

  capabilities: string[];
  forbiddenOperations: string[];
  safeLabels: string[];
  disclaimers: string[];
};

export function createPMFreakAocEvidenceRequirementHandoffDescriptor(): PMFreakAocEvidenceRequirementHandoffDescriptor {
  return {
    featureId: PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
    featureName: PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_NAME,
    version: "v1",
    mode: "evidence_requirement_handoff",
    runtimeDirection: "pmfreak_consumes_aoc_governance",

    handoffOnly: true,

    evidenceAttachmentCapable: false,
    taskCreationCapable: false,
    actionExecutionCapable: false,
    productionMutationCapable: false,
    decisionWritebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    legalCertificationCapable: false,
    complianceCertificationCapable: false,
    customerAcceptanceCertificationCapable: false,

    capabilities: Object.values(PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES),
    forbiddenOperations: [...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS],
    safeLabels: [...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS],
    disclaimers: [...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_DISCLAIMERS],
  };
}
