/**
 * Release Gate 01 corrective regression: protected navigation losing
 * authentication after PR #562.
 *
 * PR #562 fixed (protected)/layout.tsx making two independent getUser()
 * calls within a single request. Post-merge production UAT reproduced the
 * exact same observable symptom (authenticated /projects/new -> click a nav
 * item -> bounced to /login) via a DIFFERENT mechanism:
 *
 *   1. next/link's default viewport prefetching fired real background
 *      requests, through Edge middleware, for every visible protected nav
 *      link as soon as the shell rendered — each an independently
 *      refresh-capable getUser() call racing the SAME single-use refresh
 *      token as the user's actual click-through navigation.
 *   2. isSafeContinuationRoute's hand-maintained ALLOWED_PREFIXES allowlist
 *      had drifted out of sync with the real, growing set of protected
 *      routes (missing /chat, /execution, /executive, /pmos, /workspaces,
 *      /team, and more) — so even when re-login succeeded, the originally
 *      requested destination was silently discarded and the user landed
 *      back on /command-center or /projects/new, reproducing "the cycle
 *      repeats when attempting to leave Projects".
 *   3. route-policy-registry.ts was missing explicit entries for two real
 *      nav hrefs (/execution, /workspace-setup), leaving them classified as
 *      "unknown" — currently harmless (unknown still counts as protected)
 *      but a latent classification drift.
 *
 * These tests invoke the real, unmodified production entry points
 * (isSafeContinuationRoute, getRouteAccessPolicy/isProtectedPageRoute) —
 * not source-text pattern matching — so they fail against the pre-fix
 * origin/main behavior and pass after the correction.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { isSafeContinuationRoute } = await import("../src/lib/auth/validate-continuation-route.ts");
const { getRouteAccessPolicy, isProtectedPageRoute } = await import("../src/lib/auth/route-policy-registry.ts");
const { NAVIGATION_HIERARCHY } = await import("../src/lib/workspace/navigation-hierarchy.ts");

const operationalShell = readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");
const advancedDrawer = readFileSync("src/components/pmfreak/navigation/advanced-drawer.tsx", "utf8");
const sidebarPmoTree = readFileSync("src/components/pmfreak/navigation/sidebar-pmo-tree.tsx", "utf8");
const validator = readFileSync("src/lib/auth/validate-continuation-route.ts", "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Every real, currently-linked protected nav destination survives a
//    post-login continuation redirect (real invocation of the actual
//    production route validator, not a hand-maintained duplicate list).
// ─────────────────────────────────────────────────────────────────────────────

test("every protected nav destination in NAVIGATION_HIERARCHY is a safe post-login continuation route", () => {
  const failures = [];
  for (const node of NAVIGATION_HIERARCHY) {
    if (!isSafeContinuationRoute(node.href)) {
      failures.push(`${node.label} (${node.href})`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `these real nav destinations are NOT recognized as safe continuation routes, so a post-login redirect ` +
      `silently drops the user's actually-requested destination for them: ${failures.join(", ")}`
  );
});

test("the specific destinations named in the production reproduction survive re-login continuation", () => {
  // These are the exact routes named in the release-gate corrective task:
  // Workspace Chat, Daily Execution, Create Center, Summary, Execution,
  // Executive, Portfolio, Workspace Setup, Workspaces, PMOs.
  for (const route of ["/chat", "/execution", "/create-command-center", "/dashboard", "/command-center", "/executive", "/portfolio", "/workspace-setup", "/workspaces", "/pmos"]) {
    assert.equal(isSafeContinuationRoute(route), true, `${route} must be a safe continuation route`);
  }
});

test("the continuation validator still rejects auth/api/debug routes and external targets", () => {
  assert.equal(isSafeContinuationRoute("/login"), false);
  assert.equal(isSafeContinuationRoute("/signup"), false);
  assert.equal(isSafeContinuationRoute("/api/projects"), false);
  assert.equal(isSafeContinuationRoute("/debug-session"), false);
  assert.equal(isSafeContinuationRoute("//evil.com"), false);
  assert.equal(isSafeContinuationRoute("https://evil.com"), false);
  assert.equal(isSafeContinuationRoute("/foo\r\n/bar"), false);
});

test("continuation validator delegates to the canonical route policy registry instead of a duplicated allowlist", () => {
  assert.match(validator, /isProtectedPageRoute/);
  assert.doesNotMatch(validator, /const ALLOWED_PREFIXES/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Route classification drift: /execution and /workspace-setup are real
//    nav hrefs and must not fall through to "unknown".
// ─────────────────────────────────────────────────────────────────────────────

test("/execution (Daily Execution nav item) is explicitly classified, not 'unknown'", () => {
  assert.notEqual(getRouteAccessPolicy("/execution"), "unknown");
  assert.equal(isProtectedPageRoute("/execution"), true);
});

test("/workspace-setup (Workspace Setup nav item) is explicitly classified, not 'unknown'", () => {
  assert.notEqual(getRouteAccessPolicy("/workspace-setup"), "unknown");
  assert.equal(isProtectedPageRoute("/workspace-setup"), true);
});

test("every NAVIGATION_HIERARCHY href resolves to an explicit route policy, not the 'unknown' fallback", () => {
  const unclassified = NAVIGATION_HIERARCHY.map((n) => n.href).filter((href) => getRouteAccessPolicy(href) === "unknown");
  assert.deepEqual(unclassified, [], `these real nav hrefs fall through to 'unknown' policy: ${unclassified.join(", ")}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Prefetch storm: the shell's internal nav links must not eagerly
//    background-fetch every visible protected destination — each such
//    prefetch is an independent, refresh-capable getUser() call through
//    Edge middleware that can race (and lose to, or make lose) the user's
//    actual click-through navigation's own refresh attempt against the same
//    single-use refresh token.
// ─────────────────────────────────────────────────────────────────────────────

test("operational shell's internal navigation Links disable prefetch", () => {
  // Every <Link ... href={...}> that points at an internal app route in the
  // primary/lens/utility/mobile nav and the evidence/workspace/logout links
  // must carry prefetch={false}. We assert on link-rendering call sites
  // rather than requiring literally 100% of Link usages in the file, since
  // this file also renders links unrelated to the persistent nav rail.
  const navLinkBlocks = [...operationalShell.matchAll(/<Link\b[^>]*>/gs)];
  assert.ok(navLinkBlocks.length > 5, "expected multiple <Link> render sites in operational-shell.tsx");
  const missingPrefetchFalse = navLinkBlocks.filter((m) => !/prefetch=\{false\}/.test(m[0]));
  assert.deepEqual(
    missingPrefetchFalse.map((m) => m[0]),
    [],
    "every internal navigation Link in the shell must set prefetch={false} to stop the background middleware-refresh race"
  );
});

test("advanced drawer navigation Links disable prefetch", () => {
  const navLinkBlocks = [...advancedDrawer.matchAll(/<Link\b[^>]*>/gs)];
  assert.ok(navLinkBlocks.length >= 1);
  for (const m of navLinkBlocks) {
    assert.match(m[0], /prefetch=\{false\}/, `advanced-drawer Link missing prefetch={false}: ${m[0]}`);
  }
});

test("sidebar PMO tree navigation Links disable prefetch", () => {
  const navLinkBlocks = [...sidebarPmoTree.matchAll(/<Link\b[^>]*>/gs)];
  assert.ok(navLinkBlocks.length >= 4);
  for (const m of navLinkBlocks) {
    assert.match(m[0], /prefetch=\{false\}/, `sidebar-pmo-tree Link missing prefetch={false}: ${m[0]}`);
  }
});
