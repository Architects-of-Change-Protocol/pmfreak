import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resolver = readFileSync('src/lib/auth/resolve-post-auth-destination.ts', 'utf8');
const validator = readFileSync('src/lib/auth/validate-continuation-route.ts', 'utf8');
const proxy = readFileSync('src/proxy.ts', 'utf8');
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

test('/workspace/setup renders setup flow and does not redirect to /getting-started', () => {
  assert.match(workspaceSetupPage, /GettingStartedFlow/);
  assert.doesNotMatch(workspaceSetupPage, /redirect\("\/getting-started"\)/);
});

test('legacy onboarding routes alias to canonical /workspace/setup', () => {
  assert.match(gettingStartedPage, /redirect\("\/workspace\/setup"\)/);
  assert.match(onboardingPage, /redirect\("\/workspace\/setup"\)/);
});

test('proxy does not hijack valid onboarded protected navigation', () => {
  assert.doesNotMatch(proxy, /pathname !== decision\.destination/);
  assert.doesNotMatch(proxy, /decision\.reason !== "requested-route"/);
});

test('proxy enforces setup access for onboarding incomplete users', () => {
  assert.match(proxy, /requiresOnboardingCompletion\(pathname\) && !onboardingCompleted/);
  // Canonical: redirect target comes from getOnboardingRedirect, not hardcoded
  assert.match(proxy, /getOnboardingRedirect\(onboardingState\)/);
});

test('proxy redirects onboarding-complete users away from setup routes to /command-center', () => {
  assert.match(proxy, /isSetupRoute\(pathname\) && onboardingCompleted/);
  const setupBlock = proxy.slice(proxy.indexOf('isSetupRoute(pathname) && onboardingCompleted'));
  assert.match(setupBlock.slice(0, 200), /new URL\("\/command-center", request\.url\)/);
});

test('proxy quarantines the legacy /workspace shell to /command-center', () => {
  assert.match(proxy, /pathname === "\/workspace"/);
  const workspaceBlock = proxy.slice(proxy.indexOf('pathname === "/workspace"'));
  assert.match(workspaceBlock.slice(0, 200), /new URL\("\/command-center", request\.url\)/);
});

test('no circular redirect chains between setup and legacy routes', () => {
  assert.doesNotMatch(workspaceSetupPage, /redirect\("\/getting-started"\)/);
  assert.match(gettingStartedPage, /workspace\/setup/);
  assert.match(onboardingPage, /workspace\/setup/);
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
  assert.match(proxy, /isSetupRoute/);
});
