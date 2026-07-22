# 01 — Episodic Memory (Sprint 1)

Status: Implemented (deterministic generation only — see limitations)
Code: `src/lib/project-brain/episodic-memory/`, `src/components/pmfreak/project-brain/project-episode-card.tsx`, `project-episode-detail.tsx`
Tests: `tests/project-brain-episodic-memory.test.mjs`

## 1. Product Purpose

Sprint 0 gave the Project Brain a constitution and an epistemic model.
Sprint 0.5 wired that into a single point-in-time brief. Neither told the
Brain how a project *changes over time*. Sprint 1 introduces episodic
memory: every meaningful, already-real event in a project's life — it was
created, evidence was added, a fact was recorded, a question was opened —
becomes a `ProjectEpisode`, and Project Memory renders those episodes as a
chronological history instead of a list of uploaded files.

This sprint does not make the Brain a Historian or Detective. It gives it a
trustworthy place to *remember* real events so a future sprint can reason
over them.

## 2. Definition of a Project Episode

A `ProjectEpisode` (`episodic-memory/types.ts`) is a recorded event in one
project's operational history. It answers what happened, when, why it's in
Project Memory, what evidence supports it, what the Brain's understanding
gained from it, what remains unresolved, and how it relates to earlier
memory — via its `title`/`summary`, `occurredAt`, `sourceReferences`,
`statements`, `openQuestions`, and `relatedEpisodeIds`/`supersedesEpisodeIds`
fields respectively. It never duplicates Sprint 0/0.5 types — `sourceReferences`
is `ProjectBrainSourceReference[]`, `statements` is `ProjectBrainStatement[]`,
`openQuestions` is `ProjectBrainKnowledgeGap[]`, all imported directly.

## 3. Episode Types

The full 16-member union from the sprint spec exists in `PROJECT_EPISODE_TYPES`.
Sprint 1's derivation (`derive-episodes.ts`) generates exactly eight of them,
from real system events already present in this codebase:

| Type | Generated from |
|---|---|
| `project_created` | `projects.created_at` |
| `brain_activated` | `projects.created_at` — see §3.1 |
| `context_recorded` | `evidence_items` rows with `source_type = 'manual_note'` (Capture Context / Take a Note) |
| `evidence_stored` | `project_evidence` rows, any status |
| `evidence_processing_failed` | `project_evidence` rows with `status = 'failed'` |
| `knowledge_recorded` | `FACT`/`REPORTED` statements from Sprint 0.5's `deriveInitialProjectBrainResponse` |
| `question_opened` | `OPEN_QUESTION` statements from the same response |
| `gap_identified` | `UNKNOWN` knowledge gaps from the same response |

The remaining eight (`evidence_received`, `knowledge_updated`,
`knowledge_confirmed`, `knowledge_superseded`, `knowledge_retracted`,
`question_resolved`, `gap_resolved`, `status_changed`) exist in the type
union and are fully supported by the guardrails, relation model, and UI
components — they are simply never *generated* yet, because generating them
honestly requires comparing two points in time (a real correction, a real
new-evidence-confirms-old-report event), and no such comparison mechanism
exists in this codebase yet (see §16). Per the sprint's own instruction,
`risk_detected`, `decision_extracted`, `contradiction_discovered`, and
`stakeholder_inferred` were **not** added to the union — no corresponding
processing exists at all, not even partially.

### 3.1 Why `brain_activated` shares a timestamp with `project_created`

This architecture has no persisted activation gate — `brainJustActivated` in
`command-center/page.tsx` is a transient URL query flag
(`?brainActivated=1`), never written to the database. The Project Brain is
available to a project from the moment the project row exists. Rather than
omit `brain_activated` or invent an unknown timestamp, this is treated as a
real, deterministic architectural fact: the Brain's availability coincides
with project creation in the current system. If a real activation gate is
added later, only this one derivation rule changes.

## 4. Episode Lifecycle

`status`: `recorded` (default) → `superseded` | `retracted` | `invalid`.
Sprint 1 never transitions a real episode's status — every derived episode
is `recorded`. The lifecycle exists so a future correction/confirmation
mechanism has somewhere to write to, and so historical integrity (§11) has a
defined target state to leave a superseded episode in.

## 5. Knowledge Transitions

A `KnowledgeTransition` (`unknown → reported → confirmed`, etc. — the seven
`KnowledgeState`s) is a fourth, deliberately distinct axis from:

