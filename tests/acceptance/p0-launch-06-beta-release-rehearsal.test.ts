/**
 * P0-LAUNCH-06 — Beta Release Rehearsal.
 *
 * This is not a re-run of P0-LAUNCH-05's unit-level contract. It rehearses the
 * ACCEPTED closed-beta operating model as an operator lifecycle, in order, on one
 * real server, so the evidence corresponds to a procedure we could actually follow
 * for a real participant:
 *
 *   startup boundary -> liveness -> readiness -> non-invited identity ->
 *   operator admission -> acceptance -> governed first use -> real tenant
 *   operation -> cross-tenant isolation -> dependency outage/recovery ->
 *   offboarding -> authority removal -> identity survival -> audit incident
 *
 * The load-bearing claim is the GOVERNED ACCESS LIFECYCLE: the same protected
 * Frontera-reached path answers 403 before admission, 200 after it, and 403 again
 * after offboarding, on one identity, through one running server.
 *
 * SCOPE, STATED RATHER THAN IMPLIED. This certifies the Next.js SERVER RUNTIME
 * boundary. It does not certify a hosted data tier, and it is not a deployment-time
 * claim. See the P0-LAUNCH-06 evidence document.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "../../src/lib/workspace-team";
import { TENANT_A, TENANT_B } from "../../scripts/p2-13/founder-scenario-manifest.mjs";
import {
  HttpSession,
  freePort,
  shutdownProductionServer,
  startProductionServer,
  type ServerHandle,
} from "./support/runtime-acceptance";

const ROOT = process.cwd();
const BETA_PROFILE = "closed-free-beta";
const OUTAGE_SHIM = path.join(ROOT, "tests/acceptance/support/dependency-outage-shim.cjs");
const OWNER_A = TENANT_A.actors.find((a: { reference: string }) => a.reference.endsWith(":owner"))!;

const EVIDENCE: Record<string, unknown> = {};

let CONTROL_DIR = "";
let SUPABASE_HOSTPORT = "";
let PORT = 0;
let server: ServerHandle | null = null;
let session: HttpSession;
let ownerUserId = "";
let participantEmail = "";
let participantUserId = "";
let inviteToken = "";
let inviteAcceptPath = "";
let foreignUserId = "";
let foreignEmail = "";

const admin = () =>
  createClient(process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL!, process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

function betaEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PMFREAK_OPERATING_PROFILE: BETA_PROFILE,
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require ${OUTAGE_SHIM}`.trim(),
    P0_LAUNCH_04_OUTAGE_DIR: CONTROL_DIR,
    P0_LAUNCH_04_OUTAGE_HOSTPORT: SUPABASE_HOSTPORT,
    P0_LAUNCH_04_OUTAGE_PATH_PREFIXES: "/auth/v1",
    ...overrides,
  };
}

/** The certified governed first-use path: project.read, reached through Frontera. */
const governedFirstUse = (s: HttpSession) =>
  s.request(`/api/execution-tasks?projectId=${encodeURIComponent(TENANT_A.projectId)}`);

// A failed query must never read as "no membership". Absence is only provable once the
// query itself is known to have succeeded, so the error is asserted before the null is
// interpreted — otherwise an outage silently satisfies every negative membership check.
const membershipOf = async (userId: string, workspaceId: string) => {
  const r = await admin().from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  assert.equal(r.error, null, `membership lookup failed for ${userId} in ${workspaceId}: ${r.error?.message}`);
  return r.data;
};

/**
 * Logs in and returns the raw Cookie header. HttpSession deliberately hides response
 * headers, but D1 has to inspect the accept route's `Location` — a redirect to /login or
 * an error page would otherwise be indistinguishable from a successful acceptance — so
 * that one flow uses fetch directly rather than widening the shared helper.
 */
async function rawLoginCookie(email: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD! }).toString(),
    redirect: "manual",
  });
  assert.ok([200, 302, 303, 307].includes(res.status), `${email} could not authenticate: ${res.status}`);
  const cookie = res.headers.getSetCookie()
    .map((c) => c.split(";")[0]!)
    .filter((c) => c.slice(c.indexOf("=") + 1) !== "")
    .join("; ");
  assert.ok(cookie.length > 0, `${email} authenticated but received no session cookie`);
  return cookie;
}

async function sessionFor(email: string): Promise<HttpSession> {
  const s = new HttpSession(`http://127.0.0.1:${PORT}`);
  const login = await s.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD! }).toString(),
  });
  assert.ok([200, 302, 303, 307].includes(login.status), `${email} could not authenticate: ${login.status}`);
  return s;
}

const setAuthOutage = (on: boolean) => {
  const flag = path.join(CONTROL_DIR, "path-outage");
  if (on) fs.writeFileSync(flag, "");
  else fs.rmSync(flag, { force: true });
};

type Readiness = { httpStatus: number; status: string; checks: Array<{ name: string; status: string }> };
async function readReadiness(): Promise<Readiness> {
  const r = await session.request("/api/ready");
  let parsed: { status?: string; checks?: Array<{ name: string; status: string }> } = {};
  try { parsed = JSON.parse(r.text) as typeof parsed; } catch { /* raw status is the evidence */ }
  return { httpStatus: r.status, status: parsed.status ?? "(unparsed)", checks: parsed.checks ?? [] };
}
async function awaitReadiness(want: number, why: string): Promise<Readiness> {
  let last = await readReadiness();
  for (let i = 0; i < 60 && last.httpStatus !== want; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    last = await readReadiness();
  }
  assert.equal(last.httpStatus, want, `${why} (last: ${last.httpStatus} ${last.status})`);
  return last;
}

before(async () => {
  CONTROL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "p0-launch-06-"));
  SUPABASE_HOSTPORT = new URL(process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL!).host;

  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });

  const supabase = admin();
  for (let page = 1; page <= 20 && !ownerUserId; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    assert.ok(!listed.error, `listUsers failed: ${listed.error?.message}`);
    const found = listed.data.users.find((u) => (u.email ?? "").toLowerCase() === OWNER_A.email.toLowerCase());
    if (found) ownerUserId = found.id;
    if (listed.data.users.length < 200) break;
  }
  assert.ok(ownerUserId, `no operator identity for ${OWNER_A.email}; this rehearsal never invents one`);

  const stamp = Date.now();
  // The beta PARTICIPANT: a real platform identity that has NOT been admitted.
  participantEmail = `p0-launch-06-participant-${stamp}@example.test`;
  const p = await supabase.auth.admin.createUser({ email: participantEmail, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD!, email_confirm: true });
  assert.ok(!p.error && p.data.user, `could not create the participant identity: ${p.error?.message}`);
  participantUserId = p.data.user.id;

  // A FOREIGN identity holding real authority in a DIFFERENT tenant, so a later
  // cross-tenant denial is attributable to the tenant boundary rather than to the
  // identity being unprivileged everywhere.
  foreignEmail = `p0-launch-06-foreign-${stamp}@example.test`;
  const f = await supabase.auth.admin.createUser({ email: foreignEmail, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD!, email_confirm: true });
  assert.ok(!f.error && f.data.user, `could not create the foreign identity: ${f.error?.message}`);
  foreignUserId = f.data.user.id;
  const bind = await supabase.from("workspace_memberships").insert({ workspace_id: TENANT_B.workspaceId, user_id: foreignUserId, role: "owner" });
  assert.ok(!bind.error, `could not bind the foreign identity to tenant B: ${bind.error?.message}`);

  PORT = await freePort();
  session = new HttpSession(`http://127.0.0.1:${PORT}`);
});

