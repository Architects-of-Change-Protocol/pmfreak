// PMFreak governance runtime — policy evaluation type re-exports.
// OWNERSHIP: PMFreak. Not Soberania Protocol, not Frontera.
// The implementation is injected via PolicyEvaluatorPort; the concrete PMFreak
// implementation lives in @/lib/aoc/adapters/policy-evaluation.ts.

export type {
  PolicyEvaluationOutcome,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
} from "@/lib/governance/authority/ports/policy-evaluation";
