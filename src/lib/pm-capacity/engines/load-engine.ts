import type { CalculatePMLoadInput } from "../types";

// Each project contributes a baseline load unit
const LOAD_PER_PROJECT              = 12;
// Critical projects carry higher cognitive load
const LOAD_PER_CRITICAL_PROJECT     = 8;   // additional on top of LOAD_PER_PROJECT
// Open decisions are active cognitive items
const LOAD_PER_OPEN_DECISION        = 4;
// Open commitments are tracked obligations
const LOAD_PER_OPEN_COMMITMENT      = 3;
// Execution drift represents off-track tasks requiring intervention
const LOAD_PER_EXECUTION_DRIFT      = 5;
// Escalations are the highest-weight items
const LOAD_PER_ESCALATION           = 8;
// Attention allocation score (0-100) adds proportional load
const ATTENTION_ALLOCATION_SCALE    = 0.30;

export function calculatePMLoad(input: CalculatePMLoadInput): number {
  const projectLoad     = input.projectCount * LOAD_PER_PROJECT;
  const criticalLoad    = input.criticalProjectCount * LOAD_PER_CRITICAL_PROJECT;
  const decisionLoad    = input.openDecisionCount * LOAD_PER_OPEN_DECISION;
  const commitmentLoad  = input.openCommitmentCount * LOAD_PER_OPEN_COMMITMENT;
  const driftLoad       = input.executionDriftCount * LOAD_PER_EXECUTION_DRIFT;
  const escalationLoad  = input.escalationCount * LOAD_PER_ESCALATION;
  const attentionLoad   = input.attentionAllocationScore * ATTENTION_ALLOCATION_SCALE;

  const total =
    projectLoad +
    criticalLoad +
    decisionLoad +
    commitmentLoad +
    driftLoad +
    escalationLoad +
    attentionLoad;

  return Math.max(0, Math.round(total));
}
