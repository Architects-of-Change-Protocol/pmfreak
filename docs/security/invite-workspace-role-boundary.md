# Invite acceptance / workspace role assignment boundary

Trust boundary for how a row is ever written to `workspace_memberships` — the
same table that [`billing-authorization-boundary.md`](./billing-authorization-boundary.md)
and [`auth-role-boundary.md`](./auth-role-boundary.md) already treat as the sole
authoritative source of workspace role. This document covers the other side of
that guarantee: **how does a row get into that table in the first place, and can
its `role` value be influenced by anything other than a trusted server-side
decision?**

Workspace roles are assigned only through server-side trusted flows.

## The vulnerability this closes

`src/app/(protected)/accept-invite/[token]/page.tsx` looked up a
`workspace_invitations` row by its plaintext `token`, checked that the invite
was `pending` and not expired, and then upserted a `workspace_memberships` row
using `invite.role` — **without ever checking that the invite's `email` matched
the authenticated user accepting it**:

```ts
// before
const { data: invite } = await supabase.from("workspace_invitations").select("*").eq("token", token).maybeSingle();
if (!invite) notFound();
if (invite.status !== "pending") throw new Error("Invitation already used.");
// ... expiry check ...
await supabase.from("workspace_memberships").upsert({ workspace_id: invite.workspace_id, user_id: user.id, role: invite.role });
```

Any authenticated user who obtained a valid, pending, non-expired invite
token — through a leaked link, a shared inbox, a referrer header, browser
history, or simple guessing of the 24-byte hex token — could accept **any**
pending invite for **any** workspace at **whatever role that invite carried**,
regardless of which email address it was addressed to. Combined with a second
gap in invite creation (below), this was a two-link privilege-escalation
chain: an admin could mint an `owner`-role invite, and if that token ever
reached (or was used by) any other account, that account became `owner` of
the workspace.

`src/lib/workspace-team.ts`'s `inviteWorkspaceMember` also validated the
invited `role` only against the full `WORKSPACE_ROLES` enum
(`owner|admin|pm|viewer`), never against the inviter's own rank or against a
policy that excludes `owner` from the invite flow entirely — so any `admin`
(not just the workspace `owner`) could create an `owner`-role invite.

A structurally identical version of the missing-email-check gap also existed
in `src/lib/early-access.ts`'s `acceptEarlyAccessInvite`, which activates a
90-day trial and assigns `owner` on a brand-new workspace — `invite.invite_email`
was fetched but never compared to the accepting user. Both are fixed by this
change.

## Roles that exist and where each one comes from

| Role source | Trusted? | Where |
| --- | --- | --- |
| `workspace_memberships.role` | **Yes — the only authoritative workspace role.** | Written only by `ensureWorkspaceMembership` (workspace creation) and `acceptWorkspaceInvite` (invite acceptance). |
| Invite record (`workspace_invitations.role`) | Yes, once validated server-side | Set at invite-creation time by `inviteWorkspaceMember`, from a role the actor is authorized to assign — never trusted again once read back without re-validation via `normalizeWorkspaceRole`. |
| `AuthUserContext.role` (display role) | No | Client-writable `user_metadata.role`, clamped by `toDisplayRole()` — see `auth-role-boundary.md`. Never read by any function in this document. |
| `user_metadata.role` | No | Same as above. |
| Request body / FormData / query params (`role`, `workspaceRole`, `isOwner`, `isAdmin`, `permissions`, `claims`, ...) | No | Structurally never read by `acceptWorkspaceInvite` — the function's parameter type is `{ token, userId, userEmail }`, nothing else. |

## How a workspace owner is created

```
workspace creation → creator gets owner server-side
invite acceptance  → user gets invite.role server-side (never "owner")
```

`ensureWorkspaceMembership` in `src/lib/workspaces.ts` hardcodes
`"owner"` as a literal for the user who triggers first-time workspace
bootstrap (`ensureUserWorkspace`) — never a variable derived from client
input, and only fires once per user (guarded by an existing-membership
check). This was already correct and is unchanged by this fix; a source-level
regression test locks in that the literal stays a literal (see Tests below).

