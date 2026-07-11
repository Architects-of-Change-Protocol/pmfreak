# Beta Release Closure Summary — Perilla 11 (updated by Perilla 12, Perilla 13)

> **Perilla 13 update (2026-07-11)**: fresh-database migration proof
> completed against a local PostgreSQL 16 (144 migration files — 142
> pre-existing + 2 new corrective migrations — 0 failures after
> remediation). 26 real migration defects were found and fixed, including a
> blocking `workspace_memberships` RLS-recursion bug confirmed via a live
> two-workspace tenant-isolation test (10/10 checks pass — see
> [`rls-tenant-isolation-report.md`](./rls-tenant-isolation-report.md) and
> [`migration-failure-remediation-log.md`](./migration-failure-remediation-log.md)).
> **RR-MIGRATE remains OPEN**: this environment had no hosted-Supabase
> credentials and no Docker daemon, so the strongest evidence achievable
> here is local-Postgres, not the hosted project or official local stack
> this PR's own honesty rule requires for closure (see
> [`fresh-database-migration-proof.md`](./fresh-database-migration-proof.md)).
> A new automation harness, `npm run check:fresh-db-migrations`
> (`scripts/check-fresh-db-migrations.mjs`), is ready to close it the moment
> those credentials or Docker access are available. Full suite still 12,207
> tests / 0 failures after all migration and source edits in this PR;
> `npm run check:beta-release` still reports `CONDITIONAL GO`. Decision
> remains **CONDITIONAL GO** with the same two pilot-blocking conditions as
> the Perilla 12 update below: RR-MIGRATE and RR-BACKUP.

> **Perilla 12 update (2026-07-11)**: pilot-blocking condition **RR-XLSX is
> closed** — the vulnerable `xlsx@0.18.5` dependency was removed and
> replaced with `exceljs@4.4.0` behind `src/lib/spreadsheets/`
> ([`xlsx-replacement-decision.md`](./xlsx-replacement-decision.md);
> boundary controls in
> [`../security/spreadsheet-processing-boundary.md`](../security/spreadsheet-processing-boundary.md)).
> `npm ls xlsx` → empty; `npm audit` → 0 critical / 0 high; full suite
> 12,207 tests / 0 failures; `check:dependency-security` exits 2 with 0
> unexpected findings (only pre-existing accepted moderates remain).
> The release decision remains **CONDITIONAL GO** with **two** remaining
> pilot-blocking conditions: RR-MIGRATE (fresh-DB migration proof) and
> RR-BACKUP (restore rehearsal). References to "three pilot-blocker
> conditions" and to the xlsx high below are the historical Perilla 11
> record.

Date: 2026-07-10. Scope: full-repository validation of `main` after the ten
hardening perillas, remediation of gate-blocking defects only, and an
evidence-backed release decision for a **closed, supervised pilot**.

## Scope

Eight blocks (A–H of the perilla brief): repository/CI closure, dependency
security closure, identity/invite-token closure, critical-flow validation,
AI runtime & cost guardrails, observability & operational readiness, data
recovery & migration readiness, and stale-PR cleanup — closed out by a
reproducible gate (`npm run check:beta-release`) and this evidence package.
No product features were added; every change traces to a failing check, a
confirmed vulnerability, a security debt previously documented as blocking,
or a closure requirement of the perilla itself.

## Checks executed

Full command-by-command evidence with exit codes and durations:
[`beta-release-gate-results.md`](./beta-release-gate-results.md). Headline:
clean-install `npm ci`, typecheck (0 errors), lint (0 errors), **12,165
tests / 0 failures**, production build, the governance/runtime/db-contract
battery, launch smoke, and `npm audit` all pass on the closing commit.

## Code changes made (all defect- or closure-traced)

