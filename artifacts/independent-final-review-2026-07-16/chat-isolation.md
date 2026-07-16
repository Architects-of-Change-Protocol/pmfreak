# Chat Isolation — Independent Re-Execution

## Method

A full 149-migration database was rebuilt from scratch in this session
(`pmfreak_chat_isolation_v2`), seeded with the sprint's literal scenario
(Workspace A: PMO1 {Project Alpha, Project Beta}, PMO2 {Project Gamma};
Workspace B: PMO-B {Project Delta}), with a distinct secret marker per
project embedded in `raid_items.title` — the *only* column
`context-chat-responder.ts`'s `loadScopeData()` actually selects from that
table (confirmed by reading the shipped source directly:
`.select("project_id, category, status, due_date, owner, title")`).

A minimal Node script replicates `loadScopeData()`'s exact SQL logic
(re-verified line-for-line against the current source in this session) and
runs it against the live database via the `pg` driver (temporarily
installed for this review only — `npm install --no-save pg`, removed
afterward, `package.json`/`package-lock.json` untouched throughout, verified
via `git status --short` before and after).

**Scope of this method:** it validates the actual query-construction logic
(confirmed identical to the shipped `.ts` file) against real RLS-protected
tables — genuinely behavioral, not just static reading. It does **not**
exercise the literal compiled Next.js route handler over HTTP, because no
PostgREST/GoTrue stack is available in this sandbox (`docker ps` fails —
no daemon socket). This limitation is unchanged from the prior validation
sprint and is documented, not glossed over.

## Results

```
PASS 7.2a: expected marker "ALPHA-4729" correctly visible in scope results
PASS 7.2b (Beta chat vs Alpha secret): forbidden marker "ALPHA-4729" absent from scope results (1 projects, 0 raid items visible)
PASS 7.3a: expected marker "GAMMA-7731" correctly visible in scope results
PASS 7.3b (PMO1 chat vs Gamma/PMO2 secret): forbidden marker "GAMMA-7731" absent from scope results (2 projects, 1 raid items visible)
PASS 7.3c (PMO1 chat DOES see its own Alpha+Beta): expected marker "Project Alpha" correctly visible in scope results
PASS 7.4a: expected marker "DELTA-2266" correctly visible in scope results
PASS 7.4b (Workspace A chat vs Workspace B secret): forbidden marker "DELTA-2266" absent from scope results (3 projects, 2 raid items visible)
PASS 7.4c (Workspace A chat DOES see its own projects): expected marker "GAMMA-7731" correctly visible in scope results

ALL CHAT ISOLATION SCENARIOS: PASS
```

## Workspace derivation (section 9.1)

Re-read `src/app/api/context-chat/route.ts`'s current `resolveAndAuthorizeScope`:
for `contextType === "pmo"`, `workspace_id` is fetched via
`getPmoWorkspaceId(pmoId)` (a lookup on the PMO's own row, no workspace
filter); for `contextType === "project"`, via `getProjectWorkspaceId(projectId)`
(same pattern on the project's own row). **Neither branch calls
`resolvePreferredWorkspace`** — confirmed by slicing the source at each
branch's boundary and asserting the absence of that call (see the new
regression test file, and the original validation sprint's own
`tests/workspace-pmo-project-validation-sprint.test.mjs`). Only the
`contextType === "workspace"` branch uses the cookie-derived preferred
workspace — correctly, since there is no other entity to derive from at
that level.

This means: a cookie pointing at another workspace, an invalid workspace,
or a workspace the user lost access to has **zero effect** on a PMO/project
chat's scope — the scope is always derived from, and re-authorized against,
the entity itself (`requireWorkspaceMember`/`requireProjectAccess`, both of
which independently re-check real membership server-side, not from the
cookie).

## Thread identity

See `rls-negative-tests.md` §"Thread identity" — 5 distinct scopes produced
5 distinct conversation ids; a duplicate workspace-scope insert was
rejected by the unique index; no dangerous global-fallback pattern found
anywhere in the codebase.

## Effective retrieval rules (confirmed, not assumed)

| Fuente | Workspace Chat | PMO Chat | Project Chat |
|---|---|---|---|
| Projects | todos los del workspace (todas las PMOs) | solo los de esa PMO | solo ese project |
| Risks (raid_items.title) | todos los del workspace | solo los de sus projects | solo los de ese project |
| Conversations | su propio thread (workspace-scope) | su propio thread (pmo-scope) | su propio thread (project-scope) |

**Not yet integrated with the new chat responder** (documented limitation,
not a regression — these never claimed integration in the first place):
Documents (`vault_documents`), Tasks (`execution_tasks` is queried by the
responder for tasks — confirmed present at
`context-chat-responder.ts:50` — so Tasks *are* scoped; corrected from an
initial assumption during this review), Meetings, Emails, embeddings/vector
search. `buildContextReply` grounds answers from `projects` + `raid_items`
+ `execution_tasks` only. This is **architecturally prepared** (the
`ContextScope` type and `contextIdFor()` helper are generic and would
extend cleanly to more sources) but **not yet wired** — an accurate
characterization, not an overclaim of full memory/embedding isolation.

## Verdict

**Pass**, with the black-box-HTTP limitation explicitly carried forward as
a residual risk (see `final-report.md`).
