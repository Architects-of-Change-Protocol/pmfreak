# ADR-PMF-049: Canonical API Error Contract

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR4 already ratified fourteen canonical error categories at the application layer (`04-canonical-application-architecture.md` §38: `ValidationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `InvariantViolation`, `PolicyViolation`, `StaleVersionError`, `DependencyUnavailable`, `RateLimitExceeded`, `WorkflowTimeout`, `AgentExecutionError`, `IntegrationError`, `DataIntegrityError`, `UnexpectedError`) along with a binding authorization-before-validation ordering rule to avoid leaking existence/validity information to unauthorized callers. None of this has a wire-level shape yet — no HTTP status mapping, no response body contract, no rule for how authentication failures (which happen before a Command/Query even exists to fail) relate to this catalog.

## Decision

**Every API error maps to exactly one of PR4's fourteen canonical error categories, rendered through one fixed Error DTO shape (category, code, message, retryable, correlationId, requestId, details) and one fixed HTTP status per category. Authentication failures are a distinct, pre-domain concern (`401`), never conflated with the fourteen domain categories. No endpoint invents an error shape or category outside this contract.**

## API Rules

1. The fourteen categories and their HTTP status/retryable/audit-required mapping are fixed as documented in `06-error-model.md` §1 — no endpoint reassigns a category to a different status.
2. Every Command and Query in `06-command-catalog.md`/`06-query-catalog.md` documents which subset of the fourteen categories it can return; returning an undocumented category for that operation is a contract defect.
3. Authorization is evaluated, and can fail with `AuthorizationError`, before any validation side effect that would otherwise reveal a resource's existence or validity to an unauthorized caller — inherited unchanged from PR4 §38.
4. `401 Unauthorized` (authentication failure) is issued by the inbound API port before Command/Query translation and never carries one of the fourteen domain categories.
5. The Error DTO's `message` field is always user-safe — no internal implementation detail, stack trace, credential, or another tenant's data may appear in it, under any category, at any authorization level.
6. A retried request against an endpoint returning a category marked non-retryable in `06-error-model.md` §3 must not be automatically retried by any first-party client or SDK.

## Alternatives Considered

- **Let each endpoint define its own ad hoc error shape.** Rejected: with fifty-plus Commands and twenty-five-plus Queries, ad hoc per-endpoint error shapes would make client-side error handling combinatorially complex and defeat the purpose of having a canonical category catalog at all.
- **Collapse authentication and authorization into a single category.** Rejected: PR4 §38 already treats these as distinct layers in the authorization chain; conflating "who are you" (401) with "you're not entitled to this" (403/`AuthorizationError`) would blur a distinction PR5's defense-in-depth model (ADR-PMF-042) also depends on being kept separate.
- **Include full stack traces or internal error detail in non-production environments only, via a flag.** Rejected: an environment-conditional error contract is itself a source of contract drift and a plausible path to accidental production leakage; the contract is the same in every environment, with verbose diagnostic detail available only through server-side observability tooling (ADR-PMF-053), never the API response.

## Positive Consequences

- Gives any client — first-party or external — one error-handling code path instead of fifty-plus bespoke ones.
- Makes it possible to reason about retry safety mechanically from the category alone (`06-error-model.md` §3).

## Negative Consequences

- Fourteen categories occasionally feel coarse for a highly specific failure — the `code` field exists precisely to carry that specificity without multiplying categories.

## Risks

- **Category-misuse risk:** without a fitness function, an implementation could return `UnexpectedError` for a case that should have been a specific category (e.g., masking a real `ValidationError` as a 500) — this ADR does not itself build that enforcement, only names the intended mapping.

## Security and Data Implications

- The user-safe `message` requirement (rule 5) is a direct information-disclosure control; `details` is restricted to `ValidationError` field-level failures only, never populated for any other category, preventing accidental leakage of internal record state through a "helpful" error payload.

## Application Implications

- No change — the fourteen categories and their semantics remain exactly as PR4 §38 defined them at the application layer; this ADR adds only the wire-level rendering.

## Frontend Implications

- PR7 can build one error-handling component keyed on `category` (and, where needed, `code`) instead of parsing endpoint-specific error shapes.

## Migration Implications

- None executed by this ADR. Existing ad hoc error responses from current route handlers are migrated to this contract in PR9+.

## Compatibility Implications

- Fully compatible with continued operation of non-conforming existing error responses during migration.

## Out of Scope

- The specific `code` namespace/taxonomy beyond the `{resource}.{action}.{reason}` convention named in `06-error-model.md` §2.

## Validation

Validation criteria: (1) `06-error-model.md` §1's fourteen rows match PR4 §38's categories exactly, with no additions or omissions; (2) every Command/Query catalog entry's failure-mode column only references categories from this set; (3) the Error DTO shape in `06-error-model.md` §2 is used consistently across all `06-*` documents that show example error responses.

## References

- `docs/product-architecture/04-canonical-application-architecture.md` §38
- `docs/product-architecture/06-error-model.md`
