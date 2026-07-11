// Prototype-pollution canary around untrusted spreadsheet parsing
// (Perilla 11; retained as defense-in-depth after the Perilla 12 xlsx →
// exceljs replacement).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  withPrototypePollutionGuard,
  withPrototypePollutionGuardAsync,
  PrototypePollutionError,
} from "../src/lib/security/prototype-pollution-guard.ts";

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

test("async guard rejects a polluting operation and restores the runtime", async () => {
  await assert.rejects(
    withPrototypePollutionGuardAsync("test", async () => {
      Object.prototype.__pmfreak_async_polluted__ = "owned";
      return "parsed";
    }),
    PrototypePollutionError,
  );
  assert.ok(!Object.getOwnPropertyNames(Object.prototype).includes("__pmfreak_async_polluted__"));
});

test("async guard cleans pollution even when the operation itself rejects", async () => {
  await assert.rejects(
    withPrototypePollutionGuardAsync("test", async () => {
      Object.prototype.__pmfreak_async_throw_polluted__ = "owned";
      throw new Error("parse failed");
    }),
    /parse failed/,
  );
  assert.ok(!Object.getOwnPropertyNames(Object.prototype).includes("__pmfreak_async_throw_polluted__"));
});

test("async guard passes clean operations through", async () => {
  const result = await withPrototypePollutionGuardAsync("test", async () => ({ rows: 2 }));
  assert.deepEqual(result, { rows: 2 });
});

test("the workbook reader parses untrusted spreadsheets inside the pollution guard", () => {
  const source = readFileSync(path.join(repoRoot, "src/lib/spreadsheets/workbook-reader.ts"), "utf8");
  const guarded = source.match(/withPrototypePollutionGuardAsync\("spreadsheet_workbook_read",[\s\S]*?parseWithDeadline\(/);
  assert.ok(guarded, "the exceljs parse must run inside withPrototypePollutionGuardAsync");
});