after(async () => {
  if (server) await shutdownProductionServer(server, { label: "P0-LAUNCH-06 beta server", graceMs: 10_000 });
  server = null;
  const supabase = admin();

  // Teardown asserts every result. Silently ignoring them let a real outcome hide: the
  // participant's auth user CANNOT be deleted after F1, because
  // operational_raw_inputs.actor_user_id and operational_normalized_events.actor_user_id
  // are NOT NULL ... ON DELETE RESTRICT (20260901000000_raw_input_normalized_event_foundation).
  // That FK is behaving as designed — the operational record is immutable evidence — so the
  // right teardown is to RETAIN the identity deliberately and say so, never to delete
  // immutable operational history just to make cleanup green.

  // Removable rehearsal state first; each result is checked.
  for (const [label, id] of [["participant", participantUserId], ["foreign", foreignUserId]] as const) {
    if (!id) continue;
    const removed = await supabase.from("workspace_memberships").delete().eq("user_id", id);
    assert.equal(removed.error, null, `${label} membership cleanup failed: ${removed.error?.message}`);
  }
  if (participantEmail) {
    const inviteCleanup = await supabase.from("workspace_invitations").delete()
      .eq("workspace_id", TENANT_A.workspaceId).eq("email", participantEmail.toLowerCase());
    assert.equal(inviteCleanup.error, null, `invitation cleanup failed: ${inviteCleanup.error?.message}`);
  }

  // The foreign identity performs no tenant write, so nothing may block its deletion.
  if (foreignUserId) {
    const foreignDeleted = await supabase.auth.admin.deleteUser(foreignUserId);
    assert.equal(foreignDeleted.error, null, `foreign identity deletion failed: ${foreignDeleted.error?.message}`);
  }

  // The bootstrap workspace the participant acquired by loading the protected accept
  // route is MUTABLE fixture state and must not accumulate. The accepted retention
  // rationale covers the participant IDENTITY and the immutable operational records in
  // tenant A — it does not cover this empty personal workspace.
  if (participantUserId) {
    const owned = await supabase.from("workspaces").select("id").eq("created_by_user_id", participantUserId);
    assert.equal(owned.error, null, `bootstrap-workspace lookup failed: ${owned.error?.message}`);
    const bootstrapped = (owned.data ?? []).map((w) => w.id as string)
      .filter((id) => id !== TENANT_A.workspaceId && id !== TENANT_B.workspaceId);
    for (const id of bootstrapped) {
      // Belt and braces: a seeded tenant must never be reachable by this delete.
      assert.notEqual(id, TENANT_A.workspaceId, "refusing to delete the seeded tenant A");
      assert.notEqual(id, TENANT_B.workspaceId, "refusing to delete the seeded tenant B");
      const mships = await supabase.from("workspace_memberships").delete().eq("workspace_id", id);
      assert.equal(mships.error, null, `bootstrap workspace membership cleanup failed for ${id}: ${mships.error?.message}`);
      const dropped = await supabase.from("workspaces").delete().eq("id", id);
      assert.equal(dropped.error, null, `bootstrap workspace cleanup failed for ${id}: ${dropped.error?.message}`);
    }
    const left = await supabase.from("workspaces").select("id").eq("created_by_user_id", participantUserId);
    assert.equal(left.error, null, `bootstrap-workspace verification failed: ${left.error?.message}`);
    assert.deepEqual(
      (left.data ?? []).map((w) => w.id as string).filter((id) => id !== TENANT_A.workspaceId && id !== TENANT_B.workspaceId),
      [],
      "a rehearsal-created bootstrap workspace leaked into the fixture database",
    );
    EVIDENCE.bootstrapWorkspaceTeardown = bootstrapped.length > 0
      ? `REMOVED ${bootstrapped.length} rehearsal-created bootstrap workspace(s); no immutable operational record was deleted`
      : "NONE CREATED";
  }

  // The participant: prove WHY it is retained before accepting the retention.
  if (participantUserId) {
    const [rawInputs, normalizedEvents] = await Promise.all([
      supabase.from("operational_raw_inputs").select("id").eq("actor_user_id", participantUserId),
      supabase.from("operational_normalized_events").select("id").eq("actor_user_id", participantUserId),
    ]);
    assert.equal(rawInputs.error, null, `raw-input evidence lookup failed: ${rawInputs.error?.message}`);
    assert.equal(normalizedEvents.error, null, `normalized-event evidence lookup failed: ${normalizedEvents.error?.message}`);
    const immutableRefs = (rawInputs.data?.length ?? 0) + (normalizedEvents.data?.length ?? 0);

    const deleted = await supabase.auth.admin.deleteUser(participantUserId);
    if (immutableRefs > 0) {
      // Retention is the ASSERTED consequence of the immutable-evidence FK model.
      assert.notEqual(deleted.error, null, "the participant was deleted despite immutable operational evidence referencing it");
      EVIDENCE.participantIdentityTeardown =
        `RETAINED_BY_DESIGN: ${rawInputs.data?.length ?? 0} operational_raw_inputs + ${normalizedEvents.data?.length ?? 0} operational_normalized_events reference actor_user_id ${participantUserId} under ON DELETE RESTRICT; deletion refused as expected. LOCAL FIXTURE STATE, not a product defect.`;
    } else {
      // No tenant write happened (a partial run), so nothing may block deletion.
      assert.equal(deleted.error, null, `participant deletion failed with no immutable evidence present: ${deleted.error?.message}`);
      EVIDENCE.participantIdentityTeardown = "DELETED (no immutable operational evidence referenced this participant)";
    }
  }
  try { fs.rmSync(CONTROL_DIR, { recursive: true, force: true }); } catch { /* best effort */ }
  console.log(`\nP0_LAUNCH_06_REHEARSAL_EVIDENCE ${JSON.stringify(EVIDENCE, null, 2)}`);
});

// ───────────────── PHASE A — startup boundary (the certified runtime guard) ─────────────────