- **Epistemic type** (`FACT`/`REPORTED`/... — what kind of claim a statement is, Sprint 0)
- **Confidence** (`high`/`medium`/`low`/`unknown` — how sure the Brain is, Sprint 0)
- **Episode status** (`recorded`/`superseded`/... — whether *this episode* still stands, §4)

A transition instead says: *this subject* (e.g. "delivery date") moved from
*this* state to *that* state, for *this* reason, backed by *these* sources.
It is the thing that would justify one episode superseding another.

Sprint 1 implements the full type and its guardrail
(`validateKnowledgeTransitions` — requires a named subject, two different
real states, a reason, and a primary source for any transition landing on
`confirmed`) but **generates zero transitions from real data**. Every
derived episode's `knowledgeTransitions` array is empty. Producing a real
one requires a "before" and "after" snapshot to diff, which requires either
persisting episodes (this sprint deliberately does not, see §9) or an
explicit user correction action (which does not exist in the UI yet, see
§16). `tests/project-brain-episodic-memory.test.mjs` exercises the model and
guardrail with deterministic fixtures instead — matching the sprint spec's
own "Scenario 6 — Supersession fixture" instruction to use deterministic
test data rather than a live-derived case.

## 6. Relationship to Evidence

`sourceReferenceFromEvidenceItem`/`sourceReferenceFromProjectEvidence`/
`sourceReferenceFromProjectConfiguration` (Sprint 0/0.5) are reused verbatim
by `derive-episodes.ts` — no new source-reference logic exists. A
`context_recorded` episode's one source is the `evidence_items` row that
created it; an `evidence_stored` episode's one source is the `project_evidence`
row.

## 7. Persistence Strategy — Option B, Deterministic Virtual Episodes

**No new table was created.** Episodes are derived at read time from
records this codebase already persists immutably:

- `projects` (`created_at`, `onboarding_payload` — never edited after
  creation; confirmed by inspecting every write path into these columns)
- `project_evidence` (rows are created once and only their `status`
  transitions forward — never edited otherwise)
- `evidence_items` with `source_type = 'manual_note'` (created once by
  `TextCaptureModal` → `/api/operational-flow`, never edited)

### Why Option B over Option A or C

- **Option A (reuse an existing append-only event stream)** was ruled out
  because no single existing table already carries every field an episode
  needs (project id, type, timestamp, actor, source, payload) across all
  three source tables at once — an adapter over three different shapes with
  three different write paths would be more complex than deriving directly.
- **Option C (new `project_episodes` table)** was ruled out for Sprint 1
  because nothing in this sprint's scope requires persistence beyond what's
  already there: every event type this sprint generates already has a
  perfectly good, immutable, timestamped row to derive from. Adding a table
  would mean either double-writing (a new failure mode: the episode row and
  its source row disagreeing) or migrating existing projects' history
  (unnecessary — see §10). A persistence table becomes necessary once a
  future sprint needs to write an episode that has no backing row of its
  own (e.g. a real knowledge transition, or a user's explicit correction) —
  that decision is deferred to whichever sprint needs it, not made
  speculatively here.
- **Option B** also means idempotency (§8) and backfill (§10) are the *same
  mechanism* — there is nothing to deduplicate and nothing to backfill,
  because nothing is stored.

## 8. Idempotency

Every episode id is content-addressed from the real record it came from —
`project-created:<projectId>`, `brain-activated:<projectId>`,
`evidence-stored:<evidenceId>`, `evidence-processing-failed:<evidenceId>`,
`context-recorded:<evidenceItemId>`, `knowledge-recorded:<statementId>`,
`question-opened:<statementId>`, `gap-identified:<gapId>` — exactly the key
shapes the sprint spec suggests. `derive-episodes.ts` has no counters, no
`Date.now()`, no randomness: the same input always produces the same
episode list in the same order. `tests/project-brain-episodic-memory.test.mjs`
proves this directly (`"deriving twice from identical input produces
identical episode ids"`) and proves a single evidence row never produces
more than one `evidence_stored` episode no matter how many times derivation
runs.

## 9. Historical Integrity

Because nothing is persisted, there is no in-place mutation to guard
against at the storage layer — but the *model* still enforces it:
`validateProjectEpisode` rejects a `knowledge_superseded`/`knowledge_confirmed`
episode with no `supersedesEpisodeIds`/`confirmsEpisodeIds`, and
`episode-relations.ts`'s builders always produce a relation pointing *from*
a new episode *to* a prior one — never a mutation of the prior episode's
own fields. The fixture test in §5/§11 demonstrates the pattern a future
sprint's real supersession logic must follow: the earlier episode's
`summary` stays exactly as originally recorded; only its `status` changes.

## 10. Existing-Project Backfill

**Strategy A (deterministic virtual episodes) was used — there is nothing
to backfill.** Every existing project's full derivable history (creation,
activation, evidence, context, knowledge) becomes available the moment this
code ships, computed from data that already exists, with real, original
timestamps (`project_evidence.uploaded_at`, `evidence_items.created_at`,
`projects.created_at`) — never a synthetic "backfilled at" time standing in
for when something actually happened.