**No public or normal invite flow may assign `owner`.** `INVITABLE_WORKSPACE_ROLES`
(`src/lib/workspace-access.ts`) is `["admin", "pm", "viewer"]` — `owner` is
excluded unconditionally, regardless of the inviting actor's own role. There
is no owner-transfer flow implemented; see Residual risks.

## Who can create an invite, and at what role

```
owner: can invite admin, pm, viewer — not owner
admin: can invite admin, pm, viewer — not owner
pm:    cannot invite
viewer: cannot invite
```

Two functions enforce this together, both in `src/lib/workspace-access.ts`:

- **`requireWorkspaceInviteActor({ userId, workspaceId })`** — reads the
  actor's role directly from `workspace_memberships` (never display role,
  `user_metadata.role`, or any client field) and denies if there's no
  membership or the role isn't `owner`/`admin`. Fails closed
  (`WorkspaceMembershipError` with reason `workspace_missing` or
  `insufficient_role`).
- **`canAssignWorkspaceRole({ actorRole, targetRole })`** — requires
  `canInviteMembers(actorRole)` (owner/admin) **and** `targetRole` to be in
  `INVITABLE_WORKSPACE_ROLES` (never `owner`).

`inviteWorkspaceMember` (`src/lib/workspace-team.ts`) calls
`requireWorkspaceInviteActor` first, normalizes the requested role with
`normalizeWorkspaceRole`, and only proceeds if `canAssignWorkspaceRole`
allows that `(actorRole, targetRole)` pair. The server action
(`sendInviteAction` in `src/app/(protected)/team/actions.ts`) performs the
same check as a fast-fail before ever reaching `inviteWorkspaceMember`, but
`inviteWorkspaceMember` does not depend on that pre-check — it is
self-defending regardless of caller.

### Why `requireWorkspaceInviteActor` bypasses the generic AOC governance pipeline

`inviteWorkspaceMember` also calls `requireGovernancePermission(workspaceId,
"manage_members")` (`src/lib/security/access-guards.ts`) — unchanged, kept
for its audit-trail and seat-accounting side effects — but that pipeline is
**not** the authoritative actor gate here. Its role vocabulary
(`src/lib/security/rbac.ts`: `"PM"`, `"contributor"`, `"executive_viewer"`,
...) uses different casing than `workspace_memberships.role`'s actual values
(`"pm"`, lowercase, enforced by a DB check constraint). A `pm`-role member
calling through that pipeline is denied today, but only because
`ROLE_PERMISSION_MAP["pm"]` doesn't exist (case mismatch) — an accidentally
correct outcome, not a deliberate policy. `requireWorkspaceInviteActor` is a
small, directly-testable, DB-only lookup using the same `WorkspaceRole`
vocabulary as the DB column itself, so invite-actor authorization does not
depend on that mismatch resolving in the safe direction. This mirrors the
precedent in `billing-authorization-boundary.md`.

## How an invite is accepted

`acceptWorkspaceInvite({ token, userId, userEmail })` in
`src/lib/workspace-team.ts` is the **sole** function that creates a
`workspace_memberships` row from an invite. Its signature is deliberately
narrow — no `role`, `workspaceId`, or `workspaceRole` parameter exists, so
there is nothing for a caller to smuggle in even by accident.

```
1. resolveValidWorkspaceInvite(token):
   - token missing/blank            → deny (invalid_token)
   - no matching row                → deny (invalid_token)
   - stored role fails normalizeWorkspaceRole → deny (invalid_role)
   - status = "revoked"             → deny (revoked)
   - status = "accepted"            → deny (already_used)
   - status not "pending"           → deny (expired)
   - expires_at in the past         → mark status "expired" server-side, deny (expired)
2. assertInviteBelongsToAuthenticatedEmail(invite.email, userEmail):
   - normalized emails don't match  → deny (email_mismatch) — invite is NOT
     consumed by a wrong-email attempt, so the real invitee can still use it
3. Atomic claim: UPDATE workspace_invitations SET status='accepted', ...
   WHERE id = invite.id AND status = 'pending', check the row was actually
   updated
   - no row updated (lost the race, or already used) → deny (already_used)
4. Only after 1–3 all pass: upsert workspace_memberships with
   { workspace_id: invite.workspaceId, user_id: userId, role: invite.role }
5. Insert an "invitation_accepted" workspace_audit_events row
```