test("A1. STARTUP BOUNDARY: an invalid closed-beta environment leaves NO application surface operational", async () => {
  // Started through a BARE `next start` — deliberately bypassing
  // `npm run start:closed-free-beta` — because the whole point of the in-process
  // guard is that enforcement no longer depends on which command launched Next.js.
  const port = await freePort();
  // The negative control must be rejected ONLY by the instrumentation guard, or the
  // case proves nothing about whether src/instrumentation.ts ran. A BLANK
  // NEXT_PUBLIC_APP_URL is not such a control: api/ready's checkConfiguration lists
  // NEXT_PUBLIC_APP_URL in productionRequired and 503s on its own when the variable
  // is missing, so A1 would still pass with the hook deleted. An invalid-but-PRESENT
  // value discriminates: checkConfiguration tests presence only (it would pass), while
  // evaluateClosedFreeBetaEnvSafety rejects it with `invalid_app_url`. If the guard
  // does not run, readiness answers 200 and this case FAILS, which is the point.
  const outcome = await startProductionServer({
    port,
    env: betaEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" }),
    timeoutMs: 90_000,
  });

  try {
    // Two acceptable fail-closed shapes, and the evidence must say WHICH occurred
    // rather than accepting any non-200: either the runtime never became healthy at
    // all (the harness reports it did not start), or it listens but no application
    // surface is operational. Both are fail-closed; they are not the same fact.
    const probe = new HttpSession(`http://127.0.0.1:${port}`);
    const surfaces: Array<[string, number]> = [];
    for (const p of ["/api/ready", `/api/execution-tasks?projectId=${encodeURIComponent(TENANT_A.projectId)}`]) {
      const r = await probe.request(p).catch(() => ({ status: 0, text: "" }) as never);
      surfaces.push([p, r.status]);
      assert.notEqual(r.status, 200, `an invalid beta environment served ${p} with 200`);
    }
    const shape = outcome.started
      ? "server listening, no application surface operational"
      : "runtime never became healthy (health probe never succeeded)";
    assert.ok(
      !outcome.started || surfaces.every(([, s]) => s !== 200),
      "an invalid beta environment produced an operational surface",
    );
    EVIDENCE.invalidEnvSurfaces = `${shape}; ${surfaces.map(([p, s]) => `${p}=${s}`).join(" ")}`;
    EVIDENCE.invalidEnvApplicationSurfacesOperational = "NO";
  } finally {
    if (outcome.started) await shutdownProductionServer(outcome.handle, { label: "A1 invalid-env server", graceMs: 8_000 });
  }
});

test("A2. STARTUP BOUNDARY: the guard names offending VARIABLES and never their values", () => {
  // The refusal text an operator will read must be actionable without leaking secrets.
  const source = readFileSync("src/instrumentation.ts", "utf8");
  // Comments are stripped first: the docblock deliberately NAMES
  // `assertProductionEnvSafety` to explain why it is not wired, and a naive
  // string search would read that explanation as the defect it warns about.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(code, /assertClosedFreeBetaEnvSafety\(\)/, "the runtime guard does not INVOKE the canonical beta contract");
  assert.doesNotMatch(code, /assertProductionEnvSafety\s*\(/, "the beta runtime must not INVOKE the full-production contract");
  assert.match(code, /NEXT_RUNTIME !== "nodejs"/, "the guard must not run on the edge runtime");
  assert.match(code, /PMFREAK_OPERATING_PROFILE !== "closed-free-beta"/, "the guard must be profile-scoped");
  // The scope limit must still be stated somewhere in the file, comments included.
  assert.match(source, /RUNTIME boundary, not a deployment-time one/i, "the guard does not state its scope limit");
});

test("A3. STARTUP: a VALID closed-beta environment starts and serves liveness", async () => {
  const outcome = await startProductionServer({ port: PORT, env: betaEnv(), timeoutMs: 240_000 });
  assert.ok(outcome.started, "the valid closed-beta environment did not start a server");
  server = outcome.handle;

  const health = await session.request("/api/health");
  assert.equal(health.status, 200, `liveness did not answer 200: ${health.status}`);
  EVIDENCE.liveness = `200 (/api/health)`;
});

test("A4. READINESS declares the closed-free-beta dependency set, and Stripe is NOT required", async () => {
  const readiness = await awaitReadiness(200, "the beta runtime never reported ready");
  const names = readiness.checks.map((c) => c.name).sort();
  assert.deepEqual(names, ["auth", "configuration", "database", "governance_capability"], `unexpected beta readiness set: ${names.join(",")}`);
  assert.ok(readiness.checks.every((c) => c.status === "pass"), "a declared readiness check is not passing");

  // The server was started with both Stripe secrets BLANK, so reaching ready here
  // is itself the proof that the closed free beta needs no billing surface.
  EVIDENCE.readinessInitial = `200 ready; checks=${names.join(",")}`;
  EVIDENCE.closedFreeBetaStripeRequired = "NO";
});

// ───────────────── PHASE B — a non-invited identity has no authority ─────────────────

test("B1. ACCOUNT_CREATION != BETA_ADMISSION: the participant identity exists and authenticates", async () => {
  const identity = await admin().auth.admin.getUserById(participantUserId);
  assert.ok(!identity.error && identity.data.user, "the participant identity does not exist");
  const s = await sessionFor(participantEmail);
  assert.ok(s, "the participant could not authenticate");
  EVIDENCE.participantIdentity = "exists and authenticates before any admission";
});

test("B2. a merely-created identity holds NO tenant membership and NO role", async () => {
  const memberships = await admin().from("workspace_memberships").select("workspace_id, role").eq("user_id", participantUserId);
  assert.ok(!memberships.error, `membership lookup failed: ${memberships.error?.message}`);
  assert.deepEqual(memberships.data ?? [], [], "a merely-created identity already holds tenant membership");
});

test("B3. PRE_ADMISSION_GOVERNED_ACCESS: the governed first-use path is DENIED", async () => {
  const s = await sessionFor(participantEmail);
  const r = await governedFirstUse(s);
  assert.equal(r.status, 403, `a non-invited identity was not denied the governed path: ${r.status} ${r.text.slice(0, 200)}`);
  EVIDENCE.preAdmissionGovernedAccess = "403";
});

// ───────────────── PHASE C — supported operator admission ─────────────────

const operator = (args: string[], env: Record<string, string> = {}) => {
  try {
    const out = execFileSync("npm", ["run", "beta:invite-participant", "--", ...args], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env },
    });
    return { exit: 0, text: out };
  } catch (error) {
    const shell = error as { status?: number; stdout?: string; stderr?: string };
    return { exit: shell.status ?? -1, text: `${shell.stdout ?? ""}\n${shell.stderr ?? ""}` };
  }
};
const envelopeOf = (text: string) => {
  const line = text.split("\n").filter((v) => v.trim().startsWith("{")).pop();
  return line ? (JSON.parse(line) as { ok: boolean; failureClass?: string; message?: string }) : null;
};

