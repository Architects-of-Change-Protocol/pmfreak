# PMFreak Post-Merge Critical-Path Audit

**Audit date:** 2026-07-27
**Scope:** PRs #530–#553 (canonical architecture chain through Command Center activation, Daily Execution, Project Intelligence Inbox, Project Brain, and protected-area recovery)
**Method:** Read-only repository inspection, git archaeology, static code tracing with file:line citations, and execution of the repository's own validation suite. No application code, migrations, or tracked files were modified as part of this audit beyond the two deliverables it produces.

---

## 1. Executive Summary

PMFreak's canonical architecture chain (#530–#545) is real and ratified in `docs/adr/ADR-PMF-*` and `docs/product-architecture/*`, and the feature chain built on top of it (#547–#553) is substantially implemented, not vaporware: direct task/project creation, Daily Execution, Command Center activation, the Project Intelligence Inbox, and a first slice of Project Brain all have genuine, working, tenant-scoped, tested vertical slices. The repository is in a fully green validation state (0 typecheck errors, 0 lint errors, successful build, 12,793/12,793 tests passing).

However, the audit surfaced five **P0** findings that mean the critical path a real new user experiences today does **not** match the ratified, honest architecture the PR chain claims to deliver:

1. A **pre-existing, unretired onboarding wizard** (`getting-started-flow.tsx`) — not the new evidence-derived activation engine from PR #547 — is the actual live gate every new user is routed through. It fabricates readiness scores from string-length arithmetic, seeds fictional evidence into real `operational_memory` rows, and writes the exact "fragile boolean" (`onboarding_completed`) the canonical principles forbid. It is untested by the guardrail test PR #547 added specifically to prevent this class of regression.
2. That same legacy wizard **hard-blocks direct Project creation** behind Command Center/PMO creation, contradicting the ratified IA rule (ADR-PMF-006 Rule 11) that PR #548 was supposed to have satisfied.
3. **Legacy execution-task and task-dependency mutation endpoints authorize on a "read" permission**, not "write" — view-only tenant roles (`executive_viewer`, `external_stakeholder`) can currently reassign, complete, or cancel tasks and mutate dependencies through these routes.
4. The `pmos` table has **no unique constraint on `workspace_id`**, so concurrent/multi-tab Command Center activation can create duplicate PMO rows for one workspace — a data-integrity gap in the activation step of the critical path.
5. The Project Brain "**Project Brain Online**" hero, paired with "the more evidence you provide, the smarter your Project Brain becomes," renders unconditionally at the very first render (zero evidence, zero facts beyond "project created") — overclaiming an adaptive-learning capability the deterministic, rule-based implementation does not have. This is a direct instance of the canonical principle it is meant to satisfy: "do not use fake … learning states."

None of these five are typos or cosmetic — each is a confirmed, evidence-cited defect that changes what "the honest critical path" means for the product today. The overall critical-path verdict is **PARTIALLY FUNCTIONAL**: every individual technical component (bootstrap, creation, execution, activation, evidence capture, Brain foundation) is real and largely well-built, but the actual first-use path is not the one the canonical architecture ratified, and one core Brain claim is not honest at the moment it is shown.

---

## 2. Repository Baseline

| Fact | Value |
|---|---|
| Repository path | `/home/user/pmfreak` |
| Current branch | `claude/pmfreak-audit-backlog-lhlaae` |
| Current HEAD SHA | `7aac1a52e96fe9ecc1ec96faf5b184e36aecc9e9` |
| `origin/main` SHA | `7aac1a52e96fe9ecc1ec96faf5b184e36aecc9e9` (identical) |
| Working tree | Clean (`git status`: "nothing to commit, working tree clean") |
| Ahead/behind vs `origin/main` | 0 / 0 (identical) |
| History shape | Linear, single-parent chain for the entire audited range — no merge commits |

No uncommitted work exists to protect; no branch switch, stash, or reset was necessary or performed.

---

## 3. PR/Commit Reconciliation Matrix

All PRs #530–#553 are present in current `main`/HEAD history as individual, non-reverted commits, confirmed via `git show --stat` on each SHA.

| PR# | Commit | Summary | Tests added/modified | Migration | Docs | Follow-up found |
|---|---|---|---|---|---|---|
| 530 | `b82b05e` | Canonical enterprise/PMI domain model (draft) | — | — | Y | Ratified by #531 |
| 531 | `afc9418` | Ratify domain model, 12 ADRs | — | — | Y | Self-corrects mid-commit |
| 532 | `0a77b41` | Canonical product language | — | — | Y | — |
| 533 | `23f7425` | Canonical information architecture | — | — | Y | — |
| 534 | `03492a8` | Canonical application architecture | — | — | Y | Fixed by #535, re-fixed by #537 |
| 536 | `663efb1` | Canonical persistence architecture | — | — | Y | — |
| 535 | `6366932` | Fix catalog gaps found in #534 review | — | — | Y | Follow-up to #534; itself followed up by #537 |
| 538 | `438cf2b` | Canonical API contracts | — | — | Y | Self-corrects mid-commit |
| 539 | `29923ea` | Canonical frontend architecture | — | — | Y | Multiple self-corrections mid-commit |
| 540 | `e9caf2f` | Canonical UX/visual design architecture | — | — | Y | — |
| 541 | `b623460` | Command Center migration boundary (strangler step 1–2) | — | — | Y | Continued by #542 |
| 542 | `43acc48` | `modules/workspace` extraction + CC screen move | 7 test files repointed (path-only) | — | — | Continuation of #541 |
| 543 | `b24a8c9` | "Make the Command Center honest": remove fixtures | — | — | Y | — |
| 544 | `78ea0a8` | Close founder operational loop | 3 test files modified | — | — | Interacts with activation, later reworked by #550/#553 |
| 546 | `954ec14` | Fix session loss across proxy redirects | 1 regression test added | — | — | — |
| 545 | `0a3b73d` | Zero State UX Refactor | 4 test files modified | Y | Y | — |
| **547** | `f6324a7` | Guided workspace onboarding / evidence-derived activation | 4 new test files | **Y** — `20260829000000_workspace_onboarding_preferences.sql` | Y | See §5 — guardrail test does not cover the still-live legacy wizard |
| **548** | `d3136b9` | Direct task & project creation / Quick Add Task | 1 new + 2 modified test files | **Y** — `20260830000000_execution_tasks_optional_draft.sql` | Y | — |
| **549** | `ff904a1` | Daily Execution Workspace + Task Detail drawer | 3 new test files | — | Y | — |
| **550** | `4034670` | Command Center activation sequence overlay | 2 new + 1 modified test files | — | — | **Superseded/partially reverted by #553** |
| **551** | `218f11b` | Project Intelligence Inbox evidence capture UI | — (no new test files in diffstat) | — | — | Extended by #552 |
| **552** | `0f71b48` | Project Brain constitution + episodic memory | 3 new test files | — | Y | Directly triggered #553's fix |
| **553** | `010d4f7` | Fix protected-area failure from UAT | 2 new + 3 modified test files | — | — | Merged and corrected; one documented residual gap (§11) |
| 537 | `7aac1a5` (HEAD) | "PR4 follow-up" — Recommendation-ownership split, catalog gaps | — | — | Y | Docs-only continuation of #534/#535 chain |

