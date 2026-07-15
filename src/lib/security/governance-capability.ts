/**
 * Pilot Gate Sprint 01 — Task 8 (M-03, capability-claim secret handling).
 *
 * `PMFREAK_CAPABILITY_CLAIM_SECRET` signs capability claims issued by the
 * governance approval flow (issueExecutionGrant → createCapabilityClaim).
 * Before this sprint it was optional at boot but thrown-on at runtime: a
 * default deployment with governance surfaces enabled would fail mid-flow
 * on the first UI approval.
 *
 * Contract established here:
 *   - Governance capability ENABLED  → the secret is REQUIRED at readiness
 *     (`/api/ready` fails, deploys are caught before user traffic).
 *   - Governance capability DISABLED → governance signing flows degrade
 *     gracefully with an explicit, logged `governance_capability_disabled`
 *     error (fail-closed, never silent), and readiness passes without the
 *     secret.
 *
 * The deployment-level switch is PMFREAK_GOVERNANCE_CAPABILITY_ENABLED
 * ("true" enables). Default is DISABLED — matching the pilot capability-set
 * decision (docs/release/pilot-capability-set.md): governance surfaces are
 * hidden from pilot participants.
 */

export function isGovernanceCapabilityEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PMFREAK_GOVERNANCE_CAPABILITY_ENABLED === "true";
}

export function hasCapabilityClaimSecret(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.PMFREAK_CAPABILITY_CLAIM_SECRET);
}

export type GovernanceCapabilityCheck = {
  name: "governance_capability";
  status: "pass" | "fail";
  detail?: string;
};

/**
 * Readiness check: fails ONLY in the misconfigured state (governance
 * enabled without its signing secret). Never echoes any secret value.
 */
export function checkGovernanceCapabilityConfiguration(env: NodeJS.ProcessEnv = process.env): GovernanceCapabilityCheck {
  const enabled = isGovernanceCapabilityEnabled(env);
  const hasSecret = hasCapabilityClaimSecret(env);

  if (enabled && !hasSecret) {
    return {
      name: "governance_capability",
      status: "fail",
      detail: "PMFREAK_GOVERNANCE_CAPABILITY_ENABLED=true requires PMFREAK_CAPABILITY_CLAIM_SECRET to be set",
    };
  }

  if (!enabled) {
    return { name: "governance_capability", status: "pass", detail: "governance capability disabled; claim signing unavailable by design" };
  }

  return { name: "governance_capability", status: "pass" };
}

/**
 * Resolves the claim-signing secret for governance flows. Fail-closed and
 * never silent:
 *   - disabled capability → `governance_capability_disabled` (expected
 *     degradation; callers surface a clear denial)
 *   - enabled but missing secret → `capability_claim_secret_missing`
 *     (misconfiguration; also caught earlier by the readiness check)
 */
export function resolveCapabilityClaimSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.PMFREAK_CAPABILITY_CLAIM_SECRET;
  if (!isGovernanceCapabilityEnabled(env)) {
    // Deployments may still sign claims with the secret set while the
    // capability flag is off (internal/founder use); only the combination
    // of "no flag AND no secret" is the designed degraded state.
    if (secret) return secret;
    throw new Error("governance_capability_disabled");
  }
  if (!secret) throw new Error("capability_claim_secret_missing");
  return secret;
}
