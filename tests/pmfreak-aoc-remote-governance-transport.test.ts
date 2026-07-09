import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequest,
  createPMFreakAocGovernanceRequestClient,
  createPMFreakAocGovernanceRequestClientConfig,
  createRemoteHttpPMFreakAocGovernanceTransport,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  demoPMFreakAocRemoteTransportBillingMissingApprovalEndpointBody,
  demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody,
  demoPMFreakAocRemoteTransportCancelledEndpointBody,
  demoPMFreakAocRemoteTransportEndpointErrorBody,
  createSuccessfulAocRemoteGovernanceFetchMock,
  createEndpointErrorAocRemoteGovernanceFetchMock,
  createNetworkFailureAocRemoteGovernanceFetchMock,
  createMalformedAocRemoteGovernanceFetchMock,
  createTimeoutAocRemoteGovernanceFetchMock,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const clientConfig = createPMFreakAocGovernanceRequestClientConfig();

test("remote transport uses transportKind = remote_http", () => {
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
  );
  assert.equal(transport.transportKind, "remote_http");
});

test("remote transport calls fetchImpl with a POST containing the serialized governance request", async () => {
  let capturedUrl: unknown;
  let capturedInit: RequestInit | undefined;

  const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(JSON.stringify(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport({ aocBaseUrl: "https://aoc.example.com" }, { fetchImpl });
  await transport.evaluateGovernanceRequest(request, clientConfig);

  assert.equal(capturedUrl, "https://aoc.example.com/api/aoc/pmfreak/governance/evaluate");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(JSON.parse(String(capturedInit?.body)).requestId, request.requestId);
});

test("remote transport maps a successful allow response", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
  );

  const response = await transport.evaluateGovernanceRequest(request, clientConfig);
  assert.equal(response.decision, "allow");
  assert.equal(response.evaluatedBy, "aoc");
  assert.equal(response.requestId, request.requestId);
  assert.equal(response.clientId, request.clientId);
});

test("remote transport maps a require_evidence response", async () => {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody()) },
  );

  const response = await transport.evaluateGovernanceRequest(request, clientConfig);
  assert.equal(response.decision, "require_evidence");
});

test("remote transport maps a require_billing_review response", async () => {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingMissingApprovalEndpointBody()) },
  );

  const response = await transport.evaluateGovernanceRequest(request, clientConfig);
  assert.equal(response.decision, "require_billing_review");
});

test("remote transport maps a deny response", async () => {
  const cancelledAttempt = { ...demoPMFreakAocBillingReadinessActionAttempt(), status: "cancelled" as const };
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: cancelledAttempt });
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportCancelledEndpointBody()) },
  );

  const response = await transport.evaluateGovernanceRequest(request, clientConfig);
  assert.equal(response.decision, "deny");
});

test("remote transport handles endpoint ok=false safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createEndpointErrorAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportEndpointErrorBody(), { status: 200 }) },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "endpoint_error");
    return true;
  });
});

test("remote transport handles a non-2xx endpoint status safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createEndpointErrorAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportEndpointErrorBody(), { status: 500 }) },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "endpoint_error");
    assert.equal((error as { details?: { status?: number } }).details?.status, 500);
    return true;
  });
});

test("remote transport handles a network failure safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createNetworkFailureAocRemoteGovernanceFetchMock() },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "transport_unavailable");
    return true;
  });
});

test("remote transport handles a malformed body safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createMalformedAocRemoteGovernanceFetchMock() },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "invalid_response");
    return true;
  });
});

test("remote transport handles a timeout-shaped failure safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createTimeoutAocRemoteGovernanceFetchMock() },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "timeout");
    return true;
  });
});

test("remote transport rejects a mismatched requestId safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const tamperedBody = demoPMFreakAocRemoteTransportBillingAllowedEndpointBody();
  tamperedBody.response.requestId = "some.other.request.id.v1";

  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(tamperedBody) },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "invalid_response");
    assert.match(error.message, /requestId/);
    return true;
  });
});

test("remote transport rejects a mismatched clientId safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const tamperedBody = demoPMFreakAocRemoteTransportBillingAllowedEndpointBody();
  tamperedBody.response.clientId = "some.other.client.id.v1";

  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(tamperedBody) },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "invalid_response");
    assert.match(error.message, /clientId/);
    return true;
  });
});

test("remote transport rejects an invalid AOC response safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const invalidBody = demoPMFreakAocRemoteTransportBillingAllowedEndpointBody();
  invalidBody.response.decision = "not_a_real_decision" as never;

  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(invalidBody) },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal((error as { code?: string }).code, "invalid_response");
    return true;
  });
});

test("remote transport does not leak secrets in thrown errors", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const transport = createRemoteHttpPMFreakAocGovernanceTransport(
    {
      aocBaseUrl: "https://aoc.example.com",
      authMode: "bearer_token",
      bearerToken: "sk-demo-should-never-leak-into-errors-1234567890",
    },
    { fetchImpl: createNetworkFailureAocRemoteGovernanceFetchMock() },
  );

  await assert.rejects(() => transport.evaluateGovernanceRequest(request, clientConfig), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!JSON.stringify((error as { details?: unknown }).details ?? "").includes("sk-demo-should-never-leak-into-errors-1234567890"));
    assert.ok(!error.message.includes("sk-demo-should-never-leak-into-errors-1234567890"));
    return true;
  });
});

test("remote transport never calls the real global fetch when fetchImpl is provided", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("real network fetch must not be called in tests");
  }) as typeof fetch;

  try {
    const request = demoPMFreakAocBillingAllowedRequest();
    const transport = createRemoteHttpPMFreakAocGovernanceTransport(
      { aocBaseUrl: "https://aoc.example.com" },
      { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
    );
    const response = await transport.evaluateGovernanceRequest(request, clientConfig);
    assert.equal(response.decision, "allow");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("default PMFreak governance client still defaults to local_mock", () => {
  const client = createPMFreakAocGovernanceRequestClient();
  assert.equal(client.transport.transportKind, "local_mock");
  assert.equal(client.config.transportKind, "local_mock");
});

test("PMFreak governance client can use the remote_http transport when explicitly provided", async () => {
  const remoteTransport = createRemoteHttpPMFreakAocGovernanceTransport(
    { aocBaseUrl: "https://aoc.example.com" },
    { fetchImpl: createSuccessfulAocRemoteGovernanceFetchMock(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()) },
  );
  const client = createPMFreakAocGovernanceRequestClient({
    config: { transportKind: "remote_http" },
    transport: remoteTransport,
  });

  assert.equal(client.transport.transportKind, "remote_http");
  const { response } = await client.buildAndEvaluate({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });
  assert.equal(response.decision, "allow");
  assert.equal(response.evaluatedBy, "aoc");
});
