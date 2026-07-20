# Tenancy, RLS, and Data Security Architecture

Companion to `05-canonical-persistence-architecture.md`. Documentary only — no RLS policy, migration, or code is created or modified by this document.

## 1. Enterprise/Workspace Tenancy

Enterprise is the canonical root for organizational identity, contract, billing, and cross-Workspace administration (ADR-PMF-001); it does not itself grant access to any Workspace's operational data. Workspace is the operational, data, and access boundary — the actual RLS tenancy root (ADR-PMF-002). Every Workspace belongs to exactly one Enterprise; every Project belongs to exactly one Workspace; no operational entity crosses a Workspace without an explicit contract (PR1.1 invariants 1–3).

The current-state inspection found **no `enterprises` table at all** — "Enterprise" exists today only as a billing plan-tier string (`plan='enterprise'`) and in migration/doc filenames with no corresponding schema. This is the single largest structural gap between the ratified domain model and the physical schema, and it is recorded here as a target-state gap, not something already implemented.

## 2. Membership Model

`workspace_memberships` (`workspace_id`, `user_id`, `role`) is the current, working, RLS-load-bearing membership model — role values observed: `owner`, `admin`, `pm`, `viewer`. This is a sound foundation to build on. However, the current-state inspection also found **three parallel, coexisting authorization models**: (1) this simple RBAC table, (2) a capability-grant/request/revocation model (`capability_grants`, `capability_requests`, `capability_policies`, `capability_revocation_registry`), and (3) an authority-delegation/escalation model (`authority_delegations`, `authority_escalations`, `authority_registrations`, `governance_delegations`), plus agent-specific scoping (`ai_agent_permissions`, `ai_agent_scopes`). These are not unified into one entitlements model today. The canonical target treats `workspace_memberships`-style RBAC as the base layer for ordinary operational access, with capability/delegation models reserved for fine-grained, resource-level, or time-boxed grants — consolidation is a migration-strategy question (`05-persistence-migration-strategy.md`), not resolved here.

Enterprise-level membership (`enterprise_memberships`, target) governs Enterprise-scoped administrative capability (billing, cross-Workspace policy, Enterprise Intelligence ratification) and never implies Workspace-level operational access by itself.

## 3. RLS Principles

RLS is mandatory defense in depth, additional to and never a substitute for application-layer authorization (ADR-PMF-042). The full chain: **Authentication → Application Authorization → Scoped Repository → RLS → Database Constraints.** Each layer independently fails closed; neither RLS nor application authorization is permitted to assume the other layer will catch what it misses.

The current schema already demonstrates the target pattern at scale: 885 `CREATE POLICY` statements, a converged `workspace_memberships`-chain pattern via `SECURITY DEFINER` helper functions (`is_workspace_member()`, `is_workspace_admin()`, `has_workspace_role()`), and a documented trend of hardening (not loosening) over its most recent migrations. This architecture formalizes that trend as a mandatory, forward-looking rule rather than an incident-driven pattern:

- Every table holding Workspace-, Project-, PMO-, Portfolio-, Program-, or Enterprise-scoped operational data has RLS enabled with an explicit policy set.
- Policies are built primarily on Workspace membership, following the existing converged pattern — not reinvented per table.
- Enterprise membership never alone satisfies a Workspace-scoped policy.
- `SECURITY DEFINER` helper functions used inside policies have their `EXECUTE` grants explicitly restricted, never left at the PostgreSQL default of `PUBLIC`.
- Cross-Workspace policies (the Enterprise Intelligence elevation case) are a distinct, separately reviewed policy category, never an accidental `OR` clause inside an ordinary Workspace-scoped policy.

**Real incidents already on record, used here as the negative examples this architecture is designed to prevent recurring:**
- A self-referential policy (`workspace_admins_can_read_all_memberships`, introduced `20260515100000`) caused infinite recursion by querying `workspace_memberships` from within a policy protecting `workspace_memberships`, and because the widely-used `is_workspace_member()` helper itself queries that table — this blocked reads across roughly 50 dependent migrations' worth of policies until fixed (`20260823000001`) by routing through a `SECURITY DEFINER` helper that bypasses RLS internally in a controlled way.
- A fail-open policy on `company_subscriptions` (`for all to authenticated`), inherited from the pre-Workspace model, let any authenticated user directly overwrite their own billing/subscription/Stripe fields via the REST API, bypassing the Stripe webhook signature check entirely — fixed (`20260818000000`) by splitting into a read policy for `authenticated` and a write policy restricted to `service_role`.
- `workspace_invitations.token` (a plaintext bearer secret) was readable by any Workspace member via ordinary `SELECT` — fixed by column-level GRANT restriction in the same hardening pass.
- `SECURITY DEFINER` functions default to `PUBLIC EXECUTE` in PostgreSQL unless explicitly revoked; a hardening migration (`20260825000000`) found and fixed this gap platform-wide, and it is cited again in the newest migration (`20260828000002`) as an established, ongoing convention.

