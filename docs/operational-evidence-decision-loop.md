# Governed operational evidence-to-decision loop v1

PMFreak exposes one project-scoped circuit:

`Evidence → deterministic signal → risk / issue → governance check → recommendation → authorized human decision → immutable evidence snapshot`

## Demo Truth Contract

### Real and enforced

- Evidence, derived records, recommendations, decisions, evidence snapshots, detector runs and outputs are persisted in Postgres.
- The public API exposes only evidence intake, root-derived chain materialization and evidence-backed decisions. It does not accept arbitrary signal/risk/governance combinations.
- Chain materialization is one Postgres transaction rooted at `evidence_item_id`. Stable uniqueness keys make reprocessing idempotent without reopening risks or replacing human owner/due-date/lifecycle fields.
- Governed decisions derive their evidence through recommendation → governance event → risk/issue → signal → evidence lineage.
- Decision creation, evidence snapshot/link/freeze and recommendation transition occur in one transaction.
- RLS distinguishes project read access from operational write roles. The canonical database roles are `owner`, `admin`, `pm` and `viewer`; only `owner/admin/pm` can create evidence, and derived/audit rows have no direct authenticated insert policy.
- Governance events, decisions, evidence links, signals, completed detector runs and outputs are append-only. Evidence is content-hashed, versioned on pre-decision edits and frozen when linked to a decision.
- Authority is checked against **PMFreak role mapping v1**. `owner/admin` satisfy all alpha requirements; `pm` satisfies baseline/project-manager requirements and may record escalation/review states, but cannot approve sponsor/PMO, authorized-approver or commercial-owner requirements.
- Legacy recommendation accept/reject/defer/convert paths reject governed recommendations.
- Project assurance metrics use exact count queries; the recent feed remains intentionally limited.

### Deterministic, not AI

`system/deterministic:governance_signal_detector_v1` is a bilingual regular-expression rule engine. Its `confidence_score` is a fixed rule-match score, not model confidence. `agent_runs` is an execution log schema; the detector is not represented as an autonomous agent or LLM.

### Not implemented and must not be claimed

- No AOC Protocol claim, approval token or external authority runtime is issued. PMFreak rules are aligned with AOC concepts; they are not “AOC Protocol enforced authority.”
- “Record escalation decision” records an auditable state; it does not notify a sponsor or create an escalation task.
- “Mark as needing more evidence” records that state; it does not send an evidence request.
- “Record modification rationale” preserves the rationale; it does not silently rewrite the original recommendation.
- The assurance surface is **Project Assurance Summary v1**, not enterprise portfolio assurance, certification or a multi-project control dashboard.
- The canonical membership schema has no `external_stakeholder`, `executive_viewer`, `contributor` or `ai_agent` roles. Unknown/non-human roles are denied by the application authority evaluator, but those roles cannot be represented as memberships until the canonical role model is deliberately expanded.

## Governance rules v1

| Signal | Required control | PMFreak v1 decision authority |
| --- | --- | --- |
| `missing_approval` | Decision and formal evidence | owner/admin (`authorized approver`) |
| `scope_creep` | Sponsor/PMO decision | owner/admin |
| `billing_risk` | Formal commercial evidence | owner/admin (`commercial owner`) |
| `stakeholder_blocker` | Escalation or human decision | owner/admin; PM may record escalation |
| `delivery_impediment` | Accountable owner and target date | owner/admin/PM when the requirement maps to accountable/project authority |
| Other matched signal | Baseline review | owner/admin/PM |

No matching rule means the evidence remains visible as “Recorded; no deterministic signal matched.” The system does not invent a signal.

## API surface

Every request requires authentication, project access and an exact `workspaceId`/`projectId` pair.

- `GET /api/operational-flow`: recent evidence and chain feed plus exact project metrics.
- `POST /api/operational-flow`, `operation=create_evidence`.
- `POST /api/operational-flow`, `operation=run_chain` with only an `evidenceItemId` root.
- `POST /api/operational-flow`, `operation=record_decision`. The client cannot provide `authority_basis` or arbitrary evidence for governed recommendations.
- `GET /api/operational-flow/assurance`: exact project assurance summary.

Internal risk/governance/recommendation creation is not a public operation.

## Demo seed

Use an isolated/demo workspace and an existing `owner` or `admin` actor:

```bash
npm run seed:operational-flow -- <workspace-id> <actor-user-id>
npm run seed:operational-flow -- <workspace-id> <actor-user-id> # reuses the same scenario
npm run seed:operational-flow -- <workspace-id> <actor-user-id> --reset
```

Required environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The stable scenario key is `client_scope_alignment_v1`. Stable IDs and a project metadata key prevent duplicate chains. `--reset` deletes only records with the scenario’s stable IDs and recreates them; it does not delete unrelated project data. Output reports `created`, `reused`, `repaired` or `reset`, scope IDs, URL and counts.

## Verification

Static/contract tests are intentionally named as such:

```bash
node --test tests/operational-flow-contract.test.mjs
node --test tests/recommended-actions.test.mjs
```

Real RLS/DB verification requires an **isolated, already migrated Supabase project** and fails explicitly when it is absent:

```bash
export OPERATIONAL_FLOW_TEST_SUPABASE_URL=...
export OPERATIONAL_FLOW_TEST_ANON_KEY=...
export OPERATIONAL_FLOW_TEST_SERVICE_ROLE_KEY=...
export OPERATIONAL_FLOW_TEST_BASE_URL=http://localhost:3000 # app configured against the same test project
export OPERATIONAL_FLOW_TEST_ALLOW_DESTRUCTIVE=true
npm run check:operational-flow-db
```

That verifier requires the PMFreak app to be running against the same isolated Supabase project. It creates temporary auth users and tenants, signs in through `/api/login`, exercises the operational-flow API, and attempts real allowed/denied database operations: owner evidence creation, viewer denial, direct signal/governance denial, cross-workspace denial, PM authority denial, transactional decision, append-only mutations, frozen evidence, reprocessing idempotency, assurance counts above 30 and two consecutive seed executions. It cleans up temporary data. Do not point it at production.

There is no local Supabase/Docker harness in this repository environment. Contract tests must not be described as DB E2E tests, and the PR is not security-validated until the real verifier passes against an isolated migrated database.
