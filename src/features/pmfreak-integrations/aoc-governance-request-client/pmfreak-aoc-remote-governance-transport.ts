import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { validatePMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-validator";
import type { PMFreakAocGovernanceTransport } from "./pmfreak-aoc-transport";
import { assertNoPMFreakAocRemoteGovernanceTransportOverclaim } from "./pmfreak-aoc-remote-governance-claim-safety";
import { createPMFreakAocRemoteGovernanceTransportError } from "./pmfreak-aoc-remote-governance-errors";
import { mapAocEndpointResponseToPMFreakAocGovernanceResponse } from "./pmfreak-aoc-remote-governance-response-mapper";
import { parsePMFreakAocRemoteGovernanceEndpointBody } from "./pmfreak-aoc-remote-governance-response-parser";
import { validatePMFreakAocRemoteAocGovernanceResponse } from "./pmfreak-aoc-remote-governance-response-validator";
import { serializePMFreakAocRemoteGovernanceRequest } from "./pmfreak-aoc-remote-governance-request-serializer";
import {
  createPMFreakAocRemoteGovernanceTransportConfig,
  type PMFreakAocRemoteGovernanceTransportConfig,
} from "./pmfreak-aoc-remote-governance-transport-config";

export type PMFreakAocRemoteGovernanceTransportOptions = {
  fetchImpl?: typeof fetch;
};

function isTimeoutShapedError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || /timeout/i.test(error.message));
}

// Builds the `remote_http` PMFreakAocGovernanceTransport: a real, opt-in
// HTTP transport that sends PMFreak governance requests to the AOC PMFreak
// Remote Governance Endpoint v1 and maps governed decisions back into
// PMFreak's existing governance response shape. Callers inject `fetchImpl`
// in tests so no real network call is ever required to exercise this
// module; when omitted, the global `fetch` is used.
export function createRemoteHttpPMFreakAocGovernanceTransport(
  config: Partial<PMFreakAocRemoteGovernanceTransportConfig>,
  options?: PMFreakAocRemoteGovernanceTransportOptions,
): PMFreakAocGovernanceTransport {
  const transportConfig = createPMFreakAocRemoteGovernanceTransportConfig(config);
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  return {
    transportKind: "remote_http",

    async evaluateGovernanceRequest(request: PMFreakAocGovernanceRequest): Promise<PMFreakAocGovernanceResponse> {
      const requestValidation = validatePMFreakAocGovernanceRequest(request);
      if (!requestValidation.valid) {
        throw createPMFreakAocRemoteGovernanceTransportError(
          "invalid_request",
          `Cannot send invalid governance request to AOC: ${requestValidation.errors.join("; ")}`,
          { errors: requestValidation.errors },
        );
      }

      const serialized = serializePMFreakAocRemoteGovernanceRequest(request, transportConfig);

      const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
      const timeoutHandle = controller ? setTimeout(() => controller.abort(), transportConfig.timeoutMs) : undefined;

      let rawResponse: Response;
      try {
        rawResponse = await fetchImpl(serialized.url, {
          method: serialized.method,
          headers: serialized.headers,
          body: serialized.body,
          signal: controller?.signal,
        });
      } catch (error) {
        if (isTimeoutShapedError(error)) {
          throw createPMFreakAocRemoteGovernanceTransportError(
            "timeout",
            `AOC remote governance request timed out after ${transportConfig.timeoutMs}ms.`,
          );
        }
        throw createPMFreakAocRemoteGovernanceTransportError(
          "transport_unavailable",
          "AOC remote governance endpoint is unavailable.",
        );
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }

      let bodyText = "";
      try {
        bodyText = await rawResponse.text();
      } catch {
        throw createPMFreakAocRemoteGovernanceTransportError(
          "invalid_response",
          "Failed to read the AOC remote governance response body.",
        );
      }

      const parsedBody = parsePMFreakAocRemoteGovernanceEndpointBody(bodyText);

      if (!rawResponse.ok) {
        const message = !parsedBody.ok
          ? parsedBody.body.error.message
          : `AOC remote governance endpoint returned HTTP ${rawResponse.status}.`;
        throw createPMFreakAocRemoteGovernanceTransportError("endpoint_error", message, { status: rawResponse.status });
      }

      if (!parsedBody.ok) {
        throw createPMFreakAocRemoteGovernanceTransportError(
          parsedBody.body.error.code === "invalid_response" ? "invalid_response" : "endpoint_error",
          parsedBody.body.error.message,
        );
      }

      const aocResponse = parsedBody.body.response;

      const responseValidation = validatePMFreakAocRemoteAocGovernanceResponse(aocResponse);
      if (!responseValidation.valid) {
        throw createPMFreakAocRemoteGovernanceTransportError(
          "invalid_response",
          `AOC governance response failed validation: ${responseValidation.errors.join("; ")}`,
          { errors: responseValidation.errors },
        );
      }

      if (aocResponse.requestId !== request.requestId) {
        throw createPMFreakAocRemoteGovernanceTransportError(
          "invalid_response",
          "AOC governance response requestId does not match the sent governance request.",
        );
      }
      if (aocResponse.clientId !== request.clientId) {
        throw createPMFreakAocRemoteGovernanceTransportError(
          "invalid_response",
          "AOC governance response clientId does not match the sent governance request.",
        );
      }

      const mapped = mapAocEndpointResponseToPMFreakAocGovernanceResponse({ request, endpointResponse: aocResponse });
      assertNoPMFreakAocRemoteGovernanceTransportOverclaim(mapped);

      return mapped;
    },
  };
}
