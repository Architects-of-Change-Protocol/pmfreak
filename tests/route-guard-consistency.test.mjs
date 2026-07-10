import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_GUARD_REGISTRY, PUBLIC_ROUTE_ALLOWLIST } from "../src/lib/security/route-guard-registry.ts";

// Perilla 8 — Route Middleware / Server Guard Consistency Hardening.
// See docs/security/route-middleware-server-guard-boundary.md.

const registrySrc = readFileSync("src/lib/security/route-guard-registry.ts", "utf8");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p.replaceAll("\\", "/"));
  }
  return out;
}

// Strips `//` line comments so forbidden-pattern checks below match
// executable code, not defensive comments/docstrings that explain what NOT
// to do (this codebase writes a lot of those, e.g. "never body.actorRole").
function stripLineComments(src) {
  return src
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("route guard registry file exists and is non-empty", () => {
  assert.ok(ROUTE_GUARD_REGISTRY.length > 20, "registry should cover the sensitive route families named in Perilla 8");
  assert.ok(PUBLIC_ROUTE_ALLOWLIST.length > 0, "public allowlist should not be empty");
});

test("route guard registry covers every required classification category", () => {
  const required = [
    "public",
    "auth-only",
    "workspace-scoped",
    "project-scoped",
    "billing",
    "webhook",
    "founder-internal",
    "invite-acceptance",
    "upload-evidence",
    "delegation",
  ];
  const present = new Set(ROUTE_GUARD_REGISTRY.map((e) => e.classification));
  present.add("public"); // covered by PUBLIC_ROUTE_ALLOWLIST, not ROUTE_GUARD_REGISTRY
  for (const category of required) {
    assert.ok(present.has(category), `no registry entry classified as "${category}"`);
  }
});

test("every registered route file exists and contains its declared requiredGuard", () => {
  for (const entry of ROUTE_GUARD_REGISTRY) {
    assert.ok(existsSync(entry.file), `${entry.file} (registered in route-guard-registry.ts) does not exist`);
    const src = readFileSync(entry.file, "utf8");
    assert.ok(
      src.includes(entry.requiredGuard),
      `${entry.file} is classified "${entry.classification}" and must contain "${entry.requiredGuard}"`,
    );
  }
});

test("every public-allowlisted route file exists", () => {
  for (const entry of PUBLIC_ROUTE_ALLOWLIST) {
    assert.ok(existsSync(entry.file), `${entry.file} (in PUBLIC_ROUTE_ALLOWLIST) does not exist`);
  }
});

test("public routes that do not claim service-role usage never call the privileged client factories", () => {
  for (const entry of PUBLIC_ROUTE_ALLOWLIST) {
    const src = readFileSync(entry.file, "utf8");
    const callsPrivileged = /createSupabaseServiceRoleClient\(|createPrivilegedSupabaseClient\(/.test(src);
    if (!entry.usesServiceRole) {
      assert.equal(callsPrivileged, false, `${entry.file} is allowlisted as not using service-role but calls a privileged client factory`);
    } else {
      assert.equal(callsPrivileged, true, `${entry.file} claims usesServiceRole but never calls a privileged client factory`);
      assert.ok(entry.serviceRoleJustification && entry.serviceRoleJustification.length > 10, `${entry.file} uses service-role but has no serviceRoleJustification`);
    }
  }
});

test("billing routes use requireBillingManageMembership (test #4)", () => {
  for (const file of [
    "src/app/api/billing/create-checkout-session/route.ts",
    "src/app/api/billing/create-portal-session/route.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("requireBillingManageMembership"), `${file} must call requireBillingManageMembership`);
    const code = stripLineComments(src);
    for (const forbidden of ["body.actorRole", "body.billingRole", "user.role ===", "user_metadata.role"]) {
      assert.equal(code.includes(forbidden), false, `${file} must not use "${forbidden}" for billing authorization`);
    }
  }
});

test("Stripe webhook route verifies signature before service-role client creation (test #5)", () => {
  const src = readFileSync("src/app/api/billing/webhook/route.ts", "utf8");
  const verifyIdx = src.indexOf("verifyStripeWebhookEvent");
  const serviceRoleIdx = src.search(/createSupabaseServiceRoleClient\(|createPrivilegedSupabaseClient\(/);
  assert.ok(verifyIdx >= 0, "billing webhook route must call verifyStripeWebhookEvent");
  if (serviceRoleIdx >= 0) {
    assert.ok(verifyIdx < serviceRoleIdx, "verifyStripeWebhookEvent must run before any service-role client is created");
  }
});

test("federation webhook route verifies a shared secret before treating a request as authorized (Perilla 8 regression guard)", () => {
  const src = readFileSync("src/app/api/federation/webhooks/[connectorId]/route.ts", "utf8");
  assert.ok(src.includes("requireSystemOrWebhookSecret"), "federation webhook route must verify a shared secret");
  assert.equal(
    src.includes('startsWith("Bearer ") ?? false'),
    false,
    "federation webhook route must not treat the mere presence of a Bearer header as authorization",
  );
});

test("founder/internal routes use isFounderOrInternalUser or evaluateFounderOrInternalAccess (test #6)", () => {
  const founderFiles = ROUTE_GUARD_REGISTRY.filter((e) => e.classification === "founder-internal" && e.kind === "api-route");
  assert.ok(founderFiles.length >= 6, "expected the founder/internal API surface to be registered");
  for (const entry of founderFiles) {
    const src = readFileSync(entry.file, "utf8");
    assert.ok(
      src.includes("isFounderOrInternalUser") || src.includes("evaluateFounderOrInternalAccess"),
      `${entry.file} is classified founder-internal and must call isFounderOrInternalUser/evaluateFounderOrInternalAccess`,
    );
  }
});

test("trust handshake mutation routes resolve the actor from the session, never the request body (Perilla 8 regression guard)", () => {
  for (const file of [
    "src/app/api/governance/trust/handshakes/[id]/approve/route.ts",
    "src/app/api/governance/trust/handshakes/[id]/reject/route.ts",
    "src/app/api/governance/trust/handshakes/[id]/revoke/route.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("isFounderOrInternalUser"), `${file} must gate on isFounderOrInternalUser`);
    const code = stripLineComments(src);
    for (const forbidden of ["body.approverUserId", "body.rejectorUserId", "body.revokerUserId"]) {
      assert.equal(code.includes(forbidden), false, `${file} must not trust ${forbidden} as the actor identity`);
    }
  }
});

test("delegation issue routes resolve delegatorRole from workspace_memberships, never the request body (Perilla 8 regression guard)", () => {
  for (const file of ["src/app/api/v1/delegations/route.ts", "src/app/api/governance/delegations/issue/route.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("requireWorkspaceRole"), `${file} must resolve the actor's real workspace role`);
    assert.equal(src.includes("...body, delegatorUserId: user.id }"), false, `${file} must not spread the raw body (including delegatorRole) into issueDelegatedCapability unchanged`);
  }
});

test("delegation revoke routes require requireDelegationRevokeActor, never revoke by id alone (Perilla 8 regression guard)", () => {
  for (const file of ["src/app/api/v1/delegations/[id]/revoke/route.ts", "src/app/api/governance/delegations/revoke/route.ts"]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("requireDelegationRevokeActor"), `${file} must call requireDelegationRevokeActor before revoking`);
  }
});

test("invite acceptance routes use hardened acceptance helpers (test #7)", () => {
  const early = readFileSync("src/app/api/early-access/accept/route.ts", "utf8");
  assert.ok(early.includes("acceptEarlyAccessInvite"), "early-access accept route must call acceptEarlyAccessInvite");

  const workspaceInvitePage = readFileSync("src/app/(protected)/accept-invite/[token]/page.tsx", "utf8");
  assert.ok(workspaceInvitePage.includes("acceptWorkspaceInvite"), "workspace accept-invite page must call acceptWorkspaceInvite");
});

test("schedule/execution-task mutations require write-level project access, not read (Perilla 8 regression guard)", () => {
  const milestones = readFileSync("src/lib/schedule/milestones.ts", "utf8");
  // createProjectMilestone / updateProjectMilestone / completeProjectMilestone / cancelProjectMilestone all mutate.
  assert.equal((milestones.match(/requireProjectAccess\([^)]*"write"\)/g) ?? []).length, 4, "expected 4 write-gated milestone mutations");
  assert.ok(/requireProjectAccess\(input\.projectId,\s*"read"\)/.test(milestones), "listProjectMilestones should remain read-gated");

  const taskSchedule = readFileSync("src/lib/schedule/task-schedule.ts", "utf8");
  assert.ok(taskSchedule.includes('requireProjectAccess(task.project_id, "write")'), "updateExecutionTaskSchedule must require write access");

  const convert = readFileSync("src/lib/execution-tasks/convert-task-draft.ts", "utf8");
  assert.ok(convert.includes('requireProjectAccess(draft.project_id, "write")'), "convertTaskDraftToExecutionTask must require write access");
  assert.equal(convert.includes("actorUserId"), false, "convertTaskDraftToExecutionTask must not accept a caller-supplied actor-id auth bypass");
});

// ── Forbidden auth patterns (source-scan, precise not fragile) ───────────

const SERVER_ROOTS = ["src/app", "src/lib"];
const serverFiles = SERVER_ROOTS.flatMap((root) => walk(root)).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

test("no server file authorizes via a direct role-elevation comparison (AuthUserContext.role / display role) (test #14)", () => {
  const offenders = [];
  // Scoped to identifiers that plausibly hold AuthUserContext (the display-role
  // type) — e.g. `user.role`/`authUser.role`/`AuthUserContext.role`. Deliberately
  // NOT matched: `membership.role`/`access.role`/`data.role`/`target.role`, which
  // are the correct, DB-resolved `workspace_memberships.role` comparisons used
  // throughout src/lib/workspace-access.ts, src/lib/workspace-team.ts, and
  // audit-visibility code — those are the sanctioned pattern this perilla requires,
  // not a violation of it.
  const dangerousComparison = /\b(user|authUser|currentUser|AuthUserContext)\.role\s*===\s*["'](owner|admin)["']/;
  for (const file of serverFiles) {
    const src = readFileSync(file, "utf8");
    if (dangerousComparison.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `found direct role-elevation comparisons on a display-role identifier (user.role/authUser.role === "owner"/"admin"): ${offenders.join(", ")}`);
});

test("no server file authorizes via user_metadata.role/raw_user_meta_data elevation (test #15)", () => {
  const offenders = [];
  const dangerousComparison = /user_metadata\.role\s*===\s*["'](owner|admin)["']|raw_user_meta_data.*(owner|admin)/;
  for (const file of serverFiles) {
    const src = readFileSync(file, "utf8");
    if (dangerousComparison.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `found user_metadata-based elevation checks: ${offenders.join(", ")}`);
});

test("no API route reads an authorization decision from body.actorRole/isAdmin/isFounder/isOwner (test #16)", () => {
  const offenders = [];
  const forbidden = ["body.actorRole", "body.isAdmin", "body.isFounder", "body.isOwner", "body.billingRole"];
  const apiFiles = walk("src/app/api").filter((f) => f.endsWith("route.ts"));
  for (const file of apiFiles) {
    const code = stripLineComments(readFileSync(file, "utf8"));
    if (forbidden.some((p) => code.includes(p))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `found body.actorRole/isAdmin/isFounder/isOwner usage: ${offenders.join(", ")}`);
});

// ── Unknown-route classification guard ────────────────────────────────────
// Scoped to the sensitive namespaces this perilla covers explicitly, rather
// than the full ~500-route API surface (most of which is the AOC
// governance/agent runtime, already covered as a whole by
// docs/security/local-authority-bypass-audit.md and the
// server-authorization.ts boundary). Any *new* route.ts appearing under one
// of these namespaces must be added to ROUTE_GUARD_REGISTRY or
// PUBLIC_ROUTE_ALLOWLIST, or this test fails.

const MUST_CLASSIFY_NAMESPACES = [
  "src/app/api/billing",
  "src/app/api/early-access",
  "src/app/api/governance/trust",
  "src/app/api/governance/delegations",
  "src/app/api/governance/capabilities",
  "src/app/api/v1/delegations",
  "src/app/api/federation",
];

test("every route.ts under the must-classify sensitive namespaces is registered or allowlisted (test #8)", () => {
  const registeredFiles = new Set([...ROUTE_GUARD_REGISTRY.map((e) => e.file), ...PUBLIC_ROUTE_ALLOWLIST.map((e) => e.file)]);
  const unclassified = [];
  for (const namespace of MUST_CLASSIFY_NAMESPACES) {
    if (!existsSync(namespace)) continue;
    for (const file of walk(namespace).filter((f) => f.endsWith("route.ts"))) {
      if (!registeredFiles.has(file)) unclassified.push(file);
    }
  }
  assert.deepEqual(unclassified, [], `unclassified sensitive route(s) — add to ROUTE_GUARD_REGISTRY or PUBLIC_ROUTE_ALLOWLIST: ${unclassified.join(", ")}`);
});

test("registry file documents its own scope (not exhaustive over all API routes)", () => {
  assert.match(registrySrc, /NOT exhaustive/);
});

// ── Documentation ──────────────────────────────────────────────────────────

const DOC_PATH = "docs/security/route-middleware-server-guard-boundary.md";

test("route guard boundary doc exists (test #20)", () => {
  assert.ok(existsSync(DOC_PATH), `${DOC_PATH} must exist`);
});

test("doc lists all required route categories (test #21)", () => {
  const doc = readFileSync(DOC_PATH, "utf8");
  for (const category of [
    "Public",
    "Auth-only",
    "Workspace-scoped",
    "Project-scoped",
    "Billing",
    "Webhook",
    "Founder",
    "Invite acceptance",
    "Upload",
    "AOC",
  ]) {
    assert.ok(doc.includes(category), `doc must mention the "${category}" route category`);
  }
});

test("doc states middleware is not the authorization boundary (test #22)", () => {
  const doc = readFileSync(DOC_PATH, "utf8");
  assert.match(doc, /middleware is not/i);
});
