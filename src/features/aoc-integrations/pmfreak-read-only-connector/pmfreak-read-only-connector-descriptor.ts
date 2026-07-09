// AOC PMFreak Read-Only Connector v1 — connector descriptor

import {
  AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_ID,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS,
} from "./pmfreak-read-only-connector-constants";
import type { AocPMFreakReadOnlyConnectorDescriptor } from "./pmfreak-read-only-connector-types";

export function createAocPMFreakReadOnlyConnectorDescriptor(): AocPMFreakReadOnlyConnectorDescriptor {
  return {
    connectorId: AOC_PMFREAK_READ_ONLY_CONNECTOR_ID,
    connectorName: AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME,
    systemId: "pmfreak",
    version: "v1",
    mode: "read_only",
    demoCompatible: true,
    productionMutationCapable: false,
    governanceDecisionCapable: false,
    capabilities: Object.values(AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES),
    forbiddenOperations: [...AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS],
    safeLabels: [...AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS],
    disclaimers: [...AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS],
  };
}
