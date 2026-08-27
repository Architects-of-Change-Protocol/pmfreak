/**
 * P0-LAUNCH-03 — a per-process database outage, installed by the acceptance
 * harness into ONE production server via NODE_OPTIONS=--require.
 *
 * WHY A SHIM AND NOT AN ENVIRONMENT OVERRIDE. The readiness database probe
 * reads NEXT_PUBLIC_SUPABASE_URL, and Next inlines every NEXT_PUBLIC_* value
 * into the SERVER bundle at build time — a search of .next/server for
 * `process.env.NEXT_PUBLIC_SUPABASE_URL` finds no surviving runtime lookup.
 * Re-pointing that variable in the child environment therefore changes
 * nothing, and a control built on it would report a passing database probe
 * while claiming an outage. Rebuilding the application against a dead endpoint
 * would prove the claim about a DIFFERENT build than the one under acceptance.
 *
 * So the outage is made real at the socket layer, for this process only: every
 * outbound TCP connection to the configured host:port is refused exactly as a
 * stopped service refuses one. Nothing else is intercepted — the server's own
 * listening socket is unaffected, and so is every other destination.
 *
 * Each refusal is announced on stderr, so the harness can prove from the
 * server's own log that the readiness probe REACHED for the database and was
 * refused, rather than that some earlier check happened to fail first.
 */
const net = require("node:net");

const target = String(process.env.P0_LAUNCH_03_UNREACHABLE_HOSTPORT || "").trim();
const separator = target.lastIndexOf(":");
if (separator <= 0) {
  throw new Error("P0_LAUNCH_03_UNREACHABLE_HOSTPORT must be set to host:port for the database-outage shim");
}
const blockedHost = target.slice(0, separator);
const blockedPort = target.slice(separator + 1);

const realConnect = net.Socket.prototype.connect;

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
  return { host: undefined, port: undefined }; // an IPC path: never the database
}

net.Socket.prototype.connect = function connect(...args) {
  const { host, port } = destinationOf(args);
  const hostMatches = host === undefined ? blockedHost === "127.0.0.1" || blockedHost === "localhost" : String(host) === blockedHost;
  if (hostMatches && String(port) === blockedPort) {
    process.stderr.write(`P0_LAUNCH_03_DATABASE_OUTAGE_BLOCKED ${blockedHost}:${blockedPort}\n`);
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
  return realConnect.apply(this, args);
};

process.stderr.write(`P0_LAUNCH_03_DATABASE_OUTAGE_SHIM_ACTIVE ${blockedHost}:${blockedPort}\n`);
