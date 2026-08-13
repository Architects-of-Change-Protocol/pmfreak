import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const adaptersPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "aoc",
  "adapters",
  "index.ts",
);

const bootstrapPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "aoc",
  "bootstrap.ts",
);

test("adapter registration does not recursively register runtime authority", async () => {
  const adapters = await readFile(adaptersPath, "utf8");

  assert.doesNotMatch(
    adapters,
    /ensureInProcessAuthorityDependenciesRegistered/,
    "adapter registration must not own authority-provider registration",
  );

  assert.match(adapters, /registerAocAdapters/);
});

test("runtime composition registers adapters before authority dependencies", async () => {
  const bootstrap = await readFile(bootstrapPath, "utf8");

  assert.match(
    bootstrap,
    /ensureInProcessAuthorityDependenciesRegistered/,
  );

  const adapterIndex = bootstrap.indexOf(
    "registerPmfreakAocAdapters();",
  );

  const authorityIndex = bootstrap.indexOf(
    "ensureInProcessAuthorityDependenciesRegistered();",
  );

  assert.ok(adapterIndex >= 0);
  assert.ok(authorityIndex > adapterIndex);
});