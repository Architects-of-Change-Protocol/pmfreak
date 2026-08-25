#!/usr/bin/env node
/**
 * FRONTERA_PRODUCT_RUNTIME_CONSUMPTION gate.
 *
 * P0-PKG-05 could only claim `FRONTERA_PACKAGE_INTEGRATION=PASS` in the narrow
 * sense of installed-and-loadable: no PMFreak product file imported
 * `@aoc-enterprise/runtime` at all. This gate exists so that claim can never
 * again be made on the strength of a package merely existing in node_modules.
 *
 * It deliberately does not count strings. A string count would pass for an
 * import in a dead module, for a call made after the Task was already created,
 * and for a `catch { allowAnyway() }`. Each check below names the specific way
 * this boundary could be hollowed out while still "importing Frontera".
 *
 * Exported as `analyzeFronteraProductConsumption` so
 * tests/frontera-product-consumer-gate.test.ts can run it against deliberately
 * broken sources and prove the gate FAILS — a gate never shown to fail is not
 * evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Declared public export keys of the frozen artifact. Anything else is a deep import. */
const DECLARED_FRONTERA_EXPORTS = new Set([
  "@aoc-enterprise/runtime",
  "@aoc-enterprise/runtime/authorization",
  "@aoc-enterprise/runtime/audit",
  "@aoc-enterprise/runtime/crypto",
  "@aoc-enterprise/runtime/adapters",
  "@aoc-enterprise/runtime/runtime",
  "@aoc-enterprise/runtime/runtime-host",
  "@aoc-enterprise/runtime/kernel",
  "@aoc-enterprise/runtime/enterprise",
  "@aoc-enterprise/runtime/kernel-host",
]);

/** Frontera's operator write surface. Product code may never reach it. */
const PROVISIONING_SYMBOLS = [
  "createKernelAuthorityProvisioningService",
  "provisionActor",
  "provisionTrustDomain",
  "provisionPassport",
  "provisionCapabilityToken",
  "provisionRootIssuer",
  "provisionAuthorityGrant",
  "provisionDelegationGrant",
  "appendEvent",
];

/** Frontera's bundled private workspaces. Never a direct PMFreak import. */
const PRIVATE_WORKSPACES = [
  "@aoc-enterprise/governed-authority",
  "@aoc-enterprise/governed-authorization",
  "@aoc-enterprise/identity",
  "@aoc-enterprise/scoped-access",
];

const ADAPTER = "src/lib/integrations/frontera/enforcement-adapter.ts";
const DISPATCH_SERVICE = "src/lib/operational-flow/operational-flow-service.ts";
const DISPATCH_FN = "dispatchGovernedMaterialActionToTask";
const DISPATCH_RPC = "dispatch_governed_action_to_internal_task";

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const importSpecifiers = (source) =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

