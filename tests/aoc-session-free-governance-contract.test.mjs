import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const bootstrapSrc = fs.readFileSync('src/lib/aoc/bootstrap.ts', 'utf8');
const actorContextSrc = fs.readFileSync('src/lib/aoc/actor-context.ts', 'utf8');
const policyEvalSrc = fs.readFileSync('src/lib/aoc/adapters/policy-evaluation.ts', 'utf8');
const policyPortSrc = fs.readFileSync('src/lib/governance/authority/ports/policy-evaluation.ts', 'utf8');
const actorModelSrc = fs.readFileSync('src/lib/governance/authority/actor-model.ts', 'utf8');
const runtimeWrapperSrc = fs.readFileSync('src/lib/aoc/enterprise/runtime.ts', 'utf8');
const executionGrantsShimSrc = fs.readFileSync('src/lib/security/execution-grants.ts', 'utf8');
const delegatedCapShimSrc = fs.readFileSync('src/lib/security/delegated-capabilities.ts', 'utf8');
const agentAccessSrc = fs.readFileSync('src/lib/security/agent-access.ts', 'utf8');

test('bootstrap module provides idempotent ensurePmfreakAocAdaptersRegistered', () => {
  assert.match(bootstrapSrc, /let _registered/);
  assert.match(bootstrapSrc, /export function ensurePmfreakAocAdaptersRegistered/);
  assert.match(bootstrapSrc, /if \(_registered\) return/);
  assert.match(bootstrapSrc, /registerPmfreakAocAdapters\(\)/);
  assert.match(bootstrapSrc, /_registered = true/);
});

test('actor-context module provides all three actor resolution helpers', () => {
  assert.match(actorContextSrc, /export function resolveUserGovernanceActorContext/);
  assert.match(actorContextSrc, /export function resolveAgentGovernanceActorContext/);
  assert.match(actorContextSrc, /export function createSystemGovernanceActorContext/);
  assert.match(actorContextSrc, /actorType: "user"/);
  assert.match(actorContextSrc, /actorType: "ai_agent"/);
  assert.match(actorContextSrc, /actorType: "system"/);
});

test('GovernanceActorContext is defined in protocol actor-model', () => {
  assert.match(actorModelSrc, /export type GovernanceActorContext/);
  assert.match(actorModelSrc, /actorId: string/);
  assert.match(actorModelSrc, /actorType: GovernanceActorKind/);
});

test('GovernanceActorKind covers all required actor types', () => {
  assert.match(actorModelSrc, /"user"/);
  assert.match(actorModelSrc, /"ai_agent"/);
  assert.match(actorModelSrc, /"system"/);
  assert.match(actorModelSrc, /"service"/);
});

test('PolicyEvaluationInput requires explicit actor context', () => {
  assert.match(policyPortSrc, /actor: GovernanceActorContext/);
  assert.doesNotMatch(policyPortSrc, /actor\?:/); // must be required, not optional
});

test('policy evaluation adapter does not call requireAuthenticatedUser', () => {
  assert.doesNotMatch(policyEvalSrc, /requireAuthenticatedUser/);
});

test('policy evaluation adapter uses input.actor.actorId for actor identification', () => {
  assert.match(policyEvalSrc, /input\.actor\.actorId/);
  assert.match(policyEvalSrc, /input\.actor\.actorType/);
});

test('policy evaluation adapter skips user grants for non-user actors', () => {
  assert.match(policyEvalSrc, /actorType === "user"/);
});

test('execution grants shim calls bootstrap before delegating', () => {
  assert.match(executionGrantsShimSrc, /ensurePmfreakAocAdaptersRegistered/);
});

test('delegated capabilities shim calls bootstrap before delegating', () => {
  assert.match(delegatedCapShimSrc, /ensurePmfreakAocAdaptersRegistered/);
});

test('runtime wrapper calls bootstrap before governance evaluation', () => {
  assert.match(runtimeWrapperSrc, /ensurePmfreakAocAdaptersRegistered/);
});

test('agent access evaluator delegates final authority to enterprise runtime', () => {
  assert.match(agentAccessSrc, /authorizeRuntimeAction/);
  assert.match(agentAccessSrc, /buildEnterpriseRuntimeRequest/);
  assert.match(agentAccessSrc, /from "@\/aoc\/runtime-consumer"/);
  assert.doesNotMatch(agentAccessSrc, /@\/lib\/aoc\/enterprise\/authorization/);
  assert.doesNotMatch(agentAccessSrc, /@\/lib\/aoc\/pmfreak-runtime-consumer/);
  assert.doesNotMatch(agentAccessSrc, /evaluatePolicyDecision/);
});

test('src/aoc contains no direct session or cookie imports', () => {
  const checks = ['requireAuthenticatedUser', 'cookies(', 'headers('];
  for (const pattern of checks) {
    let output = '';
    try {
      output = execSync(`grep -r "${pattern}" src/aoc`, { encoding: 'utf8' });
    } catch {
      output = '';
    }
    assert.strictEqual(output.trim(), '', `src/aoc must not contain "${pattern}" but found: ${output.trim()}`);
  }
});

test('src/aoc imports from @/lib/security only via runtime-consumer adapters', () => {
  let output = '';
  try {
    output = execSync('grep -r "@/lib/security" src/aoc', { encoding: 'utf8' });
  } catch {
    output = '';
  }
  const lines = output.trim().split('\n').filter(Boolean);
  const allowlist = [
    'src/lib/governance/authority/runtime/in-process-authority-adapter.ts',
    'src/lib/governance/authority/runtime/authority-port.ts',
    'src/lib/governance/authority/runtime/agent-access-bridge.ts',
    'src/lib/governance/authority/runtime/access-guards-bridge.ts',
  ];
  const disallowed = lines.filter((line) => !allowlist.some((allowed) => line.startsWith(`${allowed}:`)));
  assert.strictEqual(disallowed.length, 0, `src/aoc must only import @/lib/security via enterprise runtime bridge modules but found: ${disallowed.join('\n')}`);
});
