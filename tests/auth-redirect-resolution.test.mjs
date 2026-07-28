import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resolver = readFileSync('src/lib/auth/resolve-post-auth-destination.ts', 'utf8');
const validator = readFileSync('src/lib/auth/validate-continuation-route.ts', 'utf8');
const proxy = readFileSync('src/proxy.ts', 'utf8');
const layout = readFileSync('src/app/(protected)/layout.tsx', 'utf8');
const workspacePage = readFileSync('src/app/(protected)/workspace/page.tsx', 'utf8');
const workspaceSetupPage = readFileSync('src/app/(protected)/workspace/setup/page.tsx', 'utf8');
const gettingStartedPage = readFileSync('src/app/(protected)/getting-started/page.tsx', 'utf8');
const onboardingPage = readFileSync('src/app/(protected)/onboarding/page.tsx', 'utf8');

test('authenticated + safe next uses requested route', () => {
  assert.match(resolver, /requestedRoute && context\.isRequestedRouteSafe/);
  assert.match(resolver, /reason: "requested-route"/);
});

test('/workspace is quarantined and redirects to /command-center, not the legacy shell', () => {
  assert.match(workspacePage, /redirect\("\/command-center"\)/);
  assert.doesNotMatch(workspacePage, /WorkspaceShell/);
});

// PMF-001/PMF-002 canonical onboarding consolidation retired the legacy
// fabricated-readiness wizard (GettingStartedFlow) as a reachable onboarding
// surface. /workspace/setup, /getting-started and /onboarding are now all
// thin redirect-only compatibility routes that resolve the real, current
// onboarding state and redirect to the derived canonical destination — none
// of them render a wizard or hardcode a legacy destination.
test('/workspace/setup no longer renders the legacy wizard — it redirects via the canonical resolver', () => {
  assert.doesNotMatch(workspaceSetupPage, /import\s*\{\s*GettingStartedFlow/);
  assert.doesNotMatch(workspaceSetupPage, /<GettingStartedFlow/);
  assert.match(workspaceSetupPage, /redirectToCanonicalOnboardingDestination/);
});

test('legacy onboarding routes (/getting-started, /onboarding) redirect via the canonical resolver, not a hardcoded legacy destination', () => {
  for (const [name, src] of [
    ['getting-started', gettingStartedPage],
    ['onboarding', onboardingPage],
  ]) {
    assert.match(src, /redirectToCanonicalOnboardingDestination/, `${name} page must use the canonical redirect helper`);
    assert.doesNotMatch(src, /redirect\("\/workspace\/setup"\)/, `${name} page must not hardcode the retired legacy wizard route`);
  }
});

test('the canonical legacy-redirect helper never hardcodes a destination — it always derives one from real state', () => {
  const helper = readFileSync('src/lib/auth/legacy-onboarding-redirect.ts', 'utf8');
  assert.match(helper, /resolveOnboardingState/);
  assert.match(helper, /getOnboardingRedirect\(state\)/);
  assert.doesNotMatch(helper, /redirect\("\/workspace\/setup"\)/);
});

test('proxy does not hijack valid onboarded protected navigation', () => {
  assert.doesNotMatch(proxy, /pathname !== decision\.destination/);
  assert.doesNotMatch(proxy, /decision\.reason !== "requested-route"/);
});

// PMF-002's routing-layer gate lived exactly in proxy.ts's former
// onboarding-state enforcement (requiresOnboardingCompletion + a JWT-boolean
// state resolver), which unconditionally sent every PMO-less user to the
// legacy wizard before the DB-derived resolver ever ran. Edge middleware now
// makes no onboarding-state decision — (protected)/layout.tsx, which calls
// the real resolveOnboardingState on every request, is the sole authority.
test('proxy makes no onboarding-state-based access decision — that authority lives solely in layout.tsx', () => {
  assert.doesNotMatch(proxy, /requiresOnboardingCompletion/);
  assert.doesNotMatch(proxy, /isSetupRoute/);
  assert.doesNotMatch(proxy, /onboardingCompleted/);
  assert.match(layout, /resolveOnboardingState/);
  assert.match(layout, /getOnboardingRedirect\(onboardingState\)/);
});

test('proxy quarantines the legacy /workspace shell to /command-center', () => {
  assert.match(proxy, /pathname === "\/workspace"/);
  const workspaceBlock = proxy.slice(proxy.indexOf('pathname === "/workspace"'));
  assert.match(workspaceBlock.slice(0, 200), /new URL\("\/command-center", request\.url\)/);
});

test('no circular redirect chains between setup and legacy routes', () => {
  // Loop safety now comes from deriving the destination live (never a fixed
  // route literal shared between the two pages) plus layout.tsx's
  // currentPath !== dest guard — verified structurally: neither retired page
  // hardcodes the other's route.
  assert.doesNotMatch(gettingStartedPage, /redirect\("\/onboarding"\)/);
  assert.doesNotMatch(onboardingPage, /redirect\("\/getting-started"\)/);
  assert.match(layout, /currentPath !== dest/);
});

test('continuation validator maintains auth recursion protections', () => {
  assert.match(validator, /"\/login"/);
  assert.match(validator, /"\/auth"/);
  assert.match(validator, /ALLOWED_PREFIXES/);
});

test('proxy uses central route policy registry helpers', () => {
  assert.match(proxy, /getRouteAccessPolicy/);
  assert.match(proxy, /isProtectedPageRoute/);
  assert.match(proxy, /isAuthRoute/);
});