test("C1. OPERATOR NEGATIVE CONTROLS: isolation, identity, membership, role and duplication are all refused", () => {
  const refusals: string[] = [];
  const expectRefused = (label: string, args: string[], env: Record<string, string> = {}, failureClass?: string) => {
    const r = operator(args, env);
    assert.notEqual(r.exit, 0, `${label} was NOT refused`);
    const envelope = envelopeOf(r.text);
    assert.ok(envelope, `${label} emitted no structured envelope: ${r.text.slice(0, 200)}`);
    assert.equal(envelope.ok, false, `${label} reported success`);
    if (failureClass) assert.equal(envelope.failureClass, failureClass, `${label} used failureClass ${envelope.failureClass}`);
    assert.doesNotMatch(r.text, /^\s+at .*\(.*:\d+:\d+\)/m, `${label} emitted an unhandled stack trace`);
    refusals.push(label);
  };

  const base = ["--workspace", TENANT_A.workspaceId, "--email", `neg-${Date.now()}@example.test`, "--role", "pm", "--inviter", OWNER_A.email];

  // The isolation guard must refuse a non-local target BEFORE any privileged client.
  expectRefused("NON_LOCAL_TARGET", base, { NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co", OPERATIONAL_FLOW_TEST_SUPABASE_URL: "https://prod.supabase.co" }, "non_isolated_target");
  expectRefused("MISSING_ISOLATION_PREREQUISITE", base, { P2_13_FOUNDER_FIXTURE_ENABLED: "false" }, "non_isolated_target");
  expectRefused("INVITER_NOT_FOUND", ["--workspace", TENANT_A.workspaceId, "--email", `x-${Date.now()}@example.test`, "--role", "pm", "--inviter", "nobody-a1b2c3@example.test"]);
  expectRefused("INVITER_NOT_MEMBER_OF_TARGET", ["--workspace", TENANT_B.workspaceId, "--email", `y-${Date.now()}@example.test`, "--role", "pm", "--inviter", OWNER_A.email]);
  expectRefused("INVALID_ROLE", ["--workspace", TENANT_A.workspaceId, "--email", `z-${Date.now()}@example.test`, "--role", "superuser", "--inviter", OWNER_A.email]);
  expectRefused("OWNER_ROLE_NEVER_INVITABLE", ["--workspace", TENANT_A.workspaceId, "--email", `w-${Date.now()}@example.test`, "--role", "owner", "--inviter", OWNER_A.email]);

  EVIDENCE.operatorNegativeControls = refusals.join(" ");
});

test("C2. SUPPORTED_OPERATOR_INVITE: the real command creates an inspectable, correctly bound invitation", async () => {
  const result = operator(["--workspace", TENANT_A.workspaceId, "--email", participantEmail, "--role", "pm", "--inviter", OWNER_A.email, "--emit-accept-path"]);
  assert.equal(result.exit, 0, `the supported operator invite failed: ${result.text.slice(0, 400)}`);
  const envelope = envelopeOf(result.text) as { ok: boolean; acceptPath?: string } | null;
  assert.ok(envelope?.ok, `the operator boundary did not report success: ${result.text.slice(0, 300)}`);

  const row = await admin()
    .from("workspace_invitations")
    .select("workspace_id, email, role, status, expires_at, token_hash")
    .eq("workspace_id", TENANT_A.workspaceId).eq("email", participantEmail.toLowerCase()).maybeSingle();
  assert.ok(row.data, "no invitation row was created by the supported boundary");
  assert.equal(row.data.workspace_id, TENANT_A.workspaceId, "the invitation is bound to the wrong workspace");
  assert.equal(row.data.role, "pm", "the invitation carries the wrong role");
  assert.equal(row.data.status, "pending", "the invitation is not pending");
  assert.ok(row.data.expires_at, "the invitation has no expiry");
  assert.ok(row.data.token_hash, "the invitation persisted no token hash");

  // Only the HASH is persisted; the plaintext exists once, in the operator output.
  const accept = envelope!.acceptPath ?? "";
  const token = accept.split("/").filter(Boolean).pop() ?? "";
  assert.ok(token.length > 0, "the operator emitted no accept path despite --emit-accept-path");
  assert.notEqual(row.data.token_hash, token, "the PLAINTEXT token was persisted");
  inviteToken = token;

  inviteAcceptPath = accept;

  // Bind the audit assertion to THIS run's invitation. Filtering only by workspace and
  // event_type lets an older seeded `invitation_sent` row satisfy the case even if this
  // invitation produced no audit record at all — a reachable state, because
  // createWorkspaceInvitationRecord fires the audit insert without inspecting its error
  // (registered as RR-INVITE-AUDIT-NONATOMIC, ACCEPTED_FOR_CLOSED_BETA; deliberately not
  // fixed in this increment). The participant email is unique per run, so filtering the
  // payload on it makes a stale event incapable of satisfying C2.
  const auditEmail = participantEmail.toLowerCase();
  const audit = await admin().from("workspace_audit_events")
    .select("event_type, actor_user_id, payload")
    .eq("workspace_id", TENANT_A.workspaceId)
    .eq("event_type", "invitation_sent")
    .eq("payload->>email", auditEmail);
  assert.equal(audit.error, null, `the invitation_sent audit query failed: ${audit.error?.message}`);
  const auditRows = audit.data ?? [];
  assert.equal(auditRows.length, 1, `expected exactly one invitation_sent event for ${auditEmail}, found ${auditRows.length}`);
  const auditPayload = auditRows[0]!.payload as { email?: string; role?: string; expiresAt?: string };
  assert.equal(auditPayload.email, auditEmail, "the audit event names a different invitee");
  assert.equal(auditPayload.role, "pm", "the audit event records a different role");
  // Same instant, two serializations: the payload is JSON (Date#toISOString, "…Z") while
  // expires_at comes back as timestamptz ("…+00:00"). Compare instants, not strings.
  assert.ok(auditPayload.expiresAt, "the audit event records no expiry");
  assert.equal(
    new Date(auditPayload.expiresAt!).getTime(),
    new Date(row.data.expires_at as string).getTime(),
    "the audit event's expiry is not the same instant as the invitation row's",
  );
  assert.equal(auditRows[0]!.actor_user_id, ownerUserId, "the audit event attributes a different inviter");

  EVIDENCE.supportedOperatorInvite = `workspace ${TENANT_A.workspaceId} role pm pending, token hashed at rest, invitation_sent audited (bound to this run: ${auditEmail}, role pm, expiry matches the invitation row, inviter ${ownerUserId})`;
  EVIDENCE.inviteAuditAtomicity = "RR-INVITE-AUDIT-NONATOMIC ACCEPTED_FOR_CLOSED_BETA — registered in docs/release/residual-risk-register.md and verified by K2 (createWorkspaceInvitationRecord does not inspect the audit insert error; product code deliberately unchanged)";
  EVIDENCE.operatorInviteFronteraGoverned = "NO";
  EVIDENCE.operatorInviteSubscriptionSeatGated = "NO";
});

test("C3. DUPLICATE_INVITE is refused through the shared invitation domain", () => {
  const dup = operator(["--workspace", TENANT_A.workspaceId, "--email", participantEmail, "--role", "pm", "--inviter", OWNER_A.email]);
  assert.notEqual(dup.exit, 0, "a duplicate active invitation was created");
  assert.match(dup.text, /active invitation already exists/i, `duplicate refusal used an unexpected reason: ${dup.text.slice(0, 200)}`);
});

// ───────────────── PHASE D — real invite acceptance ─────────────────

test("D1. TENANT_BINDING and ROLE_BINDING come from the invitation record, server-side", async () => {
  // Acceptance is rehearsed through the SHIPPED participant-facing surface, not by
  // calling the domain function with a service-role client and a caller-supplied
  // identity. Going through the route is what makes this case's own claim honest: the
  // user id is resolved by requireAuthUser() from the participant's session cookie,
  // so "server-side, from the invitation record" is demonstrated rather than assumed.
  // It also puts session resolution, token routing, the abuse limits and the redirect
  // on the certified path — a regression in any of them would otherwise leave real
  // participants unable to accept while this rehearsal still granted membership.
  const supabase = admin();
  const base = `http://127.0.0.1:${PORT}`;
  const cookie = await rawLoginCookie(participantEmail);
  assert.ok(inviteAcceptPath.startsWith("/accept-invite/"), `the operator emitted no usable accept path: ${inviteAcceptPath}`);

  const accepted = await fetch(`${base}${inviteAcceptPath}`, { headers: { cookie }, redirect: "manual" });
  assert.ok(
    [302, 303, 307, 308].includes(accepted.status),
    `the participant-facing accept route did not redirect on success: ${accepted.status}`,
  );
  // WHERE it redirects is the actual contract. Accepting any 3xx would let a regression
  // that bounces the participant to /login, to an error destination, or to a failed invite
  // route pass as a successful acceptance. The shipped route ends in redirect("/team").
  const location = accepted.headers.get("location");
  assert.ok(location, "the accept route redirected without a Location header");
  const destination = new URL(location!, base).pathname;
  assert.equal(destination, "/team", `the accept route redirected to an unexpected destination: ${destination}`);

  // Scope the claim to the INVITED tenant. Going through the shipped route surfaces real
  // behaviour the direct-domain call never did: `(protected)/layout.tsx` resolves a write
  // workspace and BOOTSTRAPS a personal one for a user who holds none, so the participant
  // legitimately ends up with their own workspace in addition to the invited tenant. That
  // is product behaviour on the certified path, not over-granting — so the invariant to
  // assert is the binding in TENANT_A, plus the absence of any grant that was never invited.
  const memberships = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", participantUserId);
  assert.equal(memberships.error, null, `membership lookup failed: ${memberships.error?.message}`);
  const rows = memberships.data ?? [];
  const inTenantA = rows.filter((m) => m.workspace_id === TENANT_A.workspaceId);
  assert.equal(inTenantA.length, 1, "admission did not establish exactly one membership in the invited tenant");
  assert.equal(inTenantA[0]!.role, "pm", "admission did not bind the invited role");
  assert.equal(rows.filter((m) => m.workspace_id === TENANT_B.workspaceId).length, 0, "admission leaked a membership into an uninvited tenant");

  // Every membership outside the invited tenant must be a workspace the participant
  // itself bootstrapped — nothing else may have been granted by accepting an invite.
  const others = rows.filter((m) => m.workspace_id !== TENANT_A.workspaceId);
  if (others.length > 0) {
    const owned = await supabase.from("workspaces").select("id").eq("created_by_user_id", participantUserId)
      .in("id", others.map((m) => m.workspace_id));
    assert.equal(owned.error, null, `bootstrapped-workspace lookup failed: ${owned.error?.message}`);
    assert.equal(owned.data?.length, others.length, "the participant holds a membership in a workspace it neither was invited to nor created");
  }
  EVIDENCE.inviteAcceptanceBootstrapsPersonalWorkspace =
    others.length > 0
      ? `YES — ${others.length} self-created workspace membership alongside the invited tenant ((protected) layout resolveWriteWorkspace bootstrap); observed only because D1 now uses the shipped route`
      : "NO";

  // The post-acceptance destination must not DENY the admitted identity. It is not
  // asserted to be 200: the participant's own workspace was bootstrapped moments ago, so
  // `(protected)/layout.tsx` legitimately redirects into onboarding. Asserting 200 would
  // encode an onboarding-state assumption rather than an authority fact, so the assertion
  // is that the admitted identity is neither refused nor met with a server error.
  const landing = await fetch(`${base}/team`, { headers: { cookie }, redirect: "manual" });
  assert.ok(![401, 403].includes(landing.status), `the accepted participant was denied the post-acceptance destination: ${landing.status}`);
  assert.ok(landing.status < 500, `the post-acceptance destination errored: ${landing.status}`);

  EVIDENCE.tenantBinding = `workspace ${TENANT_A.workspaceId}`;
  EVIDENCE.roleBinding = "pm (from the invitation record, not the caller)";
  EVIDENCE.inviteAcceptanceSurface = `PARTICIPANT_FACING_ROUTE GET ${inviteAcceptPath.replace(/\/[^/]+$/, "/<token>")} -> ${accepted.status} Location ${destination}; /team -> ${landing.status} (not denied)`;
  EVIDENCE.inviteAcceptanceIdentitySource = "SESSION_DERIVED (requireAuthUser on the shipped route), not caller-supplied";
});

test("D2. INVITE_REPLAY_REFUSED: the same token cannot mint a second authority grant", async () => {
  // Replay stays at the DOMAIN layer on purpose. The shipped route is rate-limited
  // (20/h per IP, 10/h per token), so replaying through it would eventually be refused
  // by the abuse limiter rather than by invitation semantics, making the case
  // nondeterministic and testing the wrong boundary. D1 already certifies the route.
  const supabase = admin();
  // Treating ANY throw as proof of refusal would let a PostgREST outage, a query
  // regression or a programmer error satisfy the replay control without the
  // `already_used` decision ever being reached. Only that specific denial counts;
  // everything else is rethrown and fails the case.
  let replayed = false;
  let refusal: WorkspaceInviteError | null = null;
  try {
    await acceptWorkspaceInvite({ token: inviteToken, userId: participantUserId, userEmail: participantEmail }, async () => supabase as never);
    replayed = true;
  } catch (error) {
    if (!(error instanceof WorkspaceInviteError)) throw error;
    if (error.reason !== "already_used") throw error;
    refusal = error;
  }
  assert.equal(replayed, false, "a used invitation token was accepted a second time");
  assert.ok(refusal, "the replay did not reach the already_used decision");
  assert.equal(refusal!.reason, "already_used", "the replay was refused for an unrelated reason");

  const memberships = await supabase.from("workspace_memberships").select("workspace_id").eq("user_id", participantUserId);
  assert.equal(memberships.error, null, `membership lookup failed: ${memberships.error?.message}`);
  // Scoped to the invited tenant for the same reason as D1: the participant also holds
  // its own bootstrapped workspace once acceptance runs through the shipped route.
  const inTenantA = (memberships.data ?? []).filter((m) => m.workspace_id === TENANT_A.workspaceId);
  assert.equal(inTenantA.length, 1, "token replay created a second authority grant in the invited tenant");
  EVIDENCE.inviteReplayRefused = "PASS (WorkspaceInviteError reason=already_used; still exactly one invited-tenant membership after replay)";
});

// ───────────────── PHASE E — governed first use (the load-bearing claim) ─────────────────

test("E1. POST_ADMISSION_GOVERNED_ACCESS: the governed first-use path is now ALLOWED", async () => {
  const s = await sessionFor(participantEmail);
  const r = await governedFirstUse(s);
  assert.equal(r.status, 200, `admission did not confer governed access: ${r.status} ${r.text.slice(0, 250)}`);
  EVIDENCE.postAdmissionGovernedAccess = "200";
  EVIDENCE.governedFirstUsePath = `GET /api/execution-tasks?projectId=${TENANT_A.projectId}`;
  EVIDENCE.governedFirstUseCapability = "project.read";
});

test("E2. GOVERNED_FIRST_USE_FRONTERA_REACHED: the allow is produced by runtime authorization, not a bypass", () => {
  // Runtime evidence above proves the VERDICT; this pins the PATH that produced it,
  // so a future refactor that quietly stopped consulting the runtime would fail here
  // rather than silently downgrading the strongest claim this beta makes.
  const route = readFileSync("src/app/api/execution-tasks/route.ts", "utf8");
  assert.match(route, /requireProjectAccess/, "the governed path no longer calls the project access guard");
  assert.match(route, /server-authorization/, "the governed path no longer resolves through server-authorization");

  const guard = readFileSync("src/lib/security/server-authorization.ts", "utf8");
  const fn = guard.slice(guard.indexOf("export async function evaluateCapability"));
  assert.match(fn, /authorizeRuntimeAction/, "evaluateCapability no longer reaches runtime authorization");
  assert.match(fn, /buildEnterpriseRuntimeRequest/, "evaluateCapability no longer builds a runtime authorization request");

  const actions = readFileSync("src/lib/aoc/runtime/governance-actions.ts", "utf8");
  assert.match(actions, /read: "project\.read"/, "the read permission no longer maps to project.read");
  EVIDENCE.governedFirstUseFronteraReached = "YES (requireProjectAccess -> evaluateCapability -> authorizeRuntimeAction, project.read)";
});

// ───────────────── PHASE F — a real tenant operation, truthfully labelled ─────────────────

test("F1. REAL_TENANT_OPERATION: the admitted participant COMPLETES a real tenant write with an observable effect", async () => {
  // The payload shape is the product's own, taken from the real client
  // (`text-capture-modal.tsx` / `operational-data.ts`): no sourceKey is sent,
  // because the route pins it server-side. Nothing test-only is introduced — this
  // is the same route, the same auth, the same membership, the same supported
  // operation and the same persistence the product uses.
  const requestId = crypto.randomUUID();
  const capture = (correlationId: string, idem: string) =>
    JSON.stringify({
      workspaceId: TENANT_A.workspaceId,
      projectId: TENANT_A.projectId,
      operation: "capture_input",
      idempotencyKey: `capture:${idem}`,
      title: "P0-LAUNCH-06 rehearsal capture",
      content: "Beta release rehearsal: a real operational input captured by an admitted participant.",
      occurredAt: new Date().toISOString(),
      correlationId,
    });
  const post = (s: HttpSession, body: string) =>
    s.request("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json" }, body });

  // ---- A. the admitted participant COMPLETES the operation ----
  const participant = await post(await sessionFor(participantEmail), capture(requestId, requestId));
  assert.equal(participant.status, 201, `the admitted participant did not COMPLETE the tenant write: ${participant.status} ${participant.text.slice(0, 300)}`);

  const created = JSON.parse(participant.text) as { normalizedEvent?: { id?: string } };
  const eventId = created.normalizedEvent?.id;
  assert.ok(eventId, `the completed operation returned no canonical resource: ${participant.text.slice(0, 250)}`);

  // ---- B. the effect is OBSERVABLE, re-read from persistence ----
  // An HTTP 201 alone is not accepted as proof for a route that persists state.
  const persisted = await admin()
    .from("operational_normalized_events")
    .select("id, workspace_id, project_id, correlation_id")
    .eq("id", eventId)
    .maybeSingle();
  assert.ok(persisted.data, `the operation reported 201 but persisted no normalized event: ${persisted.error?.message ?? "row absent"}`);
  assert.equal(persisted.data.workspace_id, TENANT_A.workspaceId, "the persisted effect landed in the wrong tenant");
  assert.equal(persisted.data.project_id, TENANT_A.projectId, "the persisted effect landed in the wrong project");

  // ---- C. the identical request from a FOREIGN tenant owner is refused ----
  const foreignCorrelation = crypto.randomUUID();
  const foreigner = await post(await sessionFor(foreignEmail), capture(foreignCorrelation, foreignCorrelation));
  assert.equal(foreigner.status, 403, `a foreign-tenant owner completed a write in tenant A: ${foreigner.status} ${foreigner.text.slice(0, 250)}`);

  // ---- D. the refused request left NO effect ----
  const foreignEffect = await admin()
    .from("operational_normalized_events")
    .select("id")
    .eq("correlation_id", foreignCorrelation);
  assert.equal(foreignEffect.error, null, `the side-effect verification query failed, so absence is unproven: ${foreignEffect.error?.message}`);
  assert.deepEqual(foreignEffect.data, [], "a refused cross-tenant write still produced a persisted effect");

  EVIDENCE.realTenantOperationPath = "POST /api/operational-flow";
  EVIDENCE.realTenantOperationKind = "capture_input";
  EVIDENCE.realTenantOperationHttp = "201";
  EVIDENCE.realTenantOperationEffect = `operational_normalized_events row ${eventId} persisted in workspace ${TENANT_A.workspaceId} / project ${TENANT_A.projectId}`;
  EVIDENCE.realTenantOperationCompleted = "YES";
  EVIDENCE.foreignTenantOperation = "DENIED (403 on the identical valid request)";
  EVIDENCE.foreignTenantSideEffect = "NONE (no normalized event for the refused correlation id)";
  EVIDENCE.operationalFlowAuthorizationModel = "DIRECT_MEMBERSHIP_ROLE_CHECK (not Frontera-governed)";
});

