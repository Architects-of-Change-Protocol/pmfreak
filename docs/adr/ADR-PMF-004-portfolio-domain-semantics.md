# ADR-PMF-004: Portfolio Is a Strategic Entity, PMO-Owned, 1:N, No Cross-Workspace Scope

Status: Accepted
Date: 2026-07-18
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR1 (`docs/product-architecture/01-canonical-domain-model.md`, §9, §11, §13, §18) audited the current codebase and found that the PMI concept of Portfolio — a strategic grouping of Programs and Projects used to prioritize investment, capacity, risk, and value — **does not exist anywhere in PMFreak today.** This is not a naming defect that a rename would fix; it is a missing aggregate. Zero tables, zero foreign keys, and zero TypeScript types implement cross-project strategic grouping, benefit tracking, or investment prioritization (§18).

Meanwhile, the word "Portfolio" is already in live, user-facing use for six unrelated things (§9, §11, §13):

1. The `/portfolio` route (`src/lib/portfolio/types.ts`) — a page deriving document/risk history keyed by `projectId` only; its own breadcrumb calls it "Project Controls," contradicting its `<h1>`.
2. A UI section literally titled "Portfolio" on `/pmos/[pmoId]` (`pmos/[pmoId]/page.tsx:80`) that renders nothing more than `pmo.projects` — a plain project list wearing a strategic name.
3. An executive panel surface referencing "portfolio" language.
4. A capability flag gating access to "portfolio" features that have no backing aggregate.
5. Command-center variables that compute cross-PMO project counts and label the result "portfolio."
6. `personal_portfolios` (table, migration `20260714000000_personal_portfolio_foundation.sql`) — a real, RLS-enforced (`owner_id = auth.uid()`) per-user saved list, joined to `projects` via `personal_portfolio_projects`. This is a legitimate, narrow, and **different** concept from PMI-Portfolio, currently squatting on the same word.

PR1 classified this as Contradiction C-6 and Duplication Case "Six Portfolio surfaces" (Category D — projection confused with entity, for five of six; Category B — legitimate distinct concept, for `personal_portfolios`) and left it open as decision D-18: "Should Portfolio be built to PMI semantics?" — explicitly not resolved by that document, and explicitly in tension with a sibling audit (`docs/audits/conceptual-model-architecture-audit-2026-07-18.md`) that recommended retiring the word entirely outside `personal_portfolios`.

This ADR resolves D-18. The Founder has ratified that PMFreak's product vision — "a system of operational intelligence for Projects, Programs, Portfolios, and PMO" (PR1 §5) — requires a real, distinct Portfolio level, and the correct fix is to build the missing aggregate, not to delete the word from the product vocabulary.

## Decision

**Portfolio is ratified as a real, strategic aggregate entity: a PMO-owned grouping of Programs and Projects used to prioritize investment, capacity, risk, alignment, and value.**

Portfolio takes its place in the ratified canonical hierarchy as:

```
Enterprise → Workspace → PMO → Portfolio → Program → Project
```

with the optional shortcut Portfolio → Project (direct), alongside the other ratified shortcuts (Workspace→Project, PMO→Project, PMO→Program).

Cardinality (target-state contract, per the PR1.1 ratification):

