import {
  consumeExecutionGrant as consumeLegacyExecutionGrant,
  generateExecutionGrantToken,
  issueExecutionGrant as issueLegacyExecutionGrant,
  validateExecutionGrant as verifyLegacyExecutionGrant,
  type ExecutionGrantInput,
} from "@/lib/governance/authority/runtime/execution-grants-bridge";

export { generateExecutionGrantToken };
export type { ExecutionGrantInput };

export async function issueExecutionGrant(input: ExecutionGrantInput) {
  return issueLegacyExecutionGrant(input);
}

export async function verifyExecutionGrant(input: ExecutionGrantInput) {
  return verifyLegacyExecutionGrant(input);
}

export async function consumeExecutionGrant(input: ExecutionGrantInput) {
  try {
    return await consumeLegacyExecutionGrant(input);
  } catch (error) {
    return { ok: false as const, reason: "runtime_dependency_unavailable", metadata: { authoritySource: "runtime-consumer", delegatedTo: "enterprise-runtime", failClosed: true, error: error instanceof Error ? error.message : String(error) } };
  }
}
