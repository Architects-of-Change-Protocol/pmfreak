# 02 — Current-State Architecture

## A. Reconnaissance (as of audit start)

| Item | Value |
|---|---|
| Branch | `claude/pmfreak-saas-audit-abimtq` |
| HEAD commit | `52da0f2` — "Perilla 13B: hosted Supabase validation prep (RR-MIGRATE remains OPEN) (#520)" |
| Working tree | Clean, no staged/unstaged/untracked changes at audit start |
| Recent history | Last 10 commits are all sequential "Perilla N" hardening PRs (RLS, XLSX dependency, beta-release gate, secrets/env/CORS, abuse protection, route guards, RLS/service-role boundary, Stripe webhook boundary, founder/admin boundary) — single-author (`vicvalch`), linear history |
| Package manager | npm (`package-lock.json` present, no yarn/pnpm lockfile) |
| Framework | Next.js 16.2.10 (App Router), React 19.2.4 |
| Language | TypeScript (`tsconfig.json`); note `AGENTS.md` warns this Next.js version has breaking changes vs. training-data assumptions |
| Database | Supabase (Postgres) — 146+ migrations under `supabase/migrations/` |
| Auth provider | Supabase Auth (`@supabase/auth-helpers-nextjs`, `@supabase/ssr`, `@supabase/supabase-js`) |
| Billing provider | Stripe (`stripe` SDK v18) |
| Deployment target | Vercel (hardcoded domain `pmfreak-mu.vercel.app` in `next.config.ts:10`; `VERCEL_ENV` read as authoritative environment signal) — no in-repo deploy workflow; deployment is external to CI |
| CI provider | GitHub Actions — 4 workflows, none of which deploy the app (they gate code quality and publish internal npm packages) |
| Test runner | Node's built-in `--test` via `tsx` (`npm test` = `tsx --test tests/*.test.mjs tests/*.test.ts`) — 435 test files |
| Monorepo/workspace structure | Not a formal monorepo, but `src/aoc/protocol` and `src/aoc/enterprise` are `file:`-linked local npm packages (`@aoc/protocol`, `@aoc-enterprise/runtime`) with their own `package.json`, built via `build:aoc:*` scripts and published independently via `.changeset` + GitHub Actions |
| Environments | development / test / preview / production, distinguished in code via `VERCEL_ENV` (`src/lib/security/environment.ts`); no staging environment beyond Vercel's built-in preview deploys |
| Current release status | **CONDITIONAL GO for closed pilot only**, per the repository's own `docs/release/residual-risk-register.md` — corroborated independently by this audit. Two release risks remain explicitly OPEN: `RR-MIGRATE` (no hosted-Supabase migration proof) and `RR-BACKUP` (no rehearsed restore) |

No resets, no discards, no destructive git operations were performed during this audit.

## B. Repository map (summarized, not exhaustive)

