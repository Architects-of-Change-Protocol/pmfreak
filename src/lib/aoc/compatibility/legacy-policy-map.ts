import type { PolicyEvaluationOutcome } from "@/lib/aoc/protocol/types";

/**
 * Normalizes a legacy policy-engine decision string into PMFreak's own
 * five-state evaluation outcome. Unknown values fail closed to "deny".
 */
export function mapLegacyPolicyDecision(decision: string): PolicyEvaluationOutcome {
  if (decision === "allow" || decision === "deny" || decision === "require_approval" || decision === "expired" || decision === "no_match") {
    return decision;
  }
  return "deny";
}
