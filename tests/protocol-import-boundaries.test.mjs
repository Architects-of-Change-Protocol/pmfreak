import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The governance domain (types, ports, claim logic) must stay free of PMFreak
 * infrastructure. It was previously asserted to import no "@/lib" at all, which
 * stopped meaning anything once P0-PKG-05 established the layer IS PMFreak @/lib
 * code; these are the substantive dependencies it must still never take.
 */
const FORBIDDEN = [
  "@/app",
  "@/components",
  "@/sdk",
  "@/lib/auth",
  "@/lib/supabase",
  "@/lib/security/",
  "@supabase/",
  "next/server",
  "src/aoc/protocol",
  "src/aoc/enterprise",
  "@pmfreak/aoc-",
];
const ALLOWED_APP_PREFIX = "@/lib/governance/authority";
const collectSourceFiles = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      found.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|mjs)$/.test(full)) found.push(full.replaceAll("\\", "/"));
  }
  return found;
};

const protocolFiles = collectSourceFiles("src/lib/governance/authority");

test("governance domain files do not import PMFreak infrastructure, routes, UI or SDK", () => {
  assert.ok(protocolFiles.length > 0, "expected governance domain files to validate");
  for (const file of protocolFiles) {
    const specifiers = [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const spec of specifiers) {
      for (const blocked of FORBIDDEN) {
        assert.equal(spec.includes(blocked), false, `forbidden dependency '${spec}' found in ${file}`);
      }
      if (spec.startsWith("@/")) {
        assert.ok(
          spec.startsWith(ALLOWED_APP_PREFIX),
          `${file} imports '${spec}'; the governance domain may only import ${ALLOWED_APP_PREFIX}/*`,
        );
      }
    }
  }
});

test("the governance domain consumes the canonical Protocol only through declared public exports", () => {
  for (const file of protocolFiles) {
    const specifiers = [...readFileSync(file, "utf8").matchAll(/from\s+["'](@aoc\/[^"']+|@aoc-enterprise\/[^"']+)["']/g)].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.doesNotMatch(spec, /\/(dist|src)\//, `${file} deep-imports '${spec}'; use a declared public export`);
    }
  }
});

test("protocol capability claims require explicit injection ports", () => {
  const source = readFileSync("src/lib/governance/authority/capability-claims.ts", "utf8");
  assert.match(source, /ports: CapabilityClaimPorts/);
  assert.match(source, /ports\.trustDomain/);
  assert.match(source, /ports\.trustCoordination/);
  assert.doesNotMatch(source, /getAocAdapter/);
  assert.doesNotMatch(source, /process\.env/);
});

test("enterprise runtime owns capability claim port composition", () => {
  const source = readFileSync("src/lib/governance/authority/runtime/composition.ts", "utf8");
  assert.match(source, /export function composeCapabilityClaimPorts/);
  assert.match(source, /export function composeRuntimeContext/);
  assert.match(source, /const trustDomain = adapters\.trustDomain/);
  assert.match(source, /const trustCoordination = adapters\.trustCoordination/);
  assert.match(source, /const securityAudit = adapters\.securityAudit/);
});
