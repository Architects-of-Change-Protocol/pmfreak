import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateReasonCodes } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("reason helper creates aoc_allow", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "allow" as never }), ["aoc_allow"]);
});

test("reason helper creates aoc_deny", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "deny" as never }), ["aoc_deny"]);
});

test("reason helper creates aoc_hold", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "hold" as never }), ["aoc_hold"]);
});

test("reason helper creates aoc_requires_evidence", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "require_evidence" as never }), ["aoc_requires_evidence"]);
});

test("reason helper creates aoc_requires_pm_approval", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "require_pm_approval" as never }), ["aoc_requires_pm_approval"]);
});

test("reason helper creates aoc_requires_billing_review", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "require_billing_review" as never }), ["aoc_requires_billing_review"]);
});

test("reason helper creates missing_governance_response when decision is absent", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({}), ["missing_governance_response"]);
});

test("reason helper creates unknown_decision for an unrecognized decision", () => {
  assert.deepEqual(createPMFreakAocGateReasonCodes({ decision: "not_a_real_decision" as never }), ["unknown_decision"]);
});

test("reason helper creates mismatched_request_id", () => {
  const codes = createPMFreakAocGateReasonCodes({ decision: "allow" as never, mismatchedRequestId: true });
  assert.ok(codes.includes("mismatched_request_id"));
});

test("reason helper creates mismatched_client_id", () => {
  const codes = createPMFreakAocGateReasonCodes({ decision: "allow" as never, mismatchedClientId: true });
  assert.ok(codes.includes("mismatched_client_id"));
});

test("reason helper creates unsafe_claim", () => {
  const codes = createPMFreakAocGateReasonCodes({ decision: "allow" as never, unsafeClaim: true });
  assert.ok(codes.includes("unsafe_claim"));
});

test("reason helper creates invalid_gate_input when validation errors are present", () => {
  const codes = createPMFreakAocGateReasonCodes({ decision: "allow" as never, validationErrors: ["demo.error.v1"] });
  assert.ok(codes.includes("invalid_gate_input"));
});

test("reason helper can combine multiple codes", () => {
  const codes = createPMFreakAocGateReasonCodes({
    decision: "deny" as never,
    mismatchedRequestId: true,
    mismatchedClientId: true,
    unsafeClaim: true,
    validationErrors: ["demo.error.v1"],
  });
  assert.deepEqual(codes, ["aoc_deny", "mismatched_request_id", "mismatched_client_id", "unsafe_claim", "invalid_gate_input"]);
});