// ───────────────── PHASE G — cross-tenant isolation ─────────────────

test("G1. CROSS_TENANT_ISOLATION: authority in tenant A confers nothing in tenant B, and vice versa", async () => {
  // Non-vacuity in BOTH directions: each identity genuinely holds authority
  // somewhere, so each denial is attributable to the tenant boundary.
  assert.equal((await membershipOf(participantUserId, TENANT_A.workspaceId))?.role, "pm", "precondition: participant must hold tenant A authority");
  assert.equal((await membershipOf(foreignUserId, TENANT_B.workspaceId))?.role, "owner", "precondition: foreign identity must own tenant B");
  assert.equal(await membershipOf(participantUserId, TENANT_B.workspaceId), null, "participant leaked membership into tenant B");
  assert.equal(await membershipOf(foreignUserId, TENANT_A.workspaceId), null, "foreign identity leaked membership into tenant A");

  // A tenant-B OWNER must not reach the tenant-A governed path.
  const foreign = await sessionFor(foreignEmail);
  const r = await governedFirstUse(foreign);
  assert.equal(r.status, 403, `a foreign-tenant owner reached tenant A's governed path: ${r.status} ${r.text.slice(0, 200)}`);
  EVIDENCE.crossTenantIsolation = "tenant-B owner -> tenant-A governed path 403; no cross-tenant membership in either direction";
});

