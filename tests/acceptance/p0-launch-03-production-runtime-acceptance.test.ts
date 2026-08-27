/**
 * P0-LAUNCH-03 — production runtime and deployment acceptance.
 *
 * P0-LAUNCH-02 proved that one integrated Founder journey runs truthfully across
 * the converged stack, in ONE TEST PROCESS. This file answers a different
 * question: can that accepted stack be built, started, operated, stopped,
 * restarted and validated through PMFreak's SUPPORTED PRODUCTION RUNTIME PATH?
 *
 * The distinction is the whole increment. Before this file, every gate whose
 * name contains "production", "runtime", "hardening" or "startup" was a
 * `readFileSync` plus a regular expression over SOURCE TEXT:
 *
 *   check:production-runtime   — asserts 20-odd files exist under src/lib/production-runtime
 *   check:runtime-hardening    — asserts 20-odd files exist under src/lib/runtime-hardening
 *   check:runtime-contracts    — counts occurrences of `any` in two files
 *   diag:runtime               — three regexes against bootstrap.ts and health/route.ts
 *   test:launch-smoke          — three more regexes
 *   docs/release/startup-readiness.md — "Startup assertions are enforced by ... checks"
 *
 * Every one of those passes with the application unable to boot. `npm run start`
 * was declared in package.json and executed by NOTHING: a repository-wide search
 * for `next start` / `npm run start` across scripts/, tests/, .github/ and
 * docs/release/ returned zero hits, and the only HTTP evidence in the repository
 * (the P2-14 Playwright journey) points its webServer at `npm run dev`.
 *
 * So this file starts the real thing. `npm run build`, then `npm run start`, then
 * HTTP against the process that results — health, readiness, authentication, a
 * governed dispatch, SIGTERM, a genuinely new process, and the durable state that
 * has to survive it.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THE CLAIMS HERE LOAD-BEARING RATHER THAN DECORATIVE
 *
 * 1. The Frontera authority store is created FRESH under the OS temp directory
 *    on every run. The store configured in the developer's .env.local is a
 *    leftover from a previous session; accepting against it would be accepting
 *    against developer-machine residue, which is exactly what this increment
 *    exists to rule out.
 *
 * 2. The centrepiece is not "a governed call returned ALLOW". It is that an
 *    operator revocation performed OUT OF PROCESS, against the store file, is
 *    observed by the already-running (and by then already RESTARTED) production
 *    server on its very next dispatch, without that server being signalled or
 *    told anything. A server running an in-memory authority world, a cached
 *    provider set, or a store other than the configured one CANNOT produce that
 *    transition. It proves H, I, R and the DENY half of J at once.
 *
 *    It happens ONCE, and last, because Frontera's revocation is TERMINAL by
 *    design: a revoked entity id can never be re-provisioned. A gate that
 *    revoked mid-run and then expected to restore the same grant would be
 *    asserting against semantics the authority model deliberately forbids.
 *
 * 3. Denials assert their exact `failureClass`. An outage
 *    (`frontera_unavailable`) is proven NOT to satisfy a policy-denial
 *    assertion — the same vacuity P0-LAUNCH-02's review found as its finding 6.
 *
 * 4. Liveness and readiness are asserted separately and are not interchangeable.
 *    /api/health answers 200 with the database down; only /api/ready probes it.
 *    Readiness is proven against a REAL Supabase endpoint — the repository's
 *    existing readiness test mocks `globalThis.fetch`, so before this file the
 *    readiness database probe had never actually reached a database.
 *
 * 5. Every assertion that could pass vacuously has a mechanical control at the
 *    bottom of this file proving it fails when the thing it claims is broken.
 *
 * ---------------------------------------------------------------------------
 * SCOPE. This is LOCAL PRODUCTION-LIKE acceptance: `next build` + `next start`
 * on this machine, against the disposable local Supabase stack. It is NOT a
 * real public production deployment, and nothing here should be read as one.
 * See docs/release/p0-launch-03-production-runtime-acceptance.md.
 *
 * PRECONDITIONS (operator, out of band — never performed by this file):
 *   npm run seed:p2-13-founder     # PMFreak database state for tenant A
 * A local Supabase stack must be reachable at OPERATIONAL_FLOW_TEST_SUPABASE_URL.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";

import { createClient } from "@supabase/supabase-js";

import {
  openOperatorStore,
  provisionPmfreakDispatchAuthority,
  revokePmfreakDispatchAuthority,
} from "../../scripts/frontera-authority-provisioning.mjs";
import { buildP2_14HandoffManifest } from "../../scripts/p2-13/founder-scenario-manifest.mjs";

const ROOT = process.cwd();
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

/**
 * The installed root of a packaged artifact, by RESOLUTION rather than by
 * assuming a path.
 *
 * `require.resolve(name + "/package.json")` cannot be used here:
 * `@aoc-enterprise/runtime` declares an `exports` map that does not expose
 * `./package.json`, so Node refuses the subpath outright
 * (ERR_PACKAGE_PATH_NOT_EXPORTED). Resolving the package's own entry point and
 * walking up to the manifest that CLAIMS the name works for both artifacts, and
 * still proves the specifier genuinely resolves rather than merely that a
 * directory exists where one is expected.
 */
