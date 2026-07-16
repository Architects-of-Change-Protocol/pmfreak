# Exact Command Evidence

| Comando | Resultado | Duración aprox. | Observaciones |
|---|---|---:|---|
| `git branch -f main origin/main` | main ref corrected (was 23 PRs stale) | instant | Environment fix, see `environment-baseline.md` |
| `npx tsc --noEmit` | 0 errors | ~35s | Clean |
| `npm run lint` | 0 errors, 610 warnings | ~90s | All 610 pre-existing, unrelated to this diff (verified: same count before this review's own fix) |
| `node scripts/check-db-schema-contract.mjs` | PASS | <1s | |
| `node scripts/lint-aoc-boundaries.mjs` | PASS | <1s | |
| `node scripts/check-aoc-packages.mjs` | PASS | <1s | |
| `node scripts/check-aoc-dependency-direction.mjs` | PASS | <1s | |
| `FRESH_DB_URL=... ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true node scripts/check-fresh-db-migrations.mjs` (local Postgres 16, freshly created DB) | PASS — 149 files, 413 tables, 1 pre-existing table without RLS (unrelated) | ~15s | Independently re-run against `pmfreak_fresh_v2`, not reused from prior sprint |
| Seeded upgrade-scenario migration (148 pre-refactor migrations + hierarchy migration, against freshly rebuilt DB) | PASS — 0 orphans, 0 mismatches, 6→6 projects, all related data preserved | ~40s | `pmfreak_upgrade_v2`, rebuilt from scratch this session |
| 5x concurrent `psql -f` of the isolated backfill DO block | Exactly 1 PMO created (was 2 before the original sprint's fix) | ~1s | Re-verified live |
| Forced mid-block exception in a copy of the backfill | 0 PMOs, 0 links — full rollback | <1s | New in this review — proves atomicity for the "interrupted after PMO creation, before Project linking" scenario explicitly named in §6.3 |
| RLS negative-test suite (8 tests + 4 positive controls) via `psql` with simulated JWT | All PASS | ~2s | Re-run against `pmfreak_upgrade_v2` |
| Additional DELETE-policy / archived-PMO / nonexistent-pmo_id tests | All findings as documented in `rls-negative-tests.md` | ~1s | New in this review |
| Chat isolation live proof (8 scenarios, `pg`-backed replica of the shipped responder logic) | ALL PASS | ~2s | `npm install --no-save pg`, removed afterward — `package.json`/`package-lock.json` untouched (verified via `git status --short` before/after) |
| Thread-identity uniqueness test (5 scopes → 5 ids; duplicate rejected) | PASS | <1s | New in this review |
| `npm test` (full suite, `node --test` via tsx) | **12,335 tests, 12,335 pass, 0 fail** | ~90s | Includes this review's new 6-test file |
| `npm run build` | Compiled successfully in ~33s; all new routes (`/pmos`, `/pmos/[pmoId]`, `/chat`, `/workspaces`, `/workspaces/new`, `/projects/[id]/chat`, `/projects/[id]/settings`) present in the route manifest | ~2min total | One pre-existing, unrelated Turbopack tracing warning (`next.config.ts` NFT list) — not caused by this diff |

## Warning classification

- **610 ESLint warnings**: all pre-existing (`@typescript-eslint/no-unused-vars` in test files unrelated to this diff), 0 new, 0 errors. Not touched — out of scope to clean up unrelated pre-existing warnings in a merge-readiness audit.
- **1 Turbopack build warning** (`next.config.ts` NFT trace): pre-existing, unrelated to this diff (traces through `src/lib/runtime-hardening/degraded-mode.ts`, a file this branch never touches). Not blocking (build still succeeds).
