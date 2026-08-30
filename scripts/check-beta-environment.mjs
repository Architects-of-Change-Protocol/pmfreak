import { assertClosedFreeBetaEnvSafety, evaluateClosedFreeBetaEnvSafety } from "../src/lib/security/environment.ts";

/**
 * The supported closed-free-beta preflight. `npm run start:closed-free-beta`
 * runs this and only reaches `next start` on exit 0.
 *
 * The refusal names WHICH guard rejected. `assertClosedFreeBetaEnvSafety()`
 * invokes `assertServerOnlyEnvBoundary()` first and both guards reject a
 * secret-shaped NEXT_PUBLIC_ name, so reporting only the beta violation codes
 * made the sibling's execution unobservable — the evidence needed to prove it
 * actually runs was being discarded here.
 *
 * Output stays name-only: the guard's identity, violation CODES, and a message
 * that names offending VARIABLES. No environment value is ever echoed.
 */
try {
  assertClosedFreeBetaEnvSafety();
  process.stdout.write(`${JSON.stringify({ ok: true, profile: "closed-free-beta", stripeRequired: false, guardsEnforced: ["assertServerOnlyEnvBoundary", "evaluateClosedFreeBetaEnvSafety"] })}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      failureClass: "CONFIGURATION_FAILURE",
      guard: error?.guard ?? "unknown",
      reason: error?.message ?? String(error),
      violations: evaluateClosedFreeBetaEnvSafety().map(({ code }) => code),
    })}\n`,
  );
  process.exitCode = 1;
}