function resolvePackageRoot(name: string): string {
  let dir = path.dirname(fs.realpathSync(requireFromRoot.resolve(name)));
  const stop = path.parse(dir).root;
  while (dir !== stop) {
    const manifest = path.join(dir, "package.json");
    if (fs.existsSync(manifest)) {
      try {
        if (readJson(manifest).name === name) return dir;
      } catch {
        /* an unreadable manifest on the way up is not the one we want */
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error(`could not locate the installed root of ${name} by resolution`);
}

const installedManifest = (name: string) => readJson(path.join(resolvePackageRoot(name), "package.json"));

/**
 * THE IMMUTABLE LAUNCH BASELINE.
 *
 * Deliberately a literal, and deliberately NOT derived from
 * `vendor/aoc-consumer.lock.json`, for the reason P0-LAUNCH-02 gives: the lock
 * is mutable, and a coordinated repin would move the lock and the installed
 * tree together while an acceptance that only compared those two to each other
 * stayed green. Moving the launch baseline must edit this block.
 */
const LAUNCH_BASELINE = {
  "@aoc/protocol": {
    version: "0.2.0-rc.1",
    sha256: "b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60",
    integrity: "sha512-iJqgwo9ZLewWhY4HWOX1owfplgOzcjk2CuPOcI7ne8ZhwM8dekDaztaBhkfgos0IQ9mSH6fmefNA2yix8DO2bA==",
    tarball: "vendor/aoc-protocol-0.2.0-rc.1.tgz",
  },
  "@aoc-enterprise/runtime": {
    version: "1.2.1",
    sha256: "6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628",
    integrity: "sha512-k3YmQ/GX6cHLLGjNzzYKHSIUT19U342jJF76l+qIbr2TKZTJJhvIQSjLIRuwfbeLZS1EqKOUNDrgPzdu0s5K3A==",
    tarball: "vendor/aoc-enterprise-runtime-1.2.1.tgz",
  },
} as const;

/** Frontera's own internals. A DIRECT PMFreak dependency on any of these would bypass the packaged boundary. */
const PRIVATE_FRONTERA_WORKSPACES = [
  "@aoc-enterprise/governed-authority",
  "@aoc-enterprise/governed-authorization",
  "@aoc-enterprise/identity",
  "@aoc-enterprise/scoped-access",
] as const;

const FRONTERA_STORE_ENV = "AOC_ENTERPRISE_KERNEL_AUTHORITY_SQLITE_PATH";

// ───────────────────────────── small utilities ─────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const sha256File = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/**
 * A cookie jar over fetch.
 *
 * The Founder session is a real Supabase SSR cookie pair written by
 * `POST /api/login`, not a bearer token this file could mint. Redirects are
 * manual so the Set-Cookie on the post-login redirect is not swallowed.
 */
class HttpSession {
  private readonly cookies = new Map<string, string>();
  constructor(private baseUrl: string) {}

  rebind(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  async request(pathname: string, init: RequestInit = {}): Promise<{ status: number; text: string; json: <T = unknown>() => T }> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const response = await fetch(`${this.baseUrl}${pathname}`, { ...init, headers, redirect: "manual" });
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await response.text();
    return { status: response.status, text, json: <T,>() => JSON.parse(text) as T };
  }

  get cookieNames(): string[] {
    return [...this.cookies.keys()].sort();
  }
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "string" || address === null) return reject(new Error("no ephemeral port"));
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function portAcceptsConnections(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    setTimeout(() => done(false), 2_000);
  });
}

// ─────────────────── /proc: which process, running which bytes ───────────────────
//
// Assertions about the running production process must target the process that
// actually serves HTTP, and must be able to say which files it loaded. On Linux
// /proc answers both. Where /proc is unavailable these assertions FAIL rather
// than skip — an environment that cannot produce the evidence must not be
// reported as having produced it.

const PROC_AVAILABLE = fs.existsSync("/proc/self/stat");

function requireProc(what: string): void {
  assert.ok(PROC_AVAILABLE, `${what} requires /proc (Linux). This environment cannot produce the evidence, so the claim is not made.`);
}

function descendantPids(root: number): number[] {
  const children = new Map<number, number[]>();
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
      // `comm` may contain spaces and parentheses; ppid is the field after the LAST ')'.
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      if (!Number.isFinite(ppid)) continue;
      children.set(ppid, [...(children.get(ppid) ?? []), pid]);
    } catch {
      /* the process exited while we were reading */
    }
  }
  const out: number[] = [];
  const walk = (pid: number) => {
    for (const child of children.get(pid) ?? []) {
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

const readProc = (pid: number, file: string): string => {
  try {
    return fs.readFileSync(`/proc/${pid}/${file}`, "utf8");
  } catch {
    return "";
  }
};

const cmdlineOf = (pid: number) => readProc(pid, "cmdline").replace(/\0/g, " ").trim();

function environOf(pid: number): Map<string, string> {
  const env = new Map<string, string>();
  for (const entry of readProc(pid, "environ").split("\0")) {
    const eq = entry.indexOf("=");
    if (eq > 0) env.set(entry.slice(0, eq), entry.slice(eq + 1));
  }
  return env;
}

/** Files mapped into the process's address space — native modules it actually dlopen'd. */
function mappedFiles(pid: number): string[] {
  const out = new Set<string>();
  for (const line of readProc(pid, "maps").split("\n")) {
    const idx = line.indexOf("/");
    if (idx > 0) out.add(line.slice(idx).trim());
  }
  return [...out];
}

const pidAlive = (pid: number) => {
  try {
    fs.statSync(`/proc/${pid}`);
    return true;
  } catch {
    return false;
  }
};

// ───────────────────────────── server lifecycle ─────────────────────────────

type ServerHandle = {
  readonly launcherPid: number;
  readonly serverPid: number;
  readonly port: number;
  readonly baseUrl: string;
  readonly child: ChildProcess;
  readonly healthyAfterMs: number;
  log(): string;
  exitStatus(): { code: number | null; signal: NodeJS.Signals | null } | null;
};

type StartOutcome =
  | { readonly started: true; readonly handle: ServerHandle }
  | { readonly started: false; readonly reason: string; readonly log: string };

/**
 * Starts PMFreak through its SUPPORTED production entrypoint: `npm run start`,
 * which is `next start`. Never `next dev`.
 *
 * `detached: true` puts the launcher and the server it spawns in their own
 * process group, so shutdown can signal the GROUP — which is what a container
 * runtime or a process supervisor does, and the only way to observe whether a
 * child is left orphaned.
 */
async function startProductionServer(options: {
  port: number;
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<StartOutcome> {
  const { port, env } = options;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn("npm", ["run", "start", "--", "--port", String(port)], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  let log = "";
  const collect = (chunk: unknown) => {
    log += String(chunk);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  const state: { exit: { code: number | null; signal: NodeJS.Signals | null } | null } = { exit: null };
  child.on("exit", (code, signal) => {
    state.exit = { code, signal };
  });

  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let healthy = false;
  while (Date.now() < deadline && !state.exit) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {
      /* not accepting connections yet */
    }
    await sleep(400);
  }

  if (!healthy) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
    return {
      started: false,
      log,
      reason: state.exit
        ? `the process exited (code ${state.exit.code}, signal ${state.exit.signal}) before it became healthy`
        : `the process never became healthy within ${timeoutMs}ms`,
    };
  }

  const launcherPid = child.pid!;
  // `npm run start` is the supported command, so the process tree is
  //   npm  ->  sh -c "next start --port N"  ->  next-server (vX.Y.Z)
  // Claims about which bytes are executing must name the server, not npm and
  // not the shell in between — both of those load none of the application.
  const descendants = descendantPids(launcherPid);
  const serverPid =
    descendants.filter((pid) => /next/.test(cmdlineOf(pid)) && !/^(\/bin\/)?sh /.test(cmdlineOf(pid))).pop() ?? launcherPid;

  return {
    started: true,
    handle: {
      launcherPid,
      serverPid,
      port,
      baseUrl,
      child,
      healthyAfterMs: Date.now() - startedAt,
      log: () => log,
      exitStatus: () => state.exit,
    },
  };
}

/** Stops the process GROUP the way a supervisor or `docker stop` would. */
async function stopProductionServer(
  handle: ServerHandle,
  signal: NodeJS.Signals = "SIGTERM",
  timeoutMs = 30_000,
): Promise<{ exitedAfterMs: number | null; code: number | null; signal: NodeJS.Signals | null; orphans: number[] }> {
  const known = [handle.serverPid, ...descendantPids(handle.launcherPid)].filter(
    (pid, index, all) => all.indexOf(pid) === index,
  );
  const startedAt = Date.now();
  try {
    process.kill(-handle.launcherPid, signal);
  } catch {
    /* already dead */
  }

  const deadline = startedAt + timeoutMs;
  while (Date.now() < deadline && handle.exitStatus() === null) await sleep(100);
  const status = handle.exitStatus();

  await sleep(750); // let descendants reap before looking for stragglers
  return {
    exitedAfterMs: status === null ? null : Date.now() - startedAt,
    code: status?.code ?? null,
    signal: status?.signal ?? null,
    orphans: known.filter((pid) => pidAlive(pid)),
  };
}

function forceKill(handle: ServerHandle | null | undefined): void {
  if (!handle) return;
  try {
    process.kill(-handle.launcherPid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

// ───────────────────────── governed-operation helpers ─────────────────────────

type GovernedResponse = { status: number; body: Record<string, unknown>; raw: string };

/**
 * The product's own decision vocabulary as it reaches an HTTP caller.
 *
 * The route deliberately withholds Frontera's reason codes from clients — they
 * are what an operator needs and precisely what an arbitrary caller should not
 * learn about another system's authority structure. What DOES cross the
 * boundary is the failure class, and that is the distinction this file needs:
 * `frontera_denied` is a policy answer, `frontera_unavailable` is an outage.
 */
function asGovernedAllow(response: GovernedResponse, why: string): string {
  assert.ok([200, 201].includes(response.status), `${why} — expected 200/201, got ${response.status}: ${response.raw.slice(0, 300)}`);
  assert.notEqual(response.body.disposition, "denied", `${why} — the dispatch was denied: ${response.raw.slice(0, 300)}`);
  const decisionId = response.body.fronteraDecisionId;
  assert.equal(typeof decisionId, "string", `${why} — no fronteraDecisionId, so the Frontera boundary was not traversed: ${response.raw.slice(0, 300)}`);
  assert.ok(String(decisionId).length > 0, `${why} — the Frontera decision id is empty`);
  return String(decisionId);
}

/**
 * A POLICY denial, and nothing else.
 *
 * `allowed === false` is not enough and never was: an unreachable store, a
 * corrupt store and a kernel crash all produce `allowed === false` too. This
 * asserts the exact class, so an outage cannot be banked as governance working.
 */
function asGovernedPolicyDenial(response: GovernedResponse, why: string): void {
  // A governed denial is answered 409 by the route's disposition ladder. It is
  // a MEANINGFUL domain answer, not a fault, so a 5xx here would itself be a
  // finding rather than a denial.
  assert.equal(response.status, 409, `${why} — expected a governed 409 denial, got ${response.status}: ${response.raw.slice(0, 300)}`);
  assert.equal(response.body.disposition, "denied", `${why} — the dispatch was not denied: ${response.raw.slice(0, 300)}`);
  assert.equal(
    response.body.failureClass,
    "frontera_denied",
    `${why} — the denial must come from EVALUATION, not from an outage. Got failureClass=${String(response.body.failureClass)}`,
  );
}

// ─────────────────── local-fallback guards, as pure functions ───────────────────
//
// These are deliberately parameterised rather than reading their inputs
// directly. The acceptance calls them with the REAL tree; the non-vacuity
// controls at the bottom of this file call the SAME functions with a poisoned
// tree and require them to throw. A guard that could only ever be handed a
// passing input would prove nothing about its ability to detect a redirect.

function assertNoUpstreamAliasRedirect(aliases: readonly string[]): void {
  for (const alias of aliases) {
    assert.ok(
      !/^@aoc\/|^@aoc-enterprise\//.test(alias),
      `the alias ${alias} could redirect an upstream specifier to repository-local source`,
    );
  }
}

function assertNoPrivateFronteraDependency(declared: readonly string[]): void {
  for (const name of declared) {
    assert.ok(
      !PRIVATE_FRONTERA_WORKSPACES.includes(name as (typeof PRIVATE_FRONTERA_WORKSPACES)[number]),
      `${name} is a Frontera internal and must reach PMFreak only as a bundled dependency of the packaged artifact`,
    );
  }
}

function assertResolvedFromPackagedArtifact(name: string, resolvedPath: string, nodeModulesRoot: string): void {
  assert.ok(resolvedPath.startsWith(nodeModulesRoot), `${name} resolves to ${resolvedPath}, outside this checkout's node_modules`);
  assert.ok(!/[/\\]src[/\\]aoc[/\\]/.test(resolvedPath), `${name} resolves through repository-local source: ${resolvedPath}`);
}

function asGovernedInfrastructureFailure(response: GovernedResponse, why: string): void {
  assert.equal(response.status, 409, `${why} — expected a fail-closed 409, got ${response.status}: ${response.raw.slice(0, 300)}`);
  assert.equal(response.body.disposition, "denied", `${why} — expected a fail-closed denial: ${response.raw.slice(0, 300)}`);
  assert.equal(
    response.body.failureClass,
    "frontera_unavailable",
    `${why} — an unusable authority dependency must be reported as an outage, never as a policy answer and never as ALLOW. Got failureClass=${String(response.body.failureClass)}`,
  );
}

// ─────────────────────────────── run context ───────────────────────────────

const manifest = buildP2_14HandoffManifest();
const TENANT_A = manifest.tenants.find((tenant: { key: string }) => tenant.key === "A")!;
const OWNER_A = TENANT_A.actors.find((actor: { reference: string }) => actor.reference.endsWith(":owner"))!;

let RUN_DIR = "";
let STORE_PATH = "";
let EMPTY_STORE_PATH = "";
let MALFORMED_STORE_PATH = "";
let PRINCIPAL_USER_ID = "";
let PORT = 0;
let server: ServerHandle | null = null;
let firstServerPid = 0;
let session!: HttpSession;
/**
 * Facts this run actually observed, printed once at the end.
 *
 * A launch-acceptance gate whose only output is "ok 25" makes a reviewer
 * re-run it to learn anything. These are recorded as they are asserted, never
 * assumed, and every one of them is also the subject of an assertion above.
 */
const EVIDENCE: Record<string, string | number | boolean> = {};
let actionId = "";
let allowDecisionId = "";
let postRestartDecisionId = "";
const runKey = `p0-launch-03-${Date.now()}`;

/**
 * The environment a production process is started with.
 *
 * Overrides are passed as EMPTY STRINGS rather than deletions, and that detail
 * is load-bearing. `next start` loads `.env.local` itself, and @next/env only
 * fills a name whose `process.env` value is `undefined` — so deleting a
 * variable here would let `.env.local` quietly put it back and the negative
 * control would test nothing. An empty string is defined, survives that merge,
 * and is falsy everywhere the product checks it.
 */
function productionEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, [FRONTERA_STORE_ENV]: STORE_PATH, ...overrides };
}

/** Only the lifecycle this file owns; the provisioning helpers own the rest of the surface. */
type OperatorStore = { close(): Promise<void> };

async function withOperatorStore<T>(storePath: string, fn: (store: OperatorStore) => Promise<T>): Promise<T> {
  const store = (await openOperatorStore(storePath)) as OperatorStore;
  try {
    return await fn(store);
  } finally {
    await store.close();
  }
}

const provisionAuthority = (storePath: string) =>
  withOperatorStore(storePath, (store) =>
    provisionPmfreakDispatchAuthority(store, {
      organizationId: TENANT_A.workspaceId,
      principalUserId: PRINCIPAL_USER_ID,
      projectId: TENANT_A.projectId,
      operatorActorId: "operator-p0-launch-03",
    }),
  );

const revokeAuthority = (storePath: string) =>
  withOperatorStore(storePath, (store) =>
    revokePmfreakDispatchAuthority(store, {
      organizationId: TENANT_A.workspaceId,
      principalUserId: PRINCIPAL_USER_ID,
      projectId: TENANT_A.projectId,
      operatorActorId: "operator-p0-launch-03",
      reason: "P0-LAUNCH-03 production runtime acceptance",
    }),
  );

async function signIn(target: HttpSession) {
  const body = new URLSearchParams({ email: OWNER_A.email, password: process.env.P2_13_FIXTURE_ACTOR_PASSWORD! });
  return await target.request("/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

async function governedPost(target: HttpSession, payload: Record<string, unknown>): Promise<GovernedResponse> {
  const response = await target.request("/api/operational-flow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId: TENANT_A.workspaceId, projectId: TENANT_A.projectId, ...payload }),
  });
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(response.text) as Record<string, unknown>;
  } catch {
    /* a non-JSON body is itself the evidence; `raw` carries it */
  }
  return { status: response.status, body, raw: response.text };
}

const dispatchGovernedAction = (target: HttpSession = session) =>
  governedPost(target, { operation: "dispatch_material_action_to_task", actionId });

before(async () => {
  // ── Execution-environment guard. This gate mutates disposable runtime state
  //    and must only ever run against the canonical checkout it was written for.
  assert.ok(fs.existsSync(path.join(ROOT, "vendor/aoc-consumer.lock.json")), `not a PMFreak checkout: ${ROOT}`);

  // Environment is the operator's to supply, exactly as every other runtime gate
  // in this repository requires it (`set -a && . ./.env.local && set +a`). This
  // file reads no dotenv file of its own and invents no configuration.
  for (const name of [
    "OPERATIONAL_FLOW_TEST_SUPABASE_URL",
    "OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY",
    "P2_13_FIXTURE_ACTOR_PASSWORD",
    // Declared by the product as required in production
    // (deployment-boundary-registry.ts) and checked by /api/ready. A production
    // runtime acceptance must be given it rather than invent one, because
    // inventing it is precisely how a readiness gate stops meaning anything.
    "NEXT_PUBLIC_APP_URL",
  ] as const) {
    assert.ok(
      process.env[name],
      `${name} is required. Load the acceptance environment first:  set -a && . ./.env.local && set +a`,
    );
  }

  // ── A FRESH authority store, per run, under the OS temp directory.
  //    Never the operator's configured store: that file is developer-machine
  //    residue, and reusing it would make "durable state survived" unfalsifiable.
  RUN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pmfreak-p0-launch-03-"));
  STORE_PATH = path.join(RUN_DIR, "authority.sqlite");
  EMPTY_STORE_PATH = path.join(RUN_DIR, "empty-authority.sqlite");
  MALFORMED_STORE_PATH = path.join(RUN_DIR, "malformed-authority.sqlite");
  fs.writeFileSync(MALFORMED_STORE_PATH, "this is not a SQLite database\n");

  // ── The REAL authenticated principal id. Never guessed: an unresolvable
  //    actor is a hard failure, exactly as the operator provisioning script says.
  const admin = createClient(process.env.OPERATIONAL_FLOW_TEST_SUPABASE_URL!, process.env.OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (let page = 1; page <= 20 && !PRINCIPAL_USER_ID; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    assert.ok(!listed.error, `listUsers failed: ${listed.error?.message}`);
    const found = listed.data.users.find((user) => (user.email ?? "").toLowerCase() === OWNER_A.email.toLowerCase());
    if (found) PRINCIPAL_USER_ID = found.id;
    if (listed.data.users.length < 200) break;
  }
  assert.ok(
    PRINCIPAL_USER_ID,
    `no authenticated principal for ${OWNER_A.email}. Run 'npm run seed:p2-13-founder' first; this gate never invents an identity.`,
  );

  await provisionAuthority(STORE_PATH);
  // The empty store is provisioned with NOTHING. It exists so that "durable
  // state survived a restart" can be shown to fail when the state is absent.
  await withOperatorStore(EMPTY_STORE_PATH, async () => {});

  PORT = await freePort();
});

after(async () => {
  forceKill(server);
  console.log(`\nP0_LAUNCH_03_PRODUCTION_RUNTIME_EVIDENCE ${JSON.stringify(EVIDENCE, null, 2)}`);
  try {
    fs.rmSync(RUN_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

// ═══════════════════════════ A / Q / R — the tree ═══════════════════════════

test("A: the installed dependency tree is the frozen launch baseline", () => {
  const lock = readJson(path.join(ROOT, "package-lock.json"));
  const pkg = readJson(path.join(ROOT, "package.json"));

  for (const [name, expected] of Object.entries(LAUNCH_BASELINE)) {
    const tarball = path.join(ROOT, expected.tarball);
    assert.ok(fs.existsSync(tarball), `${name}: the vendored artifact ${expected.tarball} is missing`);
    assert.equal(sha256File(tarball), expected.sha256, `${name}: the vendored tarball is not the frozen artifact`);

    assert.equal(pkg.dependencies[name], `file:${expected.tarball}`, `${name}: the declared specifier moved off the frozen tarball`);

    const entry = lock.packages[`node_modules/${name}`];
    assert.ok(entry, `${name}: absent from package-lock.json`);
    assert.equal(entry.version, expected.version, `${name}: the locked version is not the launch baseline`);
    assert.equal(entry.integrity, expected.integrity, `${name}: the locked integrity is not the launch baseline`);

    assert.equal(installedManifest(name).version, expected.version, `${name}: the INSTALLED version is not the launch baseline`);
  }
});

test("Q: no local-source or TypeScript-alias path to the upstream packages exists", () => {
  for (const dir of ["src/aoc/protocol", "src/aoc/enterprise"]) {
    assert.ok(!fs.existsSync(path.join(ROOT, dir)), `${dir} exists; a repository-local copy could shadow the packaged artifact`);
  }

  assertNoUpstreamAliasRedirect(Object.keys(readJson(path.join(ROOT, "tsconfig.json")).compilerOptions?.paths ?? {}));

  const pkg = readJson(path.join(ROOT, "package.json"));
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
    assertNoPrivateFronteraDependency(Object.keys(pkg[section] ?? {}));
  }

  // The resolved artifacts must live in this checkout's node_modules, not
  // somewhere a link or a workspace redirect could point.
  const nodeModulesRoot = fs.realpathSync(path.join(ROOT, "node_modules"));
  for (const name of Object.keys(LAUNCH_BASELINE)) {
    assertResolvedFromPackagedArtifact(name, resolvePackageRoot(name), nodeModulesRoot);
  }
});

test("R: no product code path can select an in-memory authority store", () => {
  // The packaged runtime DOES export an in-memory store, so this is a real
  // capability rather than a hypothetical. What must not exist is a way for the
  // PRODUCTION path to reach it.
  const runtimeSurface = fs.readFileSync(requireFromRoot.resolve("@aoc-enterprise/runtime/enterprise"), "utf8");
  assert.match(
    runtimeSurface,
    /createInMemoryKernelAuthorityStore/,
    "the packaged runtime no longer exports an in-memory store; this control is asserting against a stale assumption",
  );

  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(entry.name) && fs.readFileSync(abs, "utf8").includes("createInMemoryKernelAuthorityStore")) {
        offenders.push(path.relative(ROOT, abs));
      }
    }
  };
  walk(path.join(ROOT, "src"));
  assert.deepEqual(offenders, [], "product code references an in-memory authority store");

  const adapter = fs.readFileSync(path.join(ROOT, "src/lib/integrations/frontera/enforcement-adapter.ts"), "utf8");
  assert.match(adapter, /createSqliteKernelAuthorityStore\(config\.authorityStorePath\)/, "the production path no longer opens the configured durable store");
});

// ═══════════════════════ B / C — build and actually start ═══════════════════════

test("B: the supported production build completes and emits a fresh build", () => {
  const buildIdPath = path.join(ROOT, ".next/BUILD_ID");
  const previousBuildId = fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, "utf8") : null;
  const startedAt = Date.now();

  // The real command, not a proxy for it. `npm run build` is `next build`.
  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });

  assert.ok(fs.existsSync(buildIdPath), "next build produced no .next/BUILD_ID");
  assert.ok(
    fs.statSync(buildIdPath).mtimeMs >= startedAt - 1_000,
    `.next/BUILD_ID was not rewritten by this build — stale output must never be accepted as a production build (previous id ${previousBuildId})`,
  );

  EVIDENCE.buildCommand = "npm run build";
  EVIDENCE.buildOutput = ".next";
  EVIDENCE.buildId = fs.readFileSync(buildIdPath, "utf8").trim();

  const routes = fs.readFileSync(path.join(ROOT, ".next/routes-manifest.json"), "utf8");
  for (const route of ["/api/health", "/api/ready", "/api/login", "/api/operational-flow"]) {
    assert.ok(routes.includes(`"${route}"`), `the production build does not carry ${route}`);
  }
});

test("C: the built application starts through `npm run start` and becomes healthy", async () => {
  requireProc("identifying the production server process");
  const outcome = await startProductionServer({ port: PORT, env: productionEnv() });
  if (!outcome.started) assert.fail(`the production server did not start: ${outcome.reason}\n${outcome.log.slice(-4000)}`);

  server = outcome.handle;
  firstServerPid = server.serverPid;
  session = new HttpSession(server.baseUrl);

  EVIDENCE.startCommand = `npm run start -- --port ${PORT}`;
  EVIDENCE.processModel = `npm(${server.launcherPid}) -> sh -> ${cmdlineOf(server.serverPid)}(${server.serverPid})`;
  EVIDENCE.port = PORT;
  EVIDENCE.healthyAfterMs = server.healthyAfterMs;
  EVIDENCE.oldPid = server.serverPid;
  EVIDENCE.authorityStore = STORE_PATH;

  assert.ok(await portAcceptsConnections(PORT), `nothing is listening on ${PORT}`);
  assert.notEqual(server.serverPid, server.launcherPid, "could not distinguish the Next server from the npm launcher");

  // `next start` does not export NODE_ENV into the process environment — the
  // value the application sees is compiled in — so reading /proc/environ for it
  // would prove nothing either way. What IS observable here is that the process
  // serving HTTP is Next's PRODUCTION server, and that it received this run's
  // isolated store path. That the application is in production MODE is proven
  // separately and behaviourally by the fail-closed test below: readiness only
  // demands SUPABASE_SERVICE_ROLE_KEY when NODE_ENV === "production", and it
  // demands it.
  assert.match(cmdlineOf(server.serverPid), /next-server/, `the process serving HTTP is not Next's production server: ${cmdlineOf(server.serverPid)}`);
  assert.doesNotMatch(server.log(), /next dev|Starting.*development/i, "the supported production entrypoint started a development server");
  assert.equal(
    environOf(server.serverPid).get(FRONTERA_STORE_ENV),
    STORE_PATH,
    "the server process did not receive this run's isolated authority store path",
  );
});

// ═══════════════════════ D / E — liveness and readiness ═══════════════════════

test("D: liveness answers over HTTP from the running production process", async () => {
  const response = await session.request("/api/health");
  assert.equal(response.status, 200, `/api/health returned ${response.status}: ${response.text.slice(0, 300)}`);
  const body = response.json<{ status: string; app: string; runtime: { adapters: string[]; adapterCount: number } }>();
  assert.equal(body.status, "ok");
  assert.equal(body.app, "pmfreak");
  assert.ok(body.runtime.adapterCount > 0, "the AOC runtime composed no adapters");
  assert.ok(body.runtime.adapters.includes("policyEvaluator"), `the composed adapter set is missing policyEvaluator: ${body.runtime.adapters.join(", ")}`);
  EVIDENCE.health = `200 ok (${body.runtime.adapterCount} adapters)`;
});

test("E: readiness answers separately, and its database probe reaches a REAL database", async () => {
  const response = await session.request("/api/ready");
  const body = response.json<{ status: string; checks: { name: string; status: string; detail?: string }[] }>();
  assert.equal(response.status, 200, `/api/ready returned ${response.status}: ${response.text.slice(0, 400)}`);
  assert.equal(body.status, "ready");

  const failed = body.checks.filter((check) => check.status !== "pass");
  assert.deepEqual(failed, [], `readiness reported failing checks: ${JSON.stringify(failed)}`);

  // Readiness is not liveness. The database check is the reason this endpoint
  // exists, and until now it had only ever run against a mocked `fetch`.
  const database = body.checks.find((check) => check.name === "database");
  assert.ok(database, `readiness reported no database check: ${JSON.stringify(body.checks)}`);
  assert.equal(database.status, "pass", `the readiness database probe did not reach the database: ${JSON.stringify(database)}`);
  EVIDENCE.readiness = `200 ready (${body.checks.map((check) => `${check.name}=${check.status}`).join(", ")})`;
});

// ═══════════════════════ G / F — auth and database, in the running process ═══════════════════════

test("G: the running process refuses an unauthenticated caller and honours a real login", async () => {
  const anonymous = new HttpSession(server!.baseUrl);
  const denied = await anonymous.request(`/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`);
  assert.equal(denied.status, 401, `an unauthenticated read must be refused, got ${denied.status}: ${denied.text.slice(0, 200)}`);

  const login = await signIn(session);
  assert.ok([200, 302, 303, 307].includes(login.status), `POST /api/login returned ${login.status}: ${login.text.slice(0, 300)}`);
  assert.ok(
    session.cookieNames.some((name) => name.startsWith("sb-")),
    `the login did not establish a Supabase session cookie (cookies: ${session.cookieNames.join(", ")})`,
  );
});

test("F: the running process reads tenant-scoped data from the real database", async () => {
  const response = await session.request(`/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`);
  assert.equal(response.status, 200, `the authenticated tenant read failed: ${response.status} ${response.text.slice(0, 300)}`);
  const summary = response.json<Record<string, unknown>>();
  assert.ok(Array.isArray(summary.decisions), `the summary carries no decisions array: ${response.text.slice(0, 300)}`);
  assert.ok((summary.decisions as unknown[]).length > 0, "tenant A has no persisted Decision; run `npm run seed:p2-13-founder` and the Founder journey first");
});

// ═══════════════════════ J / H / I — the governed operation ═══════════════════════

test("J(ALLOW): a governed Material Action dispatches through Frontera in the production process", async () => {
  const summary = (await session.request(`/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`)).json<{
    decisions: { id: string; decision_status: string }[];
  }>();
  // `persist_governed_material_action` only accepts a source Decision that
  // reached a terminal ACCEPTED or MODIFIED state. Taking the most recent
  // Decision regardless of status is how this reads 500 instead of proving
  // anything — an escalated Decision is not dispatchable by design.
  const decision = summary.decisions.find((row) => ["accepted", "modified"].includes(String(row.decision_status)));
  assert.ok(
    decision,
    `tenant A has no accepted or modified Decision to propose against (statuses: ${summary.decisions.map((row) => row.decision_status).join(", ") || "none"}). Run \`npm run seed:p2-13-founder\` and the Founder journey first.`,
  );
  const decisionId = decision.id;

  // Proposed through the product's own governed surface, with a run-scoped
  // idempotency key, so the ALLOW rests on state this run created rather than
  // on a row a previous session happened to leave behind.
  const proposed = await governedPost(session, {
    operation: "propose_material_action",
    decisionId,
    idempotencyKey: `${runKey}:material-action`,
    actionClass: "external_write",
    actionType: "production runtime acceptance probe",
    targetResourceType: "project",
    targetResourceId: TENANT_A.projectId,
    intendedOperation: "confirm the governed dispatch boundary from a production process",
    intendedEffect: "records a canonical Task through the governed dispatch path",
    risk: "medium",
    reversibility: "reversible",
    sideEffect: "external",
    justification: "P0-LAUNCH-03 production runtime acceptance",
  });
  assert.ok([200, 201].includes(proposed.status), `propose_material_action failed: ${proposed.status} ${proposed.raw.slice(0, 400)}`);

  const after = (await session.request(`/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`)).json<{
    materialActions: { id: string; idempotency_key?: string }[];
    materialActionEvaluations: { action_id: string; governance_state: string }[];
  }>();
  const mine = after.materialActions.find((row) => row.idempotency_key === `${runKey}:material-action`);
  assert.ok(mine, `the proposed Material Action is not readable back: ${JSON.stringify(after.materialActions).slice(0, 400)}`);
  actionId = mine.id;

  const evaluation = after.materialActionEvaluations.find((row) => row.action_id === actionId);
  assert.equal(evaluation?.governance_state, "authorized", `PMFreak's own governance did not authorize the action: ${JSON.stringify(evaluation)}`);

  const dispatched = await dispatchGovernedAction();
  allowDecisionId = asGovernedAllow(dispatched, "a provisioned Founder must be allowed to dispatch through the production process");
  EVIDENCE.governedOperation = "POST /api/operational-flow {operation:dispatch_material_action_to_task}";
  EVIDENCE.actionId = actionId;
  EVIDENCE.allowDecisionId = allowDecisionId;
});

test("H/I: the running server executed the frozen packaged artifacts, not local or alternate bytes", () => {
  requireProc("proving which bytes the production server loaded");

  // The durable store is opened through better-sqlite3, a NATIVE module. A
  // process that only claimed to use Frontera's durable store could not have
  // this mapped into its address space; a process using an in-memory store
  // would not either.
  const mapped = mappedFiles(firstServerPid);
  const sqliteBinding = mapped.find((file) => /better[_-]sqlite3.*\.node$/.test(file));
  assert.ok(
    sqliteBinding,
    `the server process mapped no better-sqlite3 native binding, so it did not open the durable authority store through the packaged runtime`,
  );
  assert.ok(
    fs.realpathSync(sqliteBinding).startsWith(fs.realpathSync(path.join(ROOT, "node_modules"))),
    `the server loaded a SQLite binding from outside this checkout: ${sqliteBinding}`,
  );
  EVIDENCE.nativeBindingMappedIntoServer = path.relative(ROOT, fs.realpathSync(sqliteBinding));
  EVIDENCE.activeProtocol = `@aoc/protocol@${installedManifest("@aoc/protocol").version}`;
  EVIDENCE.activeFrontera = `@aoc-enterprise/runtime@${installedManifest("@aoc-enterprise/runtime").version}`;

  // The store this run configured is a real, populated SQLite database. The
  // proof that the SERVER is the process reading it is not this line — it is
  // the out-of-process revocation in the next test, which the server observes
  // without being restarted or told anything.
  assert.ok(fs.statSync(STORE_PATH).size > 0, "the configured authority store is empty after a governed evaluation");
  assert.equal(
    fs.readFileSync(STORE_PATH).subarray(0, 15).toString("utf8"),
    "SQLite format 3",
    "the configured authority store is not a SQLite database",
  );

  // Identity of the artifacts resolved from the checkout the server runs out of.
  const nodeModulesRoot = fs.realpathSync(path.join(ROOT, "node_modules"));
  for (const [name, expected] of Object.entries(LAUNCH_BASELINE)) {
    assert.equal(installedManifest(name).version, expected.version, `${name}: the running root resolves a version other than the launch baseline`);
    assertResolvedFromPackagedArtifact(name, resolvePackageRoot(name), nodeModulesRoot);
  }

  // The process that produced the governed decision is the same production
  // server this test inspected — not a helper, not the launcher, and not this
  // test process. (`next start` does not export NODE_ENV; production MODE is
  // established behaviourally by the fail-closed readiness control below.)
  assert.equal(server!.serverPid, firstServerPid, "the governed decision was produced by a different process than the one inspected here");
  assert.match(cmdlineOf(firstServerPid), /next-server/, `the inspected process is not Next's production server: ${cmdlineOf(firstServerPid)}`);
  assert.equal(
    environOf(firstServerPid).get(FRONTERA_STORE_ENV),
    STORE_PATH,
    "the process that produced the governed decision was reading a different authority store",
  );
});

test("NEGATIVE CONTROL: an infrastructure outage is not accepted as a policy denial", () => {
  const outage: GovernedResponse = {
    status: 409,
    body: { disposition: "denied", failureClass: "frontera_unavailable", reason: "frontera_enforcement_denied" },
    raw: "{}",
  };
  assert.throws(
    () => asGovernedPolicyDenial(outage, "control"),
    /must come from EVALUATION, not from an outage/,
    "the policy-denial assertion accepts an outage, so every DENY in this file would be satisfiable by breaking the store",
  );
  // and the converse: a real allow must not satisfy the denial assertion either.
  assert.throws(() => asGovernedPolicyDenial({ status: 201, body: { fronteraDecisionId: "x" }, raw: "{}" }, "control"), /expected a governed 409 denial/);
});

// ═══════════════════════ K / L / M / N / O — stop, restart, survive ═══════════════════════

test("K: SIGTERM stops the production process cleanly and releases the port", async () => {
  const storeBefore = sha256File(STORE_PATH);
  const outcome = await stopProductionServer(server!, "SIGTERM");

  assert.notEqual(outcome.exitedAfterMs, null, "the production process did not exit within 30s of SIGTERM");
  assert.deepEqual(outcome.orphans, [], `SIGTERM left orphaned processes: ${outcome.orphans.join(", ")}`);
  assert.equal(await portAcceptsConnections(PORT), false, `port ${PORT} is still accepting connections after shutdown`);
  assert.equal(sha256File(STORE_PATH), storeBefore, "the durable authority store changed during shutdown");
  EVIDENCE.shutdownMethod = "SIGTERM to the process group";
  EVIDENCE.shutdownExitedAfterMs = outcome.exitedAfterMs ?? -1;
  EVIDENCE.shutdownSignal = String(outcome.signal);
  EVIDENCE.orphanProcesses = outcome.orphans.length;
  server = null;
});

test("L: a genuinely NEW production process starts from the same entrypoint", async () => {
  const outcome = await startProductionServer({ port: PORT, env: productionEnv() });
  if (!outcome.started) assert.fail(`the production server did not restart: ${outcome.reason}\n${outcome.log.slice(-4000)}`);
  server = outcome.handle;
  session.rebind(server.baseUrl);

  assert.notEqual(server.serverPid, firstServerPid, "the restart reused the original process; a same-process reopen is not a restart");
  assert.equal(pidAlive(firstServerPid), false, "the original server process is still alive after the restart");
  EVIDENCE.newPid = server.serverPid;
});

test("M: the new process becomes healthy and ready again", async () => {
  const health = await session.request("/api/health");
  assert.equal(health.status, 200, `/api/health after restart: ${health.status}`);
  assert.equal(health.json<{ status: string }>().status, "ok");

  const ready = await session.request("/api/ready");
  assert.equal(ready.status, 200, `/api/ready after restart: ${ready.status} ${ready.text.slice(0, 300)}`);
  const body = ready.json<{ status: string; checks: { name: string; status: string }[] }>();
  assert.equal(body.status, "ready");
  assert.equal(body.checks.find((check) => check.name === "database")?.status, "pass", "the restarted process cannot reach the database");
});

test("N/O: durable state survived the restart, and the new process governs with it", async () => {
  // The restarted process was told only the store PATH — nothing else about the
  // authority world. If the authority provisioned before the restart had not
  // survived in durable state, this dispatch would be denied as unbound.
  await signIn(session);
  const allowed = await dispatchGovernedAction();
  postRestartDecisionId = asGovernedAllow(allowed, "authority provisioned before the restart must still authorize after it");
  assert.notEqual(
    postRestartDecisionId,
    allowDecisionId,
    "the restarted process replayed the pre-restart decision id rather than evaluating afresh against the store",
  );

  // PMFreak's own durable state must have survived too.
  const summary = (await session.request(`/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`)).json<{
    materialActions: { id: string }[];
  }>();
  assert.ok(
    summary.materialActions.some((row) => row.id === actionId),
    "the Material Action created before the restart is no longer readable after it",
  );
  EVIDENCE.postRestartAllowDecisionId = postRestartDecisionId;
});

test("J(DENY): an operator revocation made OUT OF PROCESS is observed by the running server", async () => {
  // This is the centrepiece. The revocation is written by THIS test process,
  // directly to the store file, while the production server keeps running and
  // is never signalled, restarted or told anything. If that server were
  // consulting an in-memory world, a cached provider set, or any store other
  // than the configured one, the very next dispatch would still be allowed.
  //
  // It is done ONCE, and last, because Frontera's revocation is TERMINAL by
  // design: `decideKernelAuthorityAppend` refuses to re-provision a revoked
  // entity id ("provision a new entity id rather than reusing a revoked one").
  // A gate that revoked mid-run and then expected to restore the same grant
  // would be asserting against semantics the authority model deliberately
  // forbids.
  await revokeAuthority(STORE_PATH);

  const denied = await dispatchGovernedAction();
  asGovernedPolicyDenial(denied, "a revoked capability must deny the exact dispatch that was allowed moments ago");
  EVIDENCE.denyDecision = `${denied.status} ${String(denied.body.failureClass)}`;
});

// ═══════════════════════ P / T — fail closed ═══════════════════════

test("P: a production process missing a required server secret reports NOT READY", async () => {
  const port = await freePort();
  const outcome = await startProductionServer({ port, env: productionEnv({ SUPABASE_SERVICE_ROLE_KEY: "" }) });
  if (!outcome.started) assert.fail(`expected the process to start and report NOT READY, but: ${outcome.reason}\n${outcome.log.slice(-2000)}`);
  try {
    const response = await new HttpSession(outcome.handle.baseUrl).request("/api/ready");
    assert.equal(response.status, 503, `missing SUPABASE_SERVICE_ROLE_KEY must yield NOT READY, got ${response.status}: ${response.text.slice(0, 300)}`);
    const body = response.json<{ status: string; checks: { name: string; status: string; detail?: string }[] }>();
    assert.equal(body.status, "not_ready");
    const configuration = body.checks.find((check) => check.name === "configuration");
    assert.equal(configuration?.status, "fail", `the configuration check did not fail: ${JSON.stringify(body.checks)}`);
    // Legible to an operator, and naming the variable rather than any value.
    assert.match(String(configuration?.detail), /SUPABASE_SERVICE_ROLE_KEY/, "the failure does not name the missing variable");
    assert.doesNotMatch(response.text, /eyJ[A-Za-z0-9_-]{10,}/, "the readiness failure leaked a credential-shaped value");
  } finally {
    forceKill(outcome.handle);
  }
});

test("P: readiness fails closed when a declared dependency is misconfigured", async () => {
  const port = await freePort();
  // Enabling governance capability signing without its secret is a
  // misconfiguration the product declares as a readiness failure.
  const outcome = await startProductionServer({
    port,
    env: productionEnv({ PMFREAK_GOVERNANCE_CAPABILITY_ENABLED: "true", PMFREAK_CAPABILITY_CLAIM_SECRET: "" }),
  });
  if (!outcome.started) assert.fail(`expected NOT READY, but: ${outcome.reason}\n${outcome.log.slice(-2000)}`);
  try {
    const response = await new HttpSession(outcome.handle.baseUrl).request("/api/ready");
    assert.equal(response.status, 503, `expected NOT READY, got ${response.status}: ${response.text.slice(0, 300)}`);
    const body = response.json<{ status: string; checks: { name: string; status: string }[] }>();
    assert.equal(body.status, "not_ready");
    assert.equal(body.checks.find((check) => check.name === "governance_capability")?.status, "fail");
  } finally {
    forceKill(outcome.handle);
  }
});

test("P: an unconfigured Frontera authority store denies as an OUTAGE, never as ALLOW", async () => {
  const port = await freePort();
  const outcome = await startProductionServer({ port, env: productionEnv({ [FRONTERA_STORE_ENV]: "" }) });
  if (!outcome.started) assert.fail(`expected a running process that fails closed, but: ${outcome.reason}\n${outcome.log.slice(-2000)}`);
  try {
    const isolated = new HttpSession(outcome.handle.baseUrl);
    await signIn(isolated);
    const response = await governedPost(isolated, { operation: "dispatch_material_action_to_task", actionId });
    asGovernedInfrastructureFailure(response, "an unconfigured authority store must fail closed as an outage");
  } finally {
    forceKill(outcome.handle);
  }
});

test("P: a MALFORMED Frontera authority store is refused, never silently substituted", async () => {
  const port = await freePort();
  const outcome = await startProductionServer({ port, env: productionEnv({ [FRONTERA_STORE_ENV]: MALFORMED_STORE_PATH }) });
  if (!outcome.started) assert.fail(`expected a running process that fails closed, but: ${outcome.reason}\n${outcome.log.slice(-2000)}`);
  try {
    const isolated = new HttpSession(outcome.handle.baseUrl);
    await signIn(isolated);
    const response = await governedPost(isolated, { operation: "dispatch_material_action_to_task", actionId });
    asGovernedInfrastructureFailure(response, "a malformed authority store must fail closed rather than degrade to an in-memory substitute");
    // The malformed file must be left as it was — never repaired into a store.
    assert.equal(fs.readFileSync(MALFORMED_STORE_PATH, "utf8"), "this is not a SQLite database\n", "the runtime rewrote the malformed store file");
  } finally {
    forceKill(outcome.handle);
  }
});

// ═══════════════════════ non-vacuity controls ═══════════════════════

test("NON-VACUITY: the health probe fails when nothing is listening", async () => {
  const port = await freePort();
  await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`), "a probe against a dead port resolved, so 'healthy' proves nothing");
});

test("NON-VACUITY: the start check fails when the process cannot become healthy", async () => {
  const port = await freePort();
  // A start that is given no chance to become healthy must be reported as a
  // failure to start, not silently tolerated.
  const outcome = await startProductionServer({ port, env: productionEnv(), timeoutMs: 1_500 });
  assert.equal(outcome.started, false, "startProductionServer reported success without a healthy process");
  assert.match((outcome as { reason: string }).reason, /never became healthy|exited/);
});

test("NON-VACUITY: durable-state survival fails against an EMPTY authority store", async () => {
  const port = await freePort();
  // Same code path, same running product, only the durable state is absent. If
  // this still allowed, the survival claim in N/O would be worthless.
  const outcome = await startProductionServer({ port, env: productionEnv({ [FRONTERA_STORE_ENV]: EMPTY_STORE_PATH }) });
  if (!outcome.started) assert.fail(`control server did not start: ${outcome.reason}\n${outcome.log.slice(-2000)}`);
  try {
    const isolated = new HttpSession(outcome.handle.baseUrl);
    await signIn(isolated);
    const response = await governedPost(isolated, { operation: "dispatch_material_action_to_task", actionId });
    assert.equal(response.body.disposition, "denied", `an empty authority store must not authorize: ${response.raw.slice(0, 300)}`);
    assert.equal(
      response.body.failureClass,
      "frontera_actor_unbound",
      `an empty store must leave the principal unbound, not produce a policy answer: ${response.raw.slice(0, 300)}`,
    );
    assert.throws(() => asGovernedAllow(response, "control"), /fronteraDecisionId|denied/);
  } finally {
    forceKill(outcome.handle);
  }
});

test("NON-VACUITY: the local-fallback guards reject a redirected tree", () => {
  // The SAME functions the acceptance uses, handed the states they exist to
  // catch. No file is mutated: the guards are pure, so the redirect can be
  // expressed as an argument instead of as damage to the checkout.
  const nodeModulesRoot = fs.realpathSync(path.join(ROOT, "node_modules"));

  assert.throws(
    () => assertNoUpstreamAliasRedirect(["@/*", "@aoc/protocol", "@aoc/protocol/*"]),
    /@aoc\/protocol could redirect/,
    "a tsconfig alias onto @aoc/protocol is accepted, so an alias redirect would pass unnoticed",
  );
  assert.throws(
    () => assertNoUpstreamAliasRedirect(["@aoc-enterprise/runtime"]),
    /@aoc-enterprise\/runtime could redirect/,
    "a tsconfig alias onto @aoc-enterprise/runtime is accepted",
  );
  assert.throws(
    () => assertNoPrivateFronteraDependency(["next", "@aoc-enterprise/governed-authority"]),
    /must reach PMFreak only as a bundled dependency/,
    "a direct dependency on a Frontera internal is accepted, so the packaged boundary could be bypassed",
  );
  assert.throws(
    () => assertResolvedFromPackagedArtifact("@aoc/protocol", path.join(ROOT, "src/aoc/protocol/package.json"), nodeModulesRoot),
    /outside this checkout's node_modules/,
    "a resolution into repository-local source is accepted, so a local fallback would pass unnoticed",
  );
  assert.throws(
    () => assertResolvedFromPackagedArtifact("@aoc/protocol", path.join(nodeModulesRoot, "..", "src", "aoc", "protocol", "package.json"), nodeModulesRoot),
    /outside this checkout's node_modules/,
  );

  // and the guards must still accept the genuine tree, or they are merely broken.
  assertNoUpstreamAliasRedirect(["@/*"]);
  assertNoPrivateFronteraDependency(["next", "react"]);
  assertResolvedFromPackagedArtifact("@aoc/protocol", path.join(nodeModulesRoot, "@aoc/protocol/package.json"), nodeModulesRoot);
});
