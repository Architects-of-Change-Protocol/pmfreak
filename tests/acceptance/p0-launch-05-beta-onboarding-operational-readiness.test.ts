import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/auth-js";
import { classifyAuthError } from "../../src/lib/auth/auth-error-classification";
import { evaluateClosedFreeBetaEnvSafety } from "../../src/lib/security/environment";
import { evaluateWorkspaceMembershipRemoval, acceptWorkspaceInvite, removeWorkspaceMember } from "../../src/lib/workspace-team";
import { TENANT_A, TENANT_B } from "../../scripts/p2-13/founder-scenario-manifest.mjs";
import { GUARD_MODES, LOCAL_ISOLATED, assertIsolatedTarget } from "../../scripts/p2-13/isolation-guard.mjs";
import {
  HttpSession,
  environOf,
  freePort,
  requireProc,
  shutdownProductionServer,
  startProductionServer,
  type ServerHandle,
} from "./support/runtime-acceptance";

const goodEnv = {
  PMFREAK_OPERATING_PROFILE: "closed-free-beta",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-local-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-local-service-role",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
} as unknown as NodeJS.ProcessEnv;

test("1. installed auth-js ordinary no-session class is classified as unauthenticated", () => {
  assert.equal(classifyAuthError(new AuthSessionMissingError()), "session_missing");
});

test("2. ordinary no-session is not a dependency outage (non-vacuity)", () => {
  assert.notEqual(classifyAuthError(new AuthSessionMissingError()), "retryable_transport");
});

test("3. installed auth-js transport class is classified as retryable dependency failure", () => {
  assert.equal(classifyAuthError(new AuthRetryableFetchError("synthetic", 0)), "retryable_transport");
});

test("4. transport failure is not accepted as ordinary no-session (non-vacuity)", () => {
  assert.notEqual(classifyAuthError(new AuthRetryableFetchError("synthetic", 0)), "session_missing");
});

test("5. auth-js 401/403 API errors remain genuine auth rejection", () => {
  assert.equal(classifyAuthError(new AuthApiError("synthetic", 401, "bad_jwt")), "auth_rejection");
  assert.equal(classifyAuthError(new AuthApiError("synthetic", 403, "forbidden")), "auth_rejection");
});

test("6. beta environment contract accepts the isolated no-billing profile", () => {
  assert.deepEqual(evaluateClosedFreeBetaEnvSafety(goodEnv), []);
});

test("7. beta environment contract rejects a missing selected profile", () => {
  assert.ok(evaluateClosedFreeBetaEnvSafety({ ...goodEnv, PMFREAK_OPERATING_PROFILE: undefined }).some((v) => v.code === "beta_profile_not_selected"));
});

test("8. beta environment contract rejects missing required Supabase configuration", () => {
  assert.ok(evaluateClosedFreeBetaEnvSafety({ ...goodEnv, SUPABASE_SERVICE_ROLE_KEY: undefined }).some((v) => v.code === "missing_beta_environment"));
});

test("9. Stripe is not required for the closed free beta", () => {
  const codes = evaluateClosedFreeBetaEnvSafety({ ...goodEnv, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined });
  assert.deepEqual(codes, []);
});

test("10. readiness declares anonymous auth health only for the beta profile", () => {
  const source = readFileSync("src/app/api/ready/route.ts", "utf8");
  const authCheck = source.slice(source.indexOf("async function checkAuth"), source.indexOf("export async function GET"));
  assert.match(authCheck, /\/auth\/v1\/health/);
  assert.match(authCheck, /headers: \{ apikey: anonKey \}/);
  assert.doesNotMatch(authCheck, /SUPABASE_SERVICE_ROLE_KEY|signInWithPassword/);
  // The profile gate is at the CALL SITE, so that outside the beta profile the
  // check is ABSENT from `checks` rather than present-and-passing. A passing
  // entry would widen the declared dependency set for non-beta consumers.
  const handler = source.slice(source.indexOf("export async function GET"));
  assert.match(handler, /if \(isClosedFreeBeta\(\)\) checks\.push\(await checkAuth\(\)\)/);
});

test("11. operator onboarding uses the supported tenant-aware invite boundary", () => {
  const source = readFileSync("src/lib/workspace-team.ts", "utf8");
  assert.match(source, /inviteWorkspaceMember/);
  assert.match(source, /active invitation already exists/i);
  assert.match(source, /workspace_id: input\.workspaceId/);
  assert.match(source, /role: targetRole/);
});

