# Residual Risk Register — Perillas 11–12 (Beta Release Closure Gate)

Maintained as of 2026-07-11 (Perilla 12). Every row in the open table is a
real, open risk; risks resolved by Perilla 11 were removed (plaintext invite
tokens, unbounded AI execution, missing readiness probe, missing log
redaction path, next/ws/transitive dependency highs, non-ordered migration
file). Closed risks with lasting controls keep a traceability entry in the
"Closed" section below (RR-XLSX, Perilla 12).

Severity/likelihood/impact: H/M/L. "Pilot Blocker" means the closed,
supervised pilot must not start until the row's mitigation/condition is met.

| ID | Risk | Severity | Likelihood | Impact | Mitigation | Owner | Target Date | Pilot Blocker |
| -- | ---- | -------: | ---------: | -----: | ---------- | ----- | ----------- | ------------- |
| RR-MIGRATE | 142 migrations never proven against a fresh database inside this gate (no live DB in env) | M | L | H | Run `npm run check:operational-flow-db` + full migration apply on a fresh staging Supabase project (harness already exists) | Repo owner | Before pilot start | **Yes** |
| RR-BACKUP | Backup restore never rehearsed; PITR status unconfirmed on pilot project | M | L | H | Confirm Supabase backup tier/PITR; perform one restore rehearsal to a scratch project (runbook §8) | Repo owner | Before pilot start | **Yes** |
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