## 11. Supersession and Retraction

Not generated live in Sprint 1 (§5 explains why), but fully modeled and
guardrail-enforced: `EPISODE_RELATION_TYPES` includes `supersedes`,
`retracts`, `confirms`, `resolves`; `validateEpisodeRelations` requires both
endpoints to exist and share a project scope. `episode-relations.ts`
provides `supersedes()`/`confirms()`/`resolves()` builders ready for the
sprint that adds real correction/confirmation actions.

## 12. Project-Boundary Protections

- `derive-episodes.ts` stamps every episode, source reference, statement,
  and open question with the same `scope` passed into the function — never
  computed per-field.
- `validateEpisodeProjectBoundary` independently re-checks every source
  reference, statement, open question, and knowledge transition's scope
  against the episode's own scope — a second check, not just "trust the
  derivation" (mirrors Sprint 0.5's response-level guardrail pattern).
- `validateEpisodeRelations` rejects any relation whose two episodes belong
  to different projects.
- The manual-note fetch (`fetchContextRows` in `project-intelligence-inbox.tsx`)
  goes through `/api/operational-flow`, which already validates
  `requireAuthenticatedUser` + `requireProjectAccess` + workspace/project
  row-membership match server-side (`authorize()` in that route) — no new
  route, no new authorization surface, no weakening of existing checks.
- The project-evidence fetch continues to go through `/api/project-evidence`,
  unchanged and already authorized the same way.

## 13. Timeline UX

`project-intelligence-inbox.tsx`'s "Project Memory Timeline" section, which
previously rendered `EvidenceTimelineCard` for each raw `project_evidence`
row, now renders `ProjectEpisodeCard` for each derived episode, grouped by
`groupEpisodesByRecency` into Today/Yesterday/This Week/Earlier (empty
buckets omitted). An `evidence_stored` card cross-references the same live
upload-progress state (`items`) the old raw list used, via a `liveStatusLabel`
prop — so in-flight processing feedback did not regress, it just now
renders on the historical episode card instead of a separate list.

## 14. Episode Detail UX

`ProjectEpisodeCard` is a compact, expandable list item; expanding it
inlines `ProjectEpisodeDetail`, which renders the full disclosure shape the
sprint spec asks for: header (type/timestamp/actor/status) → What happened
→ What changed (knowledge transitions, when present) → Evidence → Open
questions → Related memory → Integrity (constitution version, per-statement
confidence). Neither component ever renders `episode.id` as visible text —
it is used only as a React `key`.

## 15. Project Brain Brief Integration

`ProjectBrainIntroduction` gained an optional `recentMemory` prop
(`RecentMemorySummary`) rendering a "What Changed Recently" block: real
counts of episodes recorded today, the latest episode's title/time, and the
count of open questions/gaps recorded — all computed by the caller from the
same derived episode list, never invented inside the component. The block
is omitted entirely (not zero-filled) when there is nothing to report.

## 16. Current Limitations

- No knowledge transition is ever generated from real data — only the model
  and guardrails exist (§5).
- No episode ever reaches `superseded`/`retracted`/`invalid` from real user
  action — there is no UI path to correct or retract a previously-recorded
  fact yet. (Onboarding fields themselves cannot be edited after project
  creation in the current product, so there is nothing to correct there
  either — confirmed by inspecting every write path into
  `projects.onboarding_payload`.)
- Derivation runs client-side inside `ProjectIntelligenceInbox` from
  server-supplied `onboarding`/`createdAt` props and two already-authorized
  client fetches (`/api/project-evidence`, `/api/operational-flow`) — there
  is no dedicated `GET /api/projects/:projectId/episodes` route, no
  pagination, and no server-side caching. This mirrors Sprint 0.5's same
  deferred item for the brief itself.