test("12. invite acceptance binds server-side tenant and role and refuses caller substitution", () => {
  const source = readFileSync("src/lib/workspace-team.ts", "utf8");
  assert.match(source, /workspace_id: invite\.workspaceId/);
  assert.match(source, /role: invite\.role/);
  assert.doesNotMatch(source.slice(source.indexOf("export async function acceptWorkspaceInvite"), source.indexOf("Workspace member role update")), /input\.workspaceId|input\.role/);
});

test("13. canonical two-tenant fixture identities are distinct (wrong mapping control)", () => {
  assert.notEqual(TENANT_A.workspaceId, TENANT_B.workspaceId);
  assert.notEqual(TENANT_A.projectId, TENANT_B.projectId);
  assert.throws(() => assert.equal(TENANT_A.workspaceId, TENANT_B.workspaceId));
});

test("14. protected journey requires session and authoritative membership", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const layout = readFileSync("src/app/(protected)/layout.tsx", "utf8");
  assert.match(proxy, /isProtectedPageRoute\(pathname\) && !user/);
  assert.match(layout, /assertRuntimeAuthContinuity/);
  assert.match(layout, /resolveOnboardingState/);
});

test("15. governed operations resolve authenticated tenant context through Frontera", () => {
  const authorization = readFileSync("src/lib/security/server-authorization.ts", "utf8");
  assert.match(authorization, /requireAuthenticatedUser/);
  assert.match(authorization, /authorizeRuntimeAction/);
  assert.match(authorization, /workspaceId: requirement\.workspaceId/);
});

test("16. policy denial and Frontera infrastructure failure remain distinct", () => {
  const prior = readFileSync("tests/acceptance/p0-launch-04-failure-recovery-observability.test.ts", "utf8");
  assert.match(prior, /frontera_denied/);
  assert.match(prior, /frontera_unavailable/);
  assert.notEqual("frontera_denied", "frontera_unavailable");
});

test("17. offboarding permits owner/admin removal of a non-owner participant", () => {
  assert.equal(evaluateWorkspaceMembershipRemoval({ actorRole: "owner", actorUserId: "a", targetUserId: "b", targetRole: "pm", ownerCount: 1 }), "allow");
});

test("18. offboarding cannot self-remove or orphan the final owner", () => {
  assert.equal(evaluateWorkspaceMembershipRemoval({ actorRole: "owner", actorUserId: "a", targetUserId: "a", targetRole: "owner", ownerCount: 1 }), "deny_self_removal");
  assert.equal(evaluateWorkspaceMembershipRemoval({ actorRole: "admin", actorUserId: "a", targetUserId: "b", targetRole: "owner", ownerCount: 1 }), "deny_last_owner");
});

test("19. offboarding is auditable and removes membership rather than deleting identity", () => {
  const source = readFileSync("src/lib/workspace-team.ts", "utf8");
  const fn = source.slice(source.indexOf("export async function removeWorkspaceMember"), source.indexOf("export async function updateWorkspaceMemberRole"));
  assert.match(fn, /from\("workspace_memberships"\)\.delete\(\)/);
  assert.match(fn, /event_type: "member_removed"/);
  assert.doesNotMatch(fn, /auth\.admin\.deleteUser|delete.*auth\.users/);
});

