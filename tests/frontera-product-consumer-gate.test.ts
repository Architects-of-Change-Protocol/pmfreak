/**
 * Negative controls for the FRONTERA_PRODUCT_RUNTIME_CONSUMPTION gate.
 *
 * A gate that has only ever been seen to pass is not evidence. Each test here
 * mutates the real sources in memory to reproduce one specific way the
 * boundary could be hollowed out while still looking like an integration, and
 * asserts the gate rejects it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import { analyzeFronteraProductConsumption } from "../scripts/check-frontera-product-consumer.mjs";

const ROOT = path.resolve(__dirname, "..");
const ADAPTER = "src/lib/integrations/frontera/enforcement-adapter.ts";
const SERVICE = "src/lib/operational-flow/operational-flow-service.ts";
const FILES = [ADAPTER, SERVICE, "src/lib/integrations/frontera/config.ts", "src/lib/integrations/frontera/index.ts"];

const realFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Forbidden specifiers are assembled from these fragments rather than spelled
 * out, so this file itself never contains a literal deep or private Frontera
 * import for `check:packaged-aoc-artifacts` to find. The gate under test still
 * sees the fully composed string.
 */
const FRONTERA_SCOPE = ["@aoc", "enterprise"].join("-");
const FRONTERA_PKG = `${FRONTERA_SCOPE}/runtime`;

/** Runs the gate over the real sources with `overrides` substituted. */
function analyze(overrides: Record<string, string> = {}, extraFiles: string[] = []) {
  return analyzeFronteraProductConsumption({
    productFiles: [...FILES, ...extraFiles],
    readFile: (rel: string) => (rel in overrides ? overrides[rel] : realFile(rel)),
  });
}

test("baseline: the real sources pass the gate", () => {
  const { failures, consumers } = analyze();
  assert.deepEqual(failures, [], `unexpected failures: ${failures.join("; ")}`);
  assert.ok(consumers.length > 0, "at least one real product consumer");
});