// ───────────────── PHASE H — dependency outage and recovery ─────────────────

test("H1. AUTH_OUTAGE: readiness becomes NOT READY while liveness stays truthful", async () => {
  setAuthOutage(true);
  try {
    const notReady = await awaitReadiness(503, "readiness never went NOT READY during an auth outage");
    const auth = notReady.checks.find((c) => c.name === "auth");
    assert.equal(auth?.status, "fail", "the auth check did not fail during the auth outage");

    // Attributability: the database check must still pass, so the transition is
    // caused by the auth dependency alone rather than a general failure.
    const db = notReady.checks.find((c) => c.name === "database");
    assert.equal(db?.status, "pass", "the database check also failed, so the transition is not attributable to auth");

    // Liveness answers process health, not dependency health.
    const health = await session.request("/api/health");
    assert.equal(health.status, 200, "liveness followed readiness down; process health and dependency health were conflated");
    EVIDENCE.authOutageBehavior = `readiness 503 (auth=fail, database=pass), liveness 200 in the same process`;
  } finally {
    setAuthOutage(false);
  }
});

test("H2. AUTH_RECOVERY: readiness returns to READY without a restart or manual repair", async () => {
  const recovered = await awaitReadiness(200, "readiness never recovered after the auth dependency returned");
  assert.ok(recovered.checks.every((c) => c.status === "pass"), "a check is still failing after recovery");
  EVIDENCE.authRecovery = "readiness 200 after dependency restoration; same process, no manual repair";
});