- PMO → Portfolio: 1:N.
- Portfolio → PMO: N:1, required (a Portfolio cannot exist without exactly one owning PMO).
- Portfolio → Program: 1:N, optional.
- Program → Portfolio: N:1, optional (a Program can exist without a Portfolio; where one exists, it is the Program's single primary Portfolio).
- Portfolio → Project (direct): 1:N, optional.
- Project → Portfolio: N:1, optional, **max one primary Portfolio** initially.
- No many-to-many relationship between Projects and Portfolios (or Programs and Portfolios) is enabled in the initial model.

This decision ratifies the *conceptual and relational* shape of Portfolio. It does not authorize or execute any schema change, migration, or product-code change — see Out of Scope and Migration Implications.

## Domain Rules

1. A Portfolio belongs to exactly one PMO. There is no orphan Portfolio and no Workspace-owned or Enterprise-owned Portfolio in the initial model.
2. A PMO may contain multiple Portfolios.
3. A Portfolio may contain Programs.
4. A Portfolio may contain Projects directly (the Portfolio→Project shortcut), independent of whether those Projects also route through a Program.
5. A Project may exist without a Portfolio. Portfolio membership is never mandatory for Project creation or operation.
6. Initially, a Project may have at most one primary Portfolio.
7. Initially, a Program may have at most one primary Portfolio.
8. No many-to-many relationship between Projects and Portfolios is enabled in the first model. Any future need for a Project to participate in multiple Portfolios simultaneously (e.g., matrixed investment views) requires a later ADR and is explicitly deferred.
9. Portfolio is NOT: a folder; a dashboard; a tag; "all projects"; a synonym for PMO; a synonym for Program. Any implementation, UI copy, or future PR that treats Portfolio as an alias for one of these violates this ADR.
10. Portfolio must eventually support prioritization, investment tracking, capacity views, aggregate risk rollup, benefits tracking, and scenario planning, and must be evaluated against strategic alignment. These capabilities are future work and are explicitly not designed or scheduled by this ADR.
11. Portfolio cannot cross Workspaces in the initial model. A Portfolio's Programs and Projects must all belong to the same Workspace as the Portfolio's owning PMO.
12. Cross-PMO Portfolio (a Portfolio spanning more than one PMO within the same Workspace) is out of scope for the initial model.

## Alternatives Considered

- **Retire the word "Portfolio" entirely, keeping only `personal_portfolios`** (the sibling audit's recommendation, PR1 §12 C-6). Rejected: the product vision explicitly names Portfolio as a required level of operational intelligence (PR1 §5); retiring the word would permanently foreclose the PMI capability rather than defer it, and would require renaming a concept the vision depends on.
- **Model Portfolio as Workspace-owned rather than PMO-owned.** Rejected: this would make Portfolio a sibling of PMO rather than a child, contradicting the ratified hierarchy (Enterprise→Workspace→PMO→Portfolio→Program→Project) and would allow a Workspace with multiple PMOs to have ambiguous Portfolio ownership. PMO ownership keeps Portfolio scoped to a single governance context, mirroring how Program and Project already relate to PMO.
- **Allow Portfolio to span multiple PMOs within a Workspace ("cross-PMO Portfolio") from day one.** Rejected for the initial model (rule 12) — this is a materially harder aggregation and permission problem (which PMO's governance rules apply? whose capacity budget?) and is deferred to a future ADR once single-PMO Portfolio is validated in production.
- **Model Portfolio↔Project and Portfolio↔Program as many-to-many from day one.** Rejected (rule 8) — consistent with the broader ratified invariant of no many-to-many relationships anywhere in the initial model; a "primary Portfolio" single-parent model is simpler to secure, migrate, and reason about, and can be relaxed later without a breaking change (adding a join table is additive; removing one is not).
- **Repurpose `personal_portfolios` as the PMI-Portfolio table.** Rejected: `personal_portfolios` is user-scoped (RLS `owner_id = auth.uid()`) and represents a personal, non-authoritative saved list; PMI-Portfolio is a PMO-governed, organization-authoritative strategic entity. Conflating them would either weaken the governance of the strategic entity or break the personal-list feature's semantics. Rule 9 keeps them distinct.
- **Fold Portfolio and Program into a single "grouping" entity.** Rejected: they answer different questions — Portfolio answers "where should we invest," Program answers "how do we coordinate related delivery." PR1 §19 already found Program is a real, well-built capability; collapsing it into Portfolio would erase that distinction and contradict rule 9's explicit "not a synonym for Program."

## Positive Consequences

- Closes the largest single-word ambiguity surfaced by PR1: six meanings collapse to one authoritative meaning plus one clearly disambiguated sibling concept (`personal_portfolios`).
- Gives the product vision's "Projects, Programs, Portfolios, and PMO" framing (PR1 §5) an actual home in the domain model for the first time.
- Establishes a clean single-parent (primary Portfolio) relationship that is straightforward to secure with RLS by extension of the existing PMO/Workspace tenancy pattern (PR1 §16), rather than requiring a new cross-cutting authorization model.
- Unblocks Program's future PMI-alignment work (D-17, a separate ADR): once Portfolio exists, "does Program belong to a Portfolio" has an answer instead of being unanswerable (PR1 §19).
- Gives the existing `/portfolio` route, the PMO "Portfolio" section, and the other four squatting usages a concrete target to be reconciled against in a future implementation PR, rather than remaining permanently ambiguous.

## Negative Consequences

- Introduces a fifth level of nesting in the canonical hierarchy (Enterprise→Workspace→PMO→Portfolio→Program→Project), adding conceptual load for users and for future engineers navigating the schema.
- Until implemented, the ratified model temporarily *increases* the gap between vision language and running code — PR1's evidence (§18) that Portfolio has zero implementation remains true the moment this ADR is merged; only a future PR2 changes that.
- The "max one primary Portfolio" constraint (rules 6-7) is a real limitation for organizations that legitimately want a Project or Program to count against two investment buckets simultaneously (e.g., co-funded initiatives); this is knowingly deferred, not solved.
- Six existing UI/data surfaces currently using the word "Portfolio" will eventually need to be renamed or reconciled (five) or explicitly kept-but-disambiguated (`personal_portfolios`) in a future PR, which is additional migration and copy-review surface area this ADR creates work for without executing.

## Risks

- **Scope creep risk:** because Portfolio is defined as eventually supporting prioritization, investment, capacity, aggregate risk, benefits, and scenario planning (rule 10), a future implementation PR could be tempted to build all of this in v1. This ADR ratifies the entity and its relationships only; the analytical capabilities are explicitly future work.
- **Naming confusion risk during transition:** until the five non-`personal_portfolios` usages are reconciled, the codebase will contain both the old (pre-ADR) meanings and the new ratified meaning simultaneously. A future implementation PR must not introduce the new `portfolios` table while leaving the old usages unaddressed, or the ambiguity PR1 documented will simply gain a seventh meaning.
- **Governance-boundary risk:** because a Portfolio is owned by exactly one PMO (rule 1) and cannot cross Workspaces (rule 11) or PMOs (rule 12), organizations that expected Portfolio to be a Workspace-wide or cross-PMO concept will need a product conversation before adoption; this is a known, accepted constraint of the initial model, not an oversight.
- **Primary-Portfolio migration risk (deferred, noted for future PR):** if and when the model is relaxed to allow multiple Portfolio memberships, converting from a single-FK "primary Portfolio" column to a many-to-many join table is a nontrivial data migration; this ADR accepts that future cost in exchange for a simpler, safer initial model.

## Security and Data Implications

- Portfolio inherits tenancy from its owning PMO, which inherits tenancy from its owning Workspace. Per the ratified tenancy invariants, every Portfolio must resolve to exactly one Workspace via its PMO, and RLS on any future `portfolios` table must enforce Workspace/PMO scoping consistent with the pattern already RLS-verified for `pmos` and `projects` (PR1 §16, §17).
- No operational entity may cross a Workspace boundary without an explicit contract (ratified invariant); Portfolio's rule 11 (no cross-Workspace scope) and rule 12 (no cross-PMO scope) are the concrete expression of that invariant for this entity. A future implementation must not allow a Portfolio's Program or Project members to belong to a different Workspace than the Portfolio's own PMO.
- `personal_portfolios` retains its existing, separately-scoped RLS model (`owner_id = auth.uid()`) unchanged by this decision; it is not merged into, and does not inherit any authorization logic from, the new PMI-Portfolio entity.
- Because Portfolio aggregates Projects and Programs for investment/risk/capacity purposes, a future implementation must consider whether Portfolio-level rollups can leak information about Projects a viewing user would not otherwise have row-level access to (e.g., an aggregate risk score derived from Projects outside the viewer's direct permissions). This is flagged as a design question for the implementation PR, not resolved here.

## Migration Implications

No migration is executed by this ADR. A future implementation PR (PR2 or later, separately scoped and separately reviewed) would need to:

- Add a new `portfolios` table, owned by `pmo_id` (NOT NULL, FK to `pmos`), consistent with how `pmos` is owned by `workspace_id` (NOT NULL).
- Add a nullable `portfolio_id` (or equivalent "primary Portfolio" FK) to `programs`, enforcing rule 7 (at most one primary Portfolio per Program) — likely mirroring the existing nullable `pmo_id` pattern on `projects`.
- Add a nullable `portfolio_id` (or equivalent "primary Portfolio" FK) to `projects` for the direct Portfolio→Project shortcut, enforcing rule 6 (at most one primary Portfolio per Project).
- Add a trigger or constraint (mirroring the existing `pmo_id`/`workspace_id` consistency trigger on `projects`, per PR1 §16) ensuring a Portfolio's Workspace matches its member Programs' and Projects' Workspace, enforcing rule 11.
- Explicitly NOT build a many-to-many join table between Portfolio and Project/Program in this initial migration (rule 8); the single-FK "primary Portfolio" design is deliberately additive-only for now.
- Separately, and not as part of the same migration, plan the reconciliation of the six existing "Portfolio" usages found in PR1 (§9, §11, §13): the `/portfolio` route, the `/pmos/[pmoId]` "Portfolio" section, the executive panel, the capability flag, the command-center cross-PMO variables, and the UI-only disambiguation of `personal_portfolios`. None of these are touched by this ADR.
- This ADR does not specify exact column names, table names beyond `portfolios`, or index/constraint SQL — those are implementation-PR decisions, bounded by the domain rules above.

## UX Implications

- None are executed by this ADR. It is documentation-only.
- A future implementation/UX PR will need a plan to disambiguate `personal_portfolios` from the new PMI-Portfolio in user-facing copy (per rule 9 and the existing PR1 recommendation to rename it toward something like "Saved Projects"), so that two different screens do not both say "Portfolio" and mean different things.
- The existing `/portfolio` route (document/risk history keyed by `projectId`, breadcrumb "Project Controls") and the `/pmos/[pmoId]` "Portfolio" section (a plain project list) will both need to be renamed or re-pointed at the real entity in a future PR; this ADR does not schedule that work, only clarifies the target they should eventually be reconciled against.
- Any future onboarding or navigation surface introducing Portfolio to users must not present it as a folder, dashboard, tag, "all projects" view, or synonym for PMO/Program (rule 9) — this is a content/copy constraint for future PRs, not something this ADR implements.

## Compatibility Implications

- No breaking change to any existing table, route, API, or UI is made by this ADR — it is a decision record only.
- The existing six "Portfolio" usages (PR1 §9, §11, §13) continue to function exactly as they do today until a future implementation PR addresses them; nothing in this ADR removes or redirects them.
- `personal_portfolios` and its RLS model are unaffected and are not modified, merged, or deprecated by this decision.
- Once the future `portfolios` table exists, Programs and Projects created before that migration will have `portfolio_id = NULL` by default (optional membership, per rules 3-5), so no backfill is mandated by this ADR — though a future PR may choose to backfill for specific organizations as a product decision, which is out of scope here.
- This decision is compatible with, and does not require re-litigating, the already-resolved Workspace→PMO→Project spine (PR1 §16, §17) or the separately-ratified decision that a Project may exist without a PMO.

## Out of Scope

- No schema change, migration, table creation, or index is executed by this ADR.
- No product code, route, component, API, or navigation change is executed by this ADR.
- The analytical capabilities Portfolio must "eventually support" (prioritization scoring, investment tracking, capacity modeling, aggregate risk rollup, benefits tracking, scenario planning) are not designed, scoped, or scheduled here (rule 10) — they are future work, likely their own ADR(s) once the base aggregate exists.
- Cross-PMO Portfolio and cross-Workspace Portfolio are explicitly out of scope for the initial model (rules 11-12) and are not designed here.
- Many-to-many Project↔Portfolio and Program↔Portfolio relationships are out of scope for the initial model (rule 8) and are not designed here.
- The specific renaming/reconciliation plan for the six existing "Portfolio" usages is out of scope for this ADR; PR1 (§9, §11, §13) documents them and this ADR gives them a target concept, but the reconciliation plan itself belongs to a future implementation PR.
- Program's own relationship to the wider hierarchy (D-17, whether "Program" means the PMI Program or remains the existing roadmap-parsing tool) is a separate decision with its own ADR; this document only fixes Portfolio's relationship to Program (Portfolio→Program 1:N optional) and does not resolve D-17 itself.

## Validation

- This decision is validated against, and does not contradict, the ratified canonical hierarchy (Enterprise→Workspace→PMO→Portfolio→Program→Project) and the ratified cardinalities and invariants supplied for PR1.1, in particular: PMO→Portfolio 1:N with Portfolio→PMO N:1 required; Portfolio→Program 1:N optional with Program→Portfolio N:1 optional (max one primary Portfolio); Portfolio→Project 1:N optional with Project→Portfolio N:1 optional (max one primary Portfolio); no many-to-many relationships in the initial model; Portfolio does not cross Workspace.
- This decision is validated against the current-state evidence in `docs/product-architecture/01-canonical-domain-model.md` §9, §11, §13, and §18: it does not claim any of the six existing "Portfolio" usages already implement this model, and it does not claim a `portfolios` table exists today. Re-reading PR1's evidence at implementation time (future PR2) remains necessary, since this ADR ratifies intent, not current fact.
- Correctness check for a future implementation PR: after the `portfolios` table and its FKs exist, re-running the same audit method PR1 used (grep for `portfolio` across schema, TypeScript types, and routes) should show exactly one authoritative entity (`portfolios`, PMO-owned) plus one clearly-disambiguated sibling (`personal_portfolios`, user-owned), not six unreconciled meanings.
- No test suite, migration, or code exists yet to validate against, consistent with this being a ratification-only document; validation here is conceptual (consistency with the ratified hierarchy and invariants) rather than executable.

## References

- `docs/product-architecture/01-canonical-domain-model.md` — §5 (Product Vision), §9 (Current Entity Inventory), §11 (Route and UI Model), §12 (Contradictions, C-6), §13 (Duplication Classification), §14 (Canonical Domain Model), §18 (Portfolio Definition), §33 (Decision D-18), §44-45 (ADR backlog and ratification plan).
- `docs/product-architecture/01.1-domain-ratification.md` — PR1.1 ratification document (authored in parallel with this ADR).
- `docs/audits/conceptual-model-architecture-audit-2026-07-18.md` — sibling, unmerged audit whose alternative recommendation (retire the word "Portfolio") is addressed and rejected under Alternatives Considered.
- `supabase/migrations/20260714000000_personal_portfolio_foundation.sql` — existing `personal_portfolios` migration, the sibling concept disambiguated by rule 9.
- `supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql` — existing Workspace→PMO→Project migration, the pattern a future Portfolio migration is expected to follow for tenancy and FK enforcement.