**Identity / invite tokens (C)**
* `workspace_invitations` migrated to hash-only token storage
  (`20260820000000_workspace_invite_token_hashing.sql`): `token_hash`
  (sha256 of a 192-bit CSPRNG token) + `revoked_at` added, **plaintext
  `token` column dropped**, legacy pending invites revoked (policy decision:
  invalidate, don't migrate plaintext), authenticated column grant re-issued
  without the hash.
* `src/lib/security/invite-tokens.ts` (shared primitives, env-clamped
  `INVITE_TOKEN_TTL_HOURS`); `inviteWorkspaceMember` now returns the
  one-time accept URL and persists only the hash;
  `resolveValidWorkspaceInvite` looks up by hash. Acceptance remains a
  single conditional-UPDATE claim (replay-safe, Perilla 3 suite still
  green against hashed fixtures).
* New: `tests/workspace-invite-token-hashing.test.mjs` (13 tests: hash-only
  storage, legacy-token rejection, hash-as-token rejection, no token in
  logs, migration shape/idempotency/grants, TTL clamping).

**AI runtime & cost guardrails (E)**
* `src/lib/ai/runtime-limits.ts`: env-configurable, hard-clamped limits
  (`AI_REQUEST_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_CHAIN_DEPTH`,
  `AI_MAX_CONCURRENT_PER_WORKSPACE`, `AI_DAILY_REQUEST_LIMIT`,
  `AI_DAILY_COST_LIMIT_USD`) — invalid env can never disable a bound.
* `src/lib/ai/runtime-guardrails.ts`: per-workspace concurrency gate,
  per-provider circuit breaker (consecutive-failure, cooldown, half-open
  probe), chain-depth guard.
* `src/lib/ai/usage-accounting.ts` + `20260821000000_ai_usage_events.sql`:
  one accounting row per inference (provider/model/workspace/user/operation/
  tokens/estimated cost/status/duration), service-role-only table; daily
  cost ceiling reads it (fail-open by design — the fail-closed backstop is
  the daily request ceiling through the Perilla 9 abuse store).
* All of the above enforced at the single chokepoint
  `runInference()` (`src/lib/ai/providers/router.ts`), which every AI path
  (gateway modules, copilot, analyze-ai) already traverses.
* Abuse-limit enforcement added to the two AI routes that lacked it
  (`message-nudges`, `meta-intelligence`) + registry entries.
* New: `tests/ai-runtime-guardrails.test.mjs` (18 tests: timeout abort,
  bounded retries, no-retry on 401, concurrency bound/release, breaker
  open/half-open/re-open, depth guard, cost estimation/accounting, router
  wiring, migration shape).

**Observability (F)**
* `/api/ready` readiness probe (configuration + database reachability with
  `HEALTHCHECK_DATABASE_TIMEOUT_MS`-bounded ping; env *names* only, never
  values) alongside the existing `/api/health` liveness probe; registered in
  the public-route allowlist.
* `src/lib/observability/logger.ts`: structured JSON logger, LOG_LEVEL
  gated, every event passed through the Perilla 10 redaction layer
  (`redactSecretLikeValues`), request_id/workspace_id/route/duration field
  contract, never throws.
* New: `tests/observability-readiness.test.mjs` (9 tests: redaction,
  level gating, health shape, ready 200/503/timeout, no secret egress,
  registry coverage).

**Dependency security (B)**
* `next` + `eslint-config-next` 16.2.4 → **16.2.10** (fixes high middleware/
  proxy-bypass, DoS, SSRF advisories); `npm audit fix` cleared `ws` (high),
  `dompurify`, `js-yaml`, `qs`, `brace-expansion`, `@babel/core`.
* `xlsx` (high, no npm fix): prototype-pollution canary around every
  untrusted parse (`src/lib/security/prototype-pollution-guard.ts` +
  evidence-processor wiring + 5 tests) and an explicit pilot condition to
  install the vendor-CDN build. Full analysis:
  [`dependency-security-review.md`](./dependency-security-review.md).
* New advisory gate `npm run check:dependency-security` (allowlist ↔
  residual-risk-register cross-checked by test).

**Migration & recovery (G)**
* Non-timestamped migration renamed
  (`create_dashboard_task_lifecycle.sql` →
  `20260822000000_dashboard_task_lifecycle.sql`) with policies made
  idempotent — the only ordering-breaking file in 142 migrations.
* [`data-recovery-readiness.md`](./data-recovery-readiness.md): migration
  inventory (incl. documented timestamp collisions), rollback posture,
  backup/restore state + rehearsal condition, export gap, actual
  deletion/retention behavior.

**Repository / gate infrastructure (A, I)**
* `scripts/check-launch-readiness.mjs`: fixed `spawnSync ENOBUFS`
  false-failure (test output outgrew the 1 MB default buffer) — this gate
  could not produce a real verdict before.
* `scripts/check-beta-release.mjs` + `npm run check:beta-release`: ordered,
  fail-fast, blocking-vs-advisory gate with per-gate logs and a printed
  GO / CONDITIONAL GO / NO-GO decision; `build:aoc` ordered first (clean
  checkouts fail `check:governance` otherwise — found by this gate).
* `.gitignore`: AOC `dist/` build artifacts and gate logs.
* `.env.example`: all new knobs documented with safe examples.
* New: `tests/beta-release-gate.test.mjs` (gate contract).

## Security findings (and their closure)

* Plaintext invite bearer tokens (known Perilla 3/7 debt) — **closed** (see
  above; security docs updated in place).
* Two AI routes missing Perilla 9 abuse enforcement — **closed**.
* `next` 16.2.4 high advisories incl. middleware/proxy auth bypass —
  **closed** by upgrade.
* `xlsx` prototype pollution on the evidence-upload parse path —
  **mitigated** (canary + existing bounds), vendor upgrade is a pilot
  condition (RR-XLSX).
* Re-confirmed intact by the existing adversarial suites (all green): no
  client-controlled privileged role, no request-body actor authority, no
  metadata-only billing authority, no cross-workspace access, no client
  service-role use, no unsafe redirects, no unsigned Stripe webhooks, no
  debug routes in production, no secrets in client bundle or logs.

## Critical flow results (D)

Validated through the repo's behavioral/contract suites (12,165 tests, all
green), which cover: auth (signup role non-escalation, protected-route
rejection, session/metadata non-authority — Perillas 1/8 suites), workspace
(create/invite/accept/role-limit/last-owner/tenant isolation — Perillas 3/4
suites + hashed-invite suites), project (tenant-scoped CRUD + body-id
non-authority — authorization-adversarial suites), context ingestion
(size/extension/MIME/path-traversal/malicious-file cases — upload +
evidence suites + new pollution guard), AI (contract-mocked provider,
timeout/retry/limits — new guardrail suite + egress/abstraction contracts),
billing (checkout authorization, safe URLs, webhook signature + idempotency
— Perillas 2/6 suites), trial/early-access (founder-only mutation,
expiration — Perilla 5 suite). End-to-end against a live database remains a
pilot precondition (RR-MIGRATE) — the harness exists
(`check:operational-flow-db`) and refuses to run without an isolated
project, which this environment does not have.

## Remaining risks

See [`residual-risk-register.md`](./residual-risk-register.md) — 16 open
rows, 3 of them pilot-blocking conditions (RR-XLSX vendor upgrade,
RR-MIGRATE fresh-DB migration proof, RR-BACKUP restore rehearsal), the rest
mitigated-and-monitored for a closed pilot.

## Release decision

```
Decision: CONDITIONAL GO
```

Every release-blocking technical gate passes (typecheck, lint, full test
suite, production build, governance battery, launch smoke, db contract,
auth-bypass scan). No critical vulnerabilities remain; the one remaining
high (`xlsx`) has a shipped mitigation and a one-command closure condition.
The pilot may start once the three pilot-blocker conditions in the risk
register are met, under the supervision cadence defined in
[`pilot-operational-runbook.md`](./pilot-operational-runbook.md).

> PMFreak has passed all critical technical gates required for a closed,
> supervised pilot, with documented residual risks and operational
> conditions.
