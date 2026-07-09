// AOC PMFreak Read-Only Connector v1 — no-mutation guard
//
// A guardrail only: it recognizes forbidden operation names and throws.
// It does not implement any executor or writeback path — there is nothing
// behind this guard to bypass.

import { AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS } from "./pmfreak-read-only-connector-constants";
import { createAocPMFreakConnectorError } from "./pmfreak-connector-errors";
import type { AocPMFreakConnectorError } from "./pmfreak-read-only-connector-types";

const FORBIDDEN_OPERATIONS = new Set<string>(AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS);

export function isAocPMFreakForbiddenConnectorOperation(operationName: string): boolean {
  return FORBIDDEN_OPERATIONS.has(operationName);
}

export class AocPMFreakMutationNotAllowedError extends Error {
  readonly connectorError: AocPMFreakConnectorError;

  constructor(connectorError: AocPMFreakConnectorError) {
    super(connectorError.message);
    this.name = "AocPMFreakMutationNotAllowedError";
    this.connectorError = connectorError;
  }
}

export function assertAocPMFreakReadOnlyOperation(operationName: string): void {
  if (isAocPMFreakForbiddenConnectorOperation(operationName)) {
    throw new AocPMFreakMutationNotAllowedError(
      createAocPMFreakConnectorError(
        "mutation_not_allowed",
        `Operation "${operationName}" is forbidden: the PMFreak Read-Only Connector never mutates PMFreak data.`,
        { operationName }
      )
    );
  }
}
