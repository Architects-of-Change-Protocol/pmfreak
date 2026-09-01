/**
 * Next.js server instrumentation — the in-process closed-free-beta environment guard.
 *
 * `register()` is called ONCE when a new Next.js server instance is initiated and
 * must complete before the server is ready to handle requests, so throwing here
 * prevents the beta surface from ever becoming operational.
 *
 * WHY THIS EXISTS. Until now the closed-free-beta environment contract was enforced
 * only by `npm run start:closed-free-beta`, which runs the preflight before
 * `next start`. Any other way of starting the same application — a bare
 * `next start`, or a platform that boots Next.js itself rather than through that
 * npm script — bypassed the contract entirely. Moving the SAME canonical guard
 * inside the runtime makes enforcement independent of which command launched
 * Next.js. See RR-BETA-PREFLIGHT-BYPASSABLE.
 *
 * WHAT IT DOES NOT CLAIM. This is a RUNTIME boundary, not a deployment-time one.
 * It proves that a certified Next.js server runtime carrying this hook cannot
 * serve the beta surface under an invalid beta environment. It does NOT claim
 * that a deployment is rejected before deploy, nor that every conceivable
 * topology is covered — only the runtime that loads this file.
 *
 * PROFILE-SCOPED ON PURPOSE. It runs `assertClosedFreeBetaEnvSafety` and only
 * under `PMFREAK_OPERATING_PROFILE=closed-free-beta`. It deliberately does NOT
 * invoke `assertProductionEnvSafety()`: that helper requires Stripe secrets the
 * closed free beta intentionally does not have, so wiring it here would refuse to
 * start the very posture P0-LAUNCH-05 accepted. The full-production runtime guard
 * remains uncertified — see RR-PRODUCTION-ENV-GUARD.
 */
export async function register() {
  // The guard reads server-only configuration and must not run on the edge
  // runtime, where that configuration is not present. Next.js calls `register`
  // in every environment, so the runtime is checked explicitly.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PMFREAK_OPERATING_PROFILE !== "closed-free-beta") return;

  // Imported dynamically so the edge bundle never pulls in server-only code.
  const { assertClosedFreeBetaEnvSafety } = await import("@/lib/security/environment");

  // Deliberately NOT wrapped: an invalid beta environment must fail closed and
  // stop the server from becoming ready. The thrown message names offending
  // VARIABLES only — never their values.
  assertClosedFreeBetaEnvSafety();
}
