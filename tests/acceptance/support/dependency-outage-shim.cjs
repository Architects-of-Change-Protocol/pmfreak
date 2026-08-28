/**
 * P0-LAUNCH-04 — a TOGGLEABLE, per-process dependency outage, installed by the
 * failure/recovery gate into ONE production server via NODE_OPTIONS=--require.
 *
 * WHY A NEW SHIM RATHER THAN P0-LAUNCH-03'S. That one is decided once, at
 * preload time, from an environment variable: the process it is installed in is
 * born with its database already unreachable and can never get it back. That is
 * exactly right for the claim P0-LAUNCH-03 makes ("liveness stays up while the
 * database is down") and useless for the claim P0-LAUNCH-04 makes, which is a
 * TRANSITION observed inside ONE process:
 *
 *     READY -> dependency lost -> NOT READY -> dependency restored -> READY
 *
 * with the same pid at both ends. So availability here is a control FILE the
 * harness creates and deletes while the server runs, re-read on every attempt.
 * `existsSync` per attempt is deliberate: any cached answer would be a second
 * source of truth about whether the outage is currently installed, and the one
 * thing this file must never do is disagree with the harness about that.
 *
 * WHY TWO SCOPES.
 *
 *   SOCKET scope refuses every outbound TCP connection to one host:port, the way
 *   a stopped service refuses one. That is the honest shape of "the dependency
 *   is gone", and it is the mechanism P0-LAUNCH-03 was accepted with (the
 *   `destinationOf` normalisation below is its code, unchanged, including the
 *   ARRAY case that `net.createConnection` — and therefore undici, and therefore
 *   `fetch` — actually calls with).
 *
 *   PATH scope refuses `fetch` for URL path prefixes only. It exists because the
 *   local Supabase stack puts PostgREST (`/rest/v1`) and GoTrue (`/auth/v1`)
 *   behind ONE gateway on ONE host:port, so a socket-level outage cannot
 *   separate them — a gate built only on the socket scope would have to call
 *   "the whole stack is down" an authentication outage. Separate containers
 *   behind one gateway is the real deployment shape, and one of them failing
 *   while the other serves is the real failure this scope reproduces.
 *
 * Both scopes announce every refusal on stderr, so the harness can prove from
 * the server's OWN log that the dependency was REACHED FOR and refused, rather
 * than that some earlier check happened to fail first and the outage was never
 * exercised at all.
 *
 * Nothing else is intercepted: the server's own listening socket is untouched,
 * and so is every other destination and every other URL.
 */
// This file is CommonJS by necessity: it is loaded as a NODE_OPTIONS=--require
// preload, which ESM cannot serve, so `require` is the only way to reach node:net.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload */
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
/* eslint-enable @typescript-eslint/no-require-imports */

const controlDir = String(process.env.P0_LAUNCH_04_OUTAGE_DIR || "").trim();
if (!controlDir) {
  throw new Error("P0_LAUNCH_04_OUTAGE_DIR must be set to the control directory for the dependency-outage shim");
}

const target = String(process.env.P0_LAUNCH_04_OUTAGE_HOSTPORT || "").trim();
const separator = target.lastIndexOf(":");
if (separator <= 0) {
  throw new Error("P0_LAUNCH_04_OUTAGE_HOSTPORT must be set to host:port for the dependency-outage shim");
}
const blockedHost = target.slice(0, separator);
const blockedPort = target.slice(separator + 1);

