# ADR-PMF-001: Enterprise and Workspace Are Distinct Canonical Entities

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited PMFreak's implementation against the product's stated PMI/enterprise vision and found a real, migration-enforced, RLS-verified `Workspace → PMO → Project` hierarchy (§4, §8, §16–17 of that document). It also found that **Enterprise has zero implementation anywhere in the repository**: no `enterprises` table, no `enterprise_id` foreign key on any table, no TypeScript `Enterprise` type, interface, or class (§9, §15). The only trace of the word "Enterprise" in the system is a dead billing-plan value: the state-table migration `supabase/migrations/20260428120000_p0_state_tables.sql` allows `plan in ('free', 'pro', 'enterprise')` at the database level, but the application-layer type `SubscriptionPlan` in `src/lib/billing.ts` is defined as `"free" | "pro" | "pmo"` — it does not include `"enterprise"` at all. The `toPlan()` coercion function in that file silently maps any unrecognized value, including `'enterprise'`, to `'free'`. Any row that ever received `plan = 'enterprise'` would be silently downgraded to free-tier capabilities with no error, log, or warning (PR1 §12 C-2). This is treated by PR1 as evidence that Enterprise was anticipated at the database layer at some point and then abandoned at the application layer without cleanup — not as evidence that Enterprise should not exist.

PR1 also documents a direct contradiction (§12 C-7): the only implemented architecture document for the tenancy hierarchy, `docs/architecture/workspace-pmo-project-hierarchy.md`, states plainly that Workspace is *"the whole organization; a user can belong to many"* — i.e., that Workspace is the top of the hierarchy, with nothing above it. The product's own stated vision, and this PR's brief, require a level above Workspace for consultancies and multi-Workspace enterprise customers. PR1 declined to resolve this contradiction, correctly, because it was a research/audit deliverable and resolving open product questions was out of its scope (PR1 §15: *"This document does not invent an answer... This is the single largest open product decision in the whole audit"*).

Separately, Workspace is confirmed as the system's live tenancy and Row-Level Security boundary: 408 of 409 tables have RLS enabled, and a live two-workspace cross-tenant smoke test rejected 10/10 attempted cross-tenant SELECT/INSERT/UPDATE/DELETE operations (PR1 §16, citing `docs/release/rls-tenant-isolation-report.md`). Any decision that introduces a concept above Workspace must not be read as weakening, replacing, or routing around that boundary.

This ADR closes the open question left by PR1 §15 and resolves the contradiction in PR1 §12 C-7. It ratifies Enterprise as a real, distinct canonical entity, superseding `workspace-pmo-project-hierarchy.md`'s "Workspace is the whole organization, nothing above it" framing for all future architecture and implementation work. This is a ratification of intent only. No schema, migration, route, API, or TypeScript type is created, modified, or superseded by this document. Implementation is deferred to a future, separately-scoped PR2.

## Decision

**Enterprise and Workspace are different entities.**

Enterprise represents the client's top organizational level and becomes the canonical root, in the target domain model, for: organizational identity; the contractual relationship; billing; global policies; enterprise-wide configuration; cross-Workspace administration; data sovereignty; integration governance; Enterprise Intelligence; and ratified organizational knowledge.

Workspace is not renamed, redefined, demoted, or altered by this decision. Workspace remains the operational tenant root and the system's live RLS/data-isolation boundary. Enterprise sits conceptually above Workspace as an administrative and organizational-identity boundary; it does not sit inside the data-isolation boundary Workspace already provides, and it does not replace that boundary.

This decision formally supersedes the "Workspace is the whole organization, with no tier above it" framing in `docs/architecture/workspace-pmo-project-hierarchy.md` for all future work. That document's description of the implemented and validated `Workspace → PMO → Project` spine remains accurate and is not disturbed; only its claim that nothing exists above Workspace is superseded.

## Domain Rules

