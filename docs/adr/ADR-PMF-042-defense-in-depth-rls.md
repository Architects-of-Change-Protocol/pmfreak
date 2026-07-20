# ADR-PMF-042: Defense-in-Depth RLS

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

The current-state inventory shows PMFreak already has an extensive Row Level Security posture — 885 `CREATE POLICY` statements, a consistent `workspace_memberships`-chain pattern via `is_workspace_member()`/`is_workspace_admin()` helper functions, and a documented history of hardening fixes (the `20260823000001` recursion fix, the `20260818000000` billing fail-open fix, the `20260825000000` `SECURITY DEFINER` grant hardening). It also shows real prior incidents: a self-referential RLS policy that caused infinite recursion and blocked reads platform-wide until fixed, and a fail-open policy that let any authenticated user overwrite their own Stripe billing fields directly. PR5 must formalize RLS's role relative to application-layer authorization (which PR4's Identity and Access context already defines) so that neither is treated as a substitute for the other, and so RLS policies for the canonical persistence model fail closed by design rather than by after-the-fact patching, as has been the pattern in the current schema's own history.

## Decision

**Row Level Security is a mandatory layer of defense in depth, additional to and never a substitute for application-layer authorization, and it must fail closed: no table holding Workspace-, Project-, or Enterprise-scoped operational data may have RLS disabled, missing, or overly permissive by default.** The full authorization chain is: Authentication → Application Authorization → Scoped Repository → RLS → Database Constraints. Application authorization must not assume RLS will catch what it misses, and RLS must not assume application authorization will catch what it misses — each is independently required to fail closed.

## Persistence Rules