**The #537/#553 ordering anomaly:** commit `7aac1a5` (labeled PR #537) is docs-only content belonging to the #534→#535 catalog-correction chain — it edits exactly the seven files #534 created and #535 first patched. Its commit timestamp (2026-07-23 21:55) is four days after #535/#536 and 31 minutes after #553, even though #552 had already landed two days earlier. This is consistent with PR #537 having been opened early and left open pending review comments while unrelated feature PRs #538–#553 merged around it, finally landing last. **Verified fact, not a defect**: no rebase artifact, no cherry-pick, no misattached commit — a stale open PR merging out of numeric order.

---

## 4. Canonical Architecture Findings (Stream A)

Canonical hierarchy is ratified at `docs/product-architecture/03-canonical-information-architecture.md:42`: `Enterprise → Workspace → PMO → Portfolio → Program → Project → (Task/Milestone/Risk/Issue/Dependency/Decision/Recommendation/Action/Outcome)`.

Per-concept verdicts:

| Concept | Verdict | Evidence |
|---|---|---|
| Workspace | VERIFIED COMPLETE | RLS-enforced tenant root; nav root (`src/lib/workspace/navigation-hierarchy.ts:11`) |
| PMO | PARTIALLY IMPLEMENTED | Real `pmos` CRUD; creation CTA mislabeled "Create Center" (`navigation-hierarchy.ts:11`); `/pmo/invite-team` still says "PMO Brain" |
| Portfolio | NOT FOUND (PMI sense) | No `portfolios` table; word reused for a lens route and for `/pmos/[pmoId]`'s project list (`pmos/[pmoId]/page.tsx:80`) — both forbidden per `02-canonical-product-language.md:51-52` |
| Program | IMPLEMENTED BUT DISCONNECTED | Tables exist, in nav, zero FK to `projects`/`pmos` per prior audit citation |
| Project | VERIFIED COMPLETE | Creation never requires a PMO (`projects/actions.ts:78`); lands on the still-ambiguous `/command-center` |
| Command Center | SUPERSEDED/CONTRADICTED | Ratified as a 6-entity projection; code still has one bare route mixing Project- and Workspace-level data (`03-canonical-information-architecture.md:397` explicitly names this a violation) |
| Daily Execution | VERIFIED COMPLETE | Distinct `/execution` nav entry, though the "Execution" label collides with Command Center's own "Execution" lens label |
| Project Intelligence Inbox | NOT FOUND as a persistent destination | It is a first-run-only overlay (`command-center-client.tsx:53,92,122`), not a reachable nav destination; the canonical IA doc itself says "does not exist in the codebase today — only a decorative heading" for the separate `/intelligence` route |
| Project Brain | Not a ratified ADR entity | Marketing/UI name only; see §9 |
| Operational Memory | PARTIALLY IMPLEMENTED | Connected to nav (capability-gated), legacy naming collision carried forward from a prior audit, not independently re-verified this session |
| Evidence | VERIFIED COMPLETE | `project_evidence` / `project_evidence_content`, tenant-scoped |
| Tasks / Decisions / Recommendations | VERIFIED COMPLETE (schema level) | `execution_tasks`, `project_decisions` real and wired |
| Controlled Actions | NOT FOUND as a first-class entity | Conceptual only per canonical docs |

### Contradiction register (top items; full register with 10 entries retained in audit working notes)

| # | Contradiction | Affected files | Canonical interpretation | User impact | Recommendation |
|---|---|---|---|---|---|
| 1 | Two "Execution" labels (`/execution` primary, Command Center "Execution" lens); `/portfolio` lens has no PMI Portfolio semantics | `navigation-hierarchy.ts:12,19,21` | `02-canonical-product-language.md:51` — Portfolio not yet implemented | Confusing dual meaning | Rename lens labels until real entities ship |
| 2 | Primary onboarding CTA "Create Center" → `/create-command-center` actually creates a **PMO** row | `navigation-hierarchy.ts:11`; `create-pmo/page.tsx` (dead redirect stub) | ADR-PMF-014 Rule 2 — must read "Create PMO" | User never sees the word "PMO" for the entity they're creating | Rename CTA; retire `/create-pmo` stub |
| 3 | `getting-started-flow.tsx` hard-blocks Project creation behind Command Center/PMO creation | `src/components/pmfreak/activation/getting-started-flow.tsx:359-370`, live at `/workspace/setup` | ADR-PMF-006 Rule 11 — no onboarding flow may require a level above Project | Independent-PM fast path is blocked | **See backlog PMF-002 (P0)** |
| 4 | Project creation and onboarding both redirect to a bare `/command-center` mixing Project/Workspace scope | `projects/actions.ts:78`; `create-project-wizard.tsx:828` | `03-canonical-information-architecture.md:397` (self-documented violation) | New users land on a screen the canon calls non-compliant | Defer entity-scoped CC split to a later phase; document as known debt |
| 5 | `/pmos/[pmoId]` labels a plain project list "Portfolio" | `pmos/[pmoId]/page.tsx:80` | `02-canonical-product-language.md:52` forbids this synonym | Same word, unrelated data | Rename heading |
| 6 | PMO Ops Suite (pmo-command-center, pmo-executive-reporting, etc.) absent from primary nav | `navigation-hierarchy.ts` (no entries) | ADR-PMF-014 Rule 6 — deliberately out of user-facing IA scope | None — intentional | No action required; document as deliberate |
| 7 | Pricing page sells "Enterprise" tier not present in `SubscriptionPlan` type | `src/app/pricing/page.tsx:8-27`; `src/lib/billing.ts:5,52-58` | `02-canonical-product-language.md:37` — Enterprise ≠ Billing Plan | If ever manually granted, silently downgrades to free-tier capability | Document as known debt (currently unreachable — tier routes to `mailto:`) |