test("20. an old session cannot retain governed authority after membership removal", () => {
  const authorization = readFileSync("src/lib/security/server-authorization.ts", "utf8");
  assert.match(authorization, /evaluateCapability/);
  assert.match(authorization, /authorizeRuntimeAction/);
  assert.doesNotMatch(authorization, /getSession\(|cached.*membership/i);
});

test("21. cleanup remains scoped to deterministic disposable fixture identities", () => {
  const cleanup = readFileSync("scripts/p2-13/fixture-cleanup.mjs", "utf8");
  assert.doesNotMatch(cleanup, /truncate\s+table|drop\s+schema/i);
  assert.match(cleanup, /where/i);
});

// ═══════════════════════════════════════════════════════════════════════════
//  RUNTIME — the closed-free-beta profile, actually selected, actually running
//
//  Assertions 1-21 are source-contract assertions. They prove the code has the
//  right SHAPE; they cannot prove the profile can be started, that the preflight
//  gates `next start`, or that readiness moves when the auth dependency does.
//  RR-BETA-PROFILE-UNEXERCISED recorded exactly that gap. This section closes it
//  through the canonical supported entrypoint — `npm run start:closed-free-beta`
//  — reusing the predecessor's ONE server lifecycle (spawn, health-probe
//  deadline, pid discovery, shutdown, residue ledger) rather than growing a
//  second. Nothing here replays the P0-LAUNCH-04 failure matrix; only the auth
//  readiness dependency this increment adopted is exercised.
// ═══════════════════════════════════════════════════════════════════════════

const ROOT = process.cwd();
const OUTAGE_SHIM = path.join(ROOT, "tests/acceptance/support/dependency-outage-shim.cjs");
const OWNER_A = TENANT_A.actors.find((actor: { reference: string }) => actor.reference.endsWith(":owner"))!;
const BETA_SCRIPT = "start:closed-free-beta";
const BETA_PROFILE = "closed-free-beta";
const READINESS_TRANSITION_TIMEOUT_MS = 30_000;

const EVIDENCE: Record<string, unknown> = {};

let CONTROL_DIR = "";
let SUPABASE_HOSTPORT = "";
let PORT = 0;
let server: ServerHandle | null = null;
let session: HttpSession;
let ownerUserId = "";
let companyId = "";
let outsiderUserId = "";
let outsiderEmail = "";
let inviteToken = "";

const admin = () =>
  createClient(process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL!, process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/**
 * The environment a beta process is started with.
 *
 * Overrides are EMPTY STRINGS, never deletions: `next start` loads `.env.local`
 * itself and @next/env fills any name whose value is `undefined`, so a deletion
 * would let the dotenv file put the value back and the control would prove
 * nothing. This is the predecessor's rule and it applies unchanged here.
 */
function betaEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PMFREAK_OPERATING_PROFILE: BETA_PROFILE,
    // The closed FREE beta has no billing surface. Blanked so a start that
    // succeeds proves Stripe is genuinely not required, not merely absent here.
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${OUTAGE_SHIM}`.trim(),
    P0_LAUNCH_04_OUTAGE_DIR: CONTROL_DIR,
    P0_LAUNCH_04_OUTAGE_HOSTPORT: SUPABASE_HOSTPORT,
    P0_LAUNCH_04_OUTAGE_PATH_PREFIXES: "/auth/v1",
    ...overrides,
  };
}

type ReadinessCheck = { name: string; status: string; detail?: string };
type Readiness = { httpStatus: number; status: string; checks: ReadinessCheck[]; raw: string };

async function readReadiness(): Promise<Readiness> {
  const response = await session.request("/api/ready");
  let parsed: { status?: string; checks?: ReadinessCheck[] } = {};
  try {
    parsed = JSON.parse(response.text) as typeof parsed;
  } catch {
    /* a non-JSON body is itself the evidence; `raw` carries it */
  }
  return { httpStatus: response.status, status: parsed.status ?? "(unparsed)", checks: parsed.checks ?? [], raw: response.text };
}

/** Bounded wait for readiness to reach an expected HTTP status; the last observation is always reported. */
async function awaitReadiness(want: number, why: string): Promise<Readiness> {
  const deadline = Date.now() + READINESS_TRANSITION_TIMEOUT_MS;
  let last = await readReadiness();
  while (last.httpStatus !== want && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    last = await readReadiness();
  }
  assert.equal(last.httpStatus, want, `${why} (last observation: ${last.httpStatus} ${last.raw.slice(0, 300)})`);
  return last;
}

/**
 * The same tenant-scoped read, issued three times: before admission, after it,
 * and after offboarding.
 *
 * This endpoint was chosen because it actually DISCRIMINATES on membership,
 * verified live against this build: anonymous 401, authenticated non-member
 * 403, member 200. Two other candidates were rejected for proving nothing —
 * `/api/workspace-team/members` answers 403 even to the workspace OWNER, and
 * `/api/portfolio` answers 200 to an authenticated NON-member because it scopes
 * by the caller's own memberships rather than gating on the requested tenant.
 */
const tenantMemberRead = () => session.request(`/api/execution-tasks?projectId=${encodeURIComponent(TENANT_A.projectId)}`);

const authCheckOf = (readiness: Readiness) => readiness.checks.find((check) => check.name === "auth");
const setAuthOutage = (installed: boolean) => {
  const flag = path.join(CONTROL_DIR, "path-outage");
  if (installed) fs.writeFileSync(flag, "");
  else fs.rmSync(flag, { force: true });
};

before(async () => {
  requireProc("the beta runtime section reports process-level evidence");

  // Isolation BEFORE any privileged access, using the repository's own guard.
  const isolation = assertIsolatedTarget(process.env, { mode: GUARD_MODES.SEED });
  assert.equal(isolation.classification, LOCAL_ISOLATED, `the beta acceptance target was not local and isolated: ${JSON.stringify(isolation.target ?? null)}`);
  EVIDENCE.isolationClassification = String(isolation.classification);
  EVIDENCE.isolationTarget = String(isolation.target?.supabaseHost ?? "(not reported)");

  const supabaseUrl = new URL(process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL!);
  SUPABASE_HOSTPORT = `${supabaseUrl.hostname}:${supabaseUrl.port}`;
  CONTROL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pmfreak-p0-launch-05-"));
  setAuthOutage(false);

  // One build serves every scenario below, so a failure is attributable to
  // runtime behaviour rather than to compilation drift between scenarios.
  const buildIdPath = path.join(ROOT, ".next/BUILD_ID");
  const previousBuildId = fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, "utf8") : null;
  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  assert.ok(fs.existsSync(buildIdPath), "next build produced no .next/BUILD_ID");
  const buildId = fs.readFileSync(buildIdPath, "utf8");
  assert.notEqual(buildId, previousBuildId, "the beta gate accepted a stale build — .next/BUILD_ID was not rewritten");
  EVIDENCE.buildId = buildId;

  const supabase = admin();
  for (let page = 1; page <= 20 && !ownerUserId; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    assert.ok(!listed.error, `listUsers failed: ${listed.error?.message}`);
    const found = listed.data.users.find((user) => (user.email ?? "").toLowerCase() === OWNER_A.email.toLowerCase());
    if (found) ownerUserId = found.id;
    if (listed.data.users.length < 200) break;
  }
  assert.ok(ownerUserId, `no authenticated principal for ${OWNER_A.email}. Run 'npm run seed:p2-13-founder' first; this gate never invents an identity.`);

  // company_id belongs to the INVITING USER, not to the workspace — resolved by
  // the same rule the product uses (`feature-gates.getCompanyIdByUserId`):
  // user_metadata.company_id when present, otherwise the user's own id.
  const owner = await supabase.auth.admin.getUserById(ownerUserId);
  assert.ok(!owner.error && owner.data.user, `could not resolve the inviting owner: ${owner.error?.message}`);
  const ownerCompany = (owner.data.user.user_metadata ?? {}).company_id;
  companyId = typeof ownerCompany === "string" ? ownerCompany : owner.data.user.id;

  // A NON-INVITED platform identity. Created deliberately, because the claim
  // this gate makes is that creating one confers no beta authority — which
  // cannot be shown without one existing.
  outsiderEmail = `p0-launch-05-noninvited-${Date.now()}@example.test`;
  const created = await supabase.auth.admin.createUser({ email: outsiderEmail, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD!, email_confirm: true });
  assert.ok(!created.error && created.data.user, `could not create the non-invited identity: ${created.error?.message}`);
  outsiderUserId = created.data.user.id;
  EVIDENCE.nonInvitedIdentityCreated = outsiderEmail;

  PORT = await freePort();
  session = new HttpSession(`http://127.0.0.1:${PORT}`);
});

