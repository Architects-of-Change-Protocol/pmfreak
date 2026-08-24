/**
 * PMFreak governance runtime — dependency inversion.
 *
 * This test used to assert that the pseudo-upstream `src/aoc/enterprise` tree
 * imported nothing from `@/lib/`. P0-PKG-05 established that the tree WAS PMFreak
 * `@/lib` code all along, so that assertion no longer says anything: the layer now
 * legitimately lives at `@/lib/governance/authority` and imports its own siblings.
 *
 * The invariant worth keeping is the real one the old rule stood in for: the
 * governance runtime must receive infrastructure through injected ports and must
 * never reach directly for PMFreak's auth session, database driver, route layer,
 * UI, SDK, or the concrete access guards it is itself the authority for.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/lib/governance/authority/runtime";

/** Import specifiers the governance runtime must never depend on directly. */
const FORBIDDEN_IMPORTS = [
  "@/app/",
  "@/components/",
  "@/sdk",
  "@/lib/auth",
  "@/lib/supabase",
  "@/lib/security/access-guards",
  "@/lib/security/server-authorization",
  "@supabase/",
  "next/server",
  // The removed pseudo-upstream trees must never come back.
  "src/aoc/protocol",
  "src/aoc/enterprise",
  "@pmfreak/aoc-",
];

/** The only PMFreak modules it may import are its own domain siblings. */
const ALLOWED_APP_PREFIX = "@/lib/governance/authority";

function collectTsFiles(root) {
  try {
    if (!statSync(root).isDirectory()) return [];
  } catch {
    return [];
  }
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/\.(ts|tsx|mts|cts)$/.test(name)) out.push(full);
    }
  }
  return out;
}

const files = collectTsFiles(ROOT);

test("governance runtime does not depend on PMFreak infrastructure, routes, UI or SDK", () => {
  assert.ok(files.length > 0, "expected governance runtime files to validate");

  for (const file of files) {
    const specifiers = [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const spec of specifiers) {
      for (const forbidden of FORBIDDEN_IMPORTS) {
        assert.equal(
          spec.includes(forbidden),
          false,
          `forbidden dependency '${spec}' in ${file} — infrastructure must arrive through an injected port`,
        );
      }
    }
  }
});

test("the only PMFreak-aliased imports in the governance runtime are its own domain siblings", () => {
  for (const file of files) {
    const specifiers = [...readFileSync(file, "utf8").matchAll(/from\s+["'](@\/[^"']+)["']/g)].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.ok(
        spec.startsWith(ALLOWED_APP_PREFIX),
        `${file} imports '${spec}'; the governance runtime may only import ${ALLOWED_APP_PREFIX}/*`,
      );
    }
  }
});