1. An Enterprise may contain multiple Workspaces (Enterprise → Workspace, 1:N).
2. Every Workspace belongs to exactly one Enterprise (Workspace → Enterprise, N:1, required in the target model).
3. For small customers, the Enterprise may be auto-created, mirroring the existing `ensureUserWorkspace` auto-creation pattern already used for Workspace (PR1 §16).
4. For small customers, Enterprise may remain hidden in the initial user experience. Its conceptual existence does not require immediate UI surfacing.
5. Enterprise does not replace Workspace. Workspace retains its role as the operational tenant root and RLS boundary.
6. Enterprise does not replace PMO. PMO remains a Workspace-scoped governance entity (per the separate, already-ratified `pmos` table model); Enterprise does not absorb or duplicate PMO's responsibilities.
7. Enterprise is not a dashboard. It is an organizational/administrative entity, not a UI surface or a view.
8. Enterprise must not be confused with a billing plan. The dead `plan = 'enterprise'` CHECK-constraint value described in Context is a naming collision with this decision, not an implementation of it, and must not be treated as prior art for the Enterprise entity.
9. Enterprise is the upper administrative boundary of the organization in the target hierarchy: `Enterprise → Workspace → PMO → Portfolio → Program → Project`, with optional shortcuts `Workspace → Project`, `PMO → Project`, `Portfolio → Program`, and `Portfolio → Project` (Program's membership in a PMO is always mandatory, per ADR-PMF-005; only its Portfolio nesting is optional).
10. Enterprise's conceptual existence does not require all of its modules (billing consolidation, cross-Workspace administration, Enterprise Intelligence, integration governance, etc.) to be implemented immediately. Ratifying the entity and ratifying full implementation of every module attached to it are separate acts.

## Alternatives Considered

- **Collapse Enterprise into Workspace** (i.e., adopt PR1's cited sibling-branch audit position, `docs/audits/conceptual-model-architecture-audit-2026-07-18.md`, which recommended eliminating aspirational concepts rather than connecting them). Rejected: this would permanently cap the product at a single organizational tier, which cannot represent a consultancy or holding-company customer with multiple client Workspaces under one contractual and billing relationship — a use case the product vision explicitly requires.
- **Rename Workspace to Enterprise** and treat PMO as the next tier down with no true multi-Workspace container. Rejected: this does not add a new capability, it only relabels an existing one, and it would break the "Workspace is a single-tenant operational and RLS boundary" property that PR1 confirmed is live and correctly enforced today.
- **Model Enterprise purely as a billing/contract construct**, not a domain entity, avoiding any organizational or administrative semantics. Rejected: this is smaller than what the product vision needs (cross-Workspace administration, data sovereignty, and Enterprise Intelligence all require an actual organizational entity, not just a billing record), and it is exactly the confusion Rule 8 above forbids.
- **Defer the decision entirely and leave Enterprise as vision-only language**, as PR1 left it. Rejected: this is the status quo this ADR exists to resolve. Leaving it open indefinitely blocks PR2 implementation planning and leaves the contradiction in `workspace-pmo-project-hierarchy.md` (PR1 §12 C-7) permanently unresolved.

## Positive Consequences

- Resolves the single largest open product decision identified by PR1 (§15, §38), unblocking future implementation planning.
- Gives the product a coherent answer for multi-Workspace customers (consultancies, holding companies, enterprise accounts with distinct business-unit Workspaces) without disturbing the Workspace tier that already works.
- Provides a legitimate home for organizational-identity, contract, billing, and cross-Workspace-governance concerns that currently have no consistent place in the domain model.
- Gives Enterprise Intelligence (currently 2 of ~14 aspirational tables built, per PR1 §9 and its `customer-owned-organizational-memory-framework.md` citation) a real conceptual root to be scoped against in a future, ratified v1, rather than remaining pure aspiration.
- Removes the contradiction between `workspace-pmo-project-hierarchy.md` and the product vision (PR1 §12 C-7) by explicit, dated ratification rather than silent drift.

## Negative Consequences

- Adds a new top-level concept to a domain model that, per PR1, is already carrying naming and connection debt (Command Center, Portfolio, Program). Introducing Enterprise without immediately clarifying its boundary against Workspace and PMO (Rules 5–6 above) risks becoming a fifth overloaded term if implementation is rushed.
- The existing dead `plan = 'enterprise'` billing value (Rule 8) is a preexisting naming collision with this decision's subject; if not explicitly retired or reconciled in a future PR, it will continue to invite confusion between "customer is on the Enterprise billing plan" and "customer's Enterprise entity exists."
- Small-customer auto-creation and hiding (Rules 3–4) mean Enterprise's existence will be invisible in most of the product for most customers for an extended period, which risks the entity being deprioritized indefinitely after ratification unless PR2 scoping explicitly accounts for it.

## Risks

- **Scope creep risk:** "Enterprise is the upper administrative boundary" (Rule 9) could be read as license to attach every future cross-Workspace feature to Enterprise regardless of whether it truly belongs there. Mitigation is definitional discipline: Rules 5–8 exist specifically to bound what Enterprise is not.
- **RLS boundary confusion risk:** because Enterprise sits above Workspace, engineers unfamiliar with this ADR could be tempted to implement Enterprise-level data access by weakening or bypassing Workspace-scoped RLS policies rather than composing on top of them. This ADR does not authorize any change to the existing RLS model; see Security and Data Implications.
- **Premature-implementation risk:** because Enterprise auto-creation and hiding are ratified for small customers (Rules 3–4), a future PR could be tempted to implement the auto-create path first, before the administrative/billing/governance modules it is meant to root are scoped, producing an entity that exists in the schema but, like the current billing-plan value, is not meaningfully connected to anything.

## Security and Data Implications

- This ADR does not alter, weaken, or bypass the existing Workspace-level Row-Level Security model. The 408/409-table RLS coverage and the verified 10/10 cross-tenant rejection result (PR1 §16) remain the operative tenant-isolation guarantee; nothing in this decision routes data access around Workspace-scoped RLS.
- A future Enterprise implementation would need its own RLS policies scoped to Enterprise membership/ownership, additive to — not a replacement for — Workspace-level RLS. Cross-Workspace administrative access at the Enterprise level must be explicit and audited, not an implicit consequence of Enterprise containing multiple Workspaces.
- Enterprise is named in the ratified invariants (see `docs/product-architecture/01.1-domain-ratification.md`) as the boundary responsible for data sovereignty and integration governance. This ADR does not specify the mechanism for either; both are explicitly Out of Scope here (see below) and belong to PR2 security design.
- The dead `plan = 'enterprise'` billing value (Context, Rule 8) is a latent data-integrity gap independent of this ADR: any row that already has or ever receives that value is silently downgraded by `toPlan()` in `src/lib/billing.ts` with no error surfaced. This ADR does not fix that gap; it flags that any future Enterprise billing work must not assume the existing enum value is safe to reuse as-is.

## Migration Implications

No migration is executed by this ADR. The following is a description of what a future PR2 implementation effort would need to plan for — it is not authorized, scheduled, or started by this document:

- A new `enterprises` table (or equivalent aggregate root) with its own primary key, distinct from `workspaces`.
- A new required foreign key from `workspaces` to the new Enterprise table (Rule 2: every Workspace belongs to exactly one Enterprise), which implies a backfill strategy for every existing Workspace row — plausibly one auto-created Enterprise per existing Workspace or per existing billing account, consistent with Rule 3.
- Retirement or reconciliation of the dead `plan = 'enterprise'` CHECK-constraint value in `supabase/migrations/20260428120000_p0_state_tables.sql` and the corresponding gap in `src/lib/billing.ts`'s `SubscriptionPlan` type, so that "Enterprise the entity" and "Enterprise the billing plan" are not left as two independently-drifting concepts.
- RLS policy design for the new Enterprise table and for any cross-Workspace administrative views/queries it enables, additive to existing Workspace-scoped policies per Security and Data Implications above.
- No change to `pmos`, `projects`, or their existing foreign keys is implied by this ADR; PMO and Project continue to resolve to a Workspace exactly as they do today.

## UX Implications

- No UI, navigation, route, or copy changes are made by this ADR.
- Per Rule 4, a future implementation is explicitly permitted — not required — to keep Enterprise hidden from small customers' initial experience. This means UX work for Enterprise can be sequenced independently of, and later than, the schema/backend work, without violating this decision.
- Any future Enterprise-facing UX must not present Enterprise as a dashboard (Rule 7) or as a billing-plan selector (Rule 8); it is an organizational-identity and administrative surface.
- Existing Workspace-facing UX (navigation, breadcrumbs, Command Center labeling, etc.) is unaffected. This ADR does not resolve any of PR1's Command Center, Portfolio, or Program naming findings.

## Compatibility Implications

- Backward compatible with the current implementation: no existing table, type, route, or API depends on the absence of an Enterprise entity, so ratifying its existence breaks nothing today.
- `docs/architecture/workspace-pmo-project-hierarchy.md` is superseded in part by this ADR: its "Workspace is the whole organization, no tier above it" statement no longer reflects ratified product direction. Its description of the implemented, validated `Workspace → PMO → Project` spine is unaffected and remains the current-state source of truth for that spine.
- The dead `plan = 'enterprise'` billing value in `supabase/migrations/20260428120000_p0_state_tables.sql` is not made valid, active, or safe by this ADR. It remains a pre-existing gap (PR1 §12 C-2) that a future PR must address explicitly; this ADR only clarifies that it must not be reused as-is to represent the Enterprise entity.
- This ADR does not modify, and is not blocked by, the open decisions PR1 left for Command Center, Portfolio, or Program (PR1 §33 D-17, D-18, and related). Those remain separate, independently-ratifiable decisions.

## Out of Scope

- Any database schema change, migration, table, column, or FK.
- Any TypeScript type, interface, or class for Enterprise.
- Any route, API endpoint, or UI surface for Enterprise.
- The specific mechanism for Enterprise Intelligence, data sovereignty enforcement, or integration governance — these are named as Enterprise-rooted concerns by this ADR but their design is deferred to PR2 and, where warranted, their own ADRs.
- Retirement of the dead `plan = 'enterprise'` billing-CHECK value and the corresponding `SubscriptionPlan` type gap — flagged here, fixed later.
- Resolution of Command Center, Portfolio, or Program's open decisions (PR1 §33) — each is independent of this ADR and, per the ratified decision set, addressed by its own decision record.
- Any statement about timeline, sprint assignment, or prioritization of Enterprise implementation relative to other roadmap items.

## Validation

- This decision is validated by ratification: it is recorded as Accepted, with the Founder / Product Authority and PMFreak Architecture as decision owners, resolving the open question PR1 explicitly declined to answer (PR1 §15) and the contradiction PR1 recorded without resolving (PR1 §12 C-7).
- No code, schema, or test changes accompany this ADR, so there is no build, lint, typecheck, or test suite to run against it. The applicable check is documentary: this file follows the mandatory ADR section format, states the ratified decision without presenting it as open, and accurately describes current-state evidence (verified directly against `src/lib/billing.ts`, `supabase/migrations/20260428120000_p0_state_tables.sql`, and `docs/architecture/workspace-pmo-project-hierarchy.md` in the course of writing this document) without claiming any implementation has occurred.
- Future validation belongs to PR2: once an `enterprises` table and its RLS policies exist, that work must be validated the same way the Workspace boundary was — including an explicit cross-Enterprise isolation test analogous to the 10/10 cross-Workspace RLS smoke test cited in PR1 §16.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — PR1, the audit whose §9, §12 (C-2, C-7), §15, §16, and §38 this ADR directly builds on and resolves.
- `docs/product-architecture/01.1-domain-ratification.md` — the PR1.1 ratification document authored alongside this ADR, recording the full set of founder-ratified domain decisions this ADR is one part of.
- `docs/architecture/workspace-pmo-project-hierarchy.md` — the implemented-and-validated Workspace→PMO→Project spine; partially superseded by this ADR as described in Compatibility Implications.
- `src/lib/billing.ts` — source of the `SubscriptionPlan` type and `toPlan()` coercion behavior cited in Context and Rule 8.
- `supabase/migrations/20260428120000_p0_state_tables.sql` — source of the dead `plan = 'enterprise'` CHECK-constraint value cited in Context and Rule 8.
- `docs/release/rls-tenant-isolation-report.md` — source of the Workspace-level RLS verification cited in Security and Data Implications.