const pathPrefixes = String(process.env.P0_LAUNCH_04_OUTAGE_PATH_PREFIXES || "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

// The two switches. Presence is the whole protocol — no content is read, so a
// partially written file can never be mistaken for a half-installed outage.
const SOCKET_OUTAGE_FLAG = path.join(controlDir, "socket-outage");
const PATH_OUTAGE_FLAG = path.join(controlDir, "path-outage");

const flagPresent = (file) => {
  try {
    return fs.existsSync(file);
  } catch {
    // An unreadable control directory must not silently mean "no outage": that
    // would report a passing dependency during an outage the harness believes it
    // installed. Fail towards the outage instead.
    return true;
  }
};

// ───────────────────────────── SOCKET scope ─────────────────────────────

const realConnect = net.Socket.prototype.connect;

/**
 * Sockets currently open to the blocked destination.
 *
 * REFUSING NEW CONNECTIONS IS NOT AN OUTAGE. `Socket.prototype.connect` is
 * called once per TCP connection, and undici keeps connections ALIVE per origin
 * and reuses them, so a shim that only refuses `connect` leaves every socket
 * that was already established fully working. That is not a hypothesis: the
 * first run of this gate observed readiness correctly reporting the database
 * unreachable (its probe needed a new connection) while a governed dispatch in
 * the SAME process succeeded and created a Task over a pooled socket — an
 * "outage" during which the database was still, demonstrably, reachable.
 *
 * A service that stops does both things: it refuses new connections AND drops
 * the ones it was holding. So established sockets to the blocked destination are
 * tracked here and reset when the outage is switched on.
 */
const liveSockets = new Set();
let outageEnforced = false;

function enforceSocketOutage() {
  const active = flagPresent(SOCKET_OUTAGE_FLAG);
  if (active && !outageEnforced) {
    outageEnforced = true;
    let reset = 0;
    for (const socket of [...liveSockets]) {
      liveSockets.delete(socket);
      const error = new Error(`read ECONNRESET ${blockedHost}:${blockedPort}`);
      error.code = "ECONNRESET";
      error.errno = -104;
      error.syscall = "read";
      try {
        socket.destroy(error);
        reset += 1;
      } catch {
        /* already gone */
      }
    }
    process.stderr.write(`P0_LAUNCH_04_SOCKET_OUTAGE_RESET ${reset}\n`);
  } else if (!active && outageEnforced) {
    outageEnforced = false;
    process.stderr.write(`P0_LAUNCH_04_SOCKET_OUTAGE_LIFTED ${blockedHost}:${blockedPort}\n`);
  }
}

// Unref'd, so this timer can never be the reason the server process stays alive.
setInterval(enforceSocketOutage, 100).unref();

/**
 * Normalises every shape `Socket.prototype.connect` is called with.
 *
 * The ARRAY case is the one that matters and the one that is easy to miss:
 * Node's own `net.createConnection` — which is what `undici`, and therefore
 * `fetch`, goes through — calls `socket.connect(normalizeArgs(args))`, passing
 * a single `[options, callback]` array. A shim that only understood the
 * documented `(options)` and `(port, host)` forms would silently pass every
 * `fetch` straight through, and the outage it claimed to install would be
 * imaginary.
 */
function destinationOf(args) {
  const [first, second] = args;
  if (Array.isArray(first)) return destinationOf(first);
  if (first && typeof first === "object") {
    return { host: first.host, port: first.port };
  }
  if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    return { host: typeof second === "string" ? second : undefined, port: first };
  }
  return { host: undefined, port: undefined }; // an IPC path: never the dependency
}

net.Socket.prototype.connect = function connect(...args) {
  const { host, port } = destinationOf(args);
  const hostMatches = host === undefined ? blockedHost === "127.0.0.1" || blockedHost === "localhost" : String(host) === blockedHost;
  const isBlockedDestination = hostMatches && String(port) === blockedPort;
  // Enforce synchronously as well as on the timer, so a connect attempt made in
  // the same tick the flag appeared cannot slip through on a pooled socket.
  if (isBlockedDestination) enforceSocketOutage();
  if (isBlockedDestination && flagPresent(SOCKET_OUTAGE_FLAG)) {
    process.stderr.write(`P0_LAUNCH_04_SOCKET_OUTAGE_BLOCKED ${blockedHost}:${blockedPort}\n`);
    // Fail the way a stopped service does, asynchronously, so callers observe
    // a normal connection error rather than a synchronous throw they never
    // expected. `undici` turns this into the fetch TypeError the probe catches.
    process.nextTick(() => {
      const error = new Error(`connect ECONNREFUSED ${blockedHost}:${blockedPort}`);
      error.code = "ECONNREFUSED";
      error.errno = -111;
      error.syscall = "connect";
      error.address = blockedHost;
      error.port = Number(blockedPort);
      this.destroy(error);
    });
    return this;
  }
  if (isBlockedDestination) {
    // Tracked so that switching the outage on can drop it, the way a stopped
    // service drops the connections it was holding.
    liveSockets.add(this);
    this.once("close", () => liveSockets.delete(this));
  }
  return realConnect.apply(this, args);
};

// ────────────────────────────── PATH scope ──────────────────────────────

const realFetch = globalThis.fetch;

/**
 * The URL a `fetch` call is actually for, across every input shape.
 *
 * A `Request` object carries `.url`; a `URL` stringifies; a string is itself.
 * Anything unrecognisable returns null and is passed through — guessing would
 * risk refusing a request this scope was never meant to touch.
 */
function urlOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input === "object" && typeof input.url === "string") return input.url;
  return null;
}

function blockedPathPrefix(rawUrl) {
  if (pathPrefixes.length === 0 || rawUrl === null) return null;
  let pathname;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  return pathPrefixes.find((prefix) => pathname.startsWith(prefix)) ?? null;
}

globalThis.fetch = function fetch(input, init) {
  const rawUrl = urlOf(input);
  const prefix = blockedPathPrefix(rawUrl);
  if (prefix !== null && flagPresent(PATH_OUTAGE_FLAG)) {
    const pathname = new URL(rawUrl).pathname;
    process.stderr.write(`P0_LAUNCH_04_PATH_OUTAGE_BLOCKED ${prefix} ${pathname}\n`);
    // The shape `undici` produces when a connection cannot be made, because
    // that is what every caller downstream is written to classify. Supabase's
    // auth client turns a rejected fetch into AuthRetryableFetchError with
    // status 0 — a TRANSPORT failure, not a 401 — which is precisely the
    // distinction the product's own auth paths branch on.
    return Promise.reject(new TypeError("fetch failed"));
  }
  return realFetch.call(this, input, init);
};

process.stderr.write(
  `P0_LAUNCH_04_OUTAGE_SHIM_ACTIVE ${blockedHost}:${blockedPort} paths=${pathPrefixes.join("|") || "(none)"} control=${controlDir}\n`,
);
