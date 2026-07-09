import { createPMFreakAocGovernanceRequestClientConfig, type PMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import { createPMFreakAocGovernanceRequestClientDescriptor, type PMFreakAocGovernanceRequestClientDescriptor } from "./pmfreak-aoc-governance-client-descriptor";
import { createPMFreakAocGovernanceClientHealth, type PMFreakAocGovernanceClientHealth } from "./pmfreak-aoc-health";
import { createLocalMockPMFreakAocGovernanceTransport } from "./pmfreak-aoc-local-governance-transport";
import { assertPMFreakAocGovernanceClientReadOnlyOperation } from "./pmfreak-aoc-no-mutation-guard";
import { createPMFreakAocGovernanceRequest, type PMFreakAocGovernanceRequestBuilderInput } from "./pmfreak-aoc-request-builder";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { validatePMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-validator";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";
import type { PMFreakAocGovernanceTransport } from "./pmfreak-aoc-transport";
import { createUnsupportedRemotePMFreakAocGovernanceTransport } from "./pmfreak-aoc-unsupported-remote-transport";

export type PMFreakAocGovernanceRequestClient = {
  descriptor: PMFreakAocGovernanceRequestClientDescriptor;
  config: PMFreakAocGovernanceRequestClientConfig;
  transport: PMFreakAocGovernanceTransport;

  getHealth(): Promise<PMFreakAocGovernanceClientHealth>;

  buildRequest(input: PMFreakAocGovernanceRequestBuilderInput): PMFreakAocGovernanceRequest;

  evaluateRequest(request: PMFreakAocGovernanceRequest): Promise<PMFreakAocGovernanceResponse>;

  buildAndEvaluate(input: PMFreakAocGovernanceRequestBuilderInput): Promise<{
    request: PMFreakAocGovernanceRequest;
    response: PMFreakAocGovernanceResponse;
  }>;
};

function resolveDefaultTransport(config: PMFreakAocGovernanceRequestClientConfig): PMFreakAocGovernanceTransport {
  if (config.transportKind === "local_mock") {
    return createLocalMockPMFreakAocGovernanceTransport();
  }
  // No stable remote AOC API contract exists in this repository yet, so
  // both `remote_http` and `unsupported_remote` fall back to the safe
  // unsupported-remote placeholder rather than faking a network call.
  return createUnsupportedRemotePMFreakAocGovernanceTransport();
}

export function createPMFreakAocGovernanceRequestClient(input?: {
  config?: Partial<PMFreakAocGovernanceRequestClientConfig>;
  transport?: PMFreakAocGovernanceTransport;
}): PMFreakAocGovernanceRequestClient {
  const config = createPMFreakAocGovernanceRequestClientConfig(input?.config);
  const transport = input?.transport ?? resolveDefaultTransport(config);
  const descriptor = createPMFreakAocGovernanceRequestClientDescriptor();

  return {
    descriptor,
    config,
    transport,

    async getHealth() {
      assertPMFreakAocGovernanceClientReadOnlyOperation("evaluate_governance_request");
      return createPMFreakAocGovernanceClientHealth({ config, transport });
    },

    buildRequest(requestInput) {
      assertPMFreakAocGovernanceClientReadOnlyOperation("evaluate_governance_request");
      return createPMFreakAocGovernanceRequest({
        ...requestInput,
        config: { ...config, ...requestInput.config },
      });
    },

    async evaluateRequest(request) {
      assertPMFreakAocGovernanceClientReadOnlyOperation("evaluate_governance_request");
      const validation = validatePMFreakAocGovernanceRequest(request);
      if (!validation.valid) {
        throw new PMFreakAocGovernanceClientError(
          "invalid_request",
          `Cannot evaluate invalid governance request: ${validation.errors.join("; ")}`,
          { errors: validation.errors },
        );
      }
      return transport.evaluateGovernanceRequest(request, config);
    },

    async buildAndEvaluate(requestInput) {
      const request = this.buildRequest(requestInput);
      const response = await this.evaluateRequest(request);
      return { request, response };
    },
  };
}
