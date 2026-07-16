# Scaffolding Register — Official Module Inventory (Pilot Gate Sprint 01, Task 10)

Status: **Adopted**. Owner: Founder (repo owner). Review cadence: every
release gate. This register implements the F-03/ERR-05 behavioral
obligation: an honest, internal inventory separating what the product IS
from what is prototype vocabulary, so no external material (demo, deck,
diligence answer) overstates capability.

Classifications:

- **Production** — load-bearing, pilot-visible, real persistence, tested.
- **Pilot** — visible in the pilot with disclosed limitations.
- **Hidden** — real code, deliberately curated out of the pilot surface
  (see `docs/release/pilot-capability-set.md`).
- **Prototype** — runs, but behind default-off flags / not wired to the UI.
- **Experimental** — exploratory; contracts unstable.
- **Scaffolding** — production-vocabulary code that is functionally inert
  (in-memory only, hardcoded data, or unreachable); must never be
  demoed/marketed as live capability.
- **Dead** — unreachable or superseded; candidates for removal (nothing was
  removed in this sprint, per sprint rules).

"User" = who can currently reach it. Risk is the honest exposure if it were
presented as real.

## Production

| Module family | Paths (representative) | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| Auth, workspaces, invites, memberships | `src/lib/auth*`, `src/lib/workspaces`, `workspace_memberships` | Founder | All users | Low — hardened Perillas 1–11 | Maintain |
| Projects / Programs / Execution tasks / Critical path | `src/app/(protected)/projects`, `src/lib/programs`, `src/lib/execution-tasks`, `src/lib/critical-path` | Founder | All users | Low | Pilot core |
| Upload + Vault intake | `src/app/api/upload`, `src/lib/vault` | Founder | All users | Low — F-13 membership check added this sprint | Pilot core |
| Billing (Stripe) + feature gates | `src/lib/billing*`, `src/lib/feature-gates.ts` | Founder | All users | Low — trust boundary hardened | Pilot (free plan) |
| AI copilot (real LLM) | `src/app/api/copilot`, `src/lib/ai/**` (router, guardrails, cost accounting) | Founder | All users | Medium — requires `OPENAI_API_KEY`; fails hard without it (verify in pilot deploy) | Pilot core |
| Operational memory | `src/lib/operational-memory*`, `/api/operational-memory` | Founder | All users | Low | Pilot core |
| First Insight brief (deterministic) | `src/lib/projects/first-insight` | Founder | All users | Low — deterministic; copy honesty enforced (M-02 tests) | Pilot core |
| Command Center chat (deterministic gateway) | `/api/command-center/chat`, `src/lib/playbook-engine/conversation/gateway` | Founder | All users | Low — determinism disclosed in UI (M-02) | Pilot core |
| Dashboard shell + honest labeling | `src/app/(protected)/dashboard`, `src/lib/dashboard/consumption` | Founder | All users | Low — fallback now labeled (M-01) | Pilot core |
| Early-access / trials tooling | `src/lib/early-access.ts`, `/trials` | Founder | Founder only | Low | Internal |
| Spreadsheets boundary (exceljs) | `src/lib/spreadsheets` | Founder | All users | Low — RR-XLSX closed | Maintain |

## Pilot (visible, limitations disclosed)

| Module | Paths | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| Portfolio snapshot metrics | dashboard fallback DTO path | Founder | All users | Low now (labeled "not yet connected"); Medium if real queries promised | Wire real per-workspace queries post-pilot |
| Input Hub | `/input-hub` → vault intake | Founder | All users | Low | Pilot core |
| Executive / Portfolio lenses | `/executive`, `/portfolio` | Founder | All users | Medium — verify each widget's data source before demo | Demo-triage per widget |

## Hidden (real code, curated out of pilot — PILOT_HIDDEN_HREFS)

