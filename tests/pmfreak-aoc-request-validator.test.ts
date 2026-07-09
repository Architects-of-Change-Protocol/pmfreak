import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequest,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  validatePMFreakAocGovernanceRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("validator accepts a well-formed governance request", () => {
  const result = validatePMFreakAocGovernanceRequest(demoPMFreakAocBillingAllowedRequest());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validator rejects a request missing critical fields", () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const tampered = {
    ...request,
    clientId: "",
    actionAttempt: { ...request.actionAttempt, agentId: "", projectId: "", actionId: "" },
    projectContext: { ...request.projectContext, projectId: "" },
    actionContext: { ...request.actionContext, actionId: "" },
  };

  const result = validatePMFreakAocGovernanceRequest(tampered);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /clientId/i.test(error)));
  assert.ok(result.errors.some((error) => /agentId/i.test(error)));
  assert.ok(result.errors.some((error) => /projectId/i.test(error)));
  assert.ok(result.errors.some((error) => /actionId/i.test(error)));
});

test("validator rejects a request whose requestMode is neither dry_run nor evaluate_only", () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const tampered = { ...request, requestMode: "execute" as unknown as "dry_run" };

  const result = validatePMFreakAocGovernanceRequest(tampered);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /requestMode/i.test(error)));
});

test("validator rejects a request whose contextFlags contain a forbidden production operation", () => {
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });
  const tampered = {
    ...request,
    actionContext: { ...request.actionContext, contextFlags: [...request.actionContext.contextFlags, "create_invoice"] },
  };

  const result = validatePMFreakAocGovernanceRequest(tampered);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /forbidden production operation/i.test(error)));
});

test("validator is a pure function with no side effects", () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const snapshot = JSON.parse(JSON.stringify(request));

  validatePMFreakAocGovernanceRequest(request);

  assert.deepEqual(JSON.parse(JSON.stringify(request)), snapshot);
});
