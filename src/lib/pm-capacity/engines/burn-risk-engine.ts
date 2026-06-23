import type { CalculatePMBurnRiskInput, PMBurnRisk } from "../types";
import { PM_BURN_RISK_THRESHOLDS } from "../types";

export function calculatePMBurnRisk(input: CalculatePMBurnRiskInput): PMBurnRisk {
  let riskScore = input.utilizationPercentage;

  // Critical projects add compounding stress
  riskScore += input.criticalProjectCount * 5;
  // Escalations signal systemic issues
  riskScore += input.escalationCount * 6;
  // Execution drift indicates overcommitment
  riskScore += input.executionDriftCount * 4;
  // High decision volume without resolution adds cognitive burden
  riskScore += Math.min(input.openDecisionCount * 1.5, 15);

  if (riskScore >= PM_BURN_RISK_THRESHOLDS.high)   return "critical";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.medium)  return "high";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.low)     return "medium";
  if (riskScore >= PM_BURN_RISK_THRESHOLDS.none)    return "low";
  return "none";
}
