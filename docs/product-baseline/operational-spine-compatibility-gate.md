# P2-02 compatibility and correlation safety gate

P2-02 adds **pure, non-persisting** compatibility reads. Supported retained identities are operational recommendations, recommended actions, governed operational decision records, project decisions, task drafts, execution tasks, agent decisions, agent execution outcomes, and analytical operational-decision outcomes. `recommended_action_decision` remains an explicit unsupported migration/audit source: it is not silently promoted to a canonical Decision.

Resolution accepts only caller-authorized Workspace and Project scope and an injected read-only mapping reader. A result is either a verified mapping or an explicit invalid, unsupported, unresolved, scope-mismatch, duplicate, conflicting-owner, stale-version, or unavailable-dependency failure. The adapter retains legacy identity and bounded-context owner; a projection is never a claim that the legacy record is canonical. No route, repository, database table, RLS policy, lifecycle, or write path changes in P2-02.

Correlation projections retain actor and timing, evidence, confidence, authority references, source/legacy references, correction/supersession, correlation, and causation. Null lineage stays null. Event projection labels partial and unresolved lineage and does not infer causal certainty.

Run the independently executable behavioral gate with:

```bash
npx tsx --test tests/operational-spine-compatibility.test.ts
```

The gate validates all 30 inventoried consumer paths and symbols, metadata, unique identities, canonical-kind coverage, supported classifications, and the absence of unresolved material consumers. It deliberately fails on drift. Retirement candidates remain retained.

G1 proves only that the executable canonical contracts and retained compatibility boundaries are safe foundations for later prompts. It does not prove intake/provenance, Evidence derivation, Decision-to-Action, AOC grants, Action-to-Task dispatch, Outcome Observation, Founder Invite UX, or production readiness. Adapters expire only through a later explicitly authorized retirement prompt with replacement runtime and migration evidence; P2-02 removes none.
