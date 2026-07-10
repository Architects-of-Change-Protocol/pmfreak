# Pilot Operational Runbook — PMFreak Closed Beta

Perilla 11 deliverable. Audience: the pilot operator (currently the repo
owner). Everything here assumes the Vercel + hosted-Supabase deployment
topology enforced by `docs/security/production-deployment-boundary.md`.

## 1. Pre-deployment checklist

- [ ] `npm run check:beta-release` passes on the release commit (blocking
      gates all PASS; advisory gates at worst CONDITIONAL with every
      condition tracked in `residual-risk-register.md`).
- [ ] Pilot-blocker conditions cleared: RR-XLSX (SheetJS 0.20.3 installed),
      RR-MIGRATE (fresh-DB migration apply + `check:operational-flow-db`
      green on staging), RR-BACKUP (restore rehearsed).
- [ ] `docs/release/beta-release-gate-results.md` regenerated for the release
      commit.

## 2. Environment validation

- [ ] All server-only vars set in Vercel (production scope):
      `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_PMO_PRICE_ID`,
      `OPENAI_API_KEY`, `ABUSE_HASH_PEPPER` (real value, not default).
- [ ] Public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `NEXT_PUBLIC_APP_URL` (+ `NEXT_PUBLIC_SITE_URL` kept in sync) — real
      https URLs; production build hard-fails on localhost values
      (`assertProductionEnvSafety`).
- [ ] Optional guardrail tuning reviewed: `AI_*` limits, `LOG_LEVEL`,
      `HEALTHCHECK_DATABASE_TIMEOUT_MS`, `INVITE_TOKEN_TTL_HOURS`,
      `UPLOAD_MAX_*`. Unset = conservative defaults; invalid values fall back
      to defaults by design.
- [ ] `FOUNDER_EMAIL_ALLOWLIST` contains exactly the operator accounts.

## 3. Database migration procedure

1. Snapshot first: confirm the latest Supabase backup is recent (Dashboard →
   Backups) or trigger one.
2. Apply migrations in filename order (Supabase CLI `supabase db push`, or
   the SQL editor for hosted-only setups). All Perilla-11 migrations
   (`20260820…`, `20260821…`, `20260822…`) are idempotent.
3. Post-apply verification queries:
   * `select column_name from information_schema.columns where table_name = 'workspace_invitations';`
     → must include `token_hash`, `revoked_at`; must **not** include `token`.
   * `select count(*) from public.ai_usage_events;` → table exists (0 rows).
   * `select relrowsecurity from pg_class where relname in ('ai_usage_events','dashboard_task_lifecycle_records');` → `t`.
4. `npm run check:db-contract` against the deployed commit.

## 4. Rollback procedure

* **Application:** Vercel → Deployments → promote the previous production
  deployment (instant). The Perilla-11 schema is backward-compatible with the
  previous app release *except* invite acceptance (the plaintext column is
  gone) — legacy invites were already revoked by design, so rollback keeps a
  working system where owners simply re-issue invites.
* **Database:** forward-fix only. If a migration misbehaves, write a
  corrective migration; restore from backup only for data corruption (see §8).

## 5. Health verification (after every deploy)

```
curl -s https://<app>/api/health   # 200, status:"ok", adapter list
curl -s https://<app>/api/ready    # 200, status:"ready", configuration+database pass
```
`/api/ready` returning 503 names the failing check (config var *names* or
database reachability) — fix env or Supabase before exposing traffic.
Then: log in with a pilot account, load `/command-center`, create a test
project, upload one small file, run one AI suggestion.

## 6. Billing mode confirmation

- [ ] Stripe keys in production are **live-mode** (`sk_live_`, `pk_live_`)
      *only if* the pilot actually charges; otherwise keep test mode and say
      so to participants. Never mix modes.
- [ ] Webhook endpoint configured with the deployed URL + `STRIPE_WEBHOOK_SECRET`
      matching; send a test event from the Stripe dashboard and confirm a
      `billing_webhook_events` row.

## 7. Alerts & monitoring (manual cadence during pilot)

