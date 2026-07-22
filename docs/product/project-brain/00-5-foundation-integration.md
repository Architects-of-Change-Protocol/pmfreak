# 00.5 — Foundation Integration (Sprint 0.5)

Status: Implemented (scoped — see "Deferred Work" below)
Branch: `claude/pmfreak-brain-foundation-y2z6hf`

## 1. What Sprint 0.5 Integrates

Sprint 0 built the Project Brain's constitution, epistemic model, provenance
model, guardrails, and a reusable statement card, but nothing on the real
Project Memory screen used any of it. Sprint 0.5 wires that foundation into
the actual user-facing flow — the Project Intelligence Inbox mounted at
`/command-center` (via `CommandCenterClient` → `ProjectIntelligenceInbox`) —
and, in the process, audits and removes several places where the existing UI
implied more intelligence than the system actually has.

## 2. The Real Project Memory Flow

```
CommandCenterPage (server)                 command-center/page.tsx
  → fetches active project's created_at + onboarding_payload
  → adapts onboarding_payload -> ProjectOnboardingSnapshot  (onboarding-snapshot.ts)
  → passes projectCreatedAt + onboarding to CommandCenterClient
CommandCenterClient (client)                command-center-client.tsx
  → firstRun=true right after activation -> full-screen Project Intelligence Inbox
  → a persistent "Project Brain" button in the regular dashboard view
    re-opens the Inbox on any later visit (see §9, returning users)
ProjectIntelligenceInbox (client)           project-intelligence-inbox.tsx
  → loads real project_evidence rows, computes an evidence summary
  → derives + validates the initial ProjectBrainResponse (see §3)
  → renders ProjectBrainIntroduction, the evidence timeline, and the
    right-rail panels from that one validated response
```

There is a second, older "Project Memory" surface at `/project-memory`
(`ProjectMemoryClient`, backed by `/api/ai/project-memory`, a
decision/risk/escalation timeline unrelated to evidence). Sprint 0.5 did not
touch it — it is a distinct concept (`MemoryEvent`) predating this work, not
the Project Brain's evidence-derived memory. Reconciling the two names is
out of scope for this sprint; flagged as a naming/IA cleanup for later.

## 3. Initial-Response Derivation

`src/lib/project-brain/derive-initial-response.ts` — pure, deterministic,
**no LLM call**. Input: `ProjectSetupSnapshot` (project id/name/createdAt +
onboarding payload) and `EvidenceSummary` (real `project_evidence` counts).
Output: a `ProjectBrainResponse`.

Derivation rules:

- **FACT** (source: `project_configuration`, `authorityLevel: "primary"` —
  the `projects` row is the system of record for its own state):
  - The project has been created — always, once the project row exists.
  - The problem statement / main deliverable have been defined — only when
    that onboarding field is non-empty.
  - "`N` evidence items are stored in Project Memory" — only when
    `evidence.totalCount > 0`, and `N` is exactly that count.
- **REPORTED** (source: `project_configuration`, `authorityLevel:
  "secondary"`, `reportedBy` = the assigned PM or "the project setup form"):
  narrative onboarding fields (pending client/vendor dependencies, financial
  blockers, external dependencies) — never classified as FACT, because a
  self-reported setup-form field is not independently verified.
- **OPEN_QUESTION**: the user's own recorded "known unknowns" text, and
  `requirementsDefined === false | null`.
- **UNKNOWN** (knowledge gaps): fields never supplied at all — no target
  delivery date, no contractual milestones, no technical lead, no evidence
  at all. Each gap carries a `reason` (why it matters), `priority`, and
  `suggestedEvidenceTypes` — never a bare "unknown" with no explanation.
- **RECOMMENDATION**: the top 2 highest-priority gaps become "Consider
  adding evidence for: `<gap>`" statements, always with
  `requiresHumanApproval: true`.

Statement ids are content-addressed (`fact:<projectId>:<slug>`), not
counter-based — the same project + field always derives the same id, so the
module has no mutable state and is safe under concurrent requests.

## 4. Validation Pipeline

```
Real project data
      ↓
deriveInitialProjectBrainResponse()         (derive-initial-response.ts)
      ↓
guardrails.validateResponse()               (guardrails.ts, from Sprint 0)
      ↓
buildInitialProjectBrainResponse() returns
  { ok: true, response } | { ok: false, failures }
      ↓
ProjectBrainIntroduction renders `response`, or — on `ok: false` — a single
neutral sentence: "The Project Brain could not safely summarize the current
project context. Your evidence remains stored in Project Memory."
```

`buildInitialProjectBrainResponse` (`validate-response-pipeline.ts`) is the
one function a caller uses; it never exposes an unvalidated response, and on
failure logs only guardrail failure *codes* (never statement text or source
content) to avoid leaking project data into logs.

## 5. Epistemic Rendering

`ProjectBrainIntroduction` (`src/components/pmfreak/project-brain/project-brain-introduction.tsx`)
groups the validated response into three sections using the Sprint 0
`ProjectBrainStatementCard`:

