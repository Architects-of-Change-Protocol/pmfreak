import { ensurePmfreakAocAdaptersRegistered } from "@/lib/aoc/bootstrap";
import { getAocAdapter } from "@/aoc/runtime/adapters";
import { composeRuntimeContext } from "@/lib/governance/authority/runtime";
import {
  generateExecutionGrantToken,
  issueExecutionGrant as _issueExecutionGrant,
  validateExecutionGrant as _validateExecutionGrant,
  consumeExecutionGrant as _consumeExecutionGrant,
  type ExecutionGrantInput,
} from "@/lib/governance/authority/runtime/execution-grants";

export { generateExecutionGrantToken };
export type { ExecutionGrantInput };

function getComposeOptions() {
  return {
    adapters: {
      trustDomain: getAocAdapter("trustDomain"),
      trustCoordination: getAocAdapter("trustCoordination"),
      securityAudit: getAocAdapter("securityAudit"),
      privilegedDb: getAocAdapter("privilegedDb"),
      accessVerification: getAocAdapter("accessVerification"),
      agentAttestation: getAocAdapter("agentAttestation"),
      policyEvaluator: getAocAdapter("policyEvaluator"),
    },
  };
}

export async function issueExecutionGrant(input: ExecutionGrantInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _issueExecutionGrant(composeRuntimeContext(getComposeOptions()), input);
}

export async function validateExecutionGrant(input: ExecutionGrantInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _validateExecutionGrant(composeRuntimeContext(getComposeOptions()), input);
}

export async function consumeExecutionGrant(input: ExecutionGrantInput) {
  ensurePmfreakAocAdaptersRegistered();
  return _consumeExecutionGrant(composeRuntimeContext(getComposeOptions()), input);
}
