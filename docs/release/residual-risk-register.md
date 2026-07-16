# Residual Risk Register — Perillas 11–13B (Beta Release Closure Gate)

Maintained as of 2026-07-15 (Pilot Gate Sprint 01). Every row in the open table is a
real, open risk; risks resolved by Perilla 11 were removed (plaintext invite
tokens, unbounded AI execution, missing readiness probe, missing log
redaction path, next/ws/transitive dependency highs, non-ordered migration
file). Closed risks with lasting controls keep a traceability entry in the
"Closed" section below (RR-XLSX, Perilla 12).

Severity/likelihood/impact: H/M/L. "Pilot Blocker" means the closed,
supervised pilot must not start until the row's mitigation/condition is met.

| ID | Risk | Severity | Likelihood | Impact | Mitigation | Owner | Target Date | Pilot Blocker |
| -- | ---- | -------: | ---------: | -----: | ---------- | ----- | ----------- | ------------- |
| RR-MIGRATE | Perilla 13: fresh-apply proven against a *local* PostgreSQL 16 (144 migrations, 0 failures after remediation; 26 real migration defects found and fixed, including a blocking `workspace_memberships` RLS recursion bug — see `docs/release/migration-failure-remediation-log.md`). **Perilla 13B (this update)**: still **no hosted Supabase credentials available** in this environment, so the hosted fresh-apply itself was not run — but the harness, safety tests, and static evidence that don't require hosted access were completed: hosted-mode repeatability verification added to `scripts/check-fresh-db-migrations.mjs` (parses `supabase migration list --linked`, fails on remote-pending/remote-unexpected/count-mismatch); 20 new behavioral safety-guard tests (`tests/fresh-db-migrations-safety-guard.test.mjs`) confirming production-ref rejection, project-ref-mismatch rejection, missing-confirmation rejection, and secret redaction — all executed for real, none require network access; a full static SECURITY DEFINER audit (new `npm run check:security-definer-hardening`, now a blocking beta-release gate) found and fixed 2 genuine gaps across 8 functions (1 missing `search_path`, 8 missing an explicit PUBLIC execute revocation — see `docs/release/hosted-grants-report.md`), landed as 2 corrective migrations (144→**146** migration files); a static RPC signature inventory (`docs/release/hosted-rpc-signature-report.md`) confirmed all 8 distinct RPC functions' call-site arguments match their migration-defined signatures. **None of this constitutes hosted execution** — templates/stubs were created for the hosted-only evidence (`hosted-supabase-migration-proof.md`, `hosted-rls-role-matrix.md`, `generated-types-drift-report.md`, `existing-database-compatibility-report.md`), each explicitly marked NOT EXECUTED with the exact commands to run once credentials exist. **RR-MIGRATE remains OPEN.** **Pilot Gate Sprint 01 (2026-07-15)**: hosted credentials still absent; Docker daemon available but the environment's egress policy blocks container-registry CDNs, so the official local stack could not start either. Executed instead against a real installed PostgreSQL 16.13: 3 independent fresh applies (146/146, 146/146 repeatability, and **147/147** including a new corrective migration) with the third run mirroring hosted default privileges (`ALTER DEFAULT PRIVILEGES` before apply); live two-workspace RLS smoke test **10/10 PASS**; `check:db-contract` PASS; **one new real defect found and fixed live** — `agent_attestation_nonces` (RLS-off by design) was readable/writable by `authenticated` under hosted-default grants, closed by `20260826000000_fix_agent_attestation_nonces_grants.sql` and re-verified (`permission denied`). Full evidence: `docs/release/pilot-gate-migration-proof.md`. **RR-MIGRATE remains OPEN** — hosted execution is still the missing evidence; remaining work is runbook §10 (~half a day once credentials exist). | M | L | H | Run `npm run check:fresh-db-migrations` in hosted mode against an isolated Supabase project — needs `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_URL` (env var names now documented in `.env.example`), **or** Docker access for the official local stack — then follow `docs/release/database-bootstrap-runbook.md` §10 "Full hosted closure checklist" end-to-end, updating every hosted-* evidence doc with real results before moving this row to Closed | Repo owner | Before pilot start | **Yes** |
| RR-BACKUP | **Pilot Gate Sprint 01 (2026-07-15): restore drill REHEARSED with evidence** — timed `pg_dump -Fc` (0.35 s) → `pg_restore` (13.5 s, zero warnings) into a scratch database on the fully-migrated 409-table schema; 10-metric integrity diff IDENTICAL (incl. data checksum); RLS re-verified live on the restored DB. Procedure + RPO/RTO statement: `docs/release/backup-restore-drill.md`. **Remains OPEN** on one operator step: confirm pilot project backup tier/PITR and one hosted restore rehearsal (~15 min once the hosted project exists). | M | L | H | Confirm Supabase backup tier/PITR; perform one restore rehearsal to a scratch project (runbook §8) | Repo owner | Before pilot start | **Yes** |
| RR-PENTEST | No third-party penetration test | M | M | H | Closed pilot with known participants; all ten perillas' internal adversarial test suites pass; schedule external test before any open beta | Repo owner | Before open beta | No |
| RR-SOC2 | No SOC 2 / ISO certification | L | — | M | Out of scope for a closed pilot; disclose to pilot participants | Repo owner | GA planning | No |
| RR-CSP | CSP still allows `unsafe-inline` styles (Next.js constraint) | M | M | M | Framework-level; re-evaluate with next CSP-nonce support; XSS surface otherwise reduced (React escaping, no `dangerouslySetInnerHTML` on user input) | Repo owner | Next hardening sprint | No |
| RR-SECRETS | No automated secret rotation / secret-manager integration (env-var based) | M | L | H | Perilla 10 boundary checks prevent exposure; manual rotation procedure in runbook §9; Vercel/Supabase console rotation is one-step | Repo owner | Next hardening sprint | No |
| RR-WAF | No WAF/CAPTCHA in front of public endpoints | M | M | M | Perilla 9 abuse-protection (durable fixed-window limits) on signup/invite/billing/AI; Vercel platform DDoS mitigation; closed pilot = low exposure | Repo owner | Before open beta | No |
| RR-STRIPE-ENV | Stripe test-vs-live mode correctness depends on env discipline | M | L | H | Webhook signature verification + mode validation shipped (Perilla 6); runbook §6 requires explicit live-mode confirmation before pilot billing | Repo owner | Pilot start | No (runbook step) |
| RR-AI-COST | AI cost ceiling uses *estimated* prices and fails open if the accounting read fails | M | M | M | Durable fail-closed daily request ceiling backs it; price table reviewed at deploy; monitor `ai_usage_events` weekly during pilot (runbook §10) | Repo owner | During pilot | No |
| RR-EXPORT | No full workspace data export (computed-artifact exports only) | M | M | M | Closed pilot commitment: operator-run SQL export on request; product export is roadmap scope | Repo owner | Before open beta | No |
| RR-MONITOR | No external monitoring/alerting platform integration; alerts are log/audit-table based | M | M | M | Instrumentation points exist (`logSecurityEvent`, structured logger, `/api/ready`); runbook §7 defines a manual daily check cadence + the alert-worthy event list | Repo owner | During pilot | No |
| RR-LOGGER-ADOPTION | Legacy `console.*` call sites (~200) don't yet route through the redacting logger | L | M | L | Redaction utility + logger shipped and used by new/critical paths; sweep confirmed no current call site logs secrets; adopt incrementally | Repo owner | Rolling | No |
| RR-RLS-LEGACY | `onboarding_analyses` / `governance_audit_events` still on legacy `company_id` RLS (PR #148 intent) | L | L | M | Isolation still enforced via JWT claim model; rebuild #148's migration from a clean branch | Repo owner | Next hardening sprint | No |
| RR-INVITE-DELIVERY | Workspace invite links are returned to the inviter (one-time) but not emailed automatically | L | M | L | Product gap, not security (early-access flow has email delivery to mirror); inviter delivers link out-of-band during pilot | Repo owner | Roadmap | No |
| RR-ABUSE-MEMORY | In-memory abuse-store fallback doesn't share counters across serverless instances when service-role env is absent | L | L | M | Production sets service-role env → durable Supabase-backed store is used (fails closed); documented in Perilla 9 | Repo owner | — | No |
| RR-POSTCSS | Moderate postcss stringify advisory bundled inside `next` (no stable fixed release) | L | L | L | Build-time only; postcss never stringifies user input here. Re-check on each next patch; drop `check:dependency-security` allowlist entry when fixed | Repo owner | Next `next` patch | No |
| RR-FOUNDER-PROGRAM | Founder Circle Program (Sprint 01) residuals while enabled: (R1) program governs membership, not platform entry — open signup remains the platform's pre-existing posture; (R2) operator role = founder/internal, no finer program-operator role or two-person rule; (R3) settings row edited via manual service-role SQL by design; (R4) capacity race-safety proven via the SECURITY DEFINER function + mirrored test double, but no hosted concurrency run yet (blocked on RR-MIGRATE); (R5) migration `20260828000000` not yet through any fresh-apply run. Full analysis: `docs/founder-program/11-security-review.md`. Program is default-off and fail-closed in every environment until explicitly enabled | M | L | M | Enable only via `docs/founder-program/14-launch-checklist.md`; close R4/R5 together with RR-MIGRATE's hosted run; revisit R2 before any EXPAND COHORT decision | Repo owner | Before founder cohort start | No (program off by default) |

## Closed

### RR-XLSX — vulnerable `xlsx@0.18.5` spreadsheet parser — **Closed** (2026-07-11, Perilla 12)

* **Was**: `xlsx@0.18.5` (last npm-published SheetJS build) with high
  prototype-pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9)
  advisories, reachable from the untrusted evidence-upload parse path; no
  npm fix; vendor CDN (cdn.sheetjs.com) blocked by build-env egress (403,
  re-verified 2026-07-11), so the Perilla 11 condition ("install the CDN
  build") was not executable.
* **Closure**: dependency **removed** and replaced with `exceljs@4.4.0`
  (npm registry, lockfile-pinned) behind a new internal abstraction
  (`src/lib/spreadsheets/`), per
  [`xlsx-replacement-decision.md`](./xlsx-replacement-decision.md).
  Closure commit: the Perilla 12 PR
  (branch `claude/xlsx-dependency-security-35m85v`).
* **Audit evidence**: `npm ls xlsx` → `(empty)`; `npm audit` → 0 critical,
  0 high (the xlsx findings are gone; the one new moderate — transitive
  `uuid` via exceljs — is unreachable, see
  [`dependency-security-review.md`](./dependency-security-review.md)).
* **Test evidence**: `tests/spreadsheet-reader-contract.test.ts`,
  `tests/spreadsheet-security-boundary.test.ts`,
  `tests/spreadsheet-export-workbook.test.ts`,
  `tests/spreadsheet-dependency-boundary.test.mjs`,
  `tests/prototype-pollution-guard.test.mjs` — all green in the full suite.
* **Lasting controls**: `xlsx` is permanently forbidden
  (`scripts/check-dependency-security.mjs` FORBIDDEN_PACKAGES +
  `tests/spreadsheet-dependency-boundary.test.mjs`); the untrusted-parse
  boundary (size/sheet/row/column/cell caps, macro/external-link/OLE/zip-bomb
  rejection, pollution canary, parse deadline) is documented in
  [`../security/spreadsheet-processing-boundary.md`](../security/spreadsheet-processing-boundary.md).

## Resolved in Perilla 11 (removed from the register)

* Plaintext workspace invite tokens → hashed storage, plaintext column
  dropped, legacy invites revoked, replay-proof (Perilla 11 §C).
* Unbounded AI execution/cost → timeout/retry/concurrency/depth/daily
  request+cost ceilings, circuit breaker, usage accounting (§E).
* No readiness probe / no structured redacting logger → `/api/ready`,
  `src/lib/observability/logger.ts` (§F).
* `next` 16.2.4 highs (middleware bypass, DoS, SSRF), `ws` high, and five
  fixable moderates/lows → upgraded/fixed (§B).
* Non-timestamped migration file (`create_dashboard_task_lifecycle.sql`) →
  renamed + idempotent policies (§G).
* `check:launch-readiness` ENOBUFS false-failure → buffer fix (§A).