test("H3. DATABASE outage/recovery is INHERITED, and the inheritance is justified mechanically", () => {
  // Not re-injected here: P0-LAUNCH-04 owns the database failure matrix, and this
  // increment changed nothing on that path. The justification is mechanical rather
  // than asserted — the only executable change in P0-LAUNCH-06 is the
  // instrumentation hook, which is profile-scoped, nodejs-only, and touches no
  // database code.
  const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
  assert.doesNotMatch(instrumentation, /supabase|createClient|from\(|database/i, "the instrumentation hook touches database code, so inherited DB evidence would need re-proving");
  const prior = readFileSync("tests/acceptance/p0-launch-04-failure-recovery-observability.test.ts", "utf8");
  assert.match(prior, /database/i, "the predecessor does not actually cover the database failure path");
  EVIDENCE.databaseOutageBehavior = "INHERITED from P0-LAUNCH-04 (28/28); instrumentation touches no database code";
});

// ───────────────── PHASE I — offboarding and authority removal ─────────────────

test("I1. OFFBOARDING denies before it permits: an unauthorized actor cannot remove the participant", async () => {
  const foreign = await sessionFor(foreignEmail);
  const r = await foreign.request("/api/workspace-team/members", {
    method: "DELETE", headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: TENANT_A.workspaceId, targetUserId: participantUserId }),
  });
  assert.equal(r.status, 403, `a foreign-tenant owner was allowed to offboard in tenant A: ${r.status}`);
  assert.ok(await membershipOf(participantUserId, TENANT_A.workspaceId), "PERSISTENCE: a refused offboarding removed the membership anyway");
  EVIDENCE.offboardingDeniesFirst = "foreign-tenant owner -> 403, participant membership intact";
});

test("I2. OFFBOARDING removes tenant authority and persists a correct member_removed audit event", async () => {
  const s = await sessionFor(OWNER_A.email);
  const r = await s.request("/api/workspace-team/members", {
    method: "DELETE", headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: TENANT_A.workspaceId, targetUserId: participantUserId }),
  });
  assert.equal(r.status, 200, `the supported offboarding failed: ${r.status} ${r.text.slice(0, 250)}`);
  assert.equal(await membershipOf(participantUserId, TENANT_A.workspaceId), null, "offboarding did not remove the membership");

  const events = await admin().from("workspace_audit_events")
    .select("workspace_id, actor_user_id, event_type, payload")
    .eq("workspace_id", TENANT_A.workspaceId).eq("event_type", "member_removed")
    .order("created_at", { ascending: false }).limit(30);
  const row = (events.data ?? []).find((e: { payload?: { targetUserId?: string } }) => e.payload?.targetUserId === participantUserId);
  assert.ok(row, "no member_removed audit event was persisted for the offboarded participant");
  assert.equal(row.workspace_id, TENANT_A.workspaceId, "the audit event names the wrong workspace");
  assert.equal(row.actor_user_id, ownerUserId, "the audit event names the wrong actor");
  assert.equal(row.payload?.previousRole, "pm", "the audit event lost the previous role");

  EVIDENCE.offboardAuditEventPersisted = `member_removed ws=${row.workspace_id} actor=${row.actor_user_id} target=${participantUserId} previousRole=pm`;
  EVIDENCE.offboardingAuthorizationModel = "AUTHENTICATED_SESSION_PLUS_SERVER_RESOLVED_WORKSPACE_HIERARCHY";
  EVIDENCE.offboardingFronteraGoverned = "NO";
});

test("I3. PLATFORM_IDENTITY_SURVIVES: offboarding removes authority, not the account", async () => {
  const identity = await admin().auth.admin.getUserById(participantUserId);
  assert.ok(!identity.error && identity.data.user, "offboarding deleted the platform identity");
  EVIDENCE.platformIdentitySurvives = "YES (auth.users row intact after offboarding)";
});

test("I4. GOVERNED_ACCESS_LIFECYCLE: 403 -> 200 -> 403 on the same protected path", async () => {
  const s = await sessionFor(participantEmail);
  const r = await governedFirstUse(s);
  assert.equal(r.status, 403, `an offboarded participant kept governed access: ${r.status} ${r.text.slice(0, 200)}`);
  EVIDENCE.postOffboardGovernedAccess = "403";
  EVIDENCE.governedAccessLifecycle = "403 (pre-admission) -> 200 (post-admission) -> 403 (post-offboarding)";
  EVIDENCE.tenantAuthorityRemoved = "YES";
});

// ───────────────── PHASE J — the audit-failure incident procedure ─────────────────

test("J1. OFFBOARD_AUDIT_FAILURE: the incident is surfaced, and the operator response is rehearsed", async () => {
  // Re-admit a disposable target so the incident can be rehearsed on real state
  // rather than described. The seam is the existing acceptance-only, local-isolated
  // fault seam; it is never used against a hosted target.
  const supabase = admin();
  const incidentEmail = `p0-launch-06-incident-${Date.now()}@example.test`;
  const made = await supabase.auth.admin.createUser({ email: incidentEmail, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD!, email_confirm: true });
  assert.ok(!made.error && made.data.user, `could not create the incident target: ${made.error?.message}`);
  const incidentUserId = made.data.user.id;
  const bound = await supabase.from("workspace_memberships").insert({ workspace_id: TENANT_A.workspaceId, user_id: incidentUserId, role: "pm" });
  assert.ok(!bound.error, `could not bind the incident target: ${bound.error?.message}`);

  const faultPort = await freePort();
  const faultServer = await startProductionServer({
    port: faultPort,
    env: betaEnv({ PMFREAK_ACCEPTANCE_OFFBOARD_AUDIT_FAULT: "1" }),
    timeoutMs: 240_000,
  });
  assert.ok(faultServer.started, "the audit-fault rehearsal server did not start");

  try {
    const s = new HttpSession(`http://127.0.0.1:${faultPort}`);
    const login = await s.request("/api/login", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: OWNER_A.email, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD! }).toString(),
    });
    assert.ok([200, 302, 303, 307].includes(login.status), `operator could not authenticate for the incident rehearsal: ${login.status}`);

    const r = await s.request("/api/workspace-team/members", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: TENANT_A.workspaceId, targetUserId: incidentUserId }),
    });

    // STEP 1 — the operation must NOT report clean success.
    assert.notEqual(r.status, 200, "an audit-write failure was reported as a clean success");
    assert.equal(r.status, 500, `the audit failure was not surfaced with its own classification: ${r.status}`);
    assert.match(r.text, /offboarding_audit_write_failed/, "the response does not name the audit failure");

    // STEP 2 — the operator INSPECTS EFFECTIVE MEMBERSHIP FIRST, before any retry.
    const effective = await membershipOf(incidentUserId, TENANT_A.workspaceId);
    assert.equal(effective, null, "the residual's premise changed: membership survived, so this is not the partial state");

    // STEP 3 — determine that authority is already gone and the audit record is missing.
    const events = await supabase.from("workspace_audit_events").select("payload")
      .eq("workspace_id", TENANT_A.workspaceId).eq("event_type", "member_removed")
      .order("created_at", { ascending: false }).limit(30);
    assert.equal(events.error, null, `the audit lookup failed, so a suppressed audit write is unproven: ${events.error?.message}`);
    const recorded = (events.data ?? []).some((e: { payload?: { targetUserId?: string } }) => e.payload?.targetUserId === incidentUserId);
    assert.equal(recorded, false, "the fault seam did not suppress the audit write, so this proves nothing");

    // STEP 4 — a blind retry is the WRONG action, and the system shows why: the
    // membership is already gone, so retrying would answer deny_target_not_member
    // rather than repairing anything. Reconciliation is a records action, not a retry.
    EVIDENCE.offboardAuditFailureRunbookRehearsed =
      "500 offboarding_audit_write_failed -> inspect effective membership FIRST (already removed) -> " +
      "confirm member_removed absent -> reconcile the audit record as an incident -> do NOT blindly retry the deletion";
  } finally {
    if (faultServer.started) await shutdownProductionServer(faultServer.handle, { label: "audit-fault rehearsal server", graceMs: 10_000 });
    await supabase.from("workspace_memberships").delete().eq("user_id", incidentUserId);
    await supabase.auth.admin.deleteUser(incidentUserId);
  }
});

