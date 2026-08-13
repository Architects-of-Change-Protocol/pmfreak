import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const adapterPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "aoc",
  "adapters",
  "access-verification.ts",
);

test("AOC access verification adapter terminates at host primitives", async () => {
  const source = await readFile(adapterPath, "utf8");

  assert.doesNotMatch(
    source,
    /from\s+["']@\/lib\/security\/access-guards["']/,
    "AccessVerificationPort must not delegate back to runtime-backed access-guards",
  );

  assert.doesNotMatch(
    source,
    /\bauthorizeRuntimeAction\b/,
    "AccessVerificationPort must not re-enter Enterprise Runtime authorization",
  );

  assert.match(
    source,
    /createSupabaseServerClient/,
    "adapter should resolve host persistence directly",
  );

  assert.match(
    source,
    /workspace_memberships/,
    "adapter should verify persisted workspace membership directly",
  );

  assert.match(
    source,
    /ROLE_PERMISSION_MAP/,
    "adapter should terminate permission evaluation at host RBAC",
  );
});

test("project permission verification is non-recursive", async () => {
  const source = await readFile(adapterPath, "utf8");

  const projectPermissionStart = source.indexOf(
    "async requireProjectPermission",
  );

  const governancePermissionStart = source.indexOf(
    "async requireGovernancePermission",
  );

  assert.ok(projectPermissionStart >= 0);
  assert.ok(governancePermissionStart > projectPermissionStart);

  const projectPermissionBody = source.slice(
    projectPermissionStart,
    governancePermissionStart,
  );

  assert.match(projectPermissionBody, /\.from\("projects"\)/);
  assert.match(projectPermissionBody, /requireDirectWorkspaceMembership/);
  assert.match(projectPermissionBody, /requireDirectPermission/);
  assert.doesNotMatch(projectPermissionBody, /authorizeRuntimeAction/);
});