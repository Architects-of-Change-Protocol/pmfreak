# PR6 Companion — API Error Model

Status: Documentary architecture (no implementation)
Parent: `06-canonical-api-contracts.md`

Purpose: give PR4's canonical error catalog (`04-canonical-application-architecture.md` §38) a wire contract — HTTP status mapping, Error DTO shape, and retry classification. This document does not add, rename, or redefine a single error category; the fourteen categories below are taken verbatim from PR4.

## 1. Canonical Error Categories

Every error any Command or Query endpoint returns maps to exactly one of these fourteen categories — no endpoint invents a category outside this set, and every Command/Query in `06-command-catalog.md`/`06-query-catalog.md` documents which subset of this list it can return.

| Category | HTTP status | Retryable | Audit required | Observability severity |
|---|---|---|---|---|
| `ValidationError` | 400 Bad Request | No | No | Info |
| `AuthorizationError` | 403 Forbidden | No | Yes | Warning |
| `NotFoundError` | 404 Not Found | No | No | Info |
| `ConflictError` | 409 Conflict | No (caller must resolve and resubmit) | No | Info |
| `InvariantViolation` | 422 Unprocessable Entity | No | Yes | Warning |
| `PolicyViolation` | 403 Forbidden | No | Yes | Warning |
| `StaleVersionError` | 409 Conflict | No (caller must refetch and resubmit) | No | Info |
| `DependencyUnavailable` | 503 Service Unavailable | Yes | No | Error |
| `RateLimitExceeded` | 429 Too Many Requests | Yes (after `Retry-After`) | No | Info |
| `WorkflowTimeout` | 504 Gateway Timeout | Yes (re-request; underlying workflow may still complete) | Yes | Error |
| `AgentExecutionError` | 502 Bad Gateway | Sometimes (per-cause; transient model/provider failures yes, output-validation failures no) | Yes | Error |
| `IntegrationError` | 502 Bad Gateway | Sometimes (per-cause, mirrors `DependencyUnavailable` for transient cases) | Yes | Error |
| `DataIntegrityError` | 500 Internal Server Error | No | Yes | Critical |
| `UnexpectedError` | 500 Internal Server Error | No (safe default; caller may retry idempotent requests only per §17 of the parent document) | Yes | Critical |

**Ordering rule inherited from PR4 §38 and this PR's §3 principle 14/15:** authorization is evaluated before validation's side effects run — an unauthorized caller receives `AuthorizationError` before the API layer reveals whether the requested resource exists or the request body would otherwise validate, preventing existence/validity leakage to a caller who was never entitled to know.

## 2. Error DTO Shape

Every error response uses the same shape, regardless of category:

```json
{
  "error": {
    "category": "AuthorizationError",
    "code": "recommendation.approve.insufficient_authority",
    "message": "You do not have authority to approve this recommendation.",
    "retryable": false,
    "correlationId": "...",
    "requestId": "...",
    "details": []
  }
}
```

- `category` — one of the fourteen values in §1, always present.
- `code` — a stable, dot-namespaced internal code (`{resource}.{action}.{reason}`), safe to key client-side error handling on; never changes meaning once shipped at a given API version (§20 of the parent document).
- `message` — user-safe, never leaks internal implementation, stack traces, credentials, SQL, or another tenant's data (PR6 §27 / `06-api-security-model.md`).
- `retryable` — mirrors §1's Retryable column for that category, may be narrowed per-code (e.g., a specific `IntegrationError` code known to be non-transient).
- `correlationId`/`requestId` — always present, enabling correlation with `06-canonical-api-contracts.md` §25's observability requirements.
- `details` — optional, structured, field-level validation failures for `ValidationError` only; empty for every other category.

## 3. Retry Classification (inherited from PR4 §39)

**Retryable automatically by the client (or client SDK):** `DependencyUnavailable`, `RateLimitExceeded` (after `Retry-After`), `WorkflowTimeout` (re-request status, not necessarily re-issue the original Command), transient-cause `AgentExecutionError`/`IntegrationError`.

**Not retryable automatically:** `ValidationError`, `AuthorizationError`, `PolicyViolation`, `InvariantViolation`, `ConflictError`, `StaleVersionError` (caller must resolve the underlying conflict — refetch, reconcile, or obtain authority — before resubmitting, not blindly retry the same request), `DataIntegrityError`, `UnexpectedError`.

A retried Command always carries its original `Idempotency-Key` where one was required (§17 of the parent document); a retry without that key against a Command that requires one is treated as a new, distinct request, not a retry.

## 4. Authentication Failures Are Not a Domain Error Category

Authentication (identity verification: is this a valid, unexpired, correctly-signed session/token at all) happens in the inbound API port **before** a request is translated into a Command or Query (§5 of the parent document) — it is a transport/session concern, not a domain execution outcome, and PR4's error catalog does not (and should not) include it. An authentication failure returns `401 Unauthorized` with the same Error DTO shape (§2) but no `category` from the fourteen-item domain list; its `code` namespace is reserved (`auth.*`) and distinct from every domain error code. This keeps `AuthorizationError` (403 — you are who you say you are, but not entitled to this action) and authentication failure (401 — the platform does not know who you are) from being conflated, consistent with PR4 §38's own separation of authentication from authorization as distinct layers.

## 5. Per-Command and Per-Query Failure Modes

Each Command in `06-command-catalog.md` and each Query in `06-query-catalog.md` documents, in its own row/section, which categories from §1 it is expected to return — an endpoint returning a category outside what it documents is itself a contract defect to fix in implementation, not a case this document tries to enumerate exhaustively in advance for all fifty-plus operations.

---

## Validation Notes

The fourteen error categories in §1 are taken verbatim from `04-canonical-application-architecture.md` §38. HTTP status mapping, the Error DTO shape, and the authentication/authorization separation in §4 are this PR's original contribution — PR4 deliberately left the wire-level error contract unspecified.
