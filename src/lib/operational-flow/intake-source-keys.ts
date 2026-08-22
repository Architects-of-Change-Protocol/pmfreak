/**
 * P2-14 repair — canonical Source identity for the two BUILT-IN intake lineages.
 *
 * A Source's `is_fixture` flag is the single fact `derive_operational_evidence` reads to
 * stamp `fixture_state`, so whoever chooses the source key chooses whether the resulting
 * Evidence is DEMO_FIXTURE or LIVE. Before this module the browser chose it: the intake
 * operations forwarded a caller-supplied `sourceKey` verbatim, and because each capture
 * contract MINTS its own Source on first use, a caller could create a non-fixture Source
 * under the DEMO key (laundering later demo input into Observation-eligible LIVE Evidence)
 * or a fixture Source under the LIVE key (permanently refusing genuine live intake, with
 * no application repair path for `operational_sources`).
 *
 * The semantic key is therefore server-owned. The browser communicates the MODE it chose
 * — which is what a human actually decides — and the server resolves the identity that
 * mode is allowed to write against. This is the product half of a defence in depth: the
 * database contract independently refuses a Source whose persisted classification does not
 * match the lineage writing to it, so direct RPC misuse cannot poison these identities
 * either.
 */

/** DEMO / FIXTURE manual intake. The contract mints this Source with `is_fixture = true`. */
export const DEMO_FIXTURE_INTAKE_SOURCE_KEY = "manual-demo:v1";

/** LIVE operational intake. The contract mints this Source with `is_fixture = false`. */
export const LIVE_INTAKE_SOURCE_KEY = "live-observation:v1";

/** The public operations that resolve a built-in Source identity rather than accepting one. */
export type BuiltInIntakeOperation = "capture_input" | "capture_live_input";

/**
 * Operation -> the ONLY source key that operation may write against.
 *
 * Frozen deliberately: this table is the product-side statement of the DEMO_FIXTURE != LIVE
 * invariant, and a mutable mapping would be one assignment away from the defect it closes.
 */
export const CANONICAL_INTAKE_SOURCE_KEYS: Readonly<Record<BuiltInIntakeOperation, string>> = Object.freeze({
  capture_input: DEMO_FIXTURE_INTAKE_SOURCE_KEY,
  capture_live_input: LIVE_INTAKE_SOURCE_KEY,
});

/**
 * Stable public error code for a request that supplied a source key the operation may not
 * write against. Refused explicitly rather than silently coerced: a caller who believes it
 * selected a different Source must learn that it did not, instead of having its intent
 * quietly rewritten into a different provenance lineage.
 */
export const INTAKE_SOURCE_KEY_NOT_PERMITTED = "intake_source_key_not_permitted";

/** The server-pinned source key for a built-in intake operation. */
export function canonicalIntakeSourceKey(operation: BuiltInIntakeOperation): string {
  return CANONICAL_INTAKE_SOURCE_KEYS[operation];
}
