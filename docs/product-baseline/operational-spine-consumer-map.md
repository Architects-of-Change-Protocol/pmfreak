# Canonical Operational Spine Consumer Map

P2-01 establishes executable business-lineage contracts in `src/lib/operational-spine/`. The canonical object order is Recommendation → Decision → Action → Task → Outcome, but each object has an independent stable ID and lifecycle. A successful transition never creates the next object.

The machine-readable inventory is `OPERATIONAL_SPINE_CONSUMER_MAP` in `src/lib/operational-spine/consumer-map.ts`. It classifies 30 material write, transition and lineage consumers or persistence owners as `CANONICAL`, `ADAPTER`, `BOUNDED_CONTEXT_MODEL`, `READ_PROJECTION`, or `MIGRATION_SOURCE`. No consumer is currently classified `UNKNOWN_REQUIRES_DECISION`; this means its bounded responsibility is known, not that it is wired to the canonical chain. Secondary analytics that merely mention an ID remain discoverable through repository search and are not misrepresented as aggregate owners.

`operational_decision_records` and its governed recommendation RPC remain the commercial Recommendation/Decision spine. `project_decisions`, legacy recommendation review, H5 task-draft conversion, execution tasks, operational-decision outcomes, and agent outcomes retain their bounded ownership and receive explicit legacy-reference/adapter targets. No persistence model, route, or runtime behavior is removed or merged by P2-01.

## Compatibility rules

1. Historical migration files remain immutable; future schema changes are forward-only.
2. A legacy ID is stored as a typed `LegacyReference`, never silently promoted into another canonical object kind.
3. The H5 direct Recommendation-to-task-draft path remains a migration source, not the canonical Action-to-Task contract.
4. Decision Governance remains an evidence-linked bounded context and audit adapter; it is not silently relabelled as `operational_decision_records`.
5. Agent outcomes remain agent-execution bounded models until a later verified Outcome adapter consumes them.
6. The internal execution task model is the candidate Task system of record for P2-07; P2-01 does not dispatch work.
7. Remote `allowDecisionWriteback` remains disabled.
8. Retirement requires consumer proof, replacement runtime evidence, migration/compatibility tests, and explicit authorization after G1.

Run `npx tsx --test tests/operational-spine-contract.test.ts` to validate ID parsing, lifecycles, transition separation, inventory completeness, classifications, and the remote-writeback invariant.
