import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP_FORBIDDEN = [
  "@/lib/aoc/enterprise/runtime",
  "@/lib/aoc/enterprise/authorization",
  "@/lib/aoc/pmfreak-runtime-consumer",
  "@/aoc/enterprise/runtime",
  "@/lib/security/execution-grants",
  "@/lib/security/delegated-capabilities",
  "@/lib/security/agent-access",
  "@/lib/security/access-guards",
];

const LEGACY_SECURITY_IMPORTS = [
  "@/lib/security/execution-grants",
  "@/lib/security/delegated-capabilities",
  "@/lib/security/agent-access",
  "@/lib/security/access-guards",
  "@/lib/aoc/enterprise/authorization",
  "@/lib/aoc/enterprise/runtime",
];



const MIGRATED_SECURITY_WRAPPERS = [
  "src/lib/security/server-authorization.ts",
  "src/lib/security/agent-access.ts",
  "src/lib/security/access-guards.ts",
  "src/lib/security/capability-flow.ts",
];

const RUNTIME_CONSUMER_ALLOWED_IMPORT_PREFIXES = [
  "@/aoc/enterprise/runtime/",
  "@/aoc/protocol/",
  "@/lib/aoc/pmfreak-runtime-consumer",
  "./",
  "../",
  "@aoc-enterprise/runtime",
  "@pmfreak/aoc-enterprise-internal",
  "@/lib/aoc/bootstrap",
  "node:",
];

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) collectFiles(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p.replaceAll("\\", "/"));
  }
  return out;
}

function readImports(src) {
  const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  const bare = [...src.matchAll(/import\s+["']([^"']+)["']/g)].map((m) => m[1]);
  return [...imports, ...bare];
}

test("app routes use runtime-consumer authority boundary", () => {
  for (const file of collectFiles("src/app")) {
    const src = readFileSync(file, "utf8");
    for (const forbidden of APP_FORBIDDEN) assert.equal(src.includes(forbidden), false, `${file} must not import ${forbidden}`);
    if (src.includes("authorizeRuntimeAction(") || src.includes("enforceRuntimeAuthorization(") || src.includes("consumeDelegatedCapability(") || src.includes("consumeExecutionGrant(") || src.includes("buildEnterpriseRuntimeRequest(") || src.includes("buildRuntimeConsumerRequest(")) {
      assert.equal(src.includes("@/aoc/runtime-consumer"), true, `${file} must import runtime authority from @/aoc/runtime-consumer`);
    }
  }
});

test("runtime-consumer does not import legacy security modules directly", () => {
  for (const file of collectFiles("src/aoc/runtime-consumer")) {
    const src = readFileSync(file, "utf8");
    for (const forbidden of LEGACY_SECURITY_IMPORTS) {
      assert.equal(src.includes(forbidden), false, `${file} must not import ${forbidden}`);
    }
  }
});

test("runtime-consumer imports only approved boundaries", () => {
  for (const file of collectFiles("src/aoc/runtime-consumer")) {
    const src = readFileSync(file, "utf8");
    for (const specifier of readImports(src)) {
      assert.equal(
        RUNTIME_CONSUMER_ALLOWED_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix)),
        true,
        `${file} has non-approved import: ${specifier}`,
      );
    }
  }
});



test("product-facing security wrappers consume runtime authority via runtime-consumer boundary", () => {
  const forbidden = [
    "@/lib/aoc/enterprise/authorization",
    "@/lib/aoc/enterprise/runtime",
    "@/lib/aoc/pmfreak-runtime-consumer",
  ];

  for (const file of MIGRATED_SECURITY_WRAPPERS) {
    const src = readFileSync(file, "utf8");
    for (const specifier of forbidden) {
      assert.equal(src.includes(specifier), false, `${file} must not import ${specifier}`);
    }
    assert.equal(src.includes("@/aoc/runtime-consumer"), true, `${file} must import runtime authority from @/aoc/runtime-consumer`);
  }
});

test("enterprise runtime implementation does not import runtime-consumer", () => {
  for (const file of collectFiles("src/aoc/enterprise/runtime")) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("@/aoc/runtime-consumer"), false, `${file} must not import runtime-consumer`);
  }
});

test("protocol layer does not import runtime-consumer or enterprise runtime/security internals", () => {
  for (const file of collectFiles("src/aoc/protocol")) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("@/aoc/runtime-consumer"), false, `${file} must not import runtime-consumer`);
    assert.equal(src.includes("@/aoc/enterprise/runtime"), false, `${file} must not import enterprise runtime`);
    assert.equal(src.includes("@/lib/security/"), false, `${file} must not import lib/security`);
  }
});

test("legacy security imports are constrained to enterprise runtime bridge files", () => {
  const adapterFiles = new Set([]);

  const files = collectFiles("src/aoc").concat(collectFiles("src/lib/security"));
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const hasLegacySecurityImport = LEGACY_SECURITY_IMPORTS.some((specifier) => src.includes(specifier));
    if (!hasLegacySecurityImport) continue;

    const isLegacyImpl = file.startsWith("src/lib/security/");
    const isAdapter = adapterFiles.has(file);
    assert.equal(isLegacyImpl || isAdapter, true, `${file} must not directly import legacy security modules`);
  }
});
