# Beta Release Gate Results — Perilla 11

Executed: 2026-07-10, on the closure branch
(`claude/pmfreak-beta-closure-gate-gavpfd`, based on `main` @ `1f4119c`
post-Perilla 10). Environment: Linux (Claude Code remote), Node v22.22.2,
npm 10.9.7, clean container. Every command below was actually executed; no
result is asserted without a run.

## Baseline evidence (current `main`, before Perilla 11 changes)

| Command | Exit | Duration | Result | Notes |
| ------- | ---: | -------: | ------ | ----- |
| `rm -rf node_modules .next && npm ci` | 0 | ~2m | PASS | Reproducible; lockfile valid; local `@aoc/*` file deps resolve. `npm` reported 9 vulnerabilities (3 high / 5 moderate / 1 low) — see dependency review |
| `npm run typecheck` | 0 | 51s | PASS | 0 TypeScript errors |
| `npm run lint` | 0 | 98s | PASS | 0 errors, 620 warnings (all `@typescript-eslint/no-unused-vars`-class; none in the security/hooks/boundaries categories — AOC boundary lint is a separate blocking pass, clean) |
| `npm test` | 0 | 134s | PASS | **12,115 tests, 498 suites, 0 failed, 0 skipped** — includes `tests/workspace-compression.test.mjs` (4/4, the historical failure no longer exists on `main`) |
| `npm run build` | 0 | 73s | PASS | Production build incl. static generation, dynamic routes, `src/proxy.ts` middleware ("ƒ Proxy") — no reserved-convention conflicts |
| `npm run check:governance` | 1→0 | 5s / 24s | **FAIL then PASS** | Fails on a clean checkout because `check:package-exports` needs `@aoc/*` `dist/` artifacts; passes after `npm run build:aoc`. **Fixed**: the beta gate orders `build:aoc` first; `dist/` is now gitignored |
| `npm run check:launch-readiness` | 1 | 118s | **FAIL** | `spawnSync ENOBUFS` — the full test suite's TAP output outgrew the 1 MB default buffer; the gate could not produce a real verdict. **Fixed** (`maxBuffer` 64 MB); re-run below |
| `npm run test:launch-smoke` | 0 | <1s | PASS | 3/3 checks |
| `npm run check:runtime-hardening` | 0 | <1s | PASS | |
| `npm run check:production-runtime` | 0 | <1s | PASS | |
| `npm run check:enterprise-ux` | 0 | 1s | PASS | |
| `npm run check:runtime-contracts` | 0 | <1s | PASS | |
| `npm run check:db-contract` | 0 | <1s | PASS | |
| `npm run check:no-local-auth-bypass` | 0 | 1s | PASS | 8 informational WARNs (documented local-allow patterns), 0 violations |
| `npm run check:publish-integrity` | 0 | 17s | PASS | build:aoc + package purity + tarball purity + build reproducibility |
| `npm audit --json` | — | 2s | 9 findings | 3 high (next, ws, xlsx), 5 moderate, 1 low — full classification in `dependency-security-review.md` |
| `git diff --check` | 0 | <1s | PASS | No whitespace errors. Finding: `npm test` rewrote tracked `artifacts/vault-smoke-test-report.*` on every run — **fixed** (reports now written only on CLI invocation) |

## Closing evidence — `npm run check:beta-release` on the finished branch

Verbatim summary (per-gate logs in `.beta-release-logs/`, gitignored):

```
PMFreak Beta Release Gate

AOC Packages Build........ PASS  (5.0s, exit 0)
Typecheck................. PASS  (9.3s, exit 0)
Lint...................... PASS  (69.7s, exit 0)
Tests..................... PASS  (91.6s, exit 0)
Build..................... PASS  (83.6s, exit 0)
Governance................ PASS  (23.6s, exit 0)
Runtime Hardening......... PASS  (0.2s, exit 0)
Production Runtime........ PASS  (0.2s, exit 0)
Runtime Contracts......... PASS  (0.2s, exit 0)
Database Contract......... PASS  (0.3s, exit 0)
Launch Smoke.............. PASS  (0.2s, exit 0)
Auth Bypass Scan.......... PASS  (0.5s, exit 0)
Enterprise UX............. PASS  (0.2s, exit 0)
Dependency Security....... CONDITIONAL  (1.7s, exit 2)

Decision: CONDITIONAL GO
```

The closing `npm test` runs **12,165 tests / 0 failures** (the delta over
baseline is the ~60 new Perilla 11 tests across
`workspace-invite-token-hashing`, `ai-runtime-guardrails`,
`observability-readiness`, `prototype-pollution-guard`,
`beta-release-gate`).

`npm audit` after remediation: **0 critical, 1 high (xlsx — accepted with
pilot-blocking condition RR-XLSX), 2 moderate (postcss bundled in next —
accepted, RR-POSTCSS)**. `npm run check:dependency-security` exit 2
(CONDITIONAL, 0 unexpected).

`npm run check:launch-readiness` (post-fix, on the closing branch): exit 0
in 3m17s — all five embedded checks pass (`npm run build`, `npm test`,
`npm run check:governance`, launch smoke, runtime diagnostics).

| Check | Resultado | Severidad | Acción |
| ----- | --------- | --------: | ------ |
| npm ci (clean) | pass | blocking | — |
| typecheck | pass | blocking | — |
| lint | pass | blocking | — |
| tests (full suite) | pass | blocking | — |
| build | pass | blocking | — |
| governance battery | pass | blocking | fixed ordering (build:aoc first) |
| runtime hardening / production runtime / runtime contracts | pass | blocking | — |
| db contract | pass | blocking | — |
| launch smoke | pass | blocking | — |
| auth bypass scan | pass | blocking | — |
| launch readiness | pass (post-fix) | blocking | fixed ENOBUFS |
| enterprise UX | pass | important | — |
| dependency security | conditional | important | RR-XLSX / RR-POSTCSS tracked |
| operational-flow live-DB harness | not runnable here (exit 2 = infra absent, by design) | important | pilot precondition RR-MIGRATE |
| Vercel deployment | not executable from this environment | blocking at deploy time | runbook §1/§5 verifies on deploy |

## Not verifiable from this environment (explicit)

* **Vercel production deployment** — the build passes locally with the same
  builder; actual deploy verification is step §5 of the runbook.
* **Fresh-database migration apply + live RLS flows** — harness exists
  (`check:operational-flow-db`) but requires an isolated Supabase project;
  pilot-blocking condition RR-MIGRATE.
* **cdn.sheetjs.com fetch** for the xlsx upgrade — egress-blocked here
  (verified 403); pilot-blocking condition RR-XLSX.
