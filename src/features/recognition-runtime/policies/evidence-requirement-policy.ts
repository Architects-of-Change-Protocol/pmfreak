import { fail, pass, type RecognitionPolicy } from "./policy-context";

const POLICY_NAME = "evidence_requirement";

export const evidenceRequirementPolicy: RecognitionPolicy = (ctx) => {
  const rule = ctx.requirementRule;
  if (!rule || rule.requiredEvidenceTypes.length === 0) {
    return pass(POLICY_NAME, "NO_EVIDENCE_REQUIRED", "No evidence requirement applies to this action");
  }

  const providedTypes = new Set((ctx.actionRequest.evidence ?? []).map((artifact) => artifact.type));
  const missing = rule.requiredEvidenceTypes.filter((type) => !providedTypes.has(type));

  if (missing.length > 0) {
    return fail(
      POLICY_NAME,
      "require_more_evidence",
      "EVIDENCE_MISSING",
      `Missing required evidence: ${missing.join(", ")}`
    );
  }

  return pass(POLICY_NAME, "EVIDENCE_SATISFIED", "All required evidence types were provided");
};
