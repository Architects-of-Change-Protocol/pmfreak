import { PMO_RISK_WEIGHTS } from "../types";
import type { PMORiskInput } from "../types";

// ─── calculatePMORiskIndex ────────────────────────────────────────────────────
//
// Risk index: 0 = no risk, 100 = maximum risk.
// Composed of critical project ratio, execution drift, governance gaps,
// overloaded PMs, and escalations.

export function calculatePMORiskIndex(input: PMORiskInput): number {
  const { criticalProjects, executionDrift, governanceGaps, overloadedPMs, escalations } = PMO_RISK_WEIGHTS;

  const criticalProjectRisk = input.totalProjectCount > 0
    ? (input.criticalProjectCount / input.totalProjectCount) * 100
    : 0;

  const driftRisk = input.totalCommitmentCount > 0
    ? (input.executionDriftCount / input.totalCommitmentCount) * 100
    : 0;

  const governanceRisk = Math.min(100, input.governanceGapCount * 5);

  const overloadRisk = input.pmCount > 0
    ? (input.overloadedPMCount / input.pmCount) * 100
    : 0;

  const escalationRisk = Math.min(100, input.escalationCount * 10);

  const raw =
    criticalProjectRisk * criticalProjects +
    driftRisk           * executionDrift   +
    governanceRisk      * governanceGaps   +
    overloadRisk        * overloadedPMs    +
    escalationRisk      * escalations;

  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}
