# Pilot Capability Set — Closed Free Pilot (Pilot Gate Sprint 01, Task 7)

Status: **Adopted** (this sprint). Owner: Founder. Enforced in code by
`src/lib/workspace/pilot-capability-set.ts` (navigation curation),
`src/lib/security/governance-capability.ts` (governance runtime switch, M-03),
and the existing plan gates in `src/lib/feature-gates.ts`.

## Decision

Three audiences, two profiles:

| Audience | Profile | How it resolves |
| --- | --- | --- |
| Founder / internal users | `founder` | `isFounderOrInternalUser()` at the protected layout |
| Design partners (closed free pilot) | `pilot` | default for every non-founder account |
| Whole-deployment override (internal demos) | `founder` | `PMFREAK_CAPABILITY_PROFILE=founder` env var |

The safe default is `pilot` — a new deployment hides the curated surfaces
unless explicitly overridden.

## Visible to pilot participants (design partners)

The real, load-bearing product surface:

- Workspace / Create Center / Create Project (primary)
- Summary dashboard (with honest fallback labeling, M-01), Execution
  (Command Center), Executive, Portfolio lenses
- Projects, Programs, Upload, Settings (utility)
- Advanced (stage/plan-unlocked): Operational Memory, Stakeholders,
  Change Detection, Meetings, Follow-up
- AI copilot (`/api/copilot` — real LLM inference; requires
  `OPENAI_API_KEY` in the pilot deployment)
- Command Center structured assistant (deterministic — disclosed in UI, M-02)

## Hidden from pilot participants (`PILOT_HIDDEN_HREFS`)

| Surface | Href | Why hidden (not deleted) |
| --- | --- | --- |
| Governance | `/governance` | Governance surface incomplete for pilot; claim signing disabled by default (M-03) |
| Policies | `/policies` | Same governance family |
| Audit | `/audit` | Same governance family |
| Trust Agents | `/trust/agents` | AOC trust/attestation surface — locally implemented, not externally assured (F-02/ERR-04: must not be presented as canonical AOC) |
| Capabilities | `/capabilities` | Same trust family |
| Trials | `/trials` | Founder/internal early-access tooling |
| Intelligence | `/intelligence` | Dead nav node (redirects to `/command-center`) |

Also outside the pilot surface (never in navigation): agent execution
scaffolding (`/api/agents/execution/**` — in-memory, no real side effects),
constitutional/digital-twin/predictive modules (see
`docs/release/scaffolding-register.md`).

## Defense-in-depth for hidden surfaces

Hiding is layered, not cosmetic:

1. **Navigation**: `computeNavigationRail(state, profile)` filters
   `PILOT_HIDDEN_HREFS` for the `pilot` profile.
2. **Plan gates**: pilot participants run on the free plan;
   `governance_directives` is `false` for free (`feature-gates.ts`), so the
   governance surface denies even by direct URL.
3. **Runtime switch (M-03)**: `PMFREAK_GOVERNANCE_CAPABILITY_ENABLED` is
   unset for the pilot deployment, so any path that reaches capability-claim
   signing fails closed with an explicit `governance_capability_disabled`.

## Verification

- `tests/pilot-capability-set.test.ts` — profile resolution, hidden-href
  filtering, founder bypass.
- `tests/governance-capability-secret.test.ts` — M-03 runtime switch.
- Manual pilot-account walkthrough is part of the pilot checklist
  (`docs/release/pilot-readiness-checklist.md`).