- **What I Know** — `FACT` + `REPORTED` statements.
- **What I Do Not Know** — `UNKNOWN` + `OPEN_QUESTION` statements.
- **What I Need Next** — the structured knowledge gaps (§6) as actionable
  request cards, plus any `RECOMMENDATION` statements.

`INFERENCE` and `CONTRADICTION` remain fully supported by
`ProjectBrainStatementCard` (unchanged from Sprint 0) but are never
generated by this deterministic derivation — there is no real
cross-evidence reasoning yet to produce them honestly.

## 6. Knowledge-Gap Model

`ProjectBrainKnowledgeGap` (extended in `types.ts` from Sprint 0's bare
`{id, scope, question}`) now carries:

```ts
{
  id, scope,
  epistemicStatus: "UNKNOWN" | "OPEN_QUESTION",
  title, question, reason,
  priority: "critical" | "high" | "medium" | "low",
  suggestedEvidenceTypes: string[],
  sourceIds: string[],
  identifiedAt,
}
```

The right-rail `KnowledgeGapsPanel` now takes `gaps` as a prop instead of a
hardcoded five-string array — the same structured gaps feed both the full
request cards in the Brief and the compact italic list in the rail. The one
generic gap that remains ("I have not received any evidence for this
project yet") is not fabricated content — it is itself a real statement
about the project's real, current evidence count, framed as a starting
recommendation per the sprint's own allowance for that case.

## 7. Truthful Evidence Lifecycle

`EvidenceProcessingState` changed from
`"receiving" | "reading" | "extracting" | "updating" | "learned" | "failed"`
(the terminal states of which were walked through on a **fixed 550ms
timer**, `advanceCosmeticThinking`, independent of any real backend
operation) to:

```ts
type EvidenceProcessingState = "uploading" | "stored" | "processing" | "processed" | "failed";
```

Every state now maps 1:1 to `project_evidence.status` (`uploaded` → real
row exists → `"stored"`; `processing` → `"processing"`; `processed` →
`"processed"`; `failed` → `"failed"`). There is no `"learned"` state — the
system has never run, and does not claim to run, any operation that
identifies decisions, risks, or stakeholders from evidence content. The
card's expandable "Project Brain Analysis" section states plainly: "No
operational analysis is available for this evidence yet" — one honest
sentence, replacing four category tiles that previously rendered `—` under
labels like "Decisions" and "Risks" in a way that implied analysis had run
and found nothing.

The "Your Project Brain just got smarter" toast is gone, replaced by a
neutral "Added to Project Memory" confirmation that fires on real
persistence, not on a fabricated "learned" transition.

## 8. Source Attribution

Onboarding-derived statements cite a `project_configuration` source (new
third `sourceSystem` value alongside Sprint 0's `project_evidence` /
`evidence_items`, via `sourceReferenceFromProjectConfiguration`) — titled
e.g. "Project setup — Problem statement", never presented as a signed or
externally verified document. `ProjectBrainStatementCard` (unchanged)
already renders "No sources yet" honestly for gap-derived `UNKNOWN`/
`OPEN_QUESTION` statements, which carry no sources by guardrail
(`unknown_with_sources` fails validation if they did).

## 9. Project-Boundary Protections

`command-center/page.tsx`'s new query for `created_at`/`onboarding_payload`
is scoped by both `id` **and** `workspace_id`, matching the existing
project-list query above it — the active project id was already resolved
against that workspace's own project list before this query runs, so it can
never read another workspace's project row. `derive-initial-response.ts`
stamps every statement and gap with the same `scope` object passed in;
`guardrails.validateResponse` independently re-checks that every statement
and gap's scope matches the response's own scope, and that every source
reference's `workspaceId`/`projectId` (when present) matches the statement's
scope — a second, independent check, not just "trust the derivation."
Existing route-level authorization (`requireProjectAccess`) on
`/api/project-evidence` was not touched or weakened.

## 10. Returning-User Behavior

Previously, `CommandCenterClient`'s `showIntelligenceInbox` was a one-shot
`useState(firstRun)` — once it flipped to `false` (by clicking "Enter
Command Center"), there was no way back into the Project Brain view short of
re-triggering `firstRun` via the `brainActivated=1` query param, which only
the onboarding wizard's own redirect ever sets. A returning user landed on
the regular Command Center dashboard with no Project Brain affordance at
all.

Sprint 0.5 adds a persistent "Project Brain" button, visible on every visit
to the regular dashboard view (not gated by `firstRun`), that re-opens
`ProjectIntelligenceInbox` — including its live-derived `ProjectBrainIntroduction`
brief, evidence timeline, and knowledge gaps — on demand. `firstRun` still
controls only which view loads *first*; it is no longer the only path in.

## 11. Explicit Deferred Functionality

Out of scope for this sprint, per its own instructions, and not attempted:

- Any LLM call, general chat, or non-deterministic reasoning.
- Automatic document analysis, decision/risk/task/stakeholder extraction,
  contradiction detection, semantic search, embeddings, or knowledge graphs.
- Recommendations derived from evidence *content* (only from the presence
  or absence of setup fields/evidence counts).
- Server-side derivation (the pipeline currently runs client-side inside
  `ProjectIntelligenceInbox`, from server-supplied `onboarding`/
  `projectCreatedAt` props and client-fetched evidence rows — see
  "Readiness for Sprint 1" below).
- Reconciling the older `/project-memory` (`MemoryEvent`) surface with this
  Project Brain surface.
- Deep `CommandCenterLayout` integration of a compact Brief widget (the
  returning-user fix is a persistent button, not an inline compact brief —
  simpler, but a coarser affordance than the spec's "compact status" ideal).
- Accessibility pass beyond what the reused `ProjectBrainStatementCard`
  already had from Sprint 0 (text-based classifications, no color-only
  signal); no dedicated screen-reader/reduced-motion audit was performed.
- Evidence Coverage categorical labels ("Early"/"Partial"/"Developing") —
  omitted entirely rather than invented, since no documented derivation
  method exists yet for such a scale.

## 12. Readiness Assessment For Sprint 1: The Listener

Ready:

- The epistemic model, provenance model, and guardrail pipeline are now
  exercised by real data end to end, not just unit-tested in isolation —
  Sprint 1 has a proven integration point (`buildInitialProjectBrainResponse`'s
  shape) to extend rather than a purely theoretical contract.
- `ProjectBrainStatementCard` already renders `INFERENCE` and
  `CONTRADICTION` correctly; Sprint 1 can start producing those types
  without any UI change.
- The evidence lifecycle states are now real, so Sprint 1's first genuine
  extraction step has an honest state to transition evidence *into*
  (`"processed"` already exists; a Sprint-1-owned "analyzed" state can be
  added without touching the truthful states this sprint established).

Not yet ready / Sprint 1 should plan for:

- Moving derivation server-side (or to an API route) once it needs to read
  more than client-visible evidence rows (e.g. extracted text content).
- A real per-evidence-item epistemic result to attach to
  `EvidenceTimelineCard`'s "Project Brain Analysis" section, replacing its
  current honest empty state.
- Deciding whether Sprint 1's output flows through
  `deriveInitialProjectBrainResponse` (extended) or a new derivation
  function composed with the same guardrail pipeline.

## 13. Manual UAT Checklist

| # | Scenario | Expected |
|---|---|---|
| 1 | New project, no evidence | "Project Brain — Online"; only the project-created FACT; delivery-timeline/technical-lead/no-evidence gaps visible; "Add Evidence" reachable; no fabricated intelligence anywhere on the page. |
| 2 | Project with partial onboarding (e.g. problem statement filled, target date empty) | The problem-statement FACT appears; the delivery-timeline gap still appears; no statement claims a delivery date exists. |
| 3 | Successful evidence upload | Card shows "Uploading…" then "Stored in Project Memory" then (once the server confirms) "Content extracted"; never "Learned"; "Project Brain Analysis" expands to "No operational analysis is available for this evidence yet." |
| 4 | Failed evidence upload (network error before a row exists) | Notice banner: "A network error occurred. Nothing was stored." — no card added, no confirmation toast. |
| 5 | Evidence stored, extraction fails (`project_evidence.status = 'failed'`) | Card shows "Failed" + "The evidence was stored, but its contents could not be read." |
| 6 | Returning visit (not first-run) | Regular dashboard loads; a "Project Brain" button is visible and reopens the same Introduction/timeline/gaps the first-run view would show, computed fresh from current evidence/onboarding state. |
| 7 | Cross-project isolation | Switching the active project changes every statement/gap's underlying data; no statement ever shows evidence or setup fields from a different project (enforced by `guardrails.validateResponse`'s scope checks, exercised in `tests/project-brain-foundation-integration.test.mjs`). |

Manual browser verification of scenarios 1–6 was not performed in this
session (no live Supabase-backed environment was exercised); the guardrail
and derivation logic backing all seven scenarios is covered by automated
tests instead (§14). This should be flagged for a manual pass before this
branch ships to production.

## 14. Test Coverage

`tests/project-brain-foundation-integration.test.mjs` (20 tests): derivation
rules (populated vs. empty fields, evidence counts, scope/version
stamping, guardrail acceptance across three scenarios), the validation
pipeline, static-analysis assertions that the cosmetic timer and fabricated
"learned" state are gone, that `OperationalMemoryPanel` no longer computes
an arbitrary percentage, that `KnowledgeGapsPanel` takes structured data,
that the returning-user "Project Brain" button exists outside the
first-run branch, and that deriving for one project never leaks a
statement scoped to another.

`tests/project-brain-foundation.test.mjs` (29 tests, from Sprint 0) still
passes unchanged against the extended `ProjectBrainKnowledgeGap` type.