- No accessibility audit beyond the static checks in §17/tests — no live
  screen-reader or reduced-motion testing was performed.

## 17. Deferred Capabilities

Everything the sprint explicitly marks out of scope was not attempted:
LLM-based event extraction, contradiction detection, autonomous
recommendations, historical question answering, cross-document reasoning,
stakeholder/risk/task/decision extraction, embeddings, semantic search,
knowledge graphs, portfolio/cross-project memory, proactive notifications,
autonomous background investigation, any new external ingestion (Slack,
Teams, Gmail, WhatsApp, Drive), OCR, audio transcription, and any fabricated
confidence/knowledge-transition/"learned" episode.

## 18. Readiness for Sprint 2: Historian

Ready:

- Every event Sprint 2 would want to reason "when did X first happen" about
  already has a real, individually-addressable episode with a real
  `occurredAt` — Sprint 2 doesn't need to invent a timeline representation,
  only produce new episode content (real transitions, real contradictions)
  into the existing model.
- The relation model (`supersedes`/`confirms`/`resolves`/`caused_by`/
  `derived_from`) and its guardrail are already correct and tested against
  fixtures — Sprint 2 can start emitting real relations without a schema
  change.
- `ProjectEpisodeCard`/`ProjectEpisodeDetail` already render
  `knowledgeTransitions`, `relatedEpisodes`, and non-`recorded` statuses
  correctly; no UI work is blocking Sprint 2's first real transition.

Not yet ready / Sprint 2 should plan for:

- Deciding whether real transitions get derived at read time (extending
  Option B) or need Option C persistence once they depend on comparing
  against a *specific prior derivation run* rather than always-current
  source data.
- A real correction/retraction UI action — currently there is no user
  affordance that would produce a `retracts`/`corrects` episode.
- Moving derivation server-side if Sprint 2's inputs (e.g. extracted
  document content) shouldn't be re-fetched/re-computed on every client
  render.

## 19. Manual UAT Checklist

| # | Scenario | Expected |
|---|---|---|
| 1 | New project | `project_created`, `brain_activated`, and (if onboarding fields were filled) `context`/`knowledge_recorded`/`gap_identified` episodes appear — nothing else. |
| 2 | Evidence upload succeeds | Exactly one `evidence_stored` episode appears immediately (timestamp = upload time); reloading the page does not duplicate it; the card's live status label tracks processing until terminal. |
| 3 | Evidence upload fails before storage | No episode is added (matches existing Sprint 0.5 "nothing was stored" behavior). |
| 4 | Evidence stored, extraction fails | One `evidence_stored` **and** one `evidence_processing_failed` episode, both referencing the same evidence. |
| 5 | Capture Context / Take a Note | A `context_recorded` episode appears after the modal closes (via `refetchContextRows`); reloading does not duplicate it. |
| 6 | Returning visit | The full episode history renders immediately (not gated by the first-run flag — see Sprint 0.5 doc §10); the brief's "What Changed Recently" reflects real recent counts. |
| 7 | Supersession (fixture-only — no live UI path yet) | Not user-triggerable in this sprint; verified in `tests/project-brain-episodic-memory.test.mjs` instead. |
| 8 | Cross-project isolation | Switching the active project changes every episode's underlying data; `validateEpisodeProjectBoundary`/`validateEpisodeRelations` are exercised by automated tests proving no leakage is structurally possible, not just empirically absent. |

Manual browser verification was not performed in this session (same
environment limitation as Sprint 0.5 — no live Supabase-backed environment
available). All behavior above is covered by automated tests instead.

## 20. Architecture Diagram

```
projects row ─────────────┐
project_evidence rows ─────┼──▶ derive-episodes.ts ──▶ ProjectEpisode[]
evidence_items (manual_note)┤         (pure, no LLM,
Sprint 0.5 ProjectBrainResponse┘        content-addressed ids)
                                              │
                                   episode-guards.ts (project boundary,
                                   source/statement/transition/relation
                                   validity, no fabricated language)
                                              │
                                    buildProjectEpisodes()
                                    { ok: true, episodes } | { ok: false, failures }
                                              │
                          groupEpisodesByRecency + sortEpisodes
                                              │
                    ProjectEpisodeCard (timeline) / ProjectEpisodeDetail (expanded)
                                              │
                        ProjectBrainIntroduction "What Changed Recently"
                        OperationalMemoryPanel "Project Memory Timeline" counts
```
