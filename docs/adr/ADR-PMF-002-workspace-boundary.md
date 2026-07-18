# ADR-PMF-002: Workspace Is the Primary Operational, Access, and Data Boundary

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`) audited PMFreak's
implementation against the vision of a full PMI-aligned hierarchy and found that,
of every candidate boundary concept in the system, Workspace is the one already
built correctly. §16 and §35 of that audit establish, with direct evidence rather
than inference:

- 408 of 409 tables in the schema have `ENABLE ROW LEVEL SECURITY` set.
- A live two-workspace SQL smoke test (`docs/release/rls-tenant-isolation-report.md`)
  exercised 10 cross-tenant SELECT/INSERT/UPDATE/DELETE attempts; all 10 were
  correctly rejected.
- A genuine `workspace_memberships` RLS infinite-recursion bug (finding F26) was
  discovered during that validation and fixed via a `SECURITY DEFINER` helper
  function — not a theoretical gap, an actual bug caught and closed.
- `ensureUserWorkspace` auto-creates a default Workspace for every user on first
  login, so the boundary is never absent, even for users who never think about it.

The audit's own decision table (§33, row D-02) already scores this: "Is Workspace
a data/security boundary? — **Yes, already true, live-tested,** High confidence,
No further ratification needed." The open problem PR1 surfaces is not whether
Workspace is the boundary — it demonstrably is — but that the word "Workspace" is
overloaded with unrelated naming. The codebase's own internal documentation states
plainly: *"A Command Center is not a new table. It is the existing `workspaces`
table"* (`docs/architecture/command-center-foundation.md`). Columns such as
`workspaces.command_center_type`, `visibility_scope`, and `confidentiality_level`
are Workspace configuration wearing Command Center's name (PR1 §9, §22). This
naming collision is real and has downstream cost: it makes Workspace read, in the
UI and in engineer intuition, like an experience or a PMO, rather than what it
actually is underneath — the tenant root.

Separately, PR1 §38 documents that the consultancy pattern — one Workspace per
client — is "already supported... each Workspace is fully isolated," making it the
single closest-to-complete segment story in the whole audit. That pattern needs
to be formally named as policy, not left as an emergent property nobody has
ratified.

This ADR does not introduce new architecture. It formalizes, as a ratified
decision, what PR1 already found to be true, and it resolves the naming ambiguity
by stating explicitly what Workspace is not.

## Decision

**Workspace is the primary operational, access, and data boundary within an
Enterprise.**

Every unit of operational work, every access grant, and every row of tenant data
in PMFreak is scoped to exactly one Workspace unless an explicit, governed policy
states otherwise. This is true today at the data layer (RLS) and is now ratified
as permanent product intent, not an implementation accident. Enterprise sits above
Workspace as an organizational grouping (see the canonical hierarchy in PR1.1);
PMO, Portfolio, Program, and Project sit below it. None of those levels — above or
below — relaxes or replaces the Workspace boundary. An Enterprise groups
Workspaces; it does not merge their data. A PMO organizes work inside a Workspace;
it does not open a channel across Workspaces.

## Domain Rules

1. An Enterprise may have multiple Workspaces.
2. A Workspace belongs to exactly one Enterprise.
3. A Workspace may contain multiple PMOs.
4. A Workspace may contain direct Projects (Projects need not go through a PMO).
5. Every Project belongs to exactly one Workspace, without exception.
6. Nothing — no entity, no record, no relationship — crosses Workspaces
   automatically. Cross-Workspace visibility never happens as a side effect of
   another operation.
7. Any transfer of knowledge or data between Workspaces requires an explicit,
   named policy, evaluated and enforced independently of ordinary read/write
   access. Absent such a policy, isolation is total.
8. A consultancy or agency operating PMFreak on behalf of multiple end clients
   MUST use a separate Workspace per client. This is the intended and supported
   multi-tenant pattern for that use case, not a workaround.
9. Cross-client intelligence — insights, patterns, memory, or recommendations
   derived from one client's Workspace appearing in another's — is prohibited by
   default. It can only be enabled through the explicit governed-elevation policy
   referenced in Rule 7, and only for knowledge that has been promoted to
   Enterprise Intelligence under its own governance (see the ratified
   Recommendation→Decision→Action→Outcome chain and the "candidate pattern ≠
   ratified pattern" invariant); raw Workspace or Project data itself never
   crosses regardless of policy.
10. Workspace is surfaced to the user when it adds context — for example, when a
    user belongs to more than one Workspace, or when a consultancy needs to
    confirm which client they are acting within. It is not surfaced as clutter
    when a user has exactly one Workspace and no reason to think about tenancy.
11. Workspace may be auto-created in simple experiences. A new user does not have
    to name or configure a Workspace before doing productive work; the system may
    provision one silently, consistent with current `ensureUserWorkspace`
    behavior.
12. Workspace does not mean Command Center. Command Center is a conceptual,
    non-persisted operational view (a projection over an entity, per PR1.1's
    Command Center decision) that can be opened *for* a Workspace, PMO,
    Portfolio, Program, or Project. It is never itself the boundary, and no
    future work may re-derive tenancy rules from "Command Center" as if it were
    an entity.
13. Workspace does not mean PMO. A PMO is a governance and organizational entity
    that lives inside exactly one Workspace; a Workspace can contain zero, one,
    or many PMOs, and Projects may exist in a Workspace with no PMO at all. The
    two words must not be used interchangeably in product copy, code, or
    documentation going forward.
14. Workspace must not be used as a generic label for an arbitrary screen,
    section, or UI surface. If a feature needs a name for "the page I'm looking
    at," that name must not be "Workspace" — that word is reserved for the
    tenancy/access/data boundary defined by this ADR.

## Alternatives Considered

- **Make Enterprise the primary boundary instead of Workspace.** Rejected.
  Enterprise has zero implementation today (PR1 §15) and no schema evidence to
  build on; retrofitting it as the *primary* boundary would require re-deriving
  every RLS policy in the system from scratch and would discard 408 tables of
  already-verified, live-tested isolation. Enterprise remains a grouping concept
  above Workspace, not a competing boundary.
- **Make PMO the primary boundary.** Rejected. PMO is optional beneath Workspace
  (a Project can exist without a PMO, per the ratified cardinalities), so it
  cannot serve as the universal tenancy anchor — some Projects would have no
  boundary at all under this model.
- **Introduce a new "Tenant" or "Organization" entity distinct from Workspace.**
  Rejected. PR1 §16 confirms no such entity exists today and Workspace already
  fills that role completely, down to RLS policy structure. Introducing a
  parallel concept would fork the boundary into two systems of record for no
  documented benefit, and contradicts the "no synonym" spirit of Rules 12–14.
- **Allow implicit cross-Workspace data sharing for convenience (e.g., a
  consultant viewing all clients' Projects in one list).** Rejected as a default.
  This directly conflicts with the ratified "no operational entity crosses
  Workspace without explicit contract" invariant and the "cross-client
  intelligence is prohibited by default" rule; any such view must be built as an
  explicit, governed, opt-in aggregation, not a default behavior.

## Positive Consequences

- Formalizes and locks in the single strongest-verified property of the system
  instead of leaving it as an implicit convention.
- Gives the consultancy/agency segment an unambiguous, ratified pattern
  (Workspace-per-client) to design onboarding and sales messaging around.
- Provides a clear naming contract that resolves the Command Center/Workspace/PMO
  collision documented in PR1 §9 and §22, reducing future engineer confusion when
  extending the schema or UI.
- Establishes the boundary that Enterprise Intelligence provenance-preservation
  (Workspace+Project lineage) can be built against with confidence in a future
  PR2, since the underlying isolation is already proven, not merely assumed.

## Negative Consequences

- Ratifying strict default isolation formally forecloses any near-term "quick
  win" cross-Workspace convenience feature (e.g., a consultant's unified
  dashboard across clients) without it going through explicit governed-policy
  design work first.
- The naming cleanup implied by Rules 12–14 (Command Center/PMO decoupling from
  Workspace) is not free — it is real, if modest, future engineering and copy
  work that this ADR commits the roadmap to, without executing it here.

## Risks

- **Naming drift continues if not enforced.** Ratifying the rule does not, by
  itself, rename `workspaces.command_center_type` or fix the "5 distinct usages"
  of "Command Center" cataloged in PR1 §9. Without a scheduled follow-up PR, the
  collision persists in code even though it is now resolved in policy.
- **Consultancy pattern is proven for isolation, not for cross-Workspace
  operator UX.** PR1 §38 confirms isolation works; it does not evidence that an
  operator managing many client Workspaces has an efficient way to work across
  them today. This ADR ratifies the isolation guarantee, not a solved multi-
  Workspace operator experience.
- **Legacy RLS debt is out of scope but not erased by ratification.** Two tables
  (`onboarding_analyses`, `governance_audit_events`) still key their RLS policies
  off a legacy `company_id` pattern rather than `workspace_id` (PR1 §35, tracked
  as `RR-RLS-LEGACY`). This ADR does not fix that debt; stating the Workspace
  boundary as canonical increases the importance of eventually closing it.

## Security and Data Implications

This ADR does not change the enforcement mechanism already in production. It
ratifies RLS-by-Workspace, live-verified per PR1 §16/§35, as permanent policy
rather than incidental implementation. Concretely: any future schema addition
must scope new tables by `workspace_id` and enable RLS by default, consistent
with the 408/409 pattern already established; any feature proposing to read or
write across Workspaces must be treated as a security-review-gated exception
requiring the explicit governed policy described in Rule 7, not an ordinary
feature change. The known residual gap (`RR-RLS-LEGACY`, two tables on
`company_id`) is explicitly acknowledged as non-compliant with this ADR's
standard and remains tracked, non-blocking, technical debt.

## Migration Implications

No migration is executed by this ADR. A future implementation PR (PR2) would need
to, at minimum: (a) close `RR-RLS-LEGACY` by migrating `onboarding_analyses` and
`governance_audit_events` to `workspace_id`-keyed RLS; (b) rename or deprecate the
Workspace columns currently wearing Command Center's name
(`command_center_type`, `visibility_scope`, `confidentiality_level`) per PR1 §9's
recommended "column/label rename only" remediation, without touching the
underlying `workspaces` table's role as tenant root; (c) ensure any new
Enterprise-level tables introduced to support the ratified Enterprise→Workspace
1:N relationship carry Workspace provenance sufficient to satisfy the "Enterprise
Intelligence preserves Workspace+Project provenance" invariant. None of this work
is scoped to or begun by this documentation-only PR.

## UX Implications

Workspace should surface in the UI only when it adds decision-relevant context —
per Rule 10 — such as a Workspace switcher for multi-Workspace users or an
explicit client-context indicator for consultancy operators. Single-Workspace
users should continue to experience no Workspace-related friction, consistent
with current `ensureUserWorkspace` auto-provisioning behavior (Rule 11). Any
existing UI copy that uses "Workspace" as a generic screen or section label
(Rule 14) or that blurs Workspace with Command Center or PMO terminology is
inconsistent with this ADR and should be flagged for correction in a future
copy-focused PR; no such renaming is performed here.

## Compatibility Implications

This ADR is backward compatible with the current schema and running system: it
ratifies existing RLS-based behavior rather than altering it. No existing table,
policy, route, or API contract is required to change as a direct result of this
document. Compatibility risk is limited to the naming/label debt already
described (Command Center/Workspace/PMO overlap), which remains functionally
inert until a future PR chooses to act on it.

## Out of Scope

- Any code, schema, migration, RLS policy, or route change (this is a
  documentation-only PR).
- Closing the `RR-RLS-LEGACY` residual debt on `onboarding_analyses` and
  `governance_audit_events`.
- Renaming `command_center_type`/`visibility_scope`/`confidentiality_level` or
  any other Command Center/Workspace naming cleanup.
- Designing the specific mechanics of the governed cross-Workspace/Enterprise
  Intelligence elevation policy referenced in Rule 7 (that belongs to the
  Enterprise Intelligence and knowledge-elevation ADRs).
- Defining Enterprise itself as an entity (covered by a separate ADR in this
  ratification set).
- Any onboarding or progressive-disclosure UX redesign.

## Validation

This decision is validated by evidence already gathered in PR1, not by new work
performed for this ADR:

- 408 of 409 tables carry `ENABLE ROW LEVEL SECURITY` (PR1 §35).
- A live two-workspace SQL smoke test exercised 10/10 cross-tenant
  SELECT/INSERT/UPDATE/DELETE attempts and rejected all 10
  (`docs/release/rls-tenant-isolation-report.md`, cited at PR1 §16/§35).
- The `workspace_memberships` RLS infinite-recursion bug (F26) was found and
  fixed via a `SECURITY DEFINER` helper, demonstrating the boundary is actively
  tested and hardened, not merely assumed (PR1 §16).
- `ensureUserWorkspace` auto-creation was confirmed in code
  (`command-center-foundation.md:50-53`, cited at PR1 §16).
- Ongoing validation for any future PR2 work should re-run or extend the
  two-workspace cross-tenant smoke test against any newly added tables, and
  should include `onboarding_analyses` and `governance_audit_events` once
  `RR-RLS-LEGACY` is closed.

## References

- `docs/product-architecture/01-canonical-domain-model.md` (PR1) — §9, §12, §15,
  §16, §22, §33 (D-02, D-10, D-15), §35, §38.
- `docs/product-architecture/01.1-domain-ratification.md` (PR1.1, authored in
  parallel with this ADR).
- `docs/architecture/command-center-foundation.md`.
- `docs/release/rls-tenant-isolation-report.md`.
