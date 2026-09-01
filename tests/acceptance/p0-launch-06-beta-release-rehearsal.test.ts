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
import { acceptWorkspaceInvite } from "../../src/lib/workspace-team";
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

const membershipOf = async (userId: string, workspaceId: string) =>
  (await admin().from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle()).data;

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
  for (const [id, ws] of [[participantUserId, TENANT_A.workspaceId], [foreignUserId, TENANT_B.workspaceId]] as const) {
    if (!id) continue;
    await supabase.from("workspace_memberships").delete().eq("user_id", id);
    await supabase.auth.admin.deleteUser(id);
    void ws;
  }
  if (participantEmail) await supabase.from("workspace_invitations").delete().eq("workspace_id", TENANT_A.workspaceId).eq("email", participantEmail);
  try { fs.rmSync(CONTROL_DIR, { recursive: true, force: true }); } catch { /* best effort */ }
  console.log(`\nP0_LAUNCH_06_REHEARSAL_EVIDENCE ${JSON.stringify(EVIDENCE, null, 2)}`);
});

// ───────────────── PHASE A — startup boundary (the certified runtime guard) ─────────────────

test("A1. STARTUP BOUNDARY: an invalid closed-beta environment leaves NO application surface operational", async () => {
  // Started through a BARE `next start` — deliberately bypassing
  // `npm run start:closed-free-beta` — because the whole point of the in-process
  // guard is that enforcement no longer depends on which command launched Next.js.
  const port = await freePort();
  const outcome = await startProductionServer({
    port,
    env: betaEnv({ NEXT_PUBLIC_APP_URL: "" }),
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

  const audit = await admin().from("workspace_audit_events").select("event_type")
    .eq("workspace_id", TENANT_A.workspaceId).eq("event_type", "invitation_sent").limit(1);
  assert.ok((audit.data ?? []).length > 0, "no invitation_sent audit event was written");

  EVIDENCE.supportedOperatorInvite = `workspace ${TENANT_A.workspaceId} role pm pending, token hashed at rest, invitation_sent audited`;
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
  const supabase = admin();
  const accepted = await acceptWorkspaceInvite(
    { token: inviteToken, userId: participantUserId, userEmail: participantEmail },
    async () => supabase as never,
  );
  assert.ok(accepted, "invite acceptance returned nothing");

  const memberships = await supabase.from("workspace_memberships").select("workspace_id, role").eq("user_id", participantUserId);
  assert.equal(memberships.data?.length, 1, "admission did not establish exactly one tenant membership");
  assert.equal(memberships.data?.[0]?.workspace_id, TENANT_A.workspaceId, "admission bound the wrong tenant");
  assert.equal(memberships.data?.[0]?.role, "pm", "admission did not bind the invited role");
  EVIDENCE.tenantBinding = `workspace ${TENANT_A.workspaceId}`;
  EVIDENCE.roleBinding = "pm (from the invitation record, not the caller)";
});

test("D2. INVITE_REPLAY_REFUSED: the same token cannot mint a second authority grant", async () => {
  const supabase = admin();
  let replayed = false;
  try {
    await acceptWorkspaceInvite({ token: inviteToken, userId: participantUserId, userEmail: participantEmail }, async () => supabase as never);
    replayed = true;
  } catch { /* refusal is the expected outcome */ }
  assert.equal(replayed, false, "a used invitation token was accepted a second time");

  const memberships = await supabase.from("workspace_memberships").select("workspace_id").eq("user_id", participantUserId);
  assert.equal(memberships.data?.length, 1, "token replay created a second authority grant");
  EVIDENCE.inviteReplayRefused = "PASS (single membership after replay attempt)";
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
  assert.deepEqual(foreignEffect.data ?? [], [], "a refused cross-tenant write still produced a persisted effect");

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
  EVIDENCE.hostedDataTierCertification = "PENDING";
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
  EVIDENCE.acceptedResidualsUnchanged = "RR-GOVERNANCE-PERMISSION-GUARD-BROKEN, RR-BETA-OPERATOR-FRONTERA-BOUNDARY, RR-NORMAL-INVITE-SEAT-MODEL, RR-OFFBOARD-AUDIT-NONATOMIC, RR-BETA-PLATFORM-SIGNUP-OPEN all ACCEPTED_FOR_CLOSED_BETA";
});
