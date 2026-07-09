import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createAocPMFreakReadOnlyConnectorClient,
  createInMemoryAocPMFreakReadOnlySource,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

const moduleDir = path.join(process.cwd(), "src/features/aoc-integrations/pmfreak-read-only-connector");

function collectModuleFiles(): string[] {
  return fs
    .readdirSync(moduleDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(moduleDir, entry.name));
}

test("connector produces the same snapshot for the same source and config, offline", async () => {
  const client = createAocPMFreakReadOnlyConnectorClient({ source: createInMemoryAocPMFreakReadOnlySource() });
  const first = await client.readSnapshot();
  const second = await client.readSnapshot();
  assert.deepEqual(first, second);
});

test("connector runtime code contains no non-deterministic or network calls", () => {
  const forbidden = [
    "Date.now(",
    "Math.random(",
    "crypto.randomUUID",
    "fetch(",
    "axios",
    "XMLHttpRequest",
    "openai",
    "anthropic",
    "OCR",
    "pdf-parse",
    "tesseract",
  ];

  for (const file of collectModuleFiles()) {
    const content = fs.readFileSync(file, "utf8");
    for (const token of forbidden) {
      assert.equal(
        content.includes(token),
        false,
        `Forbidden token "${token}" found in ${path.relative(process.cwd(), file)}`
      );
    }
  }
});
