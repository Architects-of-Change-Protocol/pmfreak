// AOC Enterprise Runtime: policy evaluation type re-exports.
// Future extraction boundary: the actual policy evaluation implementation is provided by the
// host application via PolicyEvaluatorPort (src/aoc/protocol/ports/policy-evaluation.ts).
// The concrete PMFreak implementation lives in src/lib/aoc/adapters/policy-evaluation.ts.
// This file exists to preserve the @aoc-enterprise/runtime/policy-engine import path
// for any consumers that import types from it.

export type {
  PolicyDecision,
  PolicyEvaluationInput,
  PolicyEvaluationResult,
} from "@pmfreak/aoc-protocol-internal/ports/policy-evaluation";
