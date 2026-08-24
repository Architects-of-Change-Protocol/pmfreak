import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push({ name, status: "pass" }); }
  catch (error) { checks.push({ name, status: "fail", error: error instanceof Error ? error.message : String(error) }); }
};

check("bootstrap exports runtime compose helper", () => {
  const source = readFileSync("src/lib/aoc/bootstrap.ts", "utf8");
  assert.match(source, /export function getEnterpriseRuntimeComposeOptions/);
});
check("health endpoint exists", () => {
  const source = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.match(source, /status: "ok"/);
});
check("runtime composition defines adapters", () => {
  const source = readFileSync("src/lib/governance/authority/runtime/composition.ts", "utf8");
  assert.match(source, /const trustDomain = adapters\.trustDomain/);
  assert.match(source, /const policyEvaluator = adapters\.policyEvaluator/);
});

const failed = checks.filter((item) => item.status === "fail");
console.log(JSON.stringify({ suite: "launch-smoke", checks, passed: failed.length === 0 }, null, 2));
if (failed.length) process.exit(1);
