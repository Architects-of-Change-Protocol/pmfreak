/**
 * P2-14 — real authentication and real canonical-state reads.
 *
 * Authentication goes through the product's own sign-in form and `/api/login`. There is no
 * service-role login, no injected auth context, no forged cookie or JWT, and no test-only
 * bypass header: the browser gets its session exactly the way a Founder would, or the test
 * fails.
 *
 * Canonical state is READ back through the same authenticated browser context, so a read
 * is subject to the same RLS and membership rules as the user. Reads VERIFY state; they
 * never create the P2-14-owned state the story is supposed to produce.
 */

import { expect, type BrowserContext, type Page } from "@playwright/test";
import { fixturePassword } from "./p2-14-scenario";

export type OperationalSummary = Record<string, unknown> & {
  /** Declared because P2-14 asserts the Source identity the SERVER selected for an intake. */
  sources?: Array<Record<string, unknown>>;
  decisions?: Array<Record<string, unknown>>;
  materialActions?: Array<Record<string, unknown>>;
  materialActionEvaluations?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  executions?: Array<Record<string, unknown>>;
  outcomes?: Array<Record<string, unknown>>;
  observations?: Array<Record<string, unknown>>;
  evidence?: Array<Record<string, unknown>>;
  observationEligibleEvidence?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
};

/**
 * Sign in through the real product surface.
 *
 * Asserts we actually left `/login`: a failed sign-in re-renders the same route with an
 * error, and treating that as success would let every later assertion run unauthenticated.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  // Never logged, never echoed into an artifact.
  await page.getByPlaceholder("Password").fill(fixturePassword());
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 }),
    page.getByRole("button", { name: "Continue" }).click(),
  ]);
  expect(page.url()).not.toContain("/login");
}

/** Drop the session the way a real sign-out does, so no cached principal survives. */
export async function signOut(context: BrowserContext): Promise<void> {
  await context.clearCookies();
  // SWR keeps fetched summaries in module memory per page; clearing origin storage as well
  // means the next principal cannot inherit a cached read model or a pending attempt key.
  for (const page of context.pages()) {
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage may be unavailable */ }
    }).catch(() => { /* page may be mid-navigation */ });
  }
}

/** Authenticated canonical read, through the browser's own session. */
export async function readSummary(page: Page, workspaceId: string, projectId: string): Promise<OperationalSummary> {
  const response = await page.request.get(
    `/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`
  );
  expect(response.status(), "authenticated summary read").toBe(200);
  return (await response.json()) as OperationalSummary;
}

/** Raw probe used by the negative controls — returns status and body without asserting. */
export async function probeSummary(page: Page, workspaceId: string, projectId: string) {
  const response = await page.request.get(
    `/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`
  );
  const bodyText = await response.text();
  return { status: response.status(), bodyText };
}

/** Raw write probe used by the viewer/IDOR negative controls. */
export async function probeWrite(page: Page, payload: Record<string, unknown>) {
  const response = await page.request.post("/api/operational-flow", {
    data: payload,
    headers: { "Content-Type": "application/json" },
  });
  const bodyText = await response.text();
  return { status: response.status(), bodyText };
}

export function countOf(summary: OperationalSummary, key: keyof OperationalSummary): number {
  const value = summary[key];
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Poll an authenticated canonical read until a condition holds.
 *
 * The browser writes through the product; the read model is refreshed by SWR. Waiting on
 * persisted server state — rather than on a rendered string — is what makes these
 * assertions about the canonical record instead of about render timing.
 */
export async function waitForSummary(
  page: Page,
  workspaceId: string,
  projectId: string,
  predicate: (summary: OperationalSummary) => boolean,
  description: string,
  timeoutMs = 45_000
): Promise<OperationalSummary> {
  const deadline = Date.now() + timeoutMs;
  let last: OperationalSummary = {};
  while (Date.now() < deadline) {
    last = await readSummary(page, workspaceId, projectId);
    if (predicate(last)) return last;
    await page.waitForTimeout(750);
  }
  throw new Error(`p2_14_timeout_waiting_for:${description}`);
}