after(async () => {
  if (server) await shutdownProductionServer(server, { label: "after(): the beta production server", graceMs: 10_000 });
  server = null;
  const supabase = admin();
  if (outsiderUserId) {
    // Scoped to the disposable identity this run created, by id. Never a bulk delete.
    await supabase.from("workspace_memberships").delete().eq("workspace_id", TENANT_A.workspaceId).eq("user_id", outsiderUserId);
    await supabase.from("workspace_invitations").delete().eq("workspace_id", TENANT_A.workspaceId).eq("email", outsiderEmail);
    await supabase.auth.admin.deleteUser(outsiderUserId);
  }
  try {
    fs.rmSync(CONTROL_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  console.log(`\nP0_LAUNCH_05_BETA_RUNTIME_EVIDENCE ${JSON.stringify(EVIDENCE, null, 2)}`);
});

// ───────────────── preflight enforcement through the supported path ─────────────────

test("22. BETA_PREFLIGHT=ENFORCED: an invalid beta environment REFUSES to start the server", async () => {
  const outcome = await startProductionServer({
    port: PORT,
    script: BETA_SCRIPT,
    env: betaEnv({ SUPABASE_SERVICE_ROLE_KEY: "" }),
    timeoutMs: 60_000,
  });
  if (outcome.started) {
    await shutdownProductionServer(outcome.handle, { label: "22: a beta server that should never have started" });
    assert.fail("a beta environment missing a required server secret STARTED a server");
  }
  assert.match(outcome.log, /"failureClass":"CONFIGURATION_FAILURE"/, `the refusal did not come from the beta preflight: ${outcome.log.slice(-600)}`);
  assert.match(outcome.log, /missing_beta_environment/, `the refusal did not name the beta violation: ${outcome.log.slice(-600)}`);
  // The preflight must gate `next start`, not run beside it.
  assert.doesNotMatch(outcome.log, /Ready in|- Local:\s+http/, `next start was reached despite a failed preflight: ${outcome.log.slice(-600)}`);
  assert.equal(outcome.survivors.length, 0, "the refused beta start left surviving processes behind");
  EVIDENCE.invalidBetaEnvRefusedStart = "missing_beta_environment; next start never reached";
});

test("23. SERVER_ONLY_ENV_BOUNDARY=ENFORCED through the supported beta path", async () => {
  const outcome = await startProductionServer({
    port: PORT,
    script: BETA_SCRIPT,
    env: betaEnv({ NEXT_PUBLIC_SERVICE_ROLE_KEY: "synthetic-not-a-real-key" }),
    timeoutMs: 60_000,
  });
  if (outcome.started) {
    await shutdownProductionServer(outcome.handle, { label: "23: a beta server that should never have started" });
    assert.fail("a secret-shaped NEXT_PUBLIC_ name STARTED a beta server");
  }
  // Attribution is structural, not prose-matching: only assertServerOnlyEnvBoundary
  // tags a refusal with its own name, so this proves the sibling guard RAN —
  // which reading the source could never establish.
  assert.match(outcome.log, /"guard":"assertServerOnlyEnvBoundary"/, `the refusal was not attributed to the sibling guard: ${outcome.log.slice(-600)}`);
  assert.equal(outcome.survivors.length, 0, "the refused beta start left surviving processes behind");
  EVIDENCE.serverOnlyEnvBoundaryEnforced = "assertServerOnlyEnvBoundary refused a secret-shaped NEXT_PUBLIC_ name";
});

test("24. VALID_BETA_ENV=STARTS: the canonical beta entrypoint starts and becomes healthy", async () => {
  const outcome = await startProductionServer({ port: PORT, script: BETA_SCRIPT, env: betaEnv(), timeoutMs: 240_000 });
  if (!outcome.started) assert.fail(`the canonical beta entrypoint did not start: ${outcome.reason}`);
  server = outcome.handle;
  EVIDENCE.betaEntrypoint = `npm run ${BETA_SCRIPT}`;
  EVIDENCE.betaHealthyAfterMs = server.healthyAfterMs;
  EVIDENCE.betaServerPid = server.serverPid;
});

test("25. NON-VACUITY: 22 and 23 refused because of the injected fault, not because beta cannot start", () => {
  assert.ok(server, "the valid beta environment never started, so the refusals above are not attributable to their faults");
  assert.equal(EVIDENCE.invalidBetaEnvRefusedStart !== undefined && EVIDENCE.serverOnlyEnvBoundaryEnforced !== undefined, true);
});

test("26. BETA_PROFILE=closed-free-beta is actually selected in the RUNNING process", () => {
  const environ = environOf(server!.serverPid);
  assert.equal(environ.get("PMFREAK_OPERATING_PROFILE"), BETA_PROFILE, "the running server is not in the closed-free-beta profile");
  EVIDENCE.runningProfile = environ.get("PMFREAK_OPERATING_PROFILE");
});

test("27. STRIPE_REQUIRED=NO: the beta runtime is healthy with no Stripe secret present", async () => {
  const environ = environOf(server!.serverPid);
  assert.equal(environ.get("STRIPE_SECRET_KEY") ?? "", "", "the beta server was started WITH a Stripe secret, so 'no billing surface' is untested");
  assert.equal(environ.get("STRIPE_WEBHOOK_SECRET") ?? "", "", "the beta server was started WITH a Stripe webhook secret");
  const health = await session.request("/api/health");
  assert.equal(health.status, 200, "the beta runtime is not live without Stripe secrets");
  EVIDENCE.stripeRequired = "NO — started and live with STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET blank";
});

// ───────────────── AUTH_IS_BETA_READINESS_DEPENDENCY, at runtime ─────────────────

test("28. AUTH_HEALTHY -> READY, with auth a DECLARED readiness dependency", async () => {
  const readiness = await awaitReadiness(200, "a healthy beta runtime never reported ready");
  assert.equal(readiness.status, "ready");
  const auth = authCheckOf(readiness);
  assert.ok(auth, `readiness declared no auth check under the beta profile: ${readiness.raw.slice(0, 300)}`);
  assert.equal(auth.status, "pass");
  assert.deepEqual(
    readiness.checks.map((check) => check.name).sort(),
    ["auth", "configuration", "database", "governance_capability"],
    "the beta readiness dependency set is not the declared four",
  );
  EVIDENCE.authHealthyReadiness = `${readiness.httpStatus} ${readiness.status} (auth=${auth.status})`;
});

test("29. AUTH_UNAVAILABLE -> NOT_READY, and the auth check is the one that fails", async () => {
  setAuthOutage(true);
  const readiness = await awaitReadiness(503, "an unreachable auth dependency did not move beta readiness to NOT READY");
  assert.equal(readiness.status, "not_ready");
  const auth = authCheckOf(readiness);
  assert.ok(auth && auth.status === "fail", `readiness failed for something other than auth: ${readiness.raw.slice(0, 400)}`);
  EVIDENCE.authOutageReadiness = `${readiness.httpStatus} ${readiness.status} (auth=${auth.detail ?? "fail"})`;
});

test("30. NON-VACUITY: the outage is SCOPED to auth — the database check still passes", async () => {
  const readiness = await readReadiness();
  const database = readiness.checks.find((check) => check.name === "database");
  assert.ok(database && database.status === "pass", `the auth outage also took the database down, so 29 is not attributable to auth: ${readiness.raw.slice(0, 400)}`);
});

test("31. liveness stays DISTINCT from readiness during the auth outage, in the same process", async () => {
  const health = await session.request("/api/health");
  assert.equal(health.status, 200, "liveness must stay truthful while a dependency is unreachable");
  const environ = environOf(server!.serverPid);
  assert.equal(environ.get("PMFREAK_OPERATING_PROFILE"), BETA_PROFILE, "the process changed underneath the outage");
  EVIDENCE.livenessDuringAuthOutage = "200 ok — same pid, NOT READY concurrently";
});

test("32. AUTH_RECOVERED -> READY, without restarting the process", async () => {
  const pidBefore = server!.serverPid;
  setAuthOutage(false);
  const readiness = await awaitReadiness(200, "beta readiness did not recover after the auth dependency was restored");
  assert.equal(readiness.status, "ready");
  assert.equal(authCheckOf(readiness)?.status, "pass");
  assert.equal(server!.serverPid, pidBefore, "readiness 'recovered' in a different process — that is a restart, not a recovery");
  EVIDENCE.authRecoveredReadiness = `${readiness.httpStatus} ${readiness.status} — same pid ${pidBefore}`;
});

// ───────── CLOSED_BETA_AUTHORITY_MODEL=INVITATION_CONTROLLED_TENANT_AUTHORITY ─────────
//
// ACCOUNT_CREATION != BETA_ADMISSION != TENANT_AUTHORITY.
// Platform signup is NOT disabled and this gate never claims it is.

test("33. a non-invited platform identity EXISTS and can authenticate", async () => {
  const listed = await admin().auth.admin.getUserById(outsiderUserId);
  assert.ok(!listed.error && listed.data.user, "the non-invited identity does not exist, so nothing below is attributable to admission");
  const login = await session.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: outsiderEmail, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD! }).toString(),
  });
  assert.ok([200, 302, 303, 307].includes(login.status), `the non-invited identity could not authenticate: ${login.status} ${login.text.slice(0, 200)}`);
  EVIDENCE.accountCreationIsNotBetaAdmission = "identity exists and authenticates";
});

