# Performance Review — Code-Level (Section 17)

Scenario evaluated by reading, not by generating 1000 real rows and
load-testing (out of scope per the sprint's own "no optimices
prematuramente" guidance) — code-level analysis with index verification
against the live schema.

## Index coverage (verified live against `pmfreak_fresh_v2`)

```
pmos_workspace_idx                     ON pmos (workspace_id, status, created_at)
projects_workspace_pmo_idx             ON projects (workspace_id, pmo_id)
context_conversations_workspace_idx    ON context_conversations (workspace_id, context_type)
context_conversations_scope_unique_idx ON context_conversations (workspace_id, context_type, pmo_id, project_id) [unique, partial]
context_messages_conversation_idx      ON context_messages (conversation_id, created_at)
```
All required composite indexes from the sprint's checklist are present.
`context_conversations`'s own scope-unique index also serves lookups
filtered by `(workspace_id, context_type, pmo_id/project_id)` — no separate
standalone index needed since queries always filter on that composite key
together (confirmed by reading `getOrCreateConversation`'s query).

## Sidebar / PMO listing

`listPmosWithProjects` (§ "Navigation" above) is O(2) queries regardless of
scale — no N+1. At 1000 projects the response payload (`id, name, status`
per project) is un-paginated; documented as a residual risk, not fixed.

## Chat responder

`buildContextReply`'s `loadScopeData` issues at most 3 queries per request
(`projects`, then `raid_items` + `execution_tasks` in parallel via
`Promise.all`, then an optional `pmos` count for workspace scope) —
independent of the number of projects in scope (all filtered by a single
`.in("project_id", projectIds)` call, not per-project). Each query is
`.limit(500)`-capped. No N+1 found.

## Duplicate/server-client fetch

`SidebarPmoTree` re-fetches `/api/pmos` on every `pathname` change
(`useEffect` dependency `[pathname]`) — this is a deliberate, reasonable
choice (keeps the sidebar's project list fresh after a project/PMO is
created elsewhere) at the cost of one extra fetch per navigation. Not
flagged as a defect — matches the existing app's general pattern of
client-side data freshness over aggressive caching.

## Verdict

**Pass**, with one documented residual risk (no pagination on the
PMO/project sidebar payload at 1000+ project scale) — not blocking, matches
the sprint's own instruction not to prematurely optimize.
