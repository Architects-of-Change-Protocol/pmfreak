/**
 * Shared production-runtime acceptance helpers.
 *
 * EXTRACTED, VERBATIM, from
 * `tests/acceptance/p0-launch-03-production-runtime-acceptance.test.ts` by
 * P0-LAUNCH-04. Not one line of behaviour was changed: the bodies below are the
 * same bytes P0-LAUNCH-03 was accepted with, and P0-LAUNCH-03 now imports them
 * from here instead of declaring them itself.
 *
 * WHY EXTRACT AT ALL. P0-LAUNCH-04 needs the same process lifecycle
 * (`startProductionServer`, `shutdownProductionServer`, the `/proc` evidence,
 * the residue ledger) and the same decision vocabulary
 * (`asGovernedAllow` / `asGovernedPolicyDenial` /
 * `asGovernedInfrastructureFailure`). Copying ~500 lines into a second
 * acceptance file would give the two gates two subtly diverging definitions of
 * "the production process came down cleanly", which is precisely the kind of
 * drift these gates exist to catch. One definition, two callers.
 *
 * The counters and the residue ledger are per-module-instance, and each gate
 * runs in its own process, so the two gates never share a ledger.
 *
 * Nothing in `src/` imports this file, and nothing here reads test state: every
 * function is either pure or parameterised by its caller.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const ROOT = process.cwd();

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls a condition to a deadline. Returns whether it came true in time. */
export async function waitUntil(condition: () => boolean, timeoutMs: number, intervalMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return true;
    await sleep(intervalMs);
  }
  return condition();
}