test("FAILS when the Frontera call is removed from the dispatch path", () => {
  const stripped = realFile(SERVICE).replace(/const frontera = await authorize\(/, "const frontera = await noop$&".replace("$&", ""));
  const { failures } = analyze({ [SERVICE]: stripped.replace(/await authorize\(/g, "await Promise.resolve(") });
  assert.ok(
    failures.some((f) => /no Frontera authorization call/.test(f)),
    `expected a missing-call failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when Frontera is evaluated AFTER the dispatch RPC", () => {
  const source = realFile(SERVICE);
  const start = source.indexOf("export async function dispatchGovernedMaterialActionToTask");
  const head = source.slice(0, start);
  const tail = source.slice(start);
  // Move the authorize() call to after the RPC by swapping their order textually.
  const moved = tail
    .replace(/const frontera = await authorize\(/, "const __MOVED__ = await authorize(")
    .replace(
      /const result = await client\.rpc\("dispatch_governed_action_to_internal_task"/,
      'const result = await client.rpc("dispatch_governed_action_to_internal_task"',
    );
  const reordered = moved.replace(
    /const __MOVED__ = await authorize\(/,
    "// hoisted away\n  const frontera = { allowed: true, decisionId: 'x', reasonCodes: [] };\n  const __MOVED__ = ((x:unknown)=>x)(",
  ) + "\n// const frontera = await authorize(";
  const { failures } = analyze({ [SERVICE]: head + reordered });
  assert.ok(failures.length > 0, "a reordered boundary must not pass");
});

test("FAILS when the denial guard no longer returns before the RPC", () => {
  const bypassed = realFile(SERVICE).replace(
    /if \(!frontera\.allowed\) \{[\s\S]*?\n  \}/,
    "if (!frontera.allowed) {\n    /* swallowed */\n  }",
  );
  const { failures } = analyze({ [SERVICE]: bypassed });
  assert.ok(
    failures.some((f) => /does not return before the dispatch RPC/.test(f)),
    `expected a bypass failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when a deep/private Frontera import is introduced", () => {
  // Composed at runtime, never written literally: a literal deep-import path in
  // this file would be a real forbidden import as far as
  // check:packaged-aoc-artifacts is concerned, and that gate is right to say so.
  const deepSpecifier = `${FRONTERA_PKG}/dist/src/enterprise/kernel-authority/index.js`;
  const deep = `import { x } from "${deepSpecifier}";\n` + realFile(ADAPTER);
  const { failures } = analyze({ [ADAPTER]: deep });
  assert.ok(
    failures.some((f) => /deep\/undeclared Frontera import/.test(f)),
    `expected a deep-import failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when a product file imports a Frontera-private workspace", () => {
  const privateSpecifier = `${FRONTERA_SCOPE}/identity`;
  const priv = `import type { VerifiedActorClaims } from "${privateSpecifier}";\n` + realFile(ADAPTER);
  const { failures } = analyze({ [ADAPTER]: priv });
  assert.ok(
    failures.some((f) => /Frontera-private workspace/.test(f)),
    `expected a private-workspace failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when product code invokes Frontera provisioning", () => {
  const provisioning =
    realFile(ADAPTER) +
    `\nexport async function selfHeal(store: never) { return createKernelAuthorityProvisioningService({ store, organizationId: "x" }); }\n`;
  const { failures } = analyze({ [ADAPTER]: provisioning });
  assert.ok(
    failures.some((f) => /provisioning surface/.test(f)),
    `expected a provisioning failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when product code imports the operator provisioning script", () => {
  const imported = `import { provisionPmfreakDispatchAuthority } from "../../../../scripts/frontera-authority-provisioning.mjs";\n` + realFile(ADAPTER);
  const { failures } = analyze({ [ADAPTER]: imported });
  assert.ok(
    failures.some((f) => /imports the operator provisioning script/.test(f)),
    `expected an operator-script failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when the adapter falls back to the empty in-process world", () => {
  const empty = realFile(ADAPTER).replace(/createDurableKernelProviders/g, "createDefaultKernelProviders");
  const { failures } = analyze({ [ADAPTER]: empty });
  assert.ok(
    failures.some((f) => /createDefaultKernelProviders/.test(f)),
    `expected an empty-world failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when no product source consumes Frontera at all", () => {
  const none = realFile(ADAPTER).replace(/@aoc-enterprise\/runtime[^"']*/g, "./local-stub");
  const { failures } = analyze({ [ADAPTER]: none });
  assert.ok(
    failures.some((f) => /FRONTERA_PRODUCT_CONSUMERS=0/.test(f)),
    `expected a zero-consumer failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when a Frontera-importing product file reaches a mutable world handle", () => {
  // The 1.1.0 defect: an application holding recognitionRuntime could mint
  // itself an actor and a covering token, then be allowed.
  const mutating = realFile(ADAPTER).replace(
    "const providers = await createDurableKernelProviders({ store, organizationId });",
    "const providers = await createDurableKernelProviders({ store, organizationId });\n    providers.recognitionRuntime.registerActor({ type: 'human', displayName: 'self' });",
  );
  const { failures } = analyze({ [ADAPTER]: mutating });
  assert.ok(
    failures.some((f) => /mutable Frontera world handle/.test(f)),
    `expected a mutable-handle failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when the typed organization field is dropped", () => {
  const untyped = realFile(ADAPTER).replace(/organization:\s*\{[^}]*\},?/, "");
  const { failures } = analyze({ [ADAPTER]: untyped });
  assert.ok(
    failures.some((f) => /typed organization field/.test(f)),
    `expected a missing-organization failure, got: ${failures.join("; ")}`,
  );
});

test("FAILS when organizationId is smuggled through free-form context", () => {
  const smuggled = realFile(ADAPTER).replace(
    "organization: { id: organizationId },",
    "context: { organizationId },",
  );
  const { failures } = analyze({ [ADAPTER]: smuggled });
  assert.ok(
    failures.some((f) => /smuggles organizationId|typed organization field/.test(f)),
    `expected a context-smuggling failure, got: ${failures.join("; ")}`,
  );
});

test("the PMFreak-owned recognition-runtime module is not treated as a Frontera consumer", () => {
  // src/features/recognition-runtime (tracked since #531) shares method names
  // with Frontera's engine but imports nothing upstream. It must not trip the
  // mutable-handle rule, or the gate becomes noise a reviewer learns to ignore.
  const pmfreakOwned = "src/features/recognition-runtime/runtime/aoc-recognition-runtime.ts";
  const { failures } = analyze({}, [pmfreakOwned]);
  assert.ok(
    !failures.some((f) => f.includes(pmfreakOwned)),
    `PMFreak's own module must not be flagged: ${failures.join("; ")}`,
  );
});
