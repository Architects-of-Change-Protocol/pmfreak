import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

const onboardingMap = read("src/lib/auth/onboarding-route-map.ts");
const resolver = read("src/lib/auth/resolve-post-auth-destination.ts");
const proxy = read("src/proxy.ts");
const workspacePage = read("src/app/(protected)/workspace/page.tsx");
const workspaceSetupPage = read("src/app/(protected)/workspace/setup/page.tsx");
const gettingStartedFlow = read("src/components/pmfreak/activation/getting-started-flow.tsx");
const commandCenterPage = read("src/app/(protected)/command-center/page.tsx");
const commandCenterLayout = read("src/features/command-center/command-center-layout.tsx");
const commandCenterEmptyState = read("src/features/command-center/command-center-empty-state.tsx");
const operationalShell = read("src/components/pmfreak/operational-shell.tsx");
const routeDebug = read("src/app/api/route-debug/route.ts");

const LEGACY_STRINGS = [
  "Operational Command Center",
  "No active context",
  "Create your first context",
];

// ─── 1. Default authenticated landing route ─────────────────────────────────
test("default authenticated landing route is /command-center, not /workspace", () => {
  assert.match(onboardingMap, /case "active":\s*\n\s*return "\/command-center";/);
  assert.doesNotMatch(onboardingMap, /case "active":\s*\n\s*return "\/workspace";/);
  assert.match(resolver, /return \{ destination: "\/command-center", reason: "command-center-default" \};/);
});

// ─── 2. Completed onboarding /workspace/setup redirects to /command-center ──
test("completed onboarding on /workspace/setup redirects to /command-center", () => {
  assert.match(proxy, /isSetupRoute\(pathname\) && onboardingCompleted/);
  const idx = proxy.indexOf("isSetupRoute(pathname) && onboardingCompleted");
  assert.match(proxy.slice(idx, idx + 200), /new URL\("\/command-center", request\.url\)/);
});

// ─── 3. /workspace never renders the legacy OperationalShell ────────────────
test("/workspace redirects to /command-center and does not mount the legacy shell", () => {
  assert.match(workspacePage, /redirect\("\/command-center"\)/);
  assert.doesNotMatch(workspacePage, /WorkspaceShell/);
  assert.doesNotMatch(workspacePage, /<OperationalShell/);
});

test("proxy quarantines /workspace at the edge, before any render occurs", () => {
  assert.match(proxy, /pathname === "\/workspace"/);
});

// ─── 4. Legacy dark-shell strings are absent from the normal user journey ───
for (const [name, file] of Object.entries({
  "command-center page": commandCenterPage,
  "command-center layout": commandCenterLayout,
  "command-center empty state": commandCenterEmptyState,
  "workspace/setup page": workspaceSetupPage,
  "getting-started-flow": gettingStartedFlow,
})) {
  test(`${name} contains none of the legacy dark-shell strings`, () => {
    for (const legacy of LEGACY_STRINGS) {
      assert.equal(file.includes(legacy), false, `${name} must not contain "${legacy}"`);
    }
  });
}

// ─── 5. No-project state uses the premium light empty state ─────────────────
test("command-center page renders CommandCenterEmptyState when there are no projects", () => {
  assert.match(commandCenterPage, /CommandCenterEmptyState/);
});

// ─── 6. Runtime shell markers prove which shell actually rendered ───────────
test("light command-center shells carry the pmfreak-light-command-center marker", () => {
  assert.match(commandCenterLayout, /data-shell="pmfreak-light-command-center"/);
  assert.match(commandCenterEmptyState, /data-shell="pmfreak-light-command-center"/);
  assert.match(operationalShell, /data-shell=\{shellMarker\}/);
});

test("light workspace-setup shell carries the pmfreak-light-workspace-setup marker", () => {
  assert.match(workspaceSetupPage, /data-shell="pmfreak-light-workspace-setup"/);
});

test("legacy OperationalShell root carries the pmfreak-legacy-operational-shell marker", () => {
  assert.match(operationalShell, /data-shell="pmfreak-legacy-operational-shell"/);
});

// ─── 7. Safe diagnostic endpoint ─────────────────────────────────────────────
test("/api/route-debug reports the corrected routing defaults without leaking secrets", () => {
  assert.match(routeDebug, /defaultAuthenticatedRoute: "\/command-center"/);
  assert.match(routeDebug, /workspaceRedirectTarget: "\/command-center"/);
  assert.match(routeDebug, /setupCompletedRedirectTarget: "\/command-center"/);
  assert.match(routeDebug, /commandCenterMarker: "command-center-light-v2"/);
  const responseBody = routeDebug.slice(routeDebug.indexOf("NextResponse.json({"));
  assert.doesNotMatch(responseBody, /SUPABASE|SECRET|API_KEY|password/i);
});