// ───────────────── PHASE K — the release contract this rehearsal certifies ─────────────────

test("K1. CERTIFIED BOUNDARY: the runtime boundary is certified; the hosted data tier is NOT", () => {
  // Scope discipline: this gate must not be readable as a full-topology claim.
  EVIDENCE.certifiedBetaRuntimeBoundary = "NEXTJS_16_SERVER_RUNTIME_WITH_IN_PROCESS_CLOSED_BETA_GUARD";
  EVIDENCE.certifiedBetaServerRuntimePreflightBypass = "NO";
  // This gate performs NO migration, dump, restore or integrity check — `npm run
  // check:beta-release-rehearsal` runs this file alone. The hosted certification is real
  // but EXTERNAL: it was produced by the separate, already-accepted RR-MIGRATE and
  // RR-BACKUP rehearsals. Emitting it as a bare PASS implied this case had verified it,
  // so it is emitted as attributed snapshot metadata instead. The VALUE is unchanged.
  const hostedDataTier = {
    value: "PASS_FOR_FRESH_MIGRATION_AND_LOGICAL_BACKUP_RECOVERABILITY",
    provenance: "EXTERNAL_AUTHORITATIVE_SNAPSHOT_METADATA",
    generatedByThisGate: "NO",
    verifiedByThisGate: "NO",
    source: "RR-MIGRATE (hosted validation project, 161/161 applied, 0 pending, 0 unexpected, no manual repair) and RR-BACKUP (authoritative single-pass isolated local logical restore, exit 0)",
    canonicalRecords: "docs/release/hosted-supabase-migration-proof.md, docs/release/backup-restore-drill.md, docs/release/residual-risk-register.md",
    scope: "FRESH_MIGRATION_AND_LOGICAL_BACKUP_RECOVERABILITY_ONLY",
    hostedPlatformRestoreRehearsal: "NOT_PERFORMED",
    fullBetaDeploymentTopologyCertified: "NO",
  } as const;
  // Lock the attribution: a future edit that re-presents this as gate-generated fails here.
  assert.equal(hostedDataTier.provenance, "EXTERNAL_AUTHORITATIVE_SNAPSHOT_METADATA", "the hosted certification lost its external attribution");
  assert.equal(hostedDataTier.generatedByThisGate, "NO", "the battery claims to have generated the hosted certification");
  assert.equal(hostedDataTier.verifiedByThisGate, "NO", "the battery claims to have verified the hosted certification");
  // The external snapshot must be traceable to repository records that agree with it. The
  // previous head cited RR-MIGRATE/RR-BACKUP while those documents still said NOT EXECUTED
  // and OPEN, so the gate emitted a PASS its own evidence base denied.
  const hostedProof = readFileSync("docs/release/hosted-supabase-migration-proof.md", "utf8");
  assert.match(hostedProof, /HOSTED_MIGRATIONS_APPLIED=161\/161/, "the hosted proof does not record the executed migration count");
  assert.match(hostedProof, /RR_MIGRATE=RESOLVED/, "the hosted proof does not record RR-MIGRATE as resolved");
  assert.doesNotMatch(hostedProof.split("## Historical context")[0]!, /^## Status: NOT EXECUTED/m, "the hosted proof still declares the execution NOT EXECUTED");
  const drill = readFileSync("docs/release/backup-restore-drill.md", "utf8");
  assert.match(drill, /RR_BACKUP=RESOLVED/, "the restore drill does not record RR-BACKUP as resolved");
  assert.match(drill, /HOSTED_PLATFORM_RESTORE_REHEARSAL=NOT_PERFORMED/, "the restore drill does not preserve the hosted-restore scope limit");
  EVIDENCE.hostedDataTierCertification = hostedDataTier;
  EVIDENCE.fullBetaDeploymentTopologyCertified = "NO";
  EVIDENCE.invalidEnvProcessExits = "NO (Next.js 16.3.2 may keep listening; surfaces still fail closed)";

  const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
  assert.match(instrumentation, /RUNTIME boundary, not a deployment-time one/i, "the runtime guard does not state its scope limit");
});

test("K2. ACCEPTED RESIDUAL BOUNDARIES still hold and are not silently upgraded", () => {
  const register = readFileSync("docs/release/residual-risk-register.md", "utf8");
  for (const rr of [
    "RR-GOVERNANCE-PERMISSION-GUARD-BROKEN",
    "RR-BETA-OPERATOR-FRONTERA-BOUNDARY",
    "RR-NORMAL-INVITE-SEAT-MODEL",
    "RR-OFFBOARD-AUDIT-NONATOMIC",
    "RR-INVITE-AUDIT-NONATOMIC",
    "RR-BETA-PLATFORM-SIGNUP-OPEN",
  ]) {
    const row = register.slice(register.indexOf(`| ${rr} |`));
    assert.ok(row.startsWith(`| ${rr} |`), `${rr} is missing from the register`);
    assert.match(row.slice(0, 400), /ACCEPTED_FOR_CLOSED_BETA/, `${rr} no longer carries ACCEPTED_FOR_CLOSED_BETA`);
  }

  // The broken guard must remain absent from every certified beta path.
  for (const f of [
    "scripts/beta-invite-participant.mjs",
    "src/app/api/execution-tasks/route.ts",
    "src/app/api/ready/route.ts",
  ]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /await requireGovernancePermission\(/, `${f} now reaches the broken governance guard`);
  }
  EVIDENCE.acceptedResidualsUnchanged = "RR-GOVERNANCE-PERMISSION-GUARD-BROKEN, RR-BETA-OPERATOR-FRONTERA-BOUNDARY, RR-NORMAL-INVITE-SEAT-MODEL, RR-OFFBOARD-AUDIT-NONATOMIC, RR-INVITE-AUDIT-NONATOMIC, RR-BETA-PLATFORM-SIGNUP-OPEN all ACCEPTED_FOR_CLOSED_BETA";
});