No membership is ever written before step 4, and step 4 always uses
`invite.workspaceId` / `invite.role` resolved in step 1 — never a
client-supplied value.

### Replay / race safety

The pending→accepted transition is a single conditional `UPDATE ... WHERE
status = 'pending'`, and the code checks whether that update actually
matched a row before writing any membership. If two requests race on the
same token, at most one can win that conditional update; the other
necessarily sees `already_used` and never reaches the membership upsert.
This also means a used token can never re-elevate an existing membership —
covered directly by test (see below).

### Sources that are explicitly NOT consulted during acceptance

- `AuthUserContext.role` (display role) / `user_metadata.role` — not read by
  `acceptWorkspaceInvite` at all.
- Request body / FormData / query params: `role`, `workspaceRole`,
  `memberRole`, `isOwner`, `isAdmin`, `permissions`, `claims`,
  `workspaceId` — none of these exist on the function's parameter type.
  `src/app/(protected)/accept-invite/[token]/page.tsx` is itself a Server
  Component page render (no body to parse) that passes only `token`,
  `user.id`, and `user.email`.

## What happens in each edge case

| Scenario | Result |
| --- | --- |
| Token doesn't exist / blank | 404-equivalent (`notFound()`), no membership |
| Invite role fails `normalizeWorkspaceRole` (corrupted/garbage data) | Deny, no membership |
| Invite revoked | Deny, no membership |
| Invite already accepted (used token, replay) | Deny, no membership, no role change |
| Invite status otherwise not pending, or expired | Deny (marks `expired` server-side if past `expires_at`), no membership |
| Authenticated user's email ≠ invite email | Deny, invite is **not** consumed |
| Body/FormData contains `role: "owner"`, invite role is `"viewer"` | Membership created with `"viewer"` — body ignored |
| Body contains `workspaceId` for a different workspace | Membership created in the invite's own workspace — body ignored |
| `user_metadata.role` / display role = `"admin"`, no/insufficient workspace membership | Cannot create an invite — `requireWorkspaceInviteActor` never reads these fields |
| `pm`/`viewer` actor attempts to create an invite | Denied (`insufficient_role`) |
| `owner`/`admin` actor attempts to invite `role: "owner"` | Denied — `canAssignWorkspaceRole` excludes `owner` unconditionally |
| `owner`/`admin` actor invites `admin`/`pm`/`viewer` | Invite created |
| Valid invite, matching email, invite role `admin`/`pm`/`viewer` | Membership created with that role |

## Tests

- `tests/invite-workspace-role-boundary.test.mjs` — behavioral tests of
  `normalizeWorkspaceRole`, `canAssignWorkspaceRole`,
  `requireWorkspaceInviteActor`, and `acceptWorkspaceInvite` against fake
  injected Supabase clients: role-casing/garbage normalization, owner-invite
  blocking, actor-role gating (owner/admin allow, pm/viewer deny, missing
  membership fails closed), display-role/metadata-role irrelevance, invalid
  token, expired token (with server-side status update), revoked token, used
  token (including against a pre-existing membership, proving no
  escalation), replay-after-success, email mismatch (and that it does not
  consume the invite), workspaceId-from-body ignored, role/isOwner-from-body
  ignored, normal accept success for admin/pm/viewer, invalid stored role
  fails closed, and a source-level check that workspace-creator `owner`
  assignment stays a hardcoded literal.
- `tests/early-access-invite-email-boundary.test.mjs` — source-level
  regression test confirming `acceptEarlyAccessInvite` requires `userEmail`
  and validates it before any workspace/membership mutation, and that the
  route passes the authenticated user's real email, not a body field. (Full
  behavioral testing of this function wasn't added — it has no existing
  dependency-injection seam and retrofitting one to `early-access.ts` was
  judged out of scope for this perilla; see Residual risks.)

## Regression this fix prevents

- An authenticated user who obtains a workspace invite token (leaked,
  guessed, or forwarded) addressed to someone else's email can no longer
  accept it and gain that role in the workspace.
- An `admin` can no longer mint an `owner`-role invite; no invite, regardless
  of who creates it, can ever result in an `owner` membership.
- A `pm`/`viewer` workspace member can no longer create an invite by calling
  `inviteWorkspaceMember` directly, even if some future caller skips the
  server action's own pre-check — the function is now self-defending.
