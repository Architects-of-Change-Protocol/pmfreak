# Dashboard API Runtime

**Track 8.2 — PMO Dashboard Runtime Integration**

## Purpose

The Dashboard API Runtime exposes the Track 8.1 `PortfolioExecutiveDashboardDTO` through a deterministic, tenant-safe API layer. It provides the backend contract, request validation, response shaping, error handling, and orchestration needed to serve the Portfolio Executive Dashboard DTO to PMFreak dashboard routes.

This runtime does **not** render UI. It produces typed, stable API responses.

---

## API Runtime Contract

The main entry point is:

```typescript
runDashboardApiRuntime(
  requestInput: unknown,
  preloadedSourceData?: DashboardSourceData,
): DashboardApiResponse
```

`DashboardApiResponse` shape:

```typescript
{
  status: 'ok' | 'partial' | 'empty' | 'error'
  data: PortfolioExecutiveDashboardDTO | null
  metadata?: DashboardApiMetadata
  warnings: string[]
}
```

`status` semantics:

| Status | Meaning |
|---|---|
| `ok` | Full DTO built, no warnings |
| `partial` | Full DTO built, some source inputs were absent |
| `empty` | No executiveDashboardReport available; `data` is `null` (explicit empty state) |
| `error` | Request validation failed; `data` is `null` |

---

## Request Validation Model

`validateDashboardApiRequest(input: unknown)` enforces:

| Field | Requirement |
|---|---|
| `tenantId` | Required, non-empty string |
| `workspaceId` | Optional; must be string if present |
| `portfolioId` | Optional; must be string if present |
| `userId` | Optional; must be string if present |
| `includeSignals` | Optional; must be boolean if present |
| `includeMetadata` | Optional; must be boolean if present |

Unknown fields are silently ignored.

**Deterministic error codes:**

- `missing_tenant_id` — tenantId absent or null
- `invalid_tenant_id` — tenantId present but not a non-empty string
- `invalid_workspace_id` — workspaceId present but not a string
- `invalid_portfolio_id` — portfolioId present but not a string
- `invalid_user_id` — userId present but not a string
- `invalid_include_signals` — includeSignals present but not a boolean
- `invalid_include_metadata` — includeMetadata present but not a boolean

---

## Source Data Resolver Strategy

`resolveDashboardSourceData(request, preloadedSourceData?)` is adapter-ready:

- If `preloadedSourceData` is provided, it is returned normalized with appropriate warnings for any absent fields.
- If no preloaded data is provided, all four absence warnings are emitted.
- The resolver does **not** connect to Supabase or any external storage. This is intentional — see the deferred integration section below.

**Absence warnings:**

| Missing field | Warning |
|---|---|
| `executiveDashboardReport` | `"Executive dashboard report unavailable; dashboard remains empty until workspace data exists."` |
| `interventionReport` | `"PMO intervention report unavailable."` |
| `decisionSimulationReports` | `"Decision simulation reports unavailable."` |
| `conflictReport` | `"Conflict report unavailable."` |

---

## Empty State Behavior

When `executiveDashboardReport` is absent, the response builder returns an explicit empty state:

```typescript
{
  status: 'empty',
  data: null,
  metadata?: DashboardApiMetadata,
  warnings: string[]
}
```

Absence of workspace data is a first-class state — the runtime never fabricates a
dashboard DTO (no placeholder health scores, no synthetic alerts). Consumers render
a dedicated empty-state UI when `status === 'empty'`.

---

## Error Handling Model

`buildDashboardApiErrorResponse(errors)` returns a `DashboardApiResponse` with:

- `status: "error"`
- `data`: `null` — error responses never carry a fabricated DTO
- `warnings`: error messages from the validation errors array

This ensures all error paths produce a safe, structured response rather than throwing.

---

## Metadata Model

`DashboardApiMetadata` is included when `request.includeMetadata !== false`:

```typescript
{
  generatedAt: string          // ISO 8601 timestamp
  tenantId: string
  workspaceId?: string
  portfolioId?: string
  sourceSignals: {
    executiveDashboardReport: boolean
    interventionReport: boolean
    decisionSimulationReports: boolean
    conflictReport: boolean
  }
  runtimeVersion: string       // '8.2.0'
}
```

`sourceSignals` reflects which inputs were actually present at runtime, enabling consumers to detect partial hydration without inspecting the DTO itself.

---

## Intended API Route Contract

```
GET /api/dashboard/portfolio
```

- Resolves authenticated tenant context via `getAuthUser()` (`companyId` → `tenantId`)
- Returns `401` if unauthenticated
- Calls `runDashboardApiRuntime({ tenantId, userId, includeMetadata: true })`
- Returns JSON `DashboardApiResponse`

The route is implemented at `src/app/api/dashboard/portfolio/route.ts` using the existing `getAuthUser()` auth utility. It intentionally does not accept a POST body or preloaded source data from external callers — source data hydration is a backend concern reserved for Track 8.5.

---

## Why Direct Storage Integration Is Deferred

The source data resolver is purposefully adapter-ready rather than Supabase-integrated at this stage. Reasons:

1. **Testability** — The entire runtime is exercisable from preloaded source data with no I/O dependencies.
2. **Separation of concerns** — Storage access patterns (query strategy, caching, invalidation) belong in Track 8.5.
3. **Safety** — Premature Supabase integration risks introducing tenant-unsafe query patterns before the data model is confirmed.

When Track 8.5 is implemented, `resolveDashboardSourceData` will be replaced or extended with a Supabase-backed resolver that accepts the request and queries tenant-scoped rows.

---

## Integration with Track 8.1

The response builder calls:

```typescript
runDashboardRuntimeIntegration({
  executiveDashboardReport,
  interventionReport,
  decisionSimulationReports,
  conflictReport,
})
```

from `src/lib/dashboard/runtime-integration/`. This produces the `PortfolioExecutiveDashboardDTO` that becomes `response.data` on the `ok` and `partial` paths.

No consumer of the API runtime needs to know about individual adapters or Track 7 runtime outputs.

---

## Future Extension Path

- **Track 8.3** — Protected route dashboard consumption: Next.js server component or route handler calls `runDashboardApiRuntime()` with tenant context resolved from the session.
- **Track 8.4** — Executive dashboard UI surface: React components consume `DashboardApiResponse.data` panels directly.
- **Track 8.5** — Dashboard persistence and source hydration: `resolveDashboardSourceData` extended with Supabase-backed tenant-scoped queries.
- **Caching and ETag support** — Deterministic DTO output is cache-safe; add ETag headers based on `generatedAt` or a hash of source data identifiers.
- **Role-based dashboard scopes** — Request validator extended to accept role claims; response builder filters panels by role.
- **API audit logging** — Middleware layer logs `tenantId`, `userId`, `status`, and `generatedAt` per request.
- **Streaming dashboard refresh** — Individual panel endpoints backed by the same adapter functions for selective hydration.
