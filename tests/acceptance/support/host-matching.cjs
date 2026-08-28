/**
 * Host normalisation for the dependency-outage shim, in its own module so it can
 * be exercised WITHOUT executing the shim.
 *
 * The shim itself is a `NODE_OPTIONS=--require` preload: importing it patches
 * `net.Socket.prototype.connect` and `globalThis.fetch` and throws unless the
 * outage control environment is set. So a test that imported the shim to reach
 * this function would either fail outright or silently install an outage in the
 * test process. One definition, required by the shim, importable by a control.
 */

/**
 * Normalises a host for comparison.
 *
 * IPv6 loopback is the case that matters. A URL carries it BRACKETED
 * (`http://[::1]:54321`), so `new URL(...).hostname` — and therefore the
 * host:port the shim is configured with — can be `[::1]`, while Node reports the
 * socket's destination as the bare `::1`. An exact comparison then never
 * recognises the dependency's socket, so the outage flag would block and reset
 * nothing while the gate believed an outage was installed. The repository's
 * isolation guard explicitly accepts IPv6 loopback, so the shim must not accept
 * that environment and then quietly fail to match it.
 *
 * Only bracket stripping and case are normalised. Host matching is not otherwise
 * weakened: no prefix matching, no aliasing of distinct addresses.
 */
function normalizeHost(host) {
  const value = String(host).trim().toLowerCase();
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

module.exports = { normalizeHost };