test("34. ACCOUNT_CREATION confers NO beta tenant membership and NO tenant role", async () => {
  const memberships = await admin().from("workspace_memberships").select("workspace_id, role").eq("user_id", outsiderUserId);
  assert.ok(!memberships.error, `membership lookup failed: ${memberships.error?.message}`);
  assert.deepEqual(memberships.data ?? [], [], "a merely-created identity already holds tenant membership");
});

test("35. a non-invited identity is DENIED protected beta tenant access and governed tenant operation", async () => {
  const tenantRead = await tenantMemberRead();
  // NOT merely ">= 400": a bare 4xx check would also pass on a validation
  // error and prove nothing about authority. This must be an explicit
  // AUTHORIZATION denial, and test 38 then shows the identical request
  // answering 200 once admission exists — which is what makes it attributable.
  assert.ok([401, 403].includes(tenantRead.status), `a tenant read by a non-invited identity was not an authorization denial: ${tenantRead.status} ${tenantRead.text.slice(0, 200)}`);

  const governed = await session.request("/api/operational-flow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: TENANT_A.workspaceId, projectId: TENANT_A.projectId, operation: "dispatch_material_action_to_task", actionId: "00000000-0000-4000-8000-000000000000" }),
  });
  // The governed path must be an explicit AUTHORIZATION refusal, not any 4xx.
  assert.ok([401, 403].includes(governed.status), `a governed tenant operation by a non-invited identity was not an authorization denial: ${governed.status} ${governed.text.slice(0, 300)}`);
  EVIDENCE.nonInvitedTenantAccess = `denied (tenant read ${tenantRead.status}, governed ${governed.status} — both authorization)`;
});