| Module | Paths | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| Governance surface (approvals, delegations, trust events) | `/governance`, `/policies`, `/audit`, `src/lib/governance*`, `src/aoc/**` | Founder | Founder profile only | Medium — locally-signed claims must never be presented as canonical AOC (ERR-04) | Externalize pre-enterprise; M-03 switch keeps signing off in pilot |
| PM Registry / Performance / Capacity | `src/lib/pm-registry`, `pm-performance`, `pm-capacity` (routes exist, nav-orphaned — F-21) | Founder | URL-only | Low — real Supabase-backed | Demo-triage, then nav-wire for PMO demos (post-S1) |
| PMO Command Center / Executive Reporting / Governance-Compliance | `src/lib/pmo-*` | Founder | URL-only | Low | Same as above |
| RAID page | `src/lib/raid` | Founder | URL-only | Low | Demo-triage |

## Prototype (default-off / not UI-wired)

| Module | Paths | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| Founder Circle Program (Sprint 01) | `src/lib/founder-program/**`, `/api/founder-program/**`, `/founder-circle`, `/founder-program`, migration `20260828000000` | Founder | Nobody (all `PMFREAK_FOUNDER_PROGRAM_*` flags off by default; DB settings row seeded disabled) | Low while off — fully fail-closed (404s); real, tested code when enabled (see `docs/founder-program/`) | Enable per `docs/founder-program/14-launch-checklist.md` for the closed founder cohort only; never a public-beta vehicle |
| Conversational-brain decision support | `src/lib/playbook-engine/conversation/decision-support/**` (default-off feature-flag gate) | Founder | Nobody (flag off) | Low while off | Keep off for pilot |
| Capability reveal / awakening progression | `src/features/runtime/capability-reveal`, `src/lib/workspace/awakening-state` | Founder | All users (as nav gating only) | Low | Keep — now also carries pilot profile |
| Federation webhook ingestion | `/api/federation/webhooks/*` (in-memory processing) | Founder | Secret-gated callers | Medium if sold as integration | Do not demo as live integrations |

## Scaffolding (production vocabulary, functionally inert — DO NOT DEMO AS LIVE)

| Module family | Paths (representative) | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| Agent execution runtime (~260 routes) | `src/app/api/agents/execution/**`, `src/lib/agents/**` — in-memory Maps, `externalSideEffectsEnabled: false` | Founder | Authenticated URL-only | High if marketed ("AI agents that take action") — F-11 | Freeze; no new surface; decide build-vs-archive on customer signal |
| Constitutional layer | `src/lib/constitutional-*` (brief, context, dashboard, digest, intelligence, learning, ratification, recommendations, vault, workspace) | Founder | Not navigable | High in diligence if described as live | Frozen; labeled here |
| Organizational digital twin | `organizational-digital-twin-topology.ts` (hardcoded topology) | Founder | Nobody | High if demoed | Frozen |
| Predictive / autonomous intelligence | `adaptive-operational-intelligence`, `cross-signal-reasoning`, `intervention-engine`, `predictive-*`, `autonomous-*` check-scripts | Founder | Nobody | High if marketed as validated prediction | Frozen; excluded from pilot claims |
| Live federation / production-runtime narratives | `src/lib/live-federation`, `src/lib/production-runtime` (self-admitted no live integration in CURRENT_STATE docs) | Founder | Nobody | Medium | Frozen |
| Authority governance parallel-spec tests | `tests/authority-governance.test.mjs` + ~20 similar (no `src/` imports — F-19) | Founder | CI only | Medium — false confidence | Rework to import real modules when each family is next touched; false CI claim fixed this sprint (F-19a) |

## Dead

| Module | Paths | Owner | User | Risk | Plan |
| --- | --- | --- | --- | --- | --- |
| `/intelligence` nav target | `src/app/(protected)/intelligence/page.tsx` (redirects to `/command-center`) | Founder | Nobody | None (also pilot-hidden) | Remove in a cleanup sprint |
| `capability_verification_*` evidence tables | 3 tables, no runtime reader/writer (F25 remediation locked them to service_role) | Founder | Nobody | None | Drop in a schema-cleanup migration post-pilot |

## Rules this register enforces

1. Nothing in **Scaffolding/Dead** appears in demos, marketing, or investor
   material as current capability.
2. New modules land with a classification in this register (PR checklist).
3. Reclassification to Production requires: real persistence, UI reachability,
   and tests importing the real module.
4. The pilot capability set (`pilot-capability-set.ts`) and this register
   must stay consistent — `tests/pilot-capability-set.test.ts` pins the
   navigation side.