/**
 * EVERY HTTP REQUEST THIS GATE MAKES IS BOUNDED.
 *
 * A bare `fetch` against a process that ACCEPTS the connection and then never
 * answers stays pending forever — a socket server that accepts and never writes
 * leaves it unsettled indefinitely, which is not a hypothesis about slow
 * machines but the observable behaviour of an unbounded request. That is
 * precisely the broken-startup shape the startup probe exists to DIAGNOSE, and
 * an unbounded probe there parks the `await` so the surrounding deadline is
 * never re-checked and the server is never killed: the gate hangs instead of
 * returning a failed `StartOutcome`.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const HEALTH_PROBE_TIMEOUT_MS = 10_000;

export function boundedFetch(url: string, init: RequestInit = {}, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): Promise<Response> {
  const timeout = AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs)));
  return fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
}

/** A one-line, non-secret description of why a request did not answer. */
export function describeRequestFailure(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    return code ? `${error.name}: ${code}` : `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * A cookie jar over fetch.
 *
 * The Founder session is a real Supabase SSR cookie pair written by
 * `POST /api/login`, not a bearer token this file could mint. Redirects are
 * manual so the Set-Cookie on the post-login redirect is not swallowed.
 */
export class HttpSession {
  private readonly cookies = new Map<string, string>();
  constructor(private baseUrl: string) {}

  rebind(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  async request(
    pathname: string,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<{ status: number; text: string; json: <T = unknown>() => T }> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const response = await boundedFetch(`${this.baseUrl}${pathname}`, { ...init, headers, redirect: "manual" }, timeoutMs);
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

export async function freePort(): Promise<number> {
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

export async function portAcceptsConnections(port: number): Promise<boolean> {
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

export const PROC_AVAILABLE = fs.existsSync("/proc/self/stat");

export function requireProc(what: string): void {
  assert.ok(PROC_AVAILABLE, `${what} requires /proc (Linux). This environment cannot produce the evidence, so the claim is not made.`);
}

export function descendantPids(root: number): number[] {
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

export const readProc = (pid: number, file: string): string => {
  try {
    return fs.readFileSync(`/proc/${pid}/${file}`, "utf8");
  } catch {
    return "";
  }
};

export const cmdlineOf = (pid: number) => readProc(pid, "cmdline").replace(/\0/g, " ").trim();

export function environOf(pid: number): Map<string, string> {
  const env = new Map<string, string>();
  for (const entry of readProc(pid, "environ").split("\0")) {
    const eq = entry.indexOf("=");
    if (eq > 0) env.set(entry.slice(0, eq), entry.slice(eq + 1));
  }
  return env;
}

/** Files mapped into the process's address space — native modules it actually dlopen'd. */
export function mappedFiles(pid: number): string[] {
  const out = new Set<string>();
  for (const line of readProc(pid, "maps").split("\n")) {
    const idx = line.indexOf("/");
    if (idx > 0) out.add(line.slice(idx).trim());
  }
  return [...out];
}

/**
 * The scheduler state of a process: `R`/`S`/`D` while it is still running, `Z`
 * once it has terminated and is waiting for its parent to collect it, and null
 * when the table entry is gone.
 *
 * The distinction is the whole of the reaping fix. A zombie is NOT a running
 * process — waiting for one to "die" waits for something only its parent can
 * do — but it is also not nothing: on a machine whose PID 1 does not reap
 * adopted children, a gate that signalled a process group and returned
 * immediately would accumulate table entries across runs while reporting zero
 * orphans. So the two are counted separately and both are reported.
 */
export function processState(pid: number): string | null {
  const stat = readProc(pid, "stat");
  if (stat === "") return null;
  return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0] ?? null;
}

export const pidAlive = (pid: number) => {
  const state = processState(pid);
  return state !== null && state !== "Z";
};
export const pidUnreaped = (pid: number) => processState(pid) === "Z";
export const runningPids = (pids: readonly number[]) => pids.filter(pidAlive);
export const unreapedPids = (pids: readonly number[]) => pids.filter(pidUnreaped);

/**
 * Process-table residue this gate could not account for, recorded as it is
 * observed and asserted empty by a control at the bottom of this file. A count
 * measured only around the graceful-shutdown test would say nothing about the
 * eight other production processes this gate starts.
 */
export const HARNESS_PROCESS_RESIDUE: { control: string; orphans: number[]; unreaped: number[] }[] = [];
export let PRODUCTION_PROCESSES_STARTED = 0;

/**
 * Kills a launcher's process GROUP and WAITS for it.
 *
 * `process.kill` only DELIVERS a signal. Sending SIGKILL and returning leaves
 * the launcher in state `Z` at the moment of return — observably, not in
 * theory — so a caller that checked for stragglers right afterwards would be
 * sampling a tree that had not finished coming down.
 */
export async function reapProcessGroup(
  launcherPid: number | undefined,
  hasExited: () => boolean,
  timeoutMs = 10_000,
): Promise<{ reaped: boolean; survivors: number[]; unreaped: number[] }> {
  if (!launcherPid) return { reaped: true, survivors: [], unreaped: [] };
  // Recorded BEFORE the signal: afterwards the tree is being dismantled, and a
  // descendant already re-parented can no longer be found by walking down.
  const recorded = [launcherPid, ...descendantPids(launcherPid)].filter((pid, index, all) => all.indexOf(pid) === index);

  try {
    process.kill(-launcherPid, "SIGKILL");
  } catch {
    /* already gone */
  }
  // Directly as well as by group: a descendant that left the group cannot be
  // reached by the group signal, and it is exactly the one that would survive.
  for (const pid of recorded) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }

  await waitUntil(() => hasExited() && runningPids(recorded).length === 0, timeoutMs);
  // Zombies clear only when their parent collects them, so wait briefly and
  // then REPORT rather than block for a budget that cannot help.
  await waitUntil(() => unreapedPids(recorded).length === 0, 2_000);

  const survivors = runningPids(recorded);
  return { reaped: hasExited() && survivors.length === 0, survivors, unreaped: unreapedPids(recorded) };
}

// ───────────────────────────── server lifecycle ─────────────────────────────

export type ServerHandle = {
  readonly launcherPid: number;
  readonly serverPid: number;
  readonly port: number;
  readonly baseUrl: string;
  readonly child: ChildProcess;
  readonly healthyAfterMs: number;
  log(): string;
  exitStatus(): { code: number | null; signal: NodeJS.Signals | null } | null;
};

export type FailedStart = {
  readonly started: false;
  readonly reason: string;
  readonly log: string;
  readonly launcherPid: number | null;
  readonly reaped: boolean;
  readonly survivors: number[];
};

export type StartOutcome = { readonly started: true; readonly handle: ServerHandle } | FailedStart;

/**
 * Starts PMFreak through its SUPPORTED production entrypoint: `npm run start`,
 * which is `next start`. Never `next dev`.
 *
 * `detached: true` puts the launcher and the server it spawns in their own
 * process group, so shutdown can signal the GROUP — which is what a container
 * runtime or a process supervisor does, and the only way to observe whether a
 * child is left orphaned.
 */
export async function startProductionServer(options: {
  port: number;
  env: NodeJS.ProcessEnv;
  timeoutMs?: number;
  /**
   * The npm script that starts the server. Defaults to `start`, which is what
   * every caller before P0-LAUNCH-05 used and what they all still get.
   *
   * It exists so a gate can exercise a DIFFERENT supported entrypoint —
   * `start:closed-free-beta`, which runs the beta preflight before
   * `next start` — through this one lifecycle rather than growing a second.
   * Process spawning, the health-probe deadline, server-pid discovery,
   * shutdown and the residue ledger are shared, so evidence about a beta
   * process is produced by exactly the same machinery that produced every
   * predecessor's, and a failed beta start is reaped and counted identically.
   */
  script?: string;
}): Promise<StartOutcome> {
  const { port, env } = options;
  const script = options.script ?? "start";
  const timeoutMs = options.timeoutMs ?? 180_000;
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn("npm", ["run", script, "--", "--port", String(port)], {
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

  PRODUCTION_PROCESSES_STARTED += 1;
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let healthy = false;
  let lastProbe = "no probe was attempted before the deadline expired";
  while (!state.exit) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      // Bounded by the SMALLER of the per-probe budget and what is left of the
      // startup deadline, so one request can never outlive the deadline it is
      // supposed to be checked against. A process that accepts the connection
      // and never answers is the case this exists for: it now fails the probe
      // and the loop returns to the deadline, instead of parking here forever.
      const response = await boundedFetch(`${baseUrl}/api/health`, {}, Math.min(HEALTH_PROBE_TIMEOUT_MS, remaining));
      const body = await response.text();
      if (response.ok) {
        healthy = true;
        break;
      }
      lastProbe = `/api/health answered ${response.status}: ${body.slice(0, 200)}`;
    } catch (error) {
      lastProbe = describeRequestFailure(error);
    }
    await sleep(Math.max(0, Math.min(400, deadline - Date.now())));
  }

  if (!healthy) {
    // WHY THE EXIT STATUS IS READ BEFORE THE SHUTDOWN. Whether the process died
    // on its own or was still running when the deadline expired is decided by
    // the state at THIS point. Reading it after the shutdown below — which now
    // awaits the exit rather than signalling and returning — would report the
    // SIGKILL this helper itself just sent, and every failed start would be
    // described as "the process exited (signal SIGKILL)" no matter why it
    // failed. That is not hypothetical: it is what this returned before the
    // zero-deadline control caught it.
    const exitedOnItsOwn = state.exit;
    const reaping = await reapProcessGroup(child.pid, () => state.exit !== null);
    return {
      started: false,
      log,
      launcherPid: child.pid ?? null,
      reaped: reaping.reaped,
      survivors: reaping.survivors,
      reason: exitedOnItsOwn
        ? `the process exited (code ${exitedOnItsOwn.code}, signal ${exitedOnItsOwn.signal}) before it became healthy`
        : `the process never became healthy within ${timeoutMs}ms (last probe: ${lastProbe})`,
    };
  }

  const launcherPid = child.pid!;
  // The supported command is an npm script, so the process tree is
  //   npm  ->  sh -c "[preflight &&] next start --port N"  ->  next-server (vX.Y.Z)
  // For `start:closed-free-beta` the preflight has already exited by the time
  // this runs — it is awaited by the `&&` before `next start` is reached, and
  // this line is only reached once /api/health has answered.
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

export type ShutdownOutcome = {
  readonly exitedAfterMs: number | null;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly escalated: boolean;
  readonly orphans: number[];
  readonly unreaped: number[];
};

/**
 * Stops the process GROUP the way a supervisor or `docker stop` would — and
 * then WAITS for the tree to come down.
 *
 * EVERY production process this gate starts is stopped through this one path,
 * the fail-closed controls included. The previous arrangement had two: a
 * graceful stop used by one test, and a fire-and-forget SIGKILL used by the
 * five controls and the final hook, which signalled the group and returned
 * before anything had exited. Only the first reported stragglers, so the
 * gate's "zero orphans" covered a single shutdown out of nine.
 *
 * The ladder is: signal, await the handle this gate owns and the descendants it
 * recorded, escalate ONCE to SIGKILL if that did not take, then await reaping
 * and report whatever is left — running (`orphans`) and terminated-but-uncollected
 * (`unreaped`) counted apart.
 */
export async function shutdownProductionServer(
  handle: ServerHandle,
  options: { label: string; signal?: NodeJS.Signals; graceMs?: number; reapMs?: number },
): Promise<ShutdownOutcome> {
  const signal = options.signal ?? "SIGTERM";
  const graceMs = options.graceMs ?? 30_000;
  const reapMs = options.reapMs ?? 10_000;

  const recorded = [handle.serverPid, handle.launcherPid, ...descendantPids(handle.launcherPid)].filter(
    (pid, index, all) => all.indexOf(pid) === index,
  );

  const startedAt = Date.now();
  try {
    process.kill(-handle.launcherPid, signal);
  } catch {
    /* already dead */
  }

  // 1. Await the handle, and the descendants that are not this process's to await.
  await waitUntil(() => handle.exitStatus() !== null && runningPids(recorded).length === 0, graceMs);
  // Read BEFORE any escalation, so `exitedAfterMs` answers the question the
  // graceful-shutdown test actually asks: did the signal SENT stop it in time?
  const status = handle.exitStatus();
  const exitedAfterMs = status === null ? null : Date.now() - startedAt;

  // 2. Escalate exactly once, and only if graceful termination did not take. A
  //    shutdown that always escalated could not tell a clean stop from a hung one.
  let escalated = false;
  if (status === null || runningPids(recorded).length > 0) {
    escalated = true;
    await reapProcessGroup(handle.launcherPid, () => handle.exitStatus() !== null, reapMs);
  }

  // 3. Await reaping rather than sampling once.
  await waitUntil(() => runningPids(recorded).length === 0, reapMs);
  await waitUntil(() => unreapedPids(recorded).length === 0, 2_000);

  const outcome: ShutdownOutcome = {
    exitedAfterMs,
    code: status?.code ?? null,
    signal: status?.signal ?? null,
    escalated,
    orphans: runningPids(recorded),
    unreaped: unreapedPids(recorded),
  };
  if (outcome.orphans.length > 0 || outcome.unreaped.length > 0) {
    HARNESS_PROCESS_RESIDUE.push({ control: options.label, orphans: outcome.orphans, unreaped: outcome.unreaped });
  }
  return outcome;
}

// ───────────────────────── governed-operation helpers ─────────────────────────

export type GovernedResponse = { status: number; body: Record<string, unknown>; raw: string };

/**
 * The product's own decision vocabulary as it reaches an HTTP caller.
 *
 * The route deliberately withholds Frontera's reason codes from clients — they
 * are what an operator needs and precisely what an arbitrary caller should not
 * learn about another system's authority structure. What DOES cross the
 * boundary is the failure class, and that is the distinction this file needs:
 * `frontera_denied` is a policy answer, `frontera_unavailable` is an outage.
 */
export function asGovernedAllow(response: GovernedResponse, why: string): string {
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
export function asGovernedPolicyDenial(response: GovernedResponse, why: string): void {
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

export function asGovernedInfrastructureFailure(response: GovernedResponse, why: string): void {
  assert.equal(response.status, 409, `${why} — expected a fail-closed 409, got ${response.status}: ${response.raw.slice(0, 300)}`);
  assert.equal(response.body.disposition, "denied", `${why} — expected a fail-closed denial: ${response.raw.slice(0, 300)}`);
  assert.equal(
    response.body.failureClass,
    "frontera_unavailable",
    `${why} — an unusable authority dependency must be reported as an outage, never as a policy answer and never as ALLOW. Got failureClass=${String(response.body.failureClass)}`,
  );
}

/**
 * How many production processes this module has started in this process.
 *
 * An accessor rather than a bare re-read of the exported binding, so a caller
 * can never accidentally capture the count at import time and report zero.
 */
export const productionProcessesStarted = (): number => PRODUCTION_PROCESSES_STARTED;