1. Every table holding Workspace-, Project-, PMO-, Portfolio-, Program-, or Enterprise-scoped operational data has RLS enabled with an explicit policy set; no such table is left with RLS disabled or with a default-permissive policy.
2. RLS policies for operational records are built primarily on Workspace membership (per ADR-PMF-034's `workspace_id` presence requirement), following the current schema's own converged pattern (`workspace_memberships` chain via `is_workspace_member()`), not reinvented per table.
3. Enterprise membership alone never satisfies an RLS policy for Workspace-scoped data (per ADR-PMF-034 rule 5) — an Enterprise-level actor's access to a specific Workspace's records requires an explicit Workspace-level grant or an explicitly designed Enterprise-administration policy, never an implicit blanket rule.
4. `SECURITY DEFINER` helper functions used inside RLS policies (the pattern that avoids the recursion class of bug seen in the current schema's history) must not themselves silently grant broader access than the policy calling them intends — each such function is individually reviewed and its `EXECUTE` grant is restricted (not left at the default `PUBLIC`), per the hardening precedent already established in the current schema (`20260825000000`).
5. `service_role` (or equivalent elevated database role) is never used from a client-facing code path; it is restricted to trusted backend operations with an explicitly scoped, audited purpose — mirroring the current schema's own `for all to service_role using (true)` plus `revoke ... from authenticated, anon` convention, which this ADR formalizes as a required pattern rather than an ad hoc one.
6. Background jobs and scheduled workflows execute with an explicit, narrow scope (the specific Workspace/tenant they are operating on), never with a blanket cross-tenant service-role query with no scope filter.
7. Agent Orchestration's persistence access (if any is ever granted directly, rather than solely through application-layer repositories) inherits the requesting actor's scope and policy context — an agent run never operates with broader database access than the human or system actor that authorized it.
8. Cross-Workspace queries (the Enterprise Intelligence elevation pipeline being the one legitimate case) require a dedicated, explicitly reviewed policy design distinct from ordinary Workspace-scoped policies — never an accidental byproduct of a poorly scoped `OR` condition in an otherwise Workspace-scoped policy.
9. Administrative/support access to a Workspace's data (e.g., for a support investigation) must be explicit and audited, never a silent, unscoped superuser bypass.

## Alternatives Considered

- **Rely solely on application-layer authorization, with RLS as a "belt and suspenders" nicety rather than a mandatory requirement.** Rejected: the current schema's own incident history (the billing fail-open gap that let any authenticated user overwrite Stripe fields directly via the REST API, bypassing application-layer checks entirely) demonstrates that a client with direct database access (which Supabase's architecture allows) can bypass application-layer authorization entirely if RLS is not independently enforcing the same boundary.
- **Rely solely on RLS, treating application-layer authorization as redundant.** Rejected: RLS operates at the row level and cannot express all authorization logic (e.g., complex approval-gate rules like ADR-PMF-030's four-separate-commands requirement, or field-level redaction per PR4 §14's "redact, don't error" rule for sensitive query results) — application-layer authorization remains necessary for logic RLS cannot express.
- **Fail-open RLS by default, tightened only when a gap is discovered (the pattern visible in the current schema's own history of "fix_*" migrations).** Rejected going forward: while understandable as an incremental-hardening history, this ADR requires new canonical tables to be designed fail-closed from the start, not patched into fail-closed after an incident.

## Positive Consequences

- Formalizes and extends a pattern PMFreak has already converged on through hard-won experience (the membership-chain RLS pattern, the `SECURITY DEFINER` grant hardening), rather than introducing a novel approach the team has not already validated operationally.
- Makes tenant-isolation testing (the cross-tenant rejection tests already referenced in the current-state inventory) a first-class, expected practice for every new canonical table, not an afterthought.
- Reduces blast radius of any single-layer authorization bug — a missed application-layer check is caught by RLS, and vice versa.

## Negative Consequences

- Requires policy authoring and testing effort for every new table, which is real ongoing engineering cost, not a one-time setup.
- `SECURITY DEFINER` helper functions, while solving the recursion problem, are a security-sensitive pattern themselves and require careful, deliberate review each time one is introduced or modified — as the current schema's own recursion incident demonstrates.

## Risks

- **Recursion risk:** any future RLS policy that queries the same table it protects (directly or through a non-`SECURITY DEFINER` helper) risks reproducing the exact infinite-recursion incident already documented in the current schema's history — this is a specific, named risk this ADR requires new policies to avoid by design, using the already-established `SECURITY DEFINER` helper pattern.
- **Grant-creep risk:** `SECURITY DEFINER` functions default to `PUBLIC EXECUTE` in PostgreSQL unless explicitly revoked — the current schema's own hardening migration (`20260825000000`) shows this was missed at least once; every new function of this kind must have its grants explicitly reviewed, not left at the default.
- **Scope-bypass risk:** a policy using `OR` conditions to handle a legitimate cross-Workspace case (e.g., Enterprise Intelligence) could accidentally broaden access to ordinary Workspace-scoped reads if not carefully isolated to the specific record types the exception applies to.

## Security and Data Implications

- This ADR is the persistence-layer enforcement mechanism for PR1.1's tenancy invariants (1–5) and ADR-PMF-034's Workspace-scoping rules — it is the last line of defense if application-layer authorization is bypassed or buggy.
- Fail-closed RLS is a precondition for meaningful data classification (§45), legal hold (§25), and export/deletion (§49–50) guarantees — none of those can be trusted if the underlying row-level access control itself fails open.

## Application Implications

- Application-layer authorization (PR4's Identity and Access context) continues to own business-rule authorization (role-to-permission mapping, approval-gate logic) that RLS is not designed to express; this ADR does not shift that responsibility to the database.
- Repository implementations must not assume RLS alone is sufficient and skip application-layer scope checks "for performance," and vice versa — both layers are independently required.

## API Implications

- PR6's API layer must not expose any direct-database-access pattern to end clients that would rely on RLS as the sole authorization mechanism without an accompanying application-layer authorization check.

## UX Implications

None directly; RLS is invisible to end users except through its effect (data properly scoped to their Workspace).

## Migration Implications

- Existing RLS policies and the current schema's hardening history (per the current-state inventory) are the starting point for the expand-contract migration (ADR-PMF-044); new canonical tables introduced during migration must meet this ADR's fail-closed bar from creation, not be patched afterward.

## Operational Implications

- RLS policy testing (cross-tenant rejection tests, per the current-state inventory's mention of existing test coverage) must be extended to cover new canonical tables as they are introduced, and regressions must be caught before merge, not after an incident.

## Compatibility Implications

- Fully compatible with and builds directly on Supabase's existing RLS enforcement mechanism; no new technology is introduced.

## Out of Scope

- The exact SQL for any specific policy — implementation detail for PR9+.
- The exact administrative-support-access tooling and audit mechanism — deferred to `05-tenancy-rls-and-data-security.md` for principle-level treatment, implementation left open.

## Validation

Validation criteria: (1) every operational table type described in `05-canonical-data-model.md` is documented in `05-tenancy-rls-and-data-security.md` with an explicit RLS policy category; (2) no document produced under PR5 describes RLS as optional for any Workspace-, Project-, or Enterprise-scoped table; (3) the `SECURITY DEFINER` helper-function pattern and its grant-restriction requirement are explicitly documented as a required practice, not left implicit.

## References

- `docs/product-architecture/05-tenancy-rls-and-data-security.md`
- `docs/adr/ADR-PMF-034-workspace-scoped-operational-persistence.md`
- `docs/security/supabase-rls-service-role-boundary.md`
- Current-state inventory: `supabase/migrations/20260823000001_fix_workspace_memberships_rls_recursion.sql`, `20260818000000_supabase_rls_service_role_boundary_hardening.sql`, `20260825000000_fix_security_definer_public_execute_grants.sql`
