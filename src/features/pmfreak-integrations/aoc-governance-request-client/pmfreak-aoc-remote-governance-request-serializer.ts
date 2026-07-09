import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import { createPMFreakAocRemoteGovernanceTransportError } from "./pmfreak-aoc-remote-governance-errors";
import { PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_SHARED_SECRET_HEADER_NAME } from "./pmfreak-aoc-remote-governance-transport-constants";
import type { PMFreakAocRemoteGovernanceTransportConfig } from "./pmfreak-aoc-remote-governance-transport-config";

export type PMFreakAocRemoteGovernanceSerializedRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

function normalizeAocBaseUrl(aocBaseUrl: string): string {
  return aocBaseUrl.endsWith("/") ? aocBaseUrl.slice(0, -1) : aocBaseUrl;
}

function normalizeEndpointPath(endpointPath: string): string {
  return endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
}

function buildRemoteGovernanceUrl(config: PMFreakAocRemoteGovernanceTransportConfig): string {
  return `${normalizeAocBaseUrl(config.aocBaseUrl)}${normalizeEndpointPath(config.endpointPath)}`;
}

// Deterministic, offline byte-length estimate — no network round trip is
// required to know whether a payload is too large to send.
function estimatePayloadSizeKb(body: string): number {
  return new TextEncoder().encode(body).length / 1024;
}

function buildAuthHeaders(config: PMFreakAocRemoteGovernanceTransportConfig): Record<string, string> {
  if (config.authMode === "none_demo") {
    return {};
  }

  if (config.authMode === "shared_secret_header") {
    if (!config.sharedSecretValue) {
      throw createPMFreakAocRemoteGovernanceTransportError(
        "invalid_config",
        "authMode is shared_secret_header but no sharedSecretValue is configured.",
      );
    }
    const headerName = config.sharedSecretHeaderName ?? PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_SHARED_SECRET_HEADER_NAME;
    return { [headerName]: config.sharedSecretValue };
  }

  if (config.authMode === "bearer_token") {
    if (!config.bearerToken) {
      throw createPMFreakAocRemoteGovernanceTransportError("invalid_config", "authMode is bearer_token but no bearerToken is configured.");
    }
    return { authorization: `Bearer ${config.bearerToken}` };
  }

  // config.authMode === "unsupported"
  throw createPMFreakAocRemoteGovernanceTransportError(
    "invalid_config",
    'authMode "unsupported" cannot be used to send a remote governance request.',
  );
}

// Pure, deterministic serialization: builds a POST request description from
// a governance request without mutating the input, executing the action, or
// performing any network I/O itself.
export function serializePMFreakAocRemoteGovernanceRequest(
  request: PMFreakAocGovernanceRequest,
  config: PMFreakAocRemoteGovernanceTransportConfig,
): PMFreakAocRemoteGovernanceSerializedRequest {
  const body = JSON.stringify(request);
  const payloadSizeKb = estimatePayloadSizeKb(body);

  if (payloadSizeKb > config.maxPayloadSizeKb) {
    throw createPMFreakAocRemoteGovernanceTransportError(
      "payload_too_large",
      `Governance request payload (${payloadSizeKb.toFixed(2)}KB) exceeds the configured maxPayloadSizeKb (${config.maxPayloadSizeKb}KB).`,
      { payloadSizeKb, maxPayloadSizeKb: config.maxPayloadSizeKb },
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...buildAuthHeaders(config),
  };

  return {
    url: buildRemoteGovernanceUrl(config),
    method: "POST",
    headers,
    body,
  };
}