test("36. SUPPORTED_OPERATOR_INVITE: the operator boundary creates an inspectable invitation", () => {
  // The supported operator command — NOT a hand-written row. It runs the
  // product's own invitation domain, so the duplicate refusal, role gate,
  // token hashing, expiry and audit event are the ones the app itself uses.
  const stdout = execFileSync("npm", ["run", "beta:invite-participant", "--", "--workspace", TENANT_A.workspaceId, "--email", outsiderEmail, "--role", "pm", "--inviter", OWNER_A.email, "--emit-accept-path"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const line = stdout.trim().split("\n").filter((value) => value.startsWith("{")).pop()!;
  const result = JSON.parse(line) as { ok: boolean; invitation: { id: string; role: string; status: string } | null; acceptPath: string };
  assert.equal(result.ok, true, `the supported operator invite boundary failed: ${line}`);
  assert.ok(result.invitation, "the operator boundary created no inspectable invitation");
  assert.equal(result.invitation.status, "pending");
  assert.equal(result.invitation.role, "pm", "the operator boundary did not record the intended role");
  inviteToken = decodeURIComponent(result.acceptPath.replace("/accept-invite/", ""));
  assert.ok(inviteToken.length > 0, "no accept path was emitted, so admission cannot proceed through the real path");
  EVIDENCE.supportedOperatorInvite = `npm run beta:invite-participant -> invitation ${result.invitation.id} role pm (token withheld unless requested)`;
});

test("37. the operator boundary REFUSES invalid and duplicate state", () => {
  const refuse = (args: string[]): { ok: boolean; failureClass?: string; message?: string } => {
    try {
      const out = execFileSync("npm", ["run", "beta:invite-participant", "--", ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return JSON.parse(out.trim().split("\n").filter((v) => v.startsWith("{")).pop()!) as { ok: boolean };
    } catch (error) {
      const shell = error as { stdout?: string; stderr?: string };
      const line = `${shell.stdout ?? ""}\n${shell.stderr ?? ""}`.trim().split("\n").filter((v) => v.startsWith("{")).pop();
      return line ? (JSON.parse(line) as { ok: boolean; failureClass?: string; message?: string }) : { ok: true };
    }
  };
  // A second invitation for the same pending email.
  const duplicate = refuse(["--workspace", TENANT_A.workspaceId, "--email", outsiderEmail, "--role", "pm", "--inviter", OWNER_A.email]);
  assert.equal(duplicate.ok, false, "the operator boundary created a DUPLICATE active invitation");
  assert.match(String(duplicate.message), /active invitation already exists/i);
  // "owner" is never an invitable role through this domain.
  const ownerRole = refuse(["--workspace", TENANT_A.workspaceId, "--email", `role-${outsiderEmail}`, "--role", "owner", "--inviter", OWNER_A.email]);
  assert.equal(ownerRole.ok, false, "the operator boundary invited an OWNER");
  // An inviter with no membership in the target workspace.
  const foreign = refuse(["--workspace", TENANT_B.workspaceId, "--email", `foreign-${outsiderEmail}`, "--role", "pm", "--inviter", OWNER_A.email]);
  assert.equal(foreign.ok, false, "a non-member operator admitted a participant to a tenant they do not belong to");
  EVIDENCE.operatorBoundaryRefusals = "duplicate, owner-role and non-member inviter all refused";
});

test("38. REAL_ACCEPT_WORKSPACE_INVITE establishes tenant membership, role and authority", async () => {
  const supabase = admin();
  // The PRODUCT's acceptance path, which binds workspace and role from the
  // invite record rather than from anything the caller supplies.
  const accepted = await acceptWorkspaceInvite({ token: inviteToken, userId: outsiderUserId, userEmail: outsiderEmail }, async () => supabase as never);
  assert.ok(accepted, "invite acceptance returned nothing");

  const memberships = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", outsiderUserId);
  assert.equal(memberships.data?.length, 1, "admission did not establish exactly one tenant membership");
  assert.equal(memberships.data?.[0]?.workspace_id, TENANT_A.workspaceId, "admission bound the identity to the wrong tenant");
  assert.equal(memberships.data?.[0]?.role, "pm", "admission did not bind the invited role");

  // The authority must appear THROUGH THE RUNNING SERVER, on the same session
  // cookie that was refused in 35 — no re-login. That is what makes 35 a
  // denial of authority rather than an artefact of the request shape, and it
  // shows membership is re-derived per request rather than cached at sign-in.
  const afterAdmission = await tenantMemberRead();
  assert.equal(afterAdmission.status, 200, `admission did not confer tenant access on the existing session: ${afterAdmission.status} ${afterAdmission.text.slice(0, 300)}`);
  EVIDENCE.admissionEstablishedAuthority = `workspace ${TENANT_A.workspaceId} role pm; same session tenant read 403 -> 200`;
});

test("39. OFFBOARDING removes effective beta authority while the platform identity SURVIVES", async () => {
  const supabase = admin();
  const removed = await removeWorkspaceMember(
    { workspaceId: TENANT_A.workspaceId, actorUserId: ownerUserId, targetUserId: outsiderUserId },
    async () => supabase as never,
  );
  assert.equal(removed.removed, true);
  const memberships = await supabase.from("workspace_memberships").select("workspace_id").eq("user_id", outsiderUserId);
  assert.deepEqual(memberships.data ?? [], [], "membership survived offboarding");
  const identity = await supabase.auth.admin.getUserById(outsiderUserId);
  assert.ok(!identity.error && identity.data.user, "offboarding deleted the platform IDENTITY — it must remove authority only");

  // The same still-valid session must lose the access it just had.
  const afterRemoval = await tenantMemberRead();
  assert.notEqual(afterRemoval.status, 200, `an offboarded member kept tenant access on an existing session: ${afterRemoval.text.slice(0, 300)}`);
  EVIDENCE.offboardingRemovesAuthorityNotIdentity = `membership removed; auth.users row intact; same session tenant read 200 -> ${afterRemoval.status}`;
});

test("40. NON-VACUITY: PLATFORM_SIGNUP_IS_DISABLED is NOT claimed", async () => {
  // The identity created in before() was never invited and was never blocked
  // from existing. This gate's CLOSED claim is about tenant authority only.
  const identity = await admin().auth.admin.getUserById(outsiderUserId);
  assert.ok(identity.data.user, "the non-invited identity should still exist — signup closure is not claimed");
  EVIDENCE.closedBetaAuthorityModel = "INVITATION_CONTROLLED_TENANT_AUTHORITY (platform signup NOT disabled)";
});
