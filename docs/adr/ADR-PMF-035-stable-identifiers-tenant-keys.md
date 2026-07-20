# ADR-PMF-035: Stable Identifiers and Tenant Keys

Status: Accepted
Date: 2026-07-20
Decision owners: Founder / Product Authority; PMFreak Architecture
Supersedes: None
Superseded by: None

## Context

PR5 must define how canonical records are identified, both for internal referential integrity (foreign keys) and for external interoperability (imports, integrations, human-facing keys like a Project code). Without an explicit decision, implementation PRs could mix database-generated sequential IDs, application-generated UUIDs, human-readable slugs used as primary keys, and externally-sourced identifiers used interchangeably as if they were equivalent — which would make foreign keys fragile (slugs can change; sequential IDs leak ordering and volume information across tenants) and would make multi-provider integration (Jira, GitHub, billing providers) ambiguous about which identifier is canonical.

This decision also intersects with tenancy: several entities (Enterprise, Workspace, PMO, Portfolio, Program, Project) need both a stable internal identifier and, optionally, a human-readable key or slug for URLs and display — and these two concerns must not be collapsed into one column.

## Decision

**Canonical records use stable, globally unique, non-reused, non-name-derived identifiers as their primary keys. Human-readable keys (slugs, codes) are optional, separately stored, mutable, and never used as a foreign key target. External identifiers (from integrations or imports) are stored as separate, provider-namespaced references and are never used as a primary key.** The specific identifier generation scheme (UUID, UUIDv7, ULID, or database-generated) is left open (§67) pending an implementation-time evaluation, but whichever is chosen must satisfy the properties in the Persistence Rules below for every canonical record type.

## Persistence Rules

1. Every canonical record has exactly one stable identifier that is: globally unique, never reused after deletion, not derived from a human-editable name, not inherently sensitive (does not leak PII or business volume by construction), stable for the life of the record, and compatible with bulk import/export.
2. Human-readable keys (e.g., a Workspace slug, a Project key/code, a PMO code) are optional, may change over time subject to product rules, and are never referenced by foreign key from another table — foreign keys always reference the stable identifier.
3. External identifiers (a Jira issue ID, a GitHub PR number, a billing provider's customer ID) are stored as `(provider, external_id)` pairs scoped to the owning canonical record, never promoted to be the record's primary key, and never assumed unique across providers without the provider qualifier.
4. Identifiers are never recycled: once assigned to a record (even a later-deleted one), an identifier value is never reassigned to a different record.
5. The identifier/key/external-ID matrix below is the canonical reference for which concepts need which kind of identifier.

**Identifier matrix**

| Concept | Canonical ID | Human-readable key | External IDs |
|---|---|---|---|
| Enterprise | `enterprise_id` | optional slug/code | provider IDs (billing, SSO) |
| Workspace | `workspace_id` | optional slug | external tenant ID |
| PMO | `pmo_id` | optional code | external PMO ID |
| Portfolio | `portfolio_id` | optional code | external portfolio ID |
| Program | `program_id` | optional code | external program ID |
| Project | `project_id` | project key/code | Jira/GitHub/etc. |
| Recommendation | `recommendation_id` | none required | model/run refs |
| Decision | `decision_id` | optional decision number | external approval ID |
| Action | `action_id` | optional action number | external task ID |
| Outcome | `outcome_id` | none required | measurement ID |
| Agent Run | `agent_run_id` | run reference | provider run ID |
| Evidence | `evidence_id` | optional evidence code | source object ID |
| Memory Record | `memory_record_id` | none required | source record ID |
| Knowledge Record | `knowledge_record_id` | none required | external knowledge ID |

6. Imports from an external system must namespace the external identifier by provider (`source_type`, `source_id`) so two providers' colliding ID spaces (e.g., both using integers starting at 1) can never be confused as the same canonical record.

## Alternatives Considered

- **Database-generated sequential integer IDs as primary keys.** Rejected as the default: sequential IDs leak record counts and creation order across tenants if ever exposed (even indirectly, e.g., in error messages or timing side channels), and complicate merge/import scenarios where two previously-independent datasets must combine without ID collisions. Not ruled out for genuinely internal, never-exposed technical tables, but not the default for canonical, potentially cross-system-referenced records.
- **Human-readable slugs as primary keys.** Rejected: slugs are exactly the kind of value product and UX requirements need to change over time (renaming a Workspace, correcting a typo in a Project code) — using a mutable, human-editable value as an immutable foreign-key target would force either a slug-change-forbidden rule (a poor UX constraint) or a cascading-rename problem across every referencing table.
- **A single identifier scheme with no distinction between internal ID, human key, and external ID.** Rejected: collapsing these three concerns has caused exactly the ambiguity PR1/PR4's terminology-discipline work is meant to prevent at the domain layer — an external Jira ID is not stable enough to be a primary key (a record could be re-imported, or a provider's ID scheme could change), and a human key is not immutable enough.

