# 13 — Do Not Build (Yet)

Explicit list of things that should **not** be built in the current stage, with reasoning. Revisit each only when its stated trigger condition is met.

| Item | Why not now | Trigger to revisit |
|---|---|---|
| SCIM | No enterprise customer yet; SSO itself isn't built | First enterprise deal requiring SCIM provisioning |
| Marketplace | No third-party developer ecosystem exists; core product isn't even fully self-service yet | Public B2B is stable and a genuine partner-integration demand exists |
| Public API | Internal SDK (`src/sdk`) already exists in deferred/internal form; a public-facing API is a support and versioning commitment PMFreak isn't ready to make | Post-enterprise-readiness, with a dedicated API support process |
| Wallet UI / visible token | No AOC-consumed usage ledger exists yet to visualize (F-02); building a wallet UI ahead of real AOC consumption risks implying capability that doesn't exist | Only after real AOC Enterprise usage consumption is wired (`07-aoc-consumer-architecture.md` §C `AocUsagePort`) |
| Kubernetes | Current deployment (Vercel) is adequate for current scale; no evidence of a scaling problem Kubernetes would solve | Concrete scaling/operational need, not speculative future-proofing |
| Multi-region | No customer requirement identified; adds meaningful operational complexity (data residency, replication) with no current driver | A specific enterprise data-residency requirement |
| Microservices | The current monolithic Next.js app is not the bottleneck identified anywhere in this audit; splitting it now would multiply the AOC-boundary and RLS-consistency work already found to be incomplete | A specific, measured scaling bottleneck that a monolith cannot address |
| Partner portal | No partner program exists | Marketplace or reseller program stage (itself not currently justified) |
| Complex agent economy (agent-to-agent marketplaces, agent monetization) | The basic agent tool-execution layer is currently in-memory-only with no real side effects (F-11) — an "agent economy" built on top of that would be pure scaffolding on top of scaffolding | Only after F-11 is resolved and a real, audited agent action pipeline exists |
| Advanced Assurance UI | No AOC Assurance provider exists externally to source real assurance data from; building a UI for it now would mean displaying self-certified or fabricated assurance signals | Only after `AssuranceStatusPort` (§07) is wired to a genuine external AOC Assurance provider |
| Reseller program | No partner ecosystem, no marketplace, no proven repeatable sales motion yet | Post-enterprise-readiness, once a proven direct sales motion exists |

## Also flagged as premature by this audit specifically (beyond the brief's own list)

| Item | Why not now |
|---|---|
| Building out the "constitutional/sovereign/governance/digital-twin/predictive" module family into real functionality | No product-market signal that any of these speculative capabilities are what customers actually want; the immediate priority is separating real from speculative (F-03), not investing further in the speculative layer, until a specific customer demand justifies it |
| DB-driven/configurable plan catalog | Current hardcoded 2–3 tier model is adequate until the first enterprise custom-terms negotiation (F-14) |
| Full enterprise SSO/SCIM implementation | Correctly sequenced into Scenario C (`11-roadmap.md`), not before — building it speculatively ahead of a specific enterprise deal is premature investment given everything else still open |
| Building new "AOC-verified" trust/passport features on top of the current self-implemented trust layer | Would deepen the exact ownership violation flagged in F-02, rather than resolve it — any new trust/identity feature work should wait for the external provider or explicitly build toward the port/adapter boundary, never add new local-authority surface area |
