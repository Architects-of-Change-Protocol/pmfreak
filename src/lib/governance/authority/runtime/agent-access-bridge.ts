import { getRuntimeAuthorityPort } from "./authority-provider";
import type { RuntimeAgentAccessInput, RuntimeAgentScopeInput } from "./authority-port";

export async function grantAgentScope(input: RuntimeAgentScopeInput) { return getRuntimeAuthorityPort().grantAgentScope(input); }
export async function evaluateAgentAccess(input: RuntimeAgentAccessInput) { return getRuntimeAuthorityPort().evaluateAgentAccess(input); }
export async function requireAgentScope(input: RuntimeAgentScopeInput) { return getRuntimeAuthorityPort().requireAgentScope(input); }
