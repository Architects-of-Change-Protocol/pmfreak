import { generateExecutionGrantToken, type ExecutionGrantInput } from "./execution-grants";
import { getRuntimeAuthorityPort } from "./authority-provider";

export { generateExecutionGrantToken };
export type { ExecutionGrantInput };

export async function issueExecutionGrant(input: ExecutionGrantInput) { return getRuntimeAuthorityPort().issueExecutionGrant(input); }
export async function consumeExecutionGrant(input: ExecutionGrantInput) { return getRuntimeAuthorityPort().consumeExecutionGrant(input); }
export async function validateExecutionGrant(input: ExecutionGrantInput) { return getRuntimeAuthorityPort().verifyExecutionGrant(input); }
