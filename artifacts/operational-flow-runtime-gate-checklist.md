# Operational-flow Runtime Gate — Execution Checklist

**Gate:** P1.7 Post-Merge Hardening — Runtime Validation  
**Required before:** any release or demo  
**Instructions:** docs/operational-flow-runtime-gate.md  
**Merge audited:** `38f9129` — Build complete cognitive-operational flow

Fill in executor, date, and environment, then tick each item as you complete it.

---

**Executor:**  
**Date:**  
**Environment:** (local Supabase / remote branch project)  
**Supabase project ref:** (never write production here)  
**App URL:**  

---

## Infrastructure

- [ ] Isolated Supabase project created (not production, not shared staging)
- [ ] Migrations applied — `20260611000000_operational_evidence_decision_loop` is last in `supabase migration list`
- [ ] `.env.local` configured from `.env.operational-flow.example`
- [ ] `npm install` run successfully
- [ ] Next.js app running locally (`npm run dev`) against the isolated project

---

## Automated checks

- [ ] `npm run check:db-contract` — exits 0
- [ ] `node --test tests/operational-flow-contract.test.mjs` — 11/11 pass (including test 11 with isolated Supabase)
- [ ] `node --test tests/recommended-actions.test.mjs` — 46/46 pass
- [ ] `npm run check:operational-flow-db` — exits 0, prints `"ok": true` with all 12 checks listed
- [ ] Terminal output of `check:operational-flow-db` saved to `artifacts/`

---

## Idempotent seed

```
npm run seed:operational-flow -- <workspace-id> <user-id>
npm run seed:operational-flow -- <workspace-id> <user-id>
npm run seed:operational-flow -- <workspace-id> <user-id> --reset
```

- [ ] First run: `disposition: "created"`, `projectDisposition: "created"` or `"reused"`
- [ ] Second run: `disposition: "reused"`, **same `projectId`** as first run
- [ ] Third run (`--reset`): `disposition: "reset"`
- [ ] No duplicate signals/risks/governance events confirmed (counts match `{signals:2, risksIssues:2, governanceEvents:2, recommendations:2}`)

---

## Smoke test (authenticated browser)

- [ ] Login succeeds as workspace owner
- [ ] `/command-center?projectId=<demo-project-id>` loads — **Evidence tab is first**
- [ ] New evidence item created (manual note)
- [ ] Run chain → deterministic signal appears
- [ ] Risk/issue record appears linked to signal
- [ ] Governance check appears linked to risk/issue
- [ ] Recommended action appears linked to governance event
- [ ] Decision registered as owner
- [ ] Evidence freeze indicator appears on evidence item after decision
- [ ] Page refresh → all data persists (no phantom data loss)
- [ ] Project Assurance Summary v1 opens and shows correct counts
- [ ] Screenshot saved: Command Center with evidence tab

---

## Security denial checks

- [ ] Unauthenticated `GET /api/operational-flow` → HTTP 401
- [ ] Viewer `POST /api/operational-flow` create_evidence → HTTP 403
- [ ] Owner creates evidence in wrong workspace → HTTP 403
- [ ] Authenticated user direct INSERT into `operational_signals` → DB denial
- [ ] Authenticated user direct INSERT into `governance_events` → DB denial
- [ ] PM tries to accept sponsor/PMO recommendation via `record_operational_decision` RPC → DB denial
- [ ] Direct `UPDATE` on `operational_decision_records` → DB denial (append-only)
- [ ] Direct `UPDATE` on `decision_evidence_links` → DB denial (append-only)
- [ ] Direct `UPDATE` on frozen `evidence_items` → DB denial (immutable)
- [ ] Cross-workspace evidence read → returns 0 rows (RLS filters)
- [ ] Cross-workspace evidence write → DB denial
- [ ] `POST /api/recommended-actions/decision` on governed recommendation → HTTP 409

---

## Legacy bypass

- [ ] Governed recommendations do NOT appear in `GET /api/recommended-actions` legacy list
- [ ] `POST /api/recommended-actions/decision` returns `governed_flow_required` (409) for governed recommendations
- [ ] No governed decision possible without `operational_decision_record` + `decision_evidence_link`

---

## Evidence preservation

- [ ] Terminal output of `check:operational-flow-db` (full JSON) saved
- [ ] Terminal output of both seed runs saved
- [ ] Screenshot: Command Center evidence tab
- [ ] Screenshot: completed chain (signal + risk + governance + recommendation)
- [ ] Screenshot: decision record with authority basis
- [ ] Screenshot: frozen evidence indicator
- [ ] Screenshot: Project Assurance Summary v1

---

## Final verdict

> Fill this in after all checks above are complete.

- [ ] **PASS** — all checks green, gate complete, main approved for release/demo
- [ ] **FAIL** — one or more checks failed; open P0 hotfix before release

**Verdict:**  
**Signed off by:**  
**Date:**  

---

## Preexisting issues (non-blocking for this gate)

These are tracked separately and were not introduced by merge `38f9129`:

| Issue | Source commit | Status |
|---|---|---|
| `check:governance` drift (connector-types, autonomous-intervention-types) | `2d77158` | Open — fix separately |
| 3 security boundary tests failing (routes, runtime-consumer, beta flag) | `42d9dea`, `2d77158`, `e43b732` | Open — fix separately |
| `npm run build` requires `npm install` in CI container | Environment | Operational — not a code defect |
