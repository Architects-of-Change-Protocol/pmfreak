// LEGACY SHIM — do not add new imports or logic here.
// Types are re-exported from @aoc-enterprise/runtime.
// The evaluatePolicyDecision implementation now lives in src/lib/aoc/adapters/policy-evaluation.ts
// (moved from AOC enterprise runtime as part of the dependency inversion refactor).
// TODO(aoc-migration): remove this shim once all direct importers are migrated.
export type { PolicyEvaluationOutcome, PolicyEvaluationInput, PolicyEvaluationResult } from "@/lib/governance/authority/runtime/policy-engine";
export { evaluatePolicyDecision } from "@/lib/aoc/adapters/policy-evaluation";