## Positive Consequences

- Foreign keys remain stable even when a Workspace, Project, or PMO's human-facing name or slug changes.
- Bulk import/export and multi-Enterprise or multi-environment data movement (e.g., staging to production, or Enterprise-level data portability per §49) do not risk identifier collisions.
- External integrations (Jira, GitHub, billing providers) have an explicit, namespaced place to live without contaminating the canonical identifier space.

## Negative Consequences

- Requires every table design to include (at minimum) a stable ID column, and often a separate optional key/slug column, adding schema surface versus a naive single-ID design.
- Provider-namespaced external ID storage requires a slightly more complex model (`(source_type, source_id)` pairs or a dedicated external-reference table) than a single flat external-ID column.

## Risks

- **Accidental external-ID-as-PK risk:** a future integration feature could be built quickly by treating an external ID as if it were the canonical ID, especially for a single-provider integration where the temptation to skip the namespace pair is highest — data-quality checks (§57 of the persistence architecture) must catch this.
- **Slug uniqueness-scope risk:** slugs are unique within a scope (e.g., Workspace slug unique within Enterprise, Project key unique within Workspace, per §19) — getting the uniqueness scope wrong could allow a slug collision across unrelated Enterprises or Workspaces, which is a data-quality and possibly security concern (predictable/guessable slugs used for authorization) if slugs are ever used in access-sensitive contexts.

## Security and Data Implications

- Non-sequential, non-name-derived, non-reused identifiers reduce enumeration and information-leakage risk if an identifier is ever exposed in a URL, error message, or log.
- External identifiers stored separately from canonical IDs prevent a compromised or malicious integration payload from spoofing a canonical identifier and colliding with an existing record.

## Application Implications

- Command handlers generate or receive the canonical ID at aggregate-creation time (exact generation point — client-generated vs. server-generated — is left open pending the UUID-version decision in §67).
- Repositories key all lookups and foreign keys on the canonical ID, never on the human-readable key, except for user-facing lookup queries explicitly designed to resolve a slug to a canonical ID first.

## API Implications

- PR6's API contracts may expose human-readable keys in URLs for readability (e.g., `/workspaces/acme-corp/projects/PROJ-123`) but must resolve them server-side to canonical IDs before any persistence operation — the slug is a lookup convenience, never a persistence-layer reference.

## UX Implications

- Human-readable keys and slugs remain the primary way users see and share references to Workspaces, Projects, PMOs, etc., consistent with PR3's information architecture; this ADR does not change what users see, only what the database uses internally.

## Migration Implications

- Existing tables using sequential integer IDs are not retroactively changed by this ADR; the migration strategy (ADR-PMF-044) addresses how (and whether) any given legacy table's ID scheme is brought into alignment, phase by phase, with evidence.

## Operational Implications

- Bulk data operations (backup restore into a fresh environment, tenant export/import) are simplified by globally unique, non-sequential identifiers that will not collide with an existing environment's data.

## Compatibility Implications

- Supabase and PostgreSQL both support UUID and other identifier types natively; this ADR does not require any tooling change to remain compatible with the existing platform choice (ADR-PMF-033).

## Out of Scope

- The exact identifier generation algorithm (UUID v4 vs. UUIDv7 vs. ULID vs. database-generated) — left open per §67, pending implementation-time evaluation of sortability, index-locality, and Supabase/Postgres ecosystem support.
- Exact slug uniqueness enforcement mechanism (unique index, exclusion constraint) — deferred to implementation.

## Validation

Validation criteria: (1) the identifier matrix in this ADR matches the one in `05-canonical-persistence-architecture.md` §11 exactly; (2) no canonical record type in `05-canonical-data-model.md` uses a human-readable key or an external ID as its primary key; (3) every external-ID reference documented in the data model is expressed as a provider-namespaced pair, not a bare value.

## References

- `docs/product-architecture/05-canonical-persistence-architecture.md` §11
- `docs/product-architecture/05-canonical-data-model.md`
- `docs/adr/ADR-PMF-034-workspace-scoped-operational-persistence.md`
