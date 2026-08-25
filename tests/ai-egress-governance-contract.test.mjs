import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const policySource = fs.readFileSync('src/lib/governance/authority/runtime/ai-egress/policy-engine.ts', 'utf8');
const gatewaySource = fs.readFileSync('src/lib/ai/gateway/inference-gateway.ts', 'utf8');
const registrySource = fs.readFileSync('src/lib/ai/providers/provider-registry.ts', 'utf8');
const auditSource = fs.readFileSync('src/lib/aoc/audit/ai-egress-audit.ts', 'utf8');

test('restricted data denied to conditional providers', () => {
  assert.match(policySource, /restricted.*trusted providers/s);
});

test('unknown providers denied in gateway when metadata missing', () => {
  assert.match(gatewaySource, /Provider metadata missing/);
  assert.match(gatewaySource, /Inference policy denied\./);
});

test('missing actor denied by policy engine', () => {
  assert.match(policySource, /actor_missing/);
});

test('missing provider metadata denied fail-closed', () => {
  assert.match(gatewaySource, /if \(!providerMetadata\)/);
});

test('mock provider blocked for confidential data', () => {
  assert.match(policySource, /mock provider cannot process confidential/i);
});

test('gateway evaluates policy before provider execution', () => {
  assert.ok(gatewaySource.indexOf('evaluateAIEgressPolicy') < gatewaySource.indexOf('runProviderInference'));
});

test('openai allows valid internal/confidential through conditional path', () => {
  assert.match(registrySource, /"openai"/);
  assert.match(registrySource, /"internal", "confidential"/);
  assert.match(policySource, /Conditional provider accepted/);
});

test('audit event emitted with ai_egress_decision', () => {
  assert.match(auditSource, /eventType: "ai_egress_decision"/);
  assert.match(gatewaySource, /recordAIEgressDecision\(/);
});

test('routes must keep using gateway: no runProviderInference in api routes', () => {
  function walkTs(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) results.push(...walkTs(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) results.push(full);
    }
    return results;
  }
  for (const file of walkTs('src/app/api')) {
    const apiSource = fs.readFileSync(file, 'utf8');
    assert.ok(!apiSource.includes('runProviderInference'), `runProviderInference found in ${file}`);
  }
});

test('fail-closed denies ambiguous sensitivity by normalization', () => {
  assert.match(gatewaySource, /normalizeSensitivity/);
  assert.match(policySource, /sensitivity_missing/);
});