- A client sending `role`, `workspaceRole`, `isOwner`, `isAdmin`, or
  `workspaceId` in a request during acceptance can no longer influence the
  assigned role or target workspace — `acceptWorkspaceInvite`'s signature
  structurally excludes them.
- A used/expired/revoked invite token can no longer be replayed to create a
  duplicate membership or change an existing membership's role.
- The same missing-email-check class of bug in `early-access.ts`'s
  `acceptEarlyAccessInvite` (early-access trial activation, also a
  `workspace_memberships` write) is closed — an attacker holding a leaked
  early-access token can no longer activate another person's trial under
  their own account.

## Residual risks

- **Owner transfer is not implemented.** There is no flow to move `owner` to
  another member; `owner` is only ever assigned at workspace-creation
  bootstrap. If an owner-transfer feature is added later, it must be its own
  explicit, documented flow — not a change to `INVITABLE_WORKSPACE_ROLES`.
  See [`workspace-role-update-boundary.md`](./workspace-role-update-boundary.md)
  (Perilla 4), which hardens the *update* side of `workspace_memberships.role`
  (once a member already exists) and blocks `owner` assignment there too.
- ~~**Invite tokens for `workspace_invitations` are stored and compared as
  plaintext**~~ — **RESOLVED in Perilla 11** (beta release closure gate). The
  table now stores only `token_hash` (sha256 of a 192-bit CSPRNG token, see
  `src/lib/security/invite-tokens.ts`); the plaintext `token` column was
  dropped and legacy pending plaintext invitations were revoked by
  `supabase/migrations/20260820000000_workspace_invite_token_hashing.sql`.
  Lookups compare hashes (`resolveValidWorkspaceInvite` in
  `src/lib/workspace-team.ts`), and the plaintext exists only once, inside
  the `acceptPath` returned by `inviteWorkspaceMember` at creation time.
  Coverage: `tests/workspace-invite-token-hashing.test.mjs`.
- **`acceptEarlyAccessInvite` has a separate, pre-existing race window**: it
  doesn't atomically claim the invite before creating the new workspace (the
  `accepted_at` write happens near the end of the function), so two
  concurrent requests with the same valid token could each create a
  workspace. This does not let workspace roles be assigned incorrectly
  (each new workspace's `owner` is still correctly the accepting user, never
  client-supplied) — it's a duplicate-resource-creation risk, not a role-
  assignment risk — so it's out of scope for this perilla but worth fixing
  separately.
- **No behavioral (only source-scan) test coverage for
  `acceptEarlyAccessInvite`'s email check**, because the function has no
  existing dependency-injection seam (it calls `createSupabaseServiceRoleClient`
  and `logFirstUserTelemetryEvent` directly) and adding one was judged out
  of proportion to this fix.
- **No revoke/resend/list endpoints exist for `workspace_invitations`** (only
  `early_access_invites` has resend/revoke, via founder-only routes). The
  team page reads pending invites inline, scoped to the viewer's own
  workspace via RLS. There is nothing to harden here today; if a
  revoke/resend endpoint is added, it must go through `requireWorkspaceInviteActor`
  or equivalent, not a role check on its own.
- **`pmo_team_invites.role` has no DB check constraint** (free-text column).
  It is currently inert — no code path ever promotes a `pmo_team_invites`
  row into a `workspace_memberships` row — so it's not a live escalation
  path today, but worth constraining if an acceptance flow is ever built for
  it.
- **Two divergent role vocabularies read the same `workspace_memberships.role`
  column**: `src/lib/workspace-access.ts` (`owner|admin|pm|viewer`, matches
  the DB) and `src/lib/security/rbac.ts` (`owner|admin|PM|contributor|...`,
  used by the AOC governance pipeline). This perilla routes around the
  mismatch for invite-actor authorization (see above) rather than
  consolidating the two systems, which is a larger change outside this
  perilla's scope.

## Veredicto de tuning

Tuned completamente para el flujo `workspace_invitations` (creación y
aceptación), con hardening adicional aplicado al gap estructuralmente
idéntico en `acceptEarlyAccessInvite`. Ver "Residual risks" arriba para lo
que queda deliberadamente fuera de alcance (owner transfer, hashing de
token, refactor de DI en `early-access.ts`, consolidación de vocabularios de
rol).