```
pmfreak/
├── src/
│   ├── app/                          Next.js App Router
│   │   ├── (protected)/              Authenticated app shell — dashboard, projects, programs,
│   │   │                             portfolio, PMO*, command-center, early-access (founder-only),
│   │   │                             accept-invite, onboarding/workspace-setup, upload
│   │   ├── api/                      ~450+ route handlers: billing, projects, programs, portfolio,
│   │   │                             schedule, critical-path, raid (via projects), execution-tasks,
│   │   │                             recommended-actions, governance/*, sdk/*, v1/*, telemetry,
│   │   │                             early-access, federation, getting-started, ready/health
│   │   ├── auth/, login/, signup/, forgot-password/, logout/, trial-inactive/, pricing/
│   │   └── debug-session/            dev-only debug route (production-gated per boundary docs)
│   ├── aoc/
│   │   ├── protocol/                 @aoc/protocol — capability claim signing/verification,
│   │   │                             ports (agent-attestation, trust-domain, policy-evaluation, ...)
│   │   ├── enterprise/               @aoc-enterprise/runtime — governance policy registry,
│   │   │                             delegation chains, execution grants, authority-port adapters
│   │   ├── runtime/adapters/         Adapter registry binding Protocol ports to PMFreak impls
│   │   └── runtime-consumer/         Intended "consumer" boundary (RuntimeConsumerClient)
│   ├── sdk/                          Internal PMFreak/AOC SDK (agent token issuance deferred)
│   ├── lib/                          ~120 top-level domains — see 04/07 for full classification.
│   │                                 Real/DB-backed core: projects, programs, portfolio, schedule,
│   │                                 critical-path, raid, execution-tasks, task-drafts,
│   │                                 recommended-actions, billing.ts, feature-gates.ts,
│   │                                 quota/, trials/, early-access.ts, vault/, spreadsheets/,
│   │                                 workspace(s)/, auth.ts, security/.
│   │                                 Speculative/scaffolding: constitutional-*, sovereign-*,
│   │                                 organizational-*, personal-*, pattern-extraction,
│   │                                 operational-* (most), live-federation, production-runtime,
│   │                                 pmo-* (orphaned from nav), pm-registry/performance/capacity
│   │                                 (orphaned from nav). See 03 for the full inventory table.
│   ├── lib/aoc/                      PMFreak-owned bridge/adapter layer over @aoc/* packages
│   ├── lib/ai/                       Provider routing, guardrails, egress policy, usage accounting
│   ├── lib/agents/                   Agent tool registry/execution — currently IN-MEMORY ONLY
│   │                                 (agent-tool-adapter-service.ts: "does NOT use Supabase")
│   ├── components/, ui-core/, features/   UI layer
│   └── hooks/
├── supabase/migrations/              146+ SQL migrations, most-recent ones are RLS hardening
│                                      fixes (recursion bug, search_path pinning, grant tightening)
├── scripts/                          80 scripts — mostly `check:*` governance/release gates plus
│                                      AOC package boundary/publish tooling
├── tests/                            435 test files — mixed quality, see 04 and prior research
├── docs/
│   ├── security/                     ~35 files — real, largely accurate "Perilla" hardening record
│   ├── release/                      ~30 files — release-readiness, risk register, migration proof
│   ├── architecture/                 ~94 files — incl. 18 "CURRENT_STATE_*.md" self-assessments
│   │                                 and the AOC extraction-plan docs
│   ├── contracts/, api/, audits/     Contract/API inventories, prior audits
│   └── productization/saas/          THIS AUDIT'S DELIVERABLES
├── .github/workflows/                4 workflows: ci-governance, release-governance,
│                                      aoc-packages-publish, aoc-packages-version-check
├── .env.example, .env.operational-flow.example
├── AGENTS.md, CLAUDE.md              Project-level agent instructions (Next.js version warning)
└── package.json                      ~90 npm scripts, ~57 of them `check:*` governance gates
```

## C. What the CURRENT_STATE_*.md self-assessments already say

The repository contains 18 `docs/architecture/CURRENT_STATE_*.md` files that are the prior work's own self-assessment of speculative feature domains. They are candid and worth trusting at face value — e.g. `CURRENT_STATE_LIVE_FEDERATION_RUNTIME.md` states outright: "No live KMS integration... No live token exchange... No live DB persistence — Token persistence is semantic-only." `CURRENT_STATE_PRODUCTION_RUNTIME.md` states: "Live runtime not probed. All checks are structural... No secret vault... No auto-recovery." These are not stale or contradicted by code — this audit's independent code inspection (organizational-digital-twin returning hardcoded topology, agent-tool-adapter-service being in-memory-only) confirms them. Treat every `CURRENT_STATE_*.md` claim as a reliable, if narrow, source — but do not extrapolate "documented honestly" into "safe to sell as-is."

## D. Feature flags, mocks, prototypes found

- **Feature flags**: no real system exists. The only "feature flag"-named code (`decisionSupportProductionWiringReadinessFeatureFlagGate.ts` and siblings under `src/lib/playbook-engine/conversation/decision-support/`) is explicitly self-documented as non-functional: "never reads `process.env`... never activates a feature flag... never shows anything to a real user."
- **Mocks/prototypes with the clearest evidence**: `organizational-digital-twin-topology.ts` (hardcoded nodes/scores, zero DB calls), `agent-tool-adapter-service.ts` (in-memory Maps, `externalSideEffectsEnabled: false` on every adapter), the "AI activation" onboarding animation (`AIActivationTransition.tsx` — timer-driven, no backend call), and `src/aoc/enterprise/runtime/external-authority-adapter.ts` (all three external provider modes throw `RuntimeAuthorityUnavailableError` on every method — architecture stubs only).
- **Embedded AOC code**: see `07-aoc-consumer-architecture.md` for the full classification of what in `src/aoc/*` and `src/lib/security/{trust-domains,trust-coordination,agent-attestation}.ts` is legacy-and-must-migrate vs. legitimate PMFreak-owned glue.
