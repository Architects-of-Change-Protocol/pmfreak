/**
 * Pilot Gate Sprint 01 — Task 8 (M-03, capability-claim secret handling).
 *
 * Contract:
 *   - governance enabled  + secret present → resolves (signing works)
 *   - governance enabled  + secret missing → readiness FAILS; runtime throws
 *     capability_claim_secret_missing (misconfiguration, caught pre-traffic)
 *   - governance disabled + secret missing → readiness PASSES; runtime
 *     throws governance_capability_disabled (graceful, explicit, fail-closed)
 *   - governance disabled + secret present → resolves (internal/founder use)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  checkGovernanceCapabilityConfiguration,
  isGovernanceCapabilityEnabled,
  resolveCapabilityClaimSecret,
} from "../src/lib/security/governance-capability";

const env = (overrides: Record<string, string | undefined>) => ({ ...overrides }) as NodeJS.ProcessEnv;

test("enabled + secret present: readiness passes and secret resolves", () => {
  const e = env({ PMFREAK_GOVERNANCE_CAPABILITY_ENABLED: "true", PMFREAK_CAPABILITY_CLAIM_SECRET: "s3cret" });
  assert.equal(isGovernanceCapabilityEnabled(e), true);
  assert.equal(checkGovernanceCapabilityConfiguration(e).status, "pass");
  assert.equal(resolveCapabilityClaimSecret(e), "s3cret");
});

test("enabled + secret missing: readiness fails (deploy-time catch), runtime throws misconfiguration", () => {
  const e = env({ PMFREAK_GOVERNANCE_CAPABILITY_ENABLED: "true" });
  const check = checkGovernanceCapabilityConfiguration(e);
  assert.equal(check.status, "fail");
  assert.match(check.detail ?? "", /PMFREAK_CAPABILITY_CLAIM_SECRET/);
  assert.throws(() => resolveCapabilityClaimSecret(e), /capability_claim_secret_missing/);
});

test("disabled + secret missing: readiness passes, runtime degrades explicitly (never silent)", () => {
  const e = env({});
  assert.equal(isGovernanceCapabilityEnabled(e), false);
  assert.equal(checkGovernanceCapabilityConfiguration(e).status, "pass");
  assert.throws(() => resolveCapabilityClaimSecret(e), /governance_capability_disabled/);
});

test("disabled + secret present: signing still resolves (internal/founder use)", () => {
  const e = env({ PMFREAK_CAPABILITY_CLAIM_SECRET: "s3cret" });
  assert.equal(checkGovernanceCapabilityConfiguration(e).status, "pass");
  assert.equal(resolveCapabilityClaimSecret(e), "s3cret");
});

test("readiness check never echoes the secret value", () => {
  const e = env({ PMFREAK_GOVERNANCE_CAPABILITY_ENABLED: "true", PMFREAK_CAPABILITY_CLAIM_SECRET: "super-secret-value" });
  const serialized = JSON.stringify(checkGovernanceCapabilityConfiguration(e));
  assert.ok(!serialized.includes("super-secret-value"));
});

test("the readiness route includes the governance capability check", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/api/ready/route.ts", "utf8");
  assert.ok(src.includes("checkGovernanceCapabilityConfiguration"), "/api/ready must run the governance capability check");
});

test("the trust-domain adapter routes through the governed resolver", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/lib/aoc/adapters/trust-domain.ts", "utf8");
  assert.ok(src.includes("resolveCapabilityClaimSecret"), "adapter must use resolveCapabilityClaimSecret");
  assert.ok(!/process\.env\.PMFREAK_CAPABILITY_CLAIM_SECRET/.test(src), "adapter must not read the secret directly");
});