## 4. Application Authorization

Application-layer authorization (PR4's Identity and Access context) owns business-rule authorization that RLS cannot express row-by-row: role-to-permission mapping, the four-separate-commands rule for Recommendation→Decision→Action→Outcome (ADR-PMF-030), and field-level redaction for sensitive query results ("redact, don't error," PR4 §14). RLS and application authorization are complementary and both mandatory — this architecture does not permit either to be dropped on the theory that the other "already handles it."

## 5. Service Role

`service_role` (or equivalent elevated database role) is never used from a client-facing code path. It is restricted to trusted backend operations with an explicitly scoped, audited purpose. The current schema's existing convention — `for all to service_role using (true) with check (true)` paired with `revoke all ... from authenticated, anon` on backend-only tables (e.g. `ai_usage_events`, `abuse_rate_limits`) — is the correct pattern and is formalized here as required practice, not merely observed. Prohibited: service role from a client; service role as a general-purpose solution to a hard RLS problem; unscoped, filter-less cross-tenant queries via service role; agents using service role directly; silent administrative support access.

## 6. Background Jobs

Background jobs and scheduled workflows execute with an explicit, narrow scope — the specific Workspace/tenant/record set they are operating on — never a blanket, unscoped service-role query across all tenants. Job-level scope must be as auditable as a user-initiated action's scope.

## 7. Agents

Agent Orchestration never writes any authoritative aggregate directly (PR4 §12 binding rule); its only persisted output is an Agent Proposal, converted to a Recommendation after passing output validation and a separate human review/approval (ADR-PMF-027, ADR-PMF-030). Where an Agent Run does need read access (retrieving Evidence, Project Memory), it inherits the requesting actor's scope and policy context — an agent run never operates with broader database access than the human or system actor that authorized it.

## 8. Cross-Workspace Denial

No operational query may cross a Workspace boundary implicitly. The single legitimate, designed exception is the Enterprise Intelligence elevation pipeline (ADR-PMF-029, ADR-PMF-040), which requires: a six-part gate (evidence, confidence, review, lineage, applicability, ratification), explicit per-Workspace consent before ratification, and a dedicated, separately reviewed RLS/query design distinct from ordinary Workspace-scoped policies. Every other apparent need for cross-Workspace access (e.g., Enterprise-level reporting) is served by an Enterprise-administration-specific read path with its own explicit authorization check, never a general-purpose relaxation of Workspace isolation.

## 9. Administrative Support

Administrative or support access to a Workspace's data for investigation purposes must be explicit, scoped to the specific investigation, time-boxed, and audited (an `audit_records` entry naming the support actor, the scope, and the reason) — never a silent, unscoped superuser bypass indistinguishable from a compromised credential.

## 10. Data Classification

| Classification | Examples | Access | Encryption | Logs | Export | Agent Usage | Indexing |
|---|---|---|---|---|---|---|---|
| Public | Marketing content, public docs | Unrestricted | Standard | Standard | Unrestricted | Unrestricted | Indexed |
| Internal | Project metadata, task lists | Workspace members | Standard | Standard | Workspace export | Allowed within scope | Indexed |
| Confidential | Project data, financial data, Evidence, Decisions | Workspace members with role | Standard + access control | Access-logged | Authorized export only | Allowed within scope, respects applicability | Indexed with scope filter |
| Restricted | Agent prompts/outputs, HR data, integration credentials | Named roles only | Standard + strict access control | Access-logged, alerting | Restricted/legal-reviewed export | Restricted, policy-gated | Restricted or excluded |
| Highly Restricted | Secrets, regulated identifiers, private agent context, Audit | Least-privilege, dedicated roles | Encrypted at rest + field-level where applicable | Full audit trail | Legal/compliance-approved only | Prohibited or exceptional-approval only | Excluded from general indexing |

## 11. Encryption

Encryption at rest and in transit is provided by the managed Supabase/PostgreSQL platform as a baseline. Application-level (field-level) encryption is evaluated for: credentials, integration tokens, highly sensitive Evidence, regulated identifiers, and private agent context — candidates, not yet mandated for specific columns pending implementation-time review. Secrets (API keys, integration tokens, provider credentials) belong in a secrets manager, not an ordinary application table, wherever one is available; if none is currently integrated, this is recorded as an open decision (§29 of the main architecture document), not silently accepted as acceptable practice.

## 12. Secrets

No table should carry raw secrets, credentials, or provider tokens in plaintext where a secrets-manager alternative exists. Where a token must be stored in the database as a practical necessity (e.g., a hashed invitation token, per the current schema's own `workspace_invite_token_hashing` migration), it is hashed, and read access is restricted via column-level grants — the pattern the current schema already adopted for `workspace_invitations.token` is the model to continue, not an exception to move away from.

## 13. Object Storage

Object storage separates the object itself from its metadata (bucket, path, checksum, size, MIME, uploaded-by, scope, classification, encryption, retention, status, version), which lives in the canonical database, not solely in the storage provider. Signed URLs are temporary. Deletion of the database record and the underlying object is coordinated, never independent. Orphaned objects (present in storage with no canonical metadata reference, or vice versa) are a data-quality check. The current single-bucket, service-role-only-access pattern (no direct authenticated access; all access routed through API routes) is a sound existing practice this architecture continues.

## 14. Exports

Export is designed by Enterprise, Workspace, Project, user, audit, evidence, memory, and decisions scope, producing: canonical records, relationships, version history per policy, provenance, attachments, a machine-readable format, schema version, manifest, and checksums. Exports never include secrets, provider tokens, or data outside the requester's authorization.

## 15. Deletion

Right-to-erasure and deletion follow: **Request → Scope Validation → Identity Verification → Dependency Analysis → Legal Hold Check → Deletion Plan → Approval → Execution → Derived Index Cleanup → Audit → Completion Record.** Distinct deletion categories: user profile deletion, membership deletion, Project data deletion, Workspace deletion, Enterprise deletion, agent data deletion, evidence retention exceptions, audit retention exceptions, anonymization. Authority records (Decision, Audit, ratified Enterprise Knowledge) are never deleted by ordinary request without passing this full pipeline, and are blockable by legal hold at any stage.

## 16. Legal Hold

Conceptual support for: hold scope, reason, authority, start, end, affected records, release, and audit. A legal hold blocks deletion of Evidence, Decisions, Audit, Documents, relevant Agent records, and related Memory/Knowledge records for its duration, regardless of what any other retention or deletion policy would otherwise permit.

## 17. Data Residency

Region, country, Enterprise policy, Workspace policy, backup location, object storage region, AI provider region, vector store region, and integration transfer implications are acknowledged as real future requirements but the exact topology is explicitly left open (§29 of the main architecture document) — no specific region commitment is made by this document.

## 18. Threat Model (Persistence-Relevant Summary)

| Threat | Primary mitigation |
|---|---|
| Cross-tenant data read via a missing/misconfigured RLS policy | Fail-closed RLS mandatory on every operational table (ADR-PMF-042) |
| Cross-tenant write via direct REST/client access bypassing application authorization | RLS as independent second layer, not reliant on application code alone |
| Recursive/self-referential RLS policy causing denial of service or unpredictable access | `SECURITY DEFINER` helper pattern, reviewed grants |
| Elevated role (`service_role`) misuse or leakage to a client | Never used client-side; scoped, audited backend-only usage |
| Secret/credential exposure via ordinary table access | Secrets manager preferred; hashing + column-grant restriction where unavoidable |
| Unauthorized cross-Workspace knowledge leakage | Enterprise Intelligence's six-part gate + explicit per-Workspace consent (ADR-PMF-040) |
| Stale or orphaned search/vector index exposing deleted or revoked content | Mandatory index cleanup on deletion/revocation (ADR-PMF-041) |
| Agent acting beyond its authorized scope | Agents never write aggregates directly; inherit requesting actor's scope (ADR-PMF-027) |
| Audit tampering or gap | Append-only audit, restricted access, audited export (ADR-PMF-036) |

## 19. Security Invariants

1. No operational table without RLS.
2. No RLS policy that queries its own protected table without a `SECURITY DEFINER` indirection reviewed for recursion safety.
3. No `SECURITY DEFINER` function with default `PUBLIC EXECUTE`.
4. No client-side use of `service_role`.
5. No cross-Enterprise data blending, ever.
6. No cross-Workspace data blending without passing the Enterprise Intelligence elevation gate.
7. No secret or credential stored in plaintext where a secrets manager is available.
8. No audit record ever updated or deleted by ordinary operation.
9. No agent write access to an authoritative aggregate.
10. No derived index (search, vector, projection) that outlives its canonical record's revocation or deletion.

## 20. Validation Strategy

Consistent with the current schema's own demonstrated practice (cross-tenant rejection tests referenced in the current-state inventory), every new canonical table introduced during migration is expected to have: an RLS enable check, a policy-coverage check (no table with zero policies), a cross-tenant rejection test, and a `SECURITY DEFINER` grant review where applicable — as a standing practice extended forward, not a new invention. No such tests are created by this document; this section records the expectation for PR9+.