/** Extracts one exported function body by brace matching from its signature. */
function functionBody(source, fnName) {
  const start = source.indexOf(`export async function ${fnName}`);
  if (start === -1) return null;
  const open = source.indexOf("{", source.indexOf(")", start));
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * @param readFile (repoRelativePath) => string  — injectable so a test can
 *   present a mutated source without writing to the working tree.
 */
export function analyzeFronteraProductConsumption({ readFile, productFiles } = {}) {
  const failures = [];
  const notes = [];
  const read = readFile ?? ((rel) => fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const files = productFiles ?? walk(path.join(ROOT, "src")).map((f) => path.relative(ROOT, f));

  // ---- 1. A real product consumer exists, using declared public exports only.
  const consumers = [];
  for (const rel of files) {
    let source;
    try {
      source = read(rel);
    } catch {
      continue;
    }
    for (const spec of importSpecifiers(source)) {
      if (!spec.startsWith("@aoc-enterprise/")) continue;
      if (PRIVATE_WORKSPACES.some((w) => spec === w || spec.startsWith(`${w}/`))) {
        failures.push(`${rel}: imports Frontera-private workspace '${spec}'`);
        continue;
      }
      if (!spec.startsWith("@aoc-enterprise/runtime")) continue;
      if (!DECLARED_FRONTERA_EXPORTS.has(spec)) {
        failures.push(`${rel}: deep/undeclared Frontera import '${spec}'`);
        continue;
      }
      consumers.push({ file: rel, specifier: spec });
    }
  }
  if (consumers.length === 0) {
    failures.push("FRONTERA_PRODUCT_CONSUMERS=0 — no active product source imports a declared Frontera export.");
  } else {
    notes.push(`FRONTERA_PRODUCT_CONSUMERS=${consumers.length}`);
    for (const c of consumers) notes.push(`  consumer ${c.file} -> ${c.specifier}`);
  }

  // ---- 2. Product code never touches Frontera's operator write surface.
  for (const rel of files) {
    let source;
    try {
      source = read(rel);
    } catch {
      continue;
    }
    for (const symbol of PROVISIONING_SYMBOLS) {
      if (new RegExp(`\\b${symbol}\\s*\\(`).test(source)) {
        failures.push(`${rel}: product source invokes Frontera provisioning surface '${symbol}'`);
      }
    }
    if (/from\s+["'][^"']*frontera-authority-provisioning/.test(source)) {
      failures.push(`${rel}: product source imports the operator provisioning script`);
    }
  }

  // ---- 3. The adapter exists and reaches the real kernel.
  let adapter;
  try {
    adapter = read(ADAPTER);
  } catch {
    adapter = null;
  }
  if (!adapter) {
    failures.push(`${ADAPTER}: missing — the PMFreak-owned Frontera boundary is gone.`);
  } else {
    if (!/createAocKernel\s*\(/.test(adapter) || !/\.evaluate\s*\(/.test(adapter)) {
      failures.push(`${ADAPTER}: does not reach AocKernel.evaluate() — no Frontera decision is being made.`);
    }
    if (!/createDurableKernelProviders\s*\(/.test(adapter)) {
      failures.push(`${ADAPTER}: does not use the durable authority world (createDurableKernelProviders).`);
    }
    if (/createDefaultKernelProviders\s*\(/.test(adapter)) {
      failures.push(`${ADAPTER}: uses createDefaultKernelProviders — the empty, in-process world is not an authority source.`);
    }
    if (!/system:\s*false/.test(adapter)) {
      failures.push(`${ADAPTER}: does not build an organization-scoped read context (system: false).`);
    }
  }

  // ---- 4. The dispatch path calls Frontera BEFORE the RPC, and denial returns early.
  let service;
  try {
    service = read(DISPATCH_SERVICE);
  } catch {
    service = null;
  }
  if (!service) {
    failures.push(`${DISPATCH_SERVICE}: missing.`);
  } else {
    if (!importSpecifiers(service).some((s) => s.includes("integrations/frontera"))) {
      failures.push(`${DISPATCH_SERVICE}: does not import the PMFreak Frontera adapter.`);
    }
    const body = functionBody(service, DISPATCH_FN);
    if (!body) {
      failures.push(`${DISPATCH_SERVICE}: ${DISPATCH_FN}() not found.`);
    } else {
      const authorizeAt = body.search(/\bauthorize\s*\(/);
      const rpcAt = body.indexOf(DISPATCH_RPC);
      const guardAt = body.search(/if\s*\(\s*!\s*frontera\.allowed\s*\)/);
      if (authorizeAt === -1) failures.push(`${DISPATCH_FN}(): no Frontera authorization call.`);
      if (rpcAt === -1) failures.push(`${DISPATCH_FN}(): dispatch RPC call not found.`);
      if (authorizeAt !== -1 && rpcAt !== -1 && authorizeAt > rpcAt) {
        failures.push(`${DISPATCH_FN}(): Frontera is evaluated AFTER the dispatch RPC — the Task already exists by then.`);
      }
      if (guardAt === -1) {
        failures.push(`${DISPATCH_FN}(): no fail-closed guard on the Frontera decision.`);
      } else if (rpcAt !== -1 && guardAt > rpcAt) {
        failures.push(`${DISPATCH_FN}(): the fail-closed guard is after the dispatch RPC.`);
      }
      // A denial that falls through to the RPC anyway is the bypass this whole
      // increment exists to prevent.
      if (guardAt !== -1) {
        const guardBlock = body.slice(guardAt, rpcAt === -1 ? undefined : rpcAt);
        if (!/return\b/.test(guardBlock)) {
          failures.push(`${DISPATCH_FN}(): the Frontera denial guard does not return before the dispatch RPC.`);
        }
      }
      if (/catch\s*(\([^)]*\))?\s*\{[^}]*rpc\s*\(/s.test(body)) {
        failures.push(`${DISPATCH_FN}(): a catch block reaches the dispatch RPC — Frontera failure must not fall back to dispatch.`);
      }
    }
  }

  // ---- 5. No local pseudo-Frontera fallback may reappear.
  for (const dir of ["src/aoc/enterprise", "src/aoc/protocol"]) {
    if (fs.existsSync(path.join(ROOT, dir))) {
      failures.push(`${dir}: reappeared — a local pseudo-upstream tree is never the canonical artifact.`);
    }
  }

  return { failures, notes, consumers };
}

function main() {
  const { failures, notes } = analyzeFronteraProductConsumption();
  for (const n of notes) console.log(`[frontera-consumer] ${n}`);
  if (failures.length) {
    for (const f of failures) console.error(`[frontera-consumer] FAIL ${f}`);
    console.error(`[frontera-consumer] FRONTERA_PRODUCT_RUNTIME_CONSUMPTION=FAIL (${failures.length} finding(s))`);
    process.exit(1);
  }
  console.log("[frontera-consumer] Frontera is evaluated before the dispatch RPC, denial returns early, no provisioning in product code.");
  console.log("[frontera-consumer] FRONTERA_PRODUCT_RUNTIME_CONSUMPTION=PASS");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
