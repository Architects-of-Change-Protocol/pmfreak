import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const runtimeContractsPath = path.join(repoRoot, "src/lib/governance/authority/runtime/runtime-contracts.ts");
const runtimeInputContractsPath = path.join(repoRoot, "src/lib/governance/authority/runtime/runtime-input-contracts.ts");
const authorityPortPath = path.join(repoRoot, "src/lib/governance/authority/runtime/authority-port.ts");

test("runtime-contracts.ts canonical surface exists", () => {
  assert.equal(existsSync(runtimeContractsPath), true);
});

test("runtime-input-contracts.ts canonical input surface exists", () => {
  assert.equal(existsSync(runtimeInputContractsPath), true);
});

test("authority-port.ts references canonical contract surfaces", () => {
  const content = readFileSync(authorityPortPath, "utf8");
  assert.match(content, /\.\/runtime-contracts/);
  assert.match(content, /\.\/runtime-input-contracts/);
});

test("runtime-contracts.ts does not depend on app/auth/security layers", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.doesNotMatch(content, /from\s+["']@\/app\//);
  assert.doesNotMatch(content, /from\s+["']@\/lib\/auth/);
  assert.doesNotMatch(content, /from\s+["']@\/lib\/security/);
});

test("runtime-input-contracts.ts does not depend on forbidden layers", () => {
  const content = readFileSync(runtimeInputContractsPath, "utf8");
  assert.doesNotMatch(content, /from\s+["']@\/app\//);
  assert.doesNotMatch(content, /from\s+["']@\/lib\/auth/);
  assert.doesNotMatch(content, /from\s+["']@\/lib\/security/);
  assert.doesNotMatch(content, /from\s+["'].\/authority-provider/);
  assert.doesNotMatch(content, /from\s+["'].\/in-process-authority-adapter/);
  assert.doesNotMatch(content, /from\s+["'].\/external-authority-adapter/);
});

test("runtime-contracts.ts uses runtime-input-contracts and not operational modules", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /from\s+["']\.\/runtime-input-contracts["']/);
  assert.doesNotMatch(content, /from\s+["']\.\/delegated-capabilities["']/);
  assert.doesNotMatch(content, /from\s+["']\.\/execution-grants["']/);
});

test("runtime-contracts.ts exports canonical runtime contract names", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  for (const symbol of [
    "RuntimePermission",
    "RuntimeWorkspaceRole",
    "RuntimeAuthUserContext",
    "RuntimeGovernanceEvaluationInput",
    "RuntimeEnterpriseDecision",
    "RuntimeEnforcementResult",
    "RuntimeAgentAccessInput",
    "RuntimeAgentScopeInput",
    "RuntimeAuthorityProviderKind",
    "RuntimeAuthorityProviderMetadata",
    "RuntimeAuthorityPortResult",
    "RuntimeAuthorityDependencyError",
    "RuntimeAuthorityUnavailableError",
    "InProcessAuthorityDependencies",
  ]) {
    assert.match(content, new RegExp(`\\b${symbol}\\b`));
  }
});

test("runtime-input-contracts.ts exports canonical input contract names", () => {
  const content = readFileSync(runtimeInputContractsPath, "utf8");
  for (const symbol of ["DelegationConstraints", "DelegationDecision", "DelegationInput", "ExecutionGrantInput"]) {
    assert.match(content, new RegExp(`\\b${symbol}\\b`));
  }
});

test("RuntimeAgentAccessInput is canonicalized and no longer any", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /export type RuntimeAgentAccessInput = \{/);
  assert.doesNotMatch(content, /export type RuntimeAgentAccessInput = any;/);
  assert.match(content, /workspaceId: string;/);
  assert.match(content, /action\?: string \| null;/);
  assert.match(content, /agentId\?: string \| null;/);
  assert.match(content, /actorAgentId\?: string \| null;/);
  assert.match(content, /actorUserId\?: string \| null;/);
  assert.match(content, /requestedPermission\?: RuntimePermission \| string \| null;/);
  assert.match(content, /projectId\?: string \| null;/);
  assert.match(content, /resourceType\?: string \| null;/);
  assert.match(content, /resourceId\?: string \| null;/);
  assert.match(content, /metadata\?: Record<string, unknown>;/);
});

test("RuntimeAgentScopeInput is canonicalized and no longer any", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /export type RuntimeAgentScopeInput = \{/);
  assert.doesNotMatch(content, /export type RuntimeAgentScopeInput = any;/);
  assert.match(content, /workspaceId: string;/);
  assert.match(content, /scope\?: string \| null;/);
  assert.match(content, /scopes\?: string\[\];/);
  assert.match(content, /action\?: string \| null;/);
  assert.match(content, /requestedPermission\?: RuntimePermission \| string \| null;/);
  assert.match(content, /metadata\?: Record<string, unknown>;/);
});


test("RuntimeGovernanceEvaluationInput is structurally narrowed and compatibility-safe", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /export type RuntimeGovernanceEvaluationInput = \{/);
  assert.doesNotMatch(content, /export type RuntimeGovernanceEvaluationInput = any;/);
  assert.match(content, /workspaceId\?: string \| null;/);
  assert.match(content, /actorType: "user" \| "system" \| "ai_agent";/);
  assert.match(content, /action\?: string \| null;/);
  assert.match(content, /metadata\?: Record<string, unknown>;/);
  assert.match(content, /requestedPermission\?: string \| null;/);
  assert.match(content, /projectId\?: string \| null;/);
  assert.match(content, /resourceType\?: string \| null;/);
  assert.match(content, /resourceId\?: string \| null;/);
  assert.match(content, /actorUserId\?: string \| null;/);
  assert.match(content, /actorAgentId\?: string \| null;/);
  assert.match(content, /routeId: string;/);
});

test("RuntimeGovernanceEvaluationInput supports canonical actor types", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /"user"/);
  assert.match(content, /"system"/);
  assert.match(content, /"ai_agent"/);
});


test("RuntimeEnterpriseDecision is canonicalized and no longer any", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /export type RuntimeEnterpriseDecision = \{/);
  assert.doesNotMatch(content, /export type RuntimeEnterpriseDecision = any;/);
  assert.match(content, /allowed: boolean;/);
  assert.match(content, /decisionId: string;/);
});

test("RuntimeEnterpriseDecision preserves extensible metadata and lineage envelope", () => {
  const content = readFileSync(runtimeContractsPath, "utf8");
  assert.match(content, /metadata\?: Record<string, unknown>;/);
  assert.match(content, /lineage\?: \{/);
  assert.match(content, /correlationId\?: string;/);
  assert.match(content, /executionTraceId\?: string;/);
  assert.match(content, /delegationLineage\?: string\[\];/);
  assert.match(content, /decisionLineage\?: string\[\];/);
  assert.match(content, /\[key: string\]: unknown;/);
});

test("runtime wrappers stay wired to canonical governance input contracts", () => {
  const content = readFileSync(authorityPortPath, "utf8");
  assert.match(content, /authorizeAction\(input: RuntimeGovernanceEvaluationInput\)/);
  assert.match(content, /enforceAuthorization\(input: RuntimeGovernanceEvaluationInput\)/);
});


test("authority-port methods stay wired to runtime agent access/scope contracts", () => {
  const content = readFileSync(authorityPortPath, "utf8");
  assert.match(content, /evaluateAgentAccess\(input: RuntimeAgentAccessInput\)/);
  assert.match(content, /requireAgentScope\(input: RuntimeAgentScopeInput\)/);
  assert.match(content, /grantAgentScope\(input: RuntimeAgentScopeInput\)/);
});