---

## 5. First-Use Journey Findings (Stream B)

**Headline finding:** two onboarding systems coexist, and the one the new user actually experiences is not the one the canonical principles describe.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | PR #547 contents | VERIFIED COMPLETE | New `src/lib/workspace-activation/*`, `/api/workspace-activation`, `workspace-onboarding-panel.tsx`, migration for onboarding preferences — all genuine, not stubs |
| 2 | Workspace bootstrap atomicity | IMPLEMENTED BUT DEFECTIVE | `ensureUserWorkspace` (`src/lib/workspaces.ts:77-106`) does two sequential unwrapped writes (workspace insert, then membership upsert) — no transaction; a mid-failure leaves an orphaned workspace with no owner |
| 3 | Activation-state logic | New engine VERIFIED COMPLETE; **live gate IMPLEMENTED BUT DEFECTIVE** | Evidence-derived engine (`activation-rules.ts:224-258`) is genuinely computed from real data, but Edge middleware gating uses a stored JWT boolean `onboarding_completed` (`resolve-onboarding-state.ts:115-119`, `proxy.ts:67-68`), written directly by `/api/onboarding` and `/api/getting-started` — exactly the fragile-flag pattern the principles forbid |
| 4 | Zero-state rendering | VERIFIED COMPLETE | `EmptyDashboard`/`EmptyProjects`/`EmptyPortfolio`/`EmptyExecution` correctly branch on real data, no fabricated metrics |
| 5 | Server-side membership checks | VERIFIED COMPLETE | `/api/workspace-activation`, `/api/onboarding`, `/api/getting-started` all verify membership server-side before mutating |
| 6 | "Invite Team" gating | VERIFIED COMPLETE | Confirmed non-blocking, `requiredIn: () => false` (`activation-rules.ts:92-93`) |
| 7 | Redirect loops | VERIFIED COMPLETE (none found) | `proxy.ts:89-95` has an explicit anti-loop guard |
| 8 | Reload/refresh continuity | IMPLEMENTED BUT DEFECTIVE | Server components re-derive live state, but Edge gating trusts a JWT claim that can go stale relative to DB state |
| 9 | **Parallel/superseded onboarding system** | **IMPLEMENTED BUT DISCONNECTED — critical finding** | `getting-started-flow.tsx` is the actual live gate at `/workspace/setup` (the exact destination `getOnboardingRedirect` sends every new user to). It computes fabricated "readiness"/"completion" scores from string-length formulas (`getting-started-flow.tsx:262,274-293`), ships hardcoded fake evidence templates that get persisted as real `operational_memory` rows unless edited (`getting-started/route.ts:53-60`), has a `loadDemo` branch seeding a fictional project (`route.ts:30-33,47-51`), and writes the forbidden static flag (`route.ts:62`). PR #547's own guardrail test (`tests/workspace-onboarding-guardrails.test.mjs:4,46`) only scans the *new* surface — it does not cover this file, so the regression is untested and unflagged by CI |
| 10 | Dead-end completion | VERIFIED COMPLETE | Legacy wizard routes to `/command-center?projectId=...&from=onboarding`; no dead end |

---

## 6. Direct Project/Task Creation Findings (Stream C)

No cross-tenant spoofing or missing server-side authorization was found. One functional defect and one observability gap.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 2 | No mandatory `task_draft_id`/fabricated ancestry | VERIFIED COMPLETE | Migration `20260830000000_execution_tasks_optional_draft.sql:16` drops NOT NULL; insert explicitly nulls ancestry (`create-execution-task.ts:196-199`), tags `source_payload.source = "manual"` |
| 3 | Workspace/project scope not spoofable | VERIFIED COMPLETE | workspace_id derived server-side from the project row, never client body (`create-execution-task.ts:140-147`); `requireProjectAccess` enforced (`server-authorization.ts:54-57`) |
| 4 | Assignee roster membership-scoped | VERIFIED COMPLETE | Server re-validates assignee membership against `project.workspace_id` before insert (`create-execution-task.ts:170-188`) |
| 5 | Due-date timezone handling | **IMPLEMENTED BUT DEFECTIVE** | Creation stores UTC-midnight (`create-execution-task.ts:94`, safe), but display/edit round-trip through local time inconsistently: `task-due-date-control.tsx:32` (display), `:3-11` (`toDateInputValue`, pre-fills wrong day for negative-UTC-offset viewers), `:45` (`onChange` writes back local midnight) — a due date can silently drift by one calendar day between creation and display/edit depending on viewer timezone |
| 6 | Failed-request UI errors | VERIFIED COMPLETE | `quick-add-task-modal.tsx:103-150,217-221`, `create-project-modal.tsx:34-73` — real `role="alert"` errors, distinguished field vs. general errors |
| 7 | Audit-event write safety | IMPLEMENTED BUT DEFECTIVE | `execution_task_events` insert happens after primary success (safe direction) but its result is never checked or logged (`create-execution-task.ts:223-235`) — a broken audit write fails completely silently |
| 8 | Immediate refresh + reload persistence | VERIFIED COMPLETE | Real SWR revalidation (`quick-add-task-modal.tsx:142`), not local cache splice |
| 9 | Manual vs. pipeline task compatibility | VERIFIED COMPLETE | Daily Execution query has no ancestry-based WHERE clause; drawer branches safely on `source_payload.source` with no crash path |

---

## 7. Daily Execution Findings (Stream D)

Genuinely usable daily work surface. All ten checked items resolve to VERIFIED COMPLETE or COMPLETE WITH NON-BLOCKING DEBT — see summary in §14. Notable items:

- **Filter composition**: server-side AND-composed query (`execution-tasks/daily/route.ts:89-109`); zero-result combinations render an honest "No tasks match" state, not a bug.
- **Cross-consistency**: manually created and pipeline-created tasks render identically; no ancestry-based exclusion.
- **Timezone caveat**: same due-date round-trip issue as §6 applies here too, with an added cross-team dimension — two workspace members in very different time zones can see the same due date land on different calendar days.
- **Self-reported gap**: the feature's own architecture doc (`docs/architecture/daily-execution-workspace.md:269-274`) discloses that manual UAT against live Supabase was never performed for this PR — only static/unit validation.

---

## 8. Command Center Activation Findings (Stream E)

PR #550's original simulated 7-stage timer-driven overlay was **deleted two days later by PR #553** — the audited current implementation is a simple `idle → submitting → success|failure` state machine, not the original design.

**HIGH — duplicate-record race on multi-tab/concurrent activation.** `savePmoTenant` (`src/lib/pmo/save-pmo-tenant.ts:128-149`) does check-then-insert for `pmos`. `workspace_governance` has a real PK-based idempotency guard (`onConflict: "workspace_id"`), but **`pmos` has only a non-unique index** (`20260828000001_workspace_pmo_project_hierarchy.sql:29-49`) — two concurrent activations (two tabs, or a stale retry racing the original request) can both read "no existing PMO" and both insert, producing duplicate `pmos` rows for one workspace. Client-side `inFlightRef` (`create-pmo-wizard.tsx:720,810-811`) only guards a single tab instance.

