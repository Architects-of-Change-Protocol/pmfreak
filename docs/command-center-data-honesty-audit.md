# Command Center Data Honesty Audit

Internal audit produced before the "data trust" sprint edits. Scope: the light
Command Center (`/command-center`) and its presentation components under
`src/modules/workspace`.

## 1. Data that comes from the real backend

| Surface | Source | Notes |
| --- | --- | --- |
| Project list | Supabase `projects` table via `app/(protected)/command-center/page.tsx` | Real. |
| Project badges (warnings / tasks / approvals) | `OperationalGovernanceBrief` (`loadLatestOperationalGovernanceBrief`) | Real, only for the active project. |
| Needs You (real branch) | `/api/operational-flow` → `deriveNeedsYou` | Real recommendations awaiting a decision, with Accept/Reject/Defer wired to `record_decision`. |
| Repository counts (real branch) | `deriveRepository` over operational-flow evidence/decisions | Real counts. |
| Agent statuses (real branch) | `deriveAgents` over `assurance` counters | Real counts; status text derived from them. |
| Chat | `/api/command-center/chat` (deterministic Conversational Brain Gateway) | Real; disclosure is in the feed footer. |
| Vault intake | `/api/vault/intake` + operational-flow chain | Real. |
| Portfolio strip (PMOs / projects) | `listPmosWithProjects` | Real. |

## 2. Data that came from fixtures (rendered in production before this sprint)

All in `presentation/command-center/demo-data.ts`, rendered by
`command-center-layout.tsx` whenever the active project had **no evidence yet**
(`hasRealData === false`), i.e. exactly the state every new dogfooding project
starts in:

- `DEMO_NEEDS_YOU` — 4 invented queue items ("Approve client update", "Task #104", "Email from Alejandro, June 29"…).
- `DEMO_AGENTS` — 6 agents with invented badges ("2 warnings", "3 tasks", "12 sources") and live-looking activity animations.
- `DEMO_REPOSITORY` — invented counts (18 documents, 42 emails, 9 meeting notes…).
- `DEMO_CHAT` — an invented conversation with invented sources and findings.
- `DEMO_MEMORY` — static memory categories, passed to the sidebar **unconditionally** (even with real data), implying memory content that does not exist.
- `SUGGESTED_PROMPTS` — honest copy (prompt suggestions for the real chat) but housed in the demo file and imported into production from there.
- `DEMO_PROJECTS`, `DEMO_WORKSPACE_NAME` — unused by production render.

The sections carried a small "Example" `PreviewTag`, but the numbers, names,
dates and animations still read as live operational state.

## 3. Hardcoded / fake-affordance data

- `project-top-bar.tsx` — literal `Last updated: 8 min ago` string, always shown.
- `project-top-bar.tsx` — health label `"Monitoring"` for projects whose intelligence has never been evaluated (implies active monitoring).
- `project-top-bar.tsx` — "Generate Report" and "Share" buttons with no handler (dead affordances).
- `detail-drawer.tsx` — `DEFAULT_ACTIONS` fallback buttons ("Draft update", "Create task", "Mark reviewed", "Ask agent") with no-op `onClick`, shown for every drawer that had no real actions.
- `command-center-layout.tsx` — `handleActionClick` posted a fake assistant message ("Okay — starting on …") without doing anything.
- `command-center-client.tsx` — workspace name fallback `"Demo PMO"`.
- `command-center-empty-state.tsx` — "Ask this project anything…" placeholder (implies generative AI; the chat is deterministic).
- `project-repository.tsx` / `ProjectMemory` — category buttons that navigate nowhere (kept: they now render only when backed by real counts, or as an explicit empty state).
- `operational-decision-loop.tsx` and `widgets.tsx` — not imported by any production surface (dead code, left untouched this sprint).

## 4. Components that showed information without real evidence

- `NeedsYouQueue`, `AgentDock`, `ProjectRepository`, `ProjectMemory`, `CommandFeed` — all rendered fixture content in the no-evidence state.

## 5. Sprint resolution

- No fixture is rendered by the production Command Center anymore. `demo-data.ts` is kept (clearly commented) for demo/test environments only.
- Every previously-fake section now has a three-part honest empty state: what it means, why it is empty, what the user can do now (CTA opens the notes intake).
- The only timestamp shown is derived from real operational-flow records and hidden when unknown.
- Suggested-action chips now post the action through the real chat gateway instead of faking a confirmation message.
