import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MIGRATED_ROUTES = [
  "src/app/api/operational-memory/route.ts",
  "src/app/api/sdk/capabilities/requests/[id]/approve/route.ts",
  "src/app/api/sdk/capabilities/requests/[id]/deny/route.ts",
  "src/app/api/sdk/capabilities/grants/[id]/revoke/route.ts",
];

test("migrated routes consume enterprise runtime authorization adapter", () => {
  for (const file of MIGRATED_ROUTES) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("buildEnterpriseRuntimeRequest("), true, `${file} must construct enterprise runtime request`);
    assert.equal(src.includes("authorizeRuntimeAction("), true, `${file} must call enterprise runtime authorization entrypoint`);
    assert.equal(src.includes("evaluatePolicyDecision("), false, `${file} must not run local policy engine`);
  }
});

test("policy simulation route is explicitly non-authoritative", () => {
  const src = readFileSync("src/app/api/sdk/policies/evaluate/route.ts", "utf8");
  assert.equal(src.includes('decisionSource: "policy-simulation"'), true, "policy evaluate route must identify simulation source");
  assert.equal(src.includes("authoritative: false"), true, "policy evaluate route must be non-authoritative");
  assert.equal(src.includes('productionAuthority: "enterprise-runtime"'), true, "policy evaluate route must point to production runtime authority");
});

test("access-guards delegates authorization authority to enterprise runtime", () => {
  const src = readFileSync("src/lib/security/access-guards.ts", "utf8");
  assert.equal(src.includes("authorizeRuntimeAction"), true, "access-guards must import authorizeRuntimeAction");
  assert.equal(src.includes("buildEnterpriseRuntimeRequest"), true, "access-guards must build enterprise runtime requests");
  assert.equal(src.includes("evaluatePolicyDecision"), false, "access-guards must not import/call evaluatePolicyDecision");
  assert.equal(src.includes("defaultGovernancePolicyEvaluator"), false, "access-guards must not perform local RBAC policy evaluation");
});

test("runtime decision envelope includes authority metadata", () => {
  const src = readFileSync("src/lib/aoc/enterprise/authorization.ts", "utf8");
  assert.equal(src.includes("decisionSource"), true, "runtime decision must include decisionSource");
  assert.equal(src.includes("authoritative"), true, "runtime decision must include authoritative flag");
});

test("enterprise/protocol boundaries stay clean", () => {
  const enterpriseExports = readFileSync("src/lib/governance/authority/runtime/index.ts", "utf8");
  assert.equal(/@\/lib|@\/app/.test(enterpriseExports), false, "src/lib/governance/authority/runtime must not import from app/lib aliases");

  const protocolExports = readFileSync("src/lib/governance/authority/index.ts", "utf8");
  assert.equal(/@\/lib|@\/app|@\/sdk|@\/aoc\/enterprise/.test(protocolExports), false, "src/lib/governance/authority must not import app/lib/sdk/enterprise aliases");
});


test("runtime-consumer normalization remains wired to enterprise decisions", () => {
  const client = readFileSync("src/aoc/runtime-consumer/runtime-client.ts", "utf8");
  const authorization = readFileSync("src/aoc/runtime-consumer/runtime-authorization.ts", "utf8");
  assert.equal(client.includes("normalizeRuntimeDecision"), true, "runtime-client must normalize decisions");
  assert.equal(client.includes("decision.decisionId"), true, "runtime-client must consume decisionId");
  assert.equal(client.includes("decision.allowed"), true, "runtime-client must consume allowed");
  assert.equal(authorization.includes("decisionId"), true, "runtime-authorization must produce decisionId");
  assert.equal(authorization.includes("allowed: false"), true, "runtime-authorization fail-closed path must preserve allowed boolean");
});