**Secondary bug — silent retry no-op.** Because `inFlightRef.current` clears only in the original request's `finally`, if the client's 20s timeout fires while the server call is still pending, clicking Retry hits the guard and silently no-ops with no visible feedback (`create-pmo-wizard.tsx:868-882`; `ActivationFailureState`'s `retrying` prop is hardcoded `false`).

| Item | Verdict |
|---|---|
| Timer re-arm | VERIFIED COMPLETE (current code clears before re-arming; old "Keep Waiting" mechanism was removed entirely by #553) |
| Retry vs. in-flight original request | IMPLEMENTED BUT DEFECTIVE (see HIGH finding) |
| Duplicate-click protection | PARTIALLY IMPLEMENTED — UI guard fine, DB guard missing for `pmos` |
| Boolean/count mapping | VERIFIED COMPLETE — no inversion found |
| Redirect/landing destination | VERIFIED COMPLETE — lands on live `/command-center` |
| Refresh/re-visit already-activated | COMPLETE WITH NON-BLOCKING DEBT — `/create-command-center` has no already-activated short-circuit |
| No fabricated intelligence claims | VERIFIED COMPLETE — `TransitionOverlay.tsx` shows only real configured counts, dedicated regression test (`honest-ai-copy.test.mjs`) exists |

---

## 9. Project Intelligence Inbox Findings (Stream F)

The Inbox is a first-run overlay (not a persistent nav destination). Per-source classification against the "real and end-to-end / real but partial / placeholder / disabled / misleading" taxonomy:

| Source | Classification |
|---|---|
| File upload (PDF/DOCX/XLSX/PPTX/TXT) | Real and end-to-end — real parsing (`evidence-processor.ts:134-197`) into `project_evidence_content` |
| Paste Text / Take a Note | Real and end-to-end, but both funnel into the identical `sourceType: "manual_note"` server-side (`text-capture-modal.tsx:48-56`) — cosmetically distinct, not distinguishable later |
| 13 other advertised categories (invoices, screenshots, video, chat, etc.) | **Placeholder** — `intelligence-inbox-icons.tsx:100-148` itself comments "most of these sources aren't ingestible yet"; drops are silently sorted to a `skipped` list |
| Gmail/Slack/Teams/Record Meeting | **Disabled**, and honestly labeled ("coming soon" toast, `project-intelligence-inbox.tsx:373-377`) — not misleading |
| `BrainBootSequence` staged-reveal animation | **Misleading** — labels ("Bringing governance online…", "Synchronizing context engine…") describe backend initialization that never runs; component's own comment admits "a staged reveal only" (`brain-boot-sequence.tsx:19-21`) |

Separated taxonomy (per required non-collapse rule):

1. **Evidence capture** — real and end-to-end.
2. **Evidence storage** — real and end-to-end, tenant-scoped (`requireProjectAccess`, explicit `workspace_id` cross-check).
3. **Evidence normalization** — real for the 5 wired file types; not found for manual notes.
4. **Extraction** — real for uploaded files; not found for notes (no content to extract).
5. **Classification** — real but coarse (file-type based; one bucket for two note-capture UI affordances).
6. **Intelligence generation** — NOT FOUND / honestly disclosed as such ("Operational Analysis: Not available yet" — `operational-memory-panel.tsx:43-45`).
7. **Memory formation** — NOT FOUND in this PR; the episodic layer rendering the timeline is PR #552's read-time derivation, audited separately in §10.

**Silent data-loss risk:** the manual-note/context feed (`getOperationalSummary`, `operational-flow-service.ts:85`) is `.limit(20)` with **no pagination control anywhere in the UI** — a project with more than 20 manual captures silently drops older ones from the timeline.

**Fake hash placeholder:** `createEvidenceItem` hardcodes `evidence_hash: "0".repeat(64)` (`operational-flow-service.ts:44`) — cosmetically resembles a real sha256 but performs no deduplication function. Re-submitting identical content twice creates two independent rows with no warning.

---

## 10. Project Brain Findings (Stream G)

**Overall stage:** connected to real evidence *counts* and real onboarding *field values* (not evidence *content*), generating real, guardrail-validated FACT/REPORTED/UNKNOWN/RECOMMENDATION statements — but no INFERENCE or CONTRADICTION generation exists yet, and episodes are virtual (derived at read time, never persisted — explicitly documented as intentional in `derive-episodes.ts:1-18`, "Option B: deterministic virtual episodes").

| # | Item | Verdict |
|---|---|---|
| Epistemic distinction enforced at runtime | VERIFIED COMPLETE — `validateStatement` (`guardrails.ts:67-208`) mechanically enforces per-type rules, not documentation-only |
| Confidence representation | **PLACEHOLDER OR SIMULATED** — a `"scored"` confidence variant exists in the type system but has zero producers; the one real producer hardcodes a fixed level per statement kind (`derive-initial-response.ts:107,127,147,160,178`) |
| Provenance | PARTIALLY IMPLEMENTED — real for statements; `ProjectBrainKnowledgeGap.sourceIds` is always hardcoded `[]` (`derive-initial-response.ts:407`) despite the type's own docstring expecting real references |
| Episode persistence | PLACEHOLDER OR SIMULATED (by design, documented) — no `project_episode` table exists anywhere in migrations |
| Immutability | BLOCKED FROM VERIFICATION at the episode level (nothing persisted); genuine risk at the source level — an episode synthesized live from a mutable `project_evidence.status` can silently change content between two "views" of the same historical episode |
| **Timestamp accuracy — HIGH PRIORITY** | `knowledge_recorded`/`question_opened`/`gap_identified` episodes stamp `statement.generatedAt`, which is fixed at the *project's creation time* for every statement (`project-intelligence-inbox.tsx:246`), not the real timestamp of whatever evidence triggered the fact — every knowledge/gap/question episode clusters on day one regardless of when it was actually learned |
| **UI honesty — HIGH PRIORITY** | `project-brain-online-hero.tsx:13,18-20` renders "Project Brain Online" + "the more evidence you provide, the smarter your Project Brain becomes" **unconditionally on `firstRun`**, i.e. at exactly zero evidence — a capability claim (adaptive learning) the deterministic, rule-based derivation does not have. `operational-memory-panel.tsx:34-40` renders a static "Online" block not gated on `response` at all, unlike the honestly-gated sections beneath it |
| Structured knowledge gaps | VERIFIED COMPLETE — real, typed `ProjectBrainKnowledgeGap[]` populated from real absence-of-data logic, rendered in two real UI surfaces |

---

## 11. Protected-Area Recovery Findings (Stream H)

**Status: merged and corrected, with a documented (not hidden) residual gap.**

Root cause: `command-center/page.tsx` awaited `listPmosWithProjects(workspace.workspaceId)` unguarded before the empty-projects guard; `pmo-service.ts` throws a bare `Error` on any Supabase read failure, so a transient DB error took down the mandatory post-activation landing screen (became critical only once #552 made `/command-center` mandatory).

Fix verified: try/catch wrap (`page.tsx:62-73`), new `portfolio-summary.ts` distinguishing `null` (unavailable) from `[]` (empty), explicit `projectsError` branch with a "Try again" link that re-invokes the same, now-safe route — not a redirect loop. An earlier sub-commit added an unsafe "Go to PMOs" recovery link (which would have re-triggered the same class of failure via `/pmos/page.tsx:19`'s own unguarded call); this was caught by internal review and **removed before merge** — confirmed absent in the final diff.

**Residual gap, explicitly disclosed in the commit message**: `pmo-service.ts` itself was left unmodified — "other callers keep their fatal semantics." `/pmos/page.tsx:19` still calls `listPmosWithProjects` unguarded and remains exactly as fragile to the same class of Supabase error as `/command-center` was before this fix. **See backlog PMF-011 (P1).**

No missing-membership/missing-workspace guard changes were made by this commit — those failure modes still funnel into the generic `(protected)/error.tsx` boundary, unchanged, and were out of scope for the reported UAT failure.

---

## 12. Security and Tenant-Isolation Findings (Stream I)

Scope: routes introduced/modified by PRs #542, #547–#553 only.

**HIGH — legacy execution-task/dependency endpoints authorize on "read", not "write".**
- `src/app/api/execution-tasks/update/route.ts:46-51` — `requireProjectAccess(task.project_id, "read")` gates a POST that mutates `status`, `owner_user_id`, `progress_percent`, `due_date`.
- `src/app/api/execution-task-dependencies/update/route.ts:57-63` — same pattern for dependency status transitions.
- `src/lib/execution-tasks/dependencies/create-dependency.ts:85-92` — dependency creation gated on "read".
- `src/app/api/execution-task-dependencies/materialize/route.ts:30-36` — bulk write gated on "read".

`executive_viewer`/`external_stakeholder` roles (`src/lib/security/rbac.ts`) have only `{read[, view_executive]}` in their permission set — no `write` — yet `requireProjectAccess(id, "read")` is satisfied by these roles, and RLS on the underlying tables is role-agnostic (`is_workspace_member(workspace_id)` only). The newer `/api/execution-tasks/[taskId]` PATCH route correctly gates on `"write"`, and its own comment confirms the legacy route was "kept at read for backward compatibility" — a known, unresolved gap, not hypothetical.

**MEDIUM — `/api/projects/[id]/operational-governance-brief` has no explicit membership check.** Relies solely on RLS (`is_workspace_member`) with no app-layer `requireProjectAccess` call, unlike every sibling route in scope. Currently fails closed via RLS (verified), but is a single point of failure with no defense-in-depth on a privileged content-generation/write action.

**MEDIUM — audit-event writes unchecked/unlogged.** `execution_task_events` inserts after primary mutations succeed are never checked for errors, even via `console.error` (`execution-tasks/update/route.ts:113-121`, `[taskId]/route.ts:242-249`, `create-dependency.ts:179-208`). Correctly non-blocking for the primary action, but a failing audit trail is invisible to operators.

**LOW — `/api/intelligence/{stakeholders,coordination,interventions}` unauthenticated reachable when no scope id is supplied.** Currently returns empty/synthetic snapshots in that branch (not exploitable for data today), but is an inconsistent pattern versus sibling routes that authenticate unconditionally.

**LOW — PM-assignment routes resolve workspace via `workspaces[0]` rather than the project's own workspace.** Fails closed (404) rather than granting cross-tenant access — a functional bug for multi-workspace users, not an IDOR.

**Verified clean:** upload route (magic-byte + MIME + filename validation, server-derived metadata, TOCTOU-safe governance check); onboarding, workspace-activation, projects, task-drafts, project-evidence, execution-task-graph, execution-tasks (GET/POST/PATCH on the newer route) all authenticate, resolve scope server-side, and never trust a client-supplied workspace/project id without a membership check tied to the authenticated session. All in-scope routes use the anon-key+JWT client, never the service-role client. RLS is present on every in-scope table. No in-scope route imports `@/aoc/protocol` or `@/aoc/enterprise` directly — the AOC governance boundary is respected.

**Blocked from verification:** exact enforcement inside `@aoc-enterprise/runtime`'s governance-policy registry (outside the audited route tree); exhaustive live-rendered client-side fail-open audit (spot-checked, none found, but not rendered in a browser this session).

---

## 13. Test and Validation Results

Environment had no `node_modules`; installed fresh via `npm ci`.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 586 packages installed. `npm audit`: 21 vulnerabilities (1 low, 1 moderate, 19 high) — informational, pre-existing dependency-tree state, not requested to remediate |
| `npm run typecheck` (`tsc --noEmit`) | 0 | Zero type errors |
| `npm run lint` (`lint:aoc-boundaries` + `eslint`) | 0 | 0 errors, 614 warnings (all `@typescript-eslint/no-unused-vars` in test files) |
| `npm run build` (`next build`) | 0 | Success, 413 pages generated. One cosmetic Turbopack file-tracing warning on `src/lib/runtime-hardening/degraded-mode.ts` (dynamic `fs`/`path` usage not statically scopable) — not a build failure |
| `npm test` (`tsx --test`, 469 files) | 0 | **12,793/12,793 tests pass**, 0 fail, 89.5s |

PR-area test coverage confirmed present and passing: onboarding, workspace-activation, command-center-activation, execution-task/dependency, project-evidence, project-brain/episodic/constitutional, route-guard-consistency test files all exist and pass (see full list in the validation agent's report; no file literally named "quick-add" or "intelligence-inbox" exists, but their functional equivalents — `execution-tasks.test.mjs`, `project-evidence.test.mjs` — do).

**Interpretation:** a fully green validation suite does not contradict the P0 findings above — every one of them (legacy onboarding wizard, permission-gated mutation bypass, `pmos` race, Project Brain overclaim) is a defect the existing test suite does not cover, precisely because the tests validate the *new* code paths and never assert against the *legacy* code paths still live in production traffic. This is a **test-coverage gap**, not a false-negative in the tests that do exist.

---

## 14. Critical-Path Matrix

| Transition | Implemented? | Reachable? | Authorized? | Persisted? | Tested? | User-visible failure? | Blocking defect? | Confidence |
|---|---|---|---|---|---|---|---|---|
| Create account/workspace | Y | Y | Y | Y (non-atomic, §5.2) | Partial | Orphan-workspace edge case only | No (P1) | High |
| Create project | Y | Y (but gated by legacy wizard, §5.9) | Y | Y | Y | Y | **Yes (P0, via §5.9/§5.3)** | High |
| Create first task | Y | Y | Y | Y | Y | Y | No (timezone defect only, P1) | High |
| Update task | Y | Y | Y | Y | Y | Y | No | High |
| Activate Command Center | Y | Y | Y | Y (race risk, §8) | Y | Y | **Yes (P0, §8)** | High |
| Enter Project Intelligence Inbox | Y (as overlay) | Y | Y | Y | Partial | Y | No | High |
| Add evidence | Y | Y | Y | Y (20-row cap, §9) | Partial | Y | No (P1) | High |
| Reload | Y | Y | Y | Y | Y | Y | No | High |
| Recover evidence | Y | Y | Y | Y (capped) | Partial | Y | No (P1) | High |
| Observe honest Project Brain state | Y | Y | Y | Y | Partial | **No — overclaims at zero evidence** | **Yes (P0, §10)** | High |

---

## 15. Contradiction and Duplication Register

See full register in §4. Summary of items requiring action vs. intentional-and-documented:

- **Requires action**: nav label collisions (#1), "Create Center" CTA (#2), legacy wizard blocking project creation (#3), `/pmos/[pmoId]` "Portfolio" mislabel (#5).
- **Intentional, no action required**: PMO Ops Suite disconnection from primary nav (#6, per ADR-PMF-014 Rule 6).
- **Documented debt, not currently exploitable**: pricing "Enterprise" tier vs. `SubscriptionPlan` type (#7).
- **Deferred by design**: Command Center's single-route scope mixing (#4) — the canonical docs themselves flag this as a known, not-yet-remediated violation of IA Principle 4.

---

## 16. Confirmed Technical Debt

- Dead file `src/modules/workspace/presentation/command-center/demo-data.ts` (0 importers since #543).
- `/pmo/invite-team` retains deprecated "PMO Brain" terminology.
- 614 lint warnings for unused variables/imports in test files (no functional impact).
- `npm audit`: 19 high-severity advisories in the dependency tree (informational; not scoped to the audited PR chain — flagged for product awareness, not included in the backlog since it is outside the critical-path scope this audit was chartered to cover).

---

## 17. Canonical Prioritized Backlog

See `docs/audits/pmfreak-post-merge-backlog.json` for the full machine-readable backlog. Summary:

| ID | Title | Priority | Size | Confidence |
|---|---|---|---|---|
| PMF-001 | Legacy onboarding wizard fabricates data and bypasses evidence-derived activation | P0 | M | High |
| PMF-002 | Legacy wizard hard-blocks direct Project creation, contradicting ratified IA | P0 | S | High |
| PMF-003 | Execution-task/dependency mutation endpoints authorize on "read" not "write" | P0 | S | High |
| PMF-004 | `pmos` table lacks unique constraint on `workspace_id` — duplicate-PMO race | P0 | S | High |
| PMF-005 | "Project Brain Online"/"smarter" claim renders at zero-evidence state | P0 | S | High |
| PMF-006 | Static `onboarding_completed` JWT flag diverges from DB-derived activation state | P1 | M | Medium |
| PMF-007 | Workspace bootstrap is not atomic (orphaned-workspace risk) | P1 | S | High |
| PMF-008 | Due-date value drifts by a calendar day across creation/display/edit | P1 | S | High |
| PMF-009 | Command Center activation retry silently no-ops after client timeout | P1 | S | High |
| PMF-010 | `BrainBootSequence` fakes live backend initialization stages | P1 | S | High |
| PMF-011 | `/pmos/page.tsx` retains the same unguarded-call fragility class fixed elsewhere by #553 | P1 | XS | High |
| PMF-012 | Project Brain episode/knowledge timestamps use project-creation time, not real event time | P1 | M | High |
| PMF-013 | Evidence/context timeline silently caps at 20 rows with no pagination | P1 | S | High |
| PMF-014 | `/api/projects/[id]/operational-governance-brief` has no explicit membership check | P1 | S | Medium |
| PMF-015 | Project Brain confidence levels are hardcoded per statement type, not computed | P1 | S | High |
| PMF-016 | Audit-event write failures are unchecked and unlogged | P2 | XS | High |
| PMF-017 | `/create-command-center` has no already-activated short-circuit | P2 | XS | High |
| PMF-018 | Evidence-item hash is a hardcoded placeholder — no real dedup | P2 | S | High |
| PMF-019 | Project Brain knowledge-gap `sourceIds` always empty | P2 | XS | High |
| PMF-020 | `/api/intelligence/{stakeholders,coordination,interventions}` unauthenticated when scope id omitted | P2 | XS | Medium |
| PMF-021 | PM-assignment routes resolve workspace via `workspaces[0]` instead of the project's own workspace | P2 | XS | High |
| PMF-022 | Nav/terminology contradictions (Execution label collision, Portfolio mislabels) | P2 | S | High |
| PMF-023 | Intelligence Inbox advertises 18 evidence-source categories, 5 are wired | P2 | S | High |
| PMF-024 | Pricing "Enterprise" tier undefined in `SubscriptionPlan` type | P3 | XS | Medium |
| PMF-025 | Dead file `demo-data.ts` and deprecated "PMO Brain" label in `/pmo/invite-team` | P3 | XS | High |

Full per-item detail (evidence, current/expected behavior, affected files, root-cause hypothesis, implementation boundary, non-goals, dependencies, acceptance criteria, required tests) is in the JSON deliverable.

---

## 18. Recommended Sprint Sequence

**Sprint 1 — Honest Activation Foundation** (PMF-001, PMF-002, PMF-006, PMF-007)
*Objective:* make the evidence-derived activation engine from #547 the one and only onboarding gate; unblock direct project creation; remove the fragile boolean flag; make bootstrap atomic.
*Why grouped:* all four live in the same onboarding/bootstrap vertical slice and share root files (`getting-started-flow.tsx`, `resolve-onboarding-state.ts`, `workspaces.ts`).
*User-visible outcome:* a new user's first-use journey matches the ratified, evidence-derived architecture — no fabricated scores, no forced PMO-first path.
*Major files:* `src/components/pmfreak/activation/getting-started-flow.tsx`, `src/app/api/getting-started/route.ts`, `src/lib/auth/resolve-onboarding-state.ts`, `src/proxy.ts`, `src/lib/workspaces.ts`.
*Acceptance criteria:* new-user flow never renders fabricated readiness scores; direct Project creation is reachable with zero PMO/Command-Center precondition; `onboarding_completed` is not read anywhere as an authority for activation gating; workspace bootstrap wrapped in a single transaction or explicit compensating-action recovery.
*Validation:* `npm test`, extend `tests/workspace-onboarding-guardrails.test.mjs` to cover the retired/replaced surface.
*Branch:* `sprint/honest-activation-foundation`.
*Completion evidence required:* guardrail test passes against the *entire* onboarding surface (not just the new panel); manual trace confirms no code path reads `user_metadata.onboarding_completed` for gating.

**Sprint 2 — Command Center Activation Integrity** (PMF-004, PMF-009, PMF-017)
*Objective:* make PMO creation idempotent at the database level; fix the silent retry no-op; add an already-activated short-circuit.
*Why grouped:* all three are defects in the same activation mutation path (`save-pmo-tenant.ts`, `create-pmo-wizard.tsx`).
*User-visible outcome:* activation cannot produce duplicate PMOs under concurrency; retrying after a timeout gives visible feedback; revisiting the creation page after activation redirects instead of re-rendering the wizard.
*Major files:* `src/lib/pmo/save-pmo-tenant.ts`, `supabase/migrations/` (new constraint), `src/components/pmfreak/pmo/create-pmo-wizard.tsx`, `src/app/(protected)/create-command-center/page.tsx`.
*Dependencies:* requires a product decision on PMO-per-workspace cardinality (§22) before the constraint can be written.
*Validation:* `npm test`, new concurrency-focused test for duplicate-PMO prevention.
*Branch:* `sprint/command-center-activation-integrity`.

**Sprint 3 — Authorization Hardening** (PMF-003, PMF-014, PMF-016, PMF-020, PMF-021)
*Objective:* close the read/write permission gap on legacy execution-task/dependency endpoints; add defense-in-depth to the governance-brief route; log audit-write failures; tighten auth consistency and workspace resolution on two lower-severity routes.
*Why grouped:* all are authorization/observability corrections in `src/app/api/*`, independent of onboarding/UI work — can run in parallel with Sprint 1.
*User-visible outcome:* view-only roles can no longer mutate task/dependency state through legacy endpoints; audit trail gaps are visible in logs.
*Major files:* `src/app/api/execution-tasks/update/route.ts`, `src/app/api/execution-task-dependencies/*`, `src/app/api/projects/[id]/operational-governance-brief/route.ts`, `src/app/api/intelligence/{stakeholders,coordination,interventions}/route.ts`, `src/app/api/projects/[id]/pm-assignments/*`.
*Validation:* `npm test`, new authorization-boundary tests asserting `executive_viewer`/`external_stakeholder` cannot mutate via the legacy routes.
*Branch:* `sprint/authorization-hardening`.
*May run in parallel with:* Sprint 1 (disjoint files).

**Sprint 4 — Project Brain Honesty & Accuracy** (PMF-005, PMF-010, PMF-012, PMF-015, PMF-019)
*Objective:* gate the "Online"/"smarter" claim on real evidence presence; remove or re-ground the fake boot-sequence animation; fix timestamp derivation to reflect real originating events; either wire real confidence computation or relabel the current heuristic honestly; fix knowledge-gap provenance.
*Why grouped:* one vertical slice — the Project Brain rendering/derivation layer.
*User-visible outcome:* Project Brain never claims more than it has evidence for; episode timestamps are historically accurate; confidence labels are honestly represented.
*Major files:* `src/components/pmfreak/project-brain/project-brain-online-hero.tsx`, `src/components/pmfreak/projects/brain-boot-sequence.tsx`, `src/lib/project-brain/derive-initial-response.ts`, `src/lib/project-brain/episodic-memory/derive-episodes.ts`.
*Dependencies:* should follow Sprint 5 if evidence-count pagination changes affect what counts feed the Brain response.
*Validation:* `npm test`, extend `tests/project-brain-foundation.test.mjs` for the honesty gate.
*Branch:* `sprint/project-brain-honesty`.

**Sprint 5 — Evidence Ingestion Completeness** (PMF-011, PMF-013, PMF-018, PMF-023)
*Objective:* paginate the manual-evidence/context feed; retire the fake hash placeholder or implement real dedup; fix the residual unguarded-call fragility in `/pmos/page.tsx`; reconcile the evidence-source catalog UI to only present wired categories (or clearly gate the rest as "coming soon" rather than silent no-ops).
*Major files:* `src/lib/operational-flow/operational-flow-service.ts`, `src/app/(protected)/pmos/page.tsx`, `src/components/pmfreak/intelligence-inbox/*`.
*Validation:* `npm test`, new pagination test for the evidence/context feed.
*Branch:* `sprint/evidence-ingestion-completeness`.
*May run in parallel with:* Sprint 3, Sprint 4 (mostly disjoint files; coordinate on `operational-flow-service.ts` if Sprint 4 also touches count-based derivation).

**Sprint 6 — Terminology & Navigation Cleanup** (PMF-022, PMF-024, PMF-025)
*Objective:* nav label and CTA renames; document pricing-tier debt; delete dead code.
*Major files:* `src/lib/workspace/navigation-hierarchy.ts`, `src/app/(protected)/pmos/[pmoId]/page.tsx`, `src/modules/workspace/presentation/command-center/demo-data.ts`, `src/app/(protected)/pmo/invite-team/*`.
*Validation:* `npm run lint`, `npm test`.
*Branch:* `sprint/terminology-navigation-cleanup`.
*May run entirely in parallel with all other sprints.*

**Release Gate** (after Sprints 1–3): re-run full validation suite (`npm run typecheck && npm run lint && npm run build && npm test`), plus a manual UAT trace of the full critical path (§14) with a fresh account, before any further intelligence-feature work begins. Sprints 4–6 must not start implementation until the gate passes.

---

## 19. Parallelization and Dependency Map

- **Sprint 1** and **Sprint 3** touch disjoint files — safe to run in parallel.
- **Sprint 2** depends on a product decision (§22) before its migration can be written; can start UI/idempotency-guard work in parallel but should not ship the DB constraint until the decision is made.
- **Sprint 4** should sequence after **Sprint 5** if both touch evidence-count derivation in `operational-flow-service.ts`; otherwise safe to parallelize.
- **Sprint 6** has no dependencies and can run at any time, in parallel with anything.
- **Release Gate** is a hard sequencing point: Sprints 4–6 implementation should not begin until Sprints 1–3 pass the gate, per the instruction to stabilize existing functionality before adding intelligence features.

---

## 20. Release Gate

Before proceeding past Sprint 3:
1. Full validation suite green (`typecheck`, `lint`, `build`, `test`).
2. New authorization-boundary tests for PMF-003 passing.
3. Manual trace confirms a brand-new account can create a project without any PMO/Command-Center precondition and never sees a fabricated readiness score.
4. Concurrency test for PMF-004 (duplicate-PMO prevention) passing, or an explicit product decision (§22) deferring the fix with documented rationale.
5. No regressions in the 12,793-test baseline established in §13.

---

## 21. Deferred or Explicitly Excluded Work

- Splitting Command Center into entity-scoped screens (IA Principle 4 violation) — architecturally significant, explicitly deferred pending a product decision (§22).
- Building out Portfolio/Program as real PMI entities with FK relationships — out of scope for this backlog; only the terminology mismatch is in scope.
- PMO Ops Suite navigation — intentionally disconnected per ADR-PMF-014 Rule 6; no action.
- `npm audit` dependency vulnerabilities (19 high) — outside the audited PR chain's scope; flagged in §16 for awareness only.
- Full-platform security audit — this audit was explicitly scoped to routes touched by PRs #542, #547–#553 only.

---

## 22. Unknowns Requiring Product Decision

1. **Which onboarding system is canonical?** Should `getting-started-flow.tsx` be deleted outright in favor of the #547 evidence-derived engine, or does it contain UX the new engine still needs (in which case selectively port, not delete)?
2. **Is "Portfolio" a near-term roadmap item?** If yes, prioritize building the real entity; if no, retire the term from the UI now rather than leaving a forbidden-synonym contradiction live.
3. **Is Command Center's entity-scope split (Project vs. Workspace) planned for this phase or a later one?** Affects whether PMF-002/#4 in the contradiction register gets a code fix now or stays documented debt.
4. **Are `executive_viewer`/`external_stakeholder` roles currently assignable in production today?** If they are not yet grantable through any UI, PMF-003's urgency may be P1 rather than P0 — but the audit could not confirm role-assignment reachability from static code alone, so it is kept at P0 pending confirmation.
5. **Should `pmos` enforce one-PMO-per-workspace uniqueness, or is multi-PMO-per-workspace an intended future capability?** This determines whether PMF-004's fix is a unique constraint (single-PMO model) or an idempotency key/dedup check (multi-PMO model).

---

## 23. Final Verdict

Overall critical-path classification: **PARTIALLY FUNCTIONAL**.

Every individual technical component audited — workspace bootstrap, project/task creation, Daily Execution, Command Center activation, Project Intelligence Inbox capture, Project Brain's foundation — has a real, working, tenant-isolated, and mostly-tested vertical slice, and the repository's own validation suite is fully green (12,793/12,793 tests, clean typecheck/lint/build). But the **actual first-use path** a new user experiences is gated by a pre-existing wizard that fabricates data and blocks the ratified independent-project-creation flow, one legacy authorization surface allows view-only roles to mutate execution state, one data-integrity gap can duplicate PMO records under concurrent activation, and the Project Brain's headline claim overclaims its own capability at the exact moment a new user first sees it. These are not edge-case gaps — they sit directly on the critical path this audit was chartered to verify, and each is confirmed with file:line evidence rather than inferred.

**PMFREAK CRITICAL PATH PARTIAL — REMEDIATION BACKLOG READY**
