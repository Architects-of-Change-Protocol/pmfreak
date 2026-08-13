import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const runtimeAuthorizationPath = path.join(
  process.cwd(),
  "src",
  "aoc",
  "runtime-consumer",
  "runtime-authorization.ts",
);

test("direct runtime authorization bootstraps authority dependencies", async () => {
  const source = await readFile(runtimeAuthorizationPath, "utf8");

  assert.match(
    source,
    /import\s+\{\s*bootstrapRuntimeConsumer\s*\}\s+from\s+["']\.\/runtime-bootstrap["']/,
    "runtime authorization boundary must own runtime bootstrap",
  );

  const enforceStart = source.indexOf(
    "export async function enforceRuntimeAuthorization",
  );

  const authorizeStart = source.indexOf(
    "export async function authorizeRuntimeAction",
  );

  assert.ok(enforceStart >= 0);
  assert.ok(authorizeStart > enforceStart);

  const enforceBody = source.slice(
    enforceStart,
    authorizeStart,
  );

  const authorizeBody = source.slice(
    authorizeStart,
  );

  assert.match(
    enforceBody,
    /bootstrapRuntimeConsumer\(\);/,
    "enforceRuntimeAuthorization must bootstrap before authority resolution",
  );

  assert.match(
    authorizeBody,
    /bootstrapRuntimeConsumer\(\);/,
    "authorizeRuntimeAction must bootstrap before authority resolution",
  );

  assert.ok(
    enforceBody.indexOf("bootstrapRuntimeConsumer();") <
      enforceBody.indexOf("enforceEnterpriseRuntimeAuthorization(input)"),
    "enforcement bootstrap must precede Enterprise Runtime delegation",
  );

  assert.ok(
    authorizeBody.indexOf("bootstrapRuntimeConsumer();") <
      authorizeBody.indexOf("authorizeEnterpriseRuntimeAction(input)"),
    "authorization bootstrap must precede Enterprise Runtime delegation",
  );
});