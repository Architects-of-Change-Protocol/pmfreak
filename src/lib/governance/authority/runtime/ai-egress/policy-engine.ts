import type { AIEgressDecision, AIEgressRequest, AIEgressProviderMetadata, DataSensitivity } from "./types";

const SENSITIVITY_ORDER: DataSensitivity[] = ["public", "internal", "confidential", "restricted"];

export function evaluateAIEgressPolicy(request: AIEgressRequest, providerMetadata: AIEgressProviderMetadata): AIEgressDecision {
  const sensitivity = request.estimatedSensitivity;

  if (!request.actor?.actorType) {
    return deny("actor_missing", "Missing actor context.");
  }
  if (!sensitivity) {
    return deny("sensitivity_missing", "Missing data sensitivity classification.");
  }
  if (!providerMetadata.trustTier) {
    return deny("provider_trust_unknown", "Provider trust tier is unknown.");
  }
  if (!providerMetadata.allowedSensitivityLevels.includes(sensitivity)) {
    return deny("sensitivity_not_allowed", `Provider '${providerMetadata.id}' does not permit '${sensitivity}' sensitivity.`);
  }

  if (request.actor.actorType === "system" && providerMetadata.id !== "local") {
    return deny("system_external_provider_denied", "System actor cannot use external provider without explicit policy allowance.");
  }

  if (sensitivity === "restricted" && providerMetadata.trustTier !== "trusted") {
    return deny("restricted_requires_trusted", "Restricted data is limited to trusted providers.");
  }

  if (providerMetadata.id === "mock" && SENSITIVITY_ORDER.indexOf(sensitivity) >= SENSITIVITY_ORDER.indexOf("confidential")) {
    return deny("mock_confidential_denied", "Mock provider cannot process confidential or restricted data.");
  }

  if (providerMetadata.trustTier === "conditional" && SENSITIVITY_ORDER.indexOf(sensitivity) >= SENSITIVITY_ORDER.indexOf("confidential")) {
    return {
      decision: "allow",
      reason: "Conditional provider accepted with mandatory audit trail.",
      policyId: "conditional_provider_audit",
      enforcementLevel: "soft",
      auditRequired: true,
    };
  }

  return {
    decision: "allow",
    reason: "Inference request meets baseline AI egress policy.",
    policyId: "baseline_allow",
    enforcementLevel: "hard",
    auditRequired: true,
  };
}

function deny(policyId: string, reason: string): AIEgressDecision {
  return { decision: "deny", reason, policyId, enforcementLevel: "hard", auditRequired: true };
}
