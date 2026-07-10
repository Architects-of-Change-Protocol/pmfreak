// Perilla 11 — prototype-pollution canary around untrusted xlsx parsing.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPrototypePollutionGuard, PrototypePollutionError } from "../src/lib/security/prototype-pollution-guard.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("clean operations pass through with their return value", () => {
  const result = withPrototypePollutionGuard("test", () => ({ rows: 3 }));
  assert.deepEqual(result, { rows: 3 });
});

test("an operation that pollutes Object.prototype is rejected and the runtime is restored", () => {
  assert.throws(
    () =>
      withPrototypePollutionGuard("test", () => {
        Object.prototype.__pmfreak_polluted__ = "owned";
        return "parsed";
      }),
    PrototypePollutionError,
  );
  assert.equal({}.__pmfreak_polluted__, undefined, "the injected property must be removed");
  assert.ok(!Object.getOwnPropertyNames(Object.prototype).includes("__pmfreak_polluted__"));
});

test("an operation that pollutes Array.prototype is rejected and the runtime is restored", () => {
  assert.throws(
    () =>
      withPrototypePollutionGuard("test", () => {
        Array.prototype.__pmfreak_arr_polluted__ = "owned";
      }),
    PrototypePollutionError,
  );
  assert.ok(!Object.getOwnPropertyNames(Array.prototype).includes("__pmfreak_arr_polluted__"));
});

test("pollution is cleaned even when the operation itself throws", () => {
  assert.throws(
    () =>
      withPrototypePollutionGuard("test", () => {
        Object.prototype.__pmfreak_throw_polluted__ = "owned";
        throw new Error("parse failed");
      }),
    /parse failed/,
  );
  assert.ok(!Object.getOwnPropertyNames(Object.prototype).includes("__pmfreak_throw_polluted__"));
});

test("evidence processor parses xlsx inside the pollution guard", () => {
  const source = readFileSync(path.join(repoRoot, "src/lib/project-evidence/evidence-processor.ts"), "utf8");
  const guarded = source.match(/withPrototypePollutionGuard\("xlsx_evidence_extraction",[\s\S]*?XLSX\.read\(/);
  assert.ok(guarded, "XLSX.read must run inside withPrototypePollutionGuard");
});
