# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## High-level tree

See `evidence/repository-tree.txt` and `evidence/structure-summary.txt`.

| Area | Responsibility | Evidence status |
|---|---|---:|
| `app/` | Next.js app routes and API/server-rendered surfaces | VERIFIED |
| `src/components/` | UI components including command center, dashboard, auth, landing | VERIFIED |
| `src/lib/` | Domain/runtime modules: workspace, PMO, portfolio, project, agents, Supabase, governance, AOC | VERIFIED |
| `src/aoc/protocol`, `src/aoc/enterprise` | Local AOC packages consumed via file dependencies | VERIFIED |
| `supabase/` | Local database migrations/config/functions if present | VERIFIED |
| `tests/` | Node test suites and contract/governance tests | VERIFIED |
| `scripts/` | Validation, governance, release, runtime and smoke scripts | VERIFIED |
| `.github/workflows/` | CI/CD workflows | VERIFIED if files present; remote execution UNVERIFIED |
| `docs/` | Product, governance, audit and readiness documentation | VERIFIED |

## Module inventory

| Module | Apparent responsibility | Inputs | Outputs | Data | Dependencies | Status |
|---|---|---|---|---|---|---:|
| Workspace/auth | Session, workspace resolution, membership surfaces | session/query/env | UI/API responses | Supabase | `@supabase/*` | PARTIALLY VERIFIED |
| PMO/project/portfolio | Operational project/portfolio flows | routes/forms/data | reports/views/actions | Supabase/domain types | `src/lib/*` | PARTIALLY VERIFIED |
| Command center | Executive/operational UI | route state/data | dashboards | app/domain modules | React/Next | VERIFIED |
| Agents/AI | Recommendations, decisions, operational intelligence | context/prompts/data | recommendations/records | memory/evidence types | AI/AOC modules | PARTIALLY VERIFIED |
| AOC | Protocol and enterprise runtime packages | local package imports | package builds/contracts | local package files | npm file deps | VERIFIED |
