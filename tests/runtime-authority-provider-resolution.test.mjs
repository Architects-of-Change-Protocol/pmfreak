import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerSrc = readFileSync("src/lib/governance/authority/runtime/authority-provider.ts", "utf8");
const externalSrc = readFileSync("src/lib/governance/authority/runtime/external-authority-adapter.ts", "utf8");

test("default provider is in_process", () => {
  assert.match(providerSrc, /if \(!raw\) return "in_process"/);
});

test("provider supports external kinds", () => {
  assert.match(providerSrc, /"external_sdk"/);
  assert.match(providerSrc, /"remote_service"/);
  assert.match(providerSrc, /"federated"/);
});

test("external adapter fails closed when not configured", () => {
  assert.match(externalSrc, /external_runtime_not_configured/);
  assert.match(externalSrc, /failClosed: true/);
});

test("test override hooks exist", () => {
  assert.match(providerSrc, /setRuntimeAuthorityPortForTests/);
  assert.match(providerSrc, /resetRuntimeAuthorityPortForTests/);
});
