# Hosted RLS Role Matrix — Perilla 13B

## Status: NOT EXECUTED

No hosted Supabase project was available this session. Perilla 13 already
proved a live two-workspace, two-user cross-tenant matrix against local
PostgreSQL (`rls-tenant-isolation-report.md`, 10/10 checks). This document
extends that matrix to the full actor set the PR brief requires (section
E), to be executed against a real hosted project with real Supabase Auth
sessions — **not simulated with a service-role client filtering results**,
per the PR brief's explicit prohibition (E.4).

## Real roles (source of truth: `src/lib/workspace-access.ts`)

```ts
export const WORKSPACE_ROLES = ["owner", "admin", "pm", "viewer"] as const;
```

The PR brief's actor list (E.1) uses generic names ("PM/Member", "Admin",
"Viewer", "Owner") that don't exactly match this codebase's role set — per
principle 5 ("no inventar roles que no existan"), the matrix below is
remapped to PMFreak's real 4 roles rather than inventing a "member" role
that doesn't exist.

## E.1 — Users and roles needed (not yet created — no hosted project)

| Brief actor | PMFreak role / state | Status |
| --- | --- | --- |
| User A — owner in Workspace A | `owner` | NOT CREATED |
| User B — admin in Workspace A | `admin` | NOT CREATED |
| User C — member/pm in Workspace A | `pm` | NOT CREATED |
| User D — viewer in Workspace A | `viewer` | NOT CREATED |
| User E — non-member | no membership row | NOT CREATED |
| User F — removed member | membership row deleted after creation | NOT CREATED |
| User G — expired-invite user | `workspace_invitations` row past `expires_at`, never accepted | NOT CREATED |
| User H — owner in Workspace B | `owner`, second workspace | NOT CREATED |

## E.2 — Minimum cases (template — all cells NOT EXECUTED)

| Actor | Own Workspace Read | Own Workspace Write | Role Mutation | Foreign Workspace Read | Foreign Workspace Write |
| --- | ---: | ---: | ---: | ---: | ---: |
| Owner | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Admin | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| PM | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Viewer | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Non-member | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Removed member | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |
| Expired-invite user | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED | NOT EXECUTED |

Expected outcomes per the PR brief (to be confirmed by live execution, not
assumed): Owner/Admin/PM per-policy own-workspace access, Viewer
read-only, all four of Non-member/Removed-member/Expired-invite-user denied
everywhere, all foreign-workspace access denied for every actor.

## What Perilla 13 already proved (local PostgreSQL, not hosted — see honesty statement in `fresh-database-migration-proof.md`)

Two workspaces, two users (effectively Owner-vs-Owner cross-tenant), real
`auth.uid()` simulated via `current_setting('request.jwt.claim.sub')`:
cross-tenant SELECT/INSERT/UPDATE/DELETE all correctly rejected,
own-workspace access correctly allowed, service-role-only table
(`agent_attestation_nonces`) correctly rejects `authenticated`. This is
**not** a substitute for the full 8-actor × 5-resource-category matrix
above, nor for real Supabase Auth JWT sessions (the local run stubbed
`auth.uid()`/`auth.jwt()`, it did not run GoTrue).

## E.3 — Resources to cover (not yet executed against any resource below)

`workspaces`, `workspace_memberships`, `projects`, `tasks` *(not a
first-class PMFreak table — closest analogues: `evidence_items`,
`recommended_actions`; confirm exact resource list against schema before
executing)*, `milestones` *(same caveat)*, `dependencies` *(same caveat)*,
`evidence` (`evidence_items`), `billing records`
(`billing_webhook_events`, `company_usage`), `workspace invitations`
(`workspace_invitations`), `AI usage events` (`ai_usage_events`), `audit
events` (`governance_audit_events`, `workspace_audit_events`).

Note: the brief's generic resource names (`tasks`, `milestones`,
`dependencies`) don't map 1:1 to this schema's actual table names — this
needs to be resolved against `docs/release/schema-integrity-report.md`'s
table list before live execution, not guessed.

## To complete this report for real

1. Follow the execution plan in
   [`hosted-supabase-migration-proof.md`](./hosted-supabase-migration-proof.md).
2. Create the 8 users above via the real Supabase Auth API (not direct
   `auth.users` inserts — that bypasses GoTrue and defeats the point of
   testing against the real platform).
3. For each, sign in and obtain a real session JWT; use that JWT's
   `Authorization` header for every query below — no service-role
   filtering.
4. Run each cell of the E.2 table against each resource in E.3, recording
   the actual HTTP/Postgres error (or success) — not an assumption.
5. Replace every "NOT EXECUTED" above with "Allowed"/"Denied" plus the
   evidence (request + response summary, no secrets).
