# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## Observed product baseline

PMFreak is a Next.js 16 / React 19 / TypeScript SaaS application with Supabase, AOC Protocol/Enterprise local packages, PMO/project/portfolio/workspace modules, command center UI, governance scripts, and extensive tests. Status: VERIFIED from `package-json.txt`, `structure-summary.txt`, `target-implementation-search.txt`.

## Stack

| Area | Observed | Status |
|---|---|---:|
| Runtime | Node/npm present; exact local versions captured | VERIFIED |
| Package manager | npm with `package-lock.json`; `npm ci` used | VERIFIED |
| Frontend/backend | Next.js `16.2.10`, React `19.2.4` | VERIFIED |
| Language | TypeScript / TSX / JavaScript | VERIFIED |
| Data/auth | Supabase packages and migrations | VERIFIED |
| AI/AOC | `src/lib/ai`, `src/lib/agents`, `src/aoc/*` | VERIFIED |
| Hosting | Vercel inferred from workflow/config references where present; access not verified | PARTIALLY VERIFIED |

## Modules and services

Major modules include workspace, PMO, projects, programs, portfolio, command center, trials/founder program, billing/Stripe, Supabase auth/data, document ingestion, agents, AOC, and governance/check scripts. External services are inventoried separately; live connectivity was not tested.

## Technical state

Install/typecheck/lint/build are reproducible locally. Full tests require longer execution or partitioning. No product readiness conclusion is made in Sprint 0.