No external platform is integrated (RR-MONITOR). Instrumentation points:
structured logs (Vercel log drain-ready), `security_events`,
`workspace_audit_events`, `billing_webhook_events`, `ai_usage_events`,
`/api/ready`.

**Alert-worthy events** (check daily; each maps to a query or log filter):

| Event | Where to look |
| ----- | ------------- |
| Repeated auth failures / abuse denials | `security_events` (`abuse_rate_limited`, auth_denied types) |
| Billing webhook failures | Stripe dashboard events + `billing_webhook_events` gaps |
| Database connectivity failure | `/api/ready` 503s, Vercel function logs `readiness_check_failed` |
| AI provider failure spike / circuit-open | logs `circuit is open`, `ai_usage_events.status = 'error'/'timeout'` |
| Rate-limit spike | `abuse_rate_limits` counters, `security_events` |
| Service-role use anomaly | `security_events` `privileged_client_used` outside registry expectations |
| Failed privileged operation | `security_events` denial types |
| Migration failure | deploy-time output; `/api/ready` database check |
| Cost threshold reached | `ai_usage_events` daily sum vs `AI_DAILY_COST_LIMIT_USD`; guardrail denials log `daily_cost_ceiling` |

## 8. Backup / restore

1. Confirm plan tier includes daily backups (+ PITR if budget allows) on the
   pilot project.
2. **Rehearsal (pilot precondition, RR-BACKUP):** restore the latest backup
   into a scratch Supabase project; point a preview deployment at it; verify
   login + one workspace loads. Record date + duration here.
3. Real restore: same procedure; then rotate any keys that changed and update
   Vercel env; redeploy; run §5.

## 9. Incident response

1. Triage with §5 checks + Vercel logs (filter by `request_id` — `/api/ready`
   and SDK routes echo `x-request-id`).
2. Contain: for a suspected credential leak, rotate the affected key
   (Supabase service role / Stripe / OpenAI) in its console + Vercel env,
   redeploy (all sessions survive; service-role consumers pick up the new key
   on cold start).
3. **AI provider disable switch:** unset/void `OPENAI_API_KEY` in Vercel and
   redeploy — the provider registry reports `not_configured`, `runInference`
   fails closed with a clean error, and no route crashes. Cheaper large-blast
   alternative: set `AI_DAILY_REQUEST_LIMIT=1`.
4. **Rate-limit adjustment:** abuse limits are per-route constants (registry
   documents each); AI ceilings are env-tunable (`AI_DAILY_REQUEST_LIMIT`,
   `AI_MAX_CONCURRENT_PER_WORKSPACE`) — change env + redeploy.
5. Record the incident (what/when/blast radius/fix) in `docs/audits/`.

## 10. Pilot user provisioning & workspace creation

1. Founder grants early access (founder-only endpoints, Perilla 5) or the
   participant signs up directly (self-serve role is never privileged —
   Perilla 1).
2. Participant creates their workspace (owner membership is bootstrapped
   server-side) and invites teammates from `/team` — invite links are
   returned once at creation (hashed at rest, 7-day default TTL) and
   delivered out-of-band by the inviter (RR-INVITE-DELIVERY).
3. Weekly during pilot: review `ai_usage_events` per workspace (cost trend)
   and `workspace_audit_events` for anomalies.

## 11. Support contact

Pilot support is direct-to-operator: vicvalch@gmail.com (repo owner). Include
the `x-request-id` from any failing response when reporting.

## 12. Pilot shutdown procedure

1. Announce to participants; agree data handling per workspace.
2. Disable signups/invites: set `AI_DAILY_REQUEST_LIMIT=1` is NOT the tool —
   instead pause the Vercel deployment (or protect it behind Vercel
   authentication) so the app stops taking traffic.
3. Export any requested workspace data (operator SQL export — RR-EXPORT).
4. Final backup snapshot; archive `ai_usage_events` + audit tables.
5. Rotate all production secrets (they were exposed to pilot traffic).
6. Tear down or retain the Supabase project per retention commitments
   (backups expire per plan window — see data-recovery-readiness §G.5).
