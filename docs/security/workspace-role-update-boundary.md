# Workspace member role update / owner transfer boundary

Trust boundary for **updating** an existing `workspace_memberships.role` row —
the other side of the guarantee already established for how that row gets
*created* in the first place ([`invite-workspace-role-boundary.md`](./invite-workspace-role-boundary.md),
Perilla 3) and for how it authorizes billing
([`billing-authorization-boundary.md`](./billing-authorization-boundary.md),
Perilla 2). If `workspace_memberships.role` is the sole authoritative source
of workspace authorization, the code path that *changes* a member's role is
at least as sensitive as the one that assigns it the first time.

**Workspace member role updates are authorized only from server-side
workspace membership state.** Client-provided `actorRole` and `targetRole`
are never trusted without server-side membership validation and policy
evaluation.

## What existed before this change

There is **no update-member-role or remove-member endpoint, server action,
or UI anywhere in this codebase.** `src/app/(protected)/team/page.tsx` only
renders a read-only member list and an invite form
(`sendInviteAction` in `src/app/(protected)/team/actions.ts`); there is no
`<select>`, form, route, or server action that changes an existing member's
role or removes them. Grepping for `updateMemberRole`, `changeMemberRole`,
`setWorkspaceMemberRole`, `removeWorkspaceMember`, `deleteWorkspaceMember`,
`transferOwner`, `transferWorkspaceOwner`, `makeOwner`, and every direct
`.update()`/`.delete()` call against `workspace_memberships` across the repo
confirms this: the only writers to that table are workspace-creation
bootstrap (`ensureWorkspaceMembership`, hardcodes `"owner"`) and
`acceptWorkspaceInvite` (writes `invite.role`, resolved server-side).
`workspace_memberships` also has no `UPDATE`/`DELETE`/`INSERT` RLS policy for
the `authenticated` role at all — only two `SELECT` policies
(`20260515100000_rls_governance_fixes.sql`) — so even a hypothetical
client-side Supabase call from the browser could not have changed a role
directly.

This perilla is therefore preventative rather than a fix for a live bug: it
adds the authoritative server-side policy and orchestration function *before*
any role-update UI/route is built, so that whenever one is added, it can only
ever change `workspace_memberships.role` through this hardened path — never
through an ad hoc `.update()` call somewhere else that re-derives its own
(possibly wrong) authorization logic.

## Roles that exist and where each one comes from

| Role concept | Trusted for role-update decisions? | Where |
| --- | --- | --- |
| `workspace_memberships.role` (actor's own row) | **Yes.** This is `actorRole`. | Read by `requireWorkspaceRoleUpdateActor` (`src/lib/workspace-access.ts`). |
| `workspace_memberships.role` (target's row) | **Yes.** This is `currentTargetRole`. | Read by `requireWorkspaceRoleUpdateTarget`. |
| Requested role (client input) | Only after normalization | `normalizeWorkspaceRole(input.requestedRole)` → `requestedTargetRole`. Rejected outright (`deny_invalid_role`) if it isn't one of `owner\|admin\|pm\|viewer`. |
| `AuthUserContext.role` (display role) | **No** | Never read by any function in this document. |
| `user_metadata.role` | **No** | Same. |
| Request body / FormData (`role`, `actorRole`, `isOwner`, `isAdmin`, `workspaceRole`, `currentRole`, ...) | **No** | `updateWorkspaceMemberRole`'s parameter type is `{ workspaceId, actorUserId, targetUserId, requestedRole }` — nothing else is read, so extra fields are structurally inert, not merely "checked and rejected." |

## The new server-side boundary

### Where `actorRole` comes from

`requireWorkspaceRoleUpdateActor({ userId, workspaceId })`
(`src/lib/workspace-access.ts`) reads the **actor's own row** from
`workspace_memberships`. It deliberately does **not** enforce a minimum role
— `pm`/`viewer` are valid, resolvable actors. Their insufficiency is decided
later, by policy, not by this lookup (this differs from
`requireWorkspaceInviteActor`, which *does* gate on `owner`/`admin` at read
time — role update needs the actor's exact role, not just a boolean
"can invite at all"). Fails closed (`WorkspaceMembershipError`, reason
`workspace_missing`) if there is no membership row, or the stored role isn't
one of the closed `WORKSPACE_ROLES`.

`actorUserId` itself must be the authenticated session user's id, supplied by
the (not-yet-built) caller after its own `requireAuthUser()`/equivalent — the
function has no way to derive it from a request body, and no
`body.actorRole`/`isOwner`/`isAdmin` field exists for a caller to smuggle a
role through even by accident.

### Where `currentTargetRole` comes from

`requireWorkspaceRoleUpdateTarget({ workspaceId, targetUserId })` reads the
**target's own row** from `workspace_memberships` — never a client-supplied
"currentRole". Fails closed (`deny_target_not_member`, via the same
`WorkspaceMembershipError` shape) if the target has no membership in that
workspace.

### Where `requestedTargetRole` comes from

`normalizeWorkspaceRole(input.requestedRole)` (existing, from Perilla 3) —
trims/lowercases and matches against the closed `WORKSPACE_ROLES` set.
`superadmin`, `founder`, `internal`, `billing_admin`, `__proto__`,
`constructor`, `null`, `undefined`, empty string, and any casing variant
outside the set all normalize to `null` → `deny_invalid_role`, checked
**before** any database call.

### How `workspaceId` manipulation is handled

There is no separate "workspaceId validity" check — it falls out of the
actor/target lookups. If a client sends a `workspaceId` the actor doesn't
belong to, `requireWorkspaceRoleUpdateActor` finds no matching row for
`(workspaceId, actorUserId)` and the request is denied
(`deny_actor_insufficient_role`) before a target is ever loaded. A `target`
row that happens to exist in that other workspace is irrelevant — the actor
lookup fails first.

### Last-owner protection

`countWorkspaceOwners({ workspaceId })` counts active `owner` rows in the
workspace. It is only queried when `currentTargetRole === "owner"` — for the
overwhelmingly common case (a non-owner target), no owner-count query runs at
all. `isLastOwner = ownerCount <= 1` feeds directly into the policy decision.

### The policy: `canUpdateWorkspaceMemberRole`

`canUpdateWorkspaceMemberRole` (`src/lib/workspace-access.ts`) is pure,
side-effect-free, and is the **single source of truth** for every role-update
decision. It is evaluated in this order:

```
1. requestedTargetRole === "owner"
     → deny_owner_assignment_requires_transfer   (always, regardless of actor or self)
2. currentTargetRole === "owner"
     → isLastOwner ? deny_last_owner_protected
                   : deny_owner_role_change_requires_transfer
3. actorUserId === targetUserId (self-targeted request)
     → isWorkspaceRolePromotion(current, requested) ? deny_self_promotion
                                                     : deny_self_role_update
4. actorRole === "owner"                     → allow
5. actorRole === "admin":
     currentTargetRole === "admin"           → deny_actor_insufficient_role
     requestedTargetRole === "admin"         → deny_target_role_not_assignable
     otherwise (target pm/viewer, request pm/viewer) → allow
6. actorRole ∈ {"pm", "viewer"}              → deny_actor_insufficient_role
```

Ordering matters: step 1 (owner-request) and step 2 (owner-target) are
evaluated **before** the self-check, so a self-directed request to become
`owner`, or a self-directed request while the actor already *is* the target
owner, is denied for the owner-safety reason — not miscategorized as a plain
self-promotion.

## Owner assignment: blocked by design, not implemented

There is no owner-transfer flow in this codebase. `owner` can never be
`requestedTargetRole` through `canUpdateWorkspaceMemberRole` — not for an
`owner` actor, not for an `admin` actor, not for a self-directed request.
**Owner transfer is not implemented in this release.** If one is added
later, it must be its own explicit, atomic, documented flow (actor must be
current owner, target must be an active member, workspace must retain an
owner at all times) — not a change to this policy's owner-assignment block.

An existing owner's role can also never be *changed away from* `owner`
through this policy, whether or not they're the last owner:

- Last owner (`isLastOwner === true`) → `deny_last_owner_protected` — this
  operation would leave the workspace with zero owners.
- Not the last owner (`isLastOwner === false`) →
  `deny_owner_role_change_requires_transfer` — there is still no explicit
  ownership-transfer/downgrade flow to route this through, so it is denied
  the same way rather than silently allowed just because a second owner
  exists.

## Self-promotion and self-demotion

- **Self-promotion is always denied.** `viewer→pm`, `viewer→admin`,
  `viewer→owner`, `pm→admin`, `pm→owner`, `admin→owner` for
  `actorUserId === targetUserId` all resolve to `deny_self_promotion` (or
  `deny_owner_assignment_requires_transfer` if the requested role is
  `owner`, per the ordering above).
- **Self-demotion and lateral self-change are also denied in this perilla.**
  There is no self-service role-change UX in the product today, so rather
  than half-implement one, any self-targeted request that isn't a promotion
  (`admin→pm` on yourself, `pm→pm`, etc.) is denied with
  `deny_self_role_update`. If self-demotion is explicitly designed and
  product-approved later, it can be added as its own case in this same
  function without touching the self-promotion or owner-safety checks.

## What owner / admin / pm / viewer can each do

```
owner:  may set admin/pm/viewer on any non-owner, non-self member.
        may not set owner (any target). may not change another owner's role
        (any target, last or not). may not change their own role.
admin:  may set pm/viewer only, and only on pm/viewer targets — never on an
        admin or owner target, and never to admin/owner.
        may not change their own role.
pm:     may never update any member's role.
viewer: may never update any member's role.
```

This mirrors the invite-creation policy in
`invite-workspace-role-boundary.md` (`owner`/`admin` can invite at
`admin|pm|viewer`, never `owner`) but is stricter for `admin`: invite
creation lets an `admin` invite another `admin`; role update does **not**
let an `admin` promote an existing `pm`/`viewer` to `admin`, nor touch an
existing `admin`'s role at all. This asymmetry is deliberate — inviting a
new `admin` and being able to unilaterally demote/reassign an *existing*
`admin`'s role are different risk profiles, and the safer default
(`owner`-only for admin-role changes) was chosen per this perilla's
recommended policy in the absence of an explicit product requirement
otherwise.

## The orchestrating function: `updateWorkspaceMemberRole`

`updateWorkspaceMemberRole({ workspaceId, actorUserId, targetUserId,
requestedRole })` (`src/lib/workspace-team.ts`) is the sole function that may
change an existing `workspace_memberships` row's `role`. Order of operations:

```
1. normalizeWorkspaceRole(requestedRole)     — fail closed before any DB call
2. requireWorkspaceRoleUpdateActor            — actorRole, server-side
3. requireWorkspaceRoleUpdateTarget            — currentTargetRole, server-side
4. countWorkspaceOwners (only if target is currently "owner") — isLastOwner
5. canUpdateWorkspaceMemberRole(...)           — the single policy gate
6. UPDATE workspace_memberships ... only if the decision is "allow"
7. INSERT workspace_audit_events (actor_user_id always the resolved actor,
   never a client field)
```

If any step before 6 fails or denies, the function throws
`WorkspaceRoleUpdateError` with the specific `WorkspaceRoleUpdateDecision`
reason and **no `UPDATE` is ever issued** — verified directly by test (the
fake Supabase client's membership rows are asserted unchanged after every
denial path).

A single privileged (service-role) Supabase client is used for the whole
operation — actor lookup, target lookup, owner count, and the update itself.
`workspace_memberships` has no RLS policy permitting a client-side `UPDATE`
at all, so the write must go through the service role regardless of actor
role; using one privileged client for every read in this flow also avoids a
subtler bug where an RLS-scoped client could resolve "target not found" for
a real member simply because the *actor* (e.g. a `pm`) lacks RLS visibility
into other members' rows — a false "not a member" result would be the wrong
denial reason even though the outcome (deny) happens to be safe either way.
See the updated entry for `src/lib/workspace-team.ts` in
`src/lib/security/privileged-access-registry.ts`.

## What happens in each edge case

| Scenario | Result |
| --- | --- |
| `actorRole` = viewer/pm, any target/requested role | `deny_actor_insufficient_role` |
| `admin` actor requests `owner` | `deny_owner_assignment_requires_transfer` |
| `owner` actor requests `owner` (including self) | `deny_owner_assignment_requires_transfer` |
| `owner` actor sets admin/pm/viewer on a non-owner, non-self member | Allowed |
| `admin` actor, target pm/viewer, requests pm/viewer | Allowed |
| `admin` actor, target viewer, requests admin | `deny_target_role_not_assignable` |
| `admin` actor, target is another admin, any requested role | `deny_actor_insufficient_role` |
| `admin`/`owner` actor targets an existing owner, any requested role | `deny_last_owner_protected` (last owner) or `deny_owner_role_change_requires_transfer` (not last) |
| Self-targeted promotion (`pm→admin` on yourself, etc.) | `deny_self_promotion` |
| Self-targeted `owner` request | `deny_owner_assignment_requires_transfer` |
| Self-targeted demotion/lateral change | `deny_self_role_update` |
| `requestedRole` = `superadmin`/`founder`/`__proto__`/`constructor`/empty/`null` | `deny_invalid_role`, no DB call at all |
| `targetUserId` has no membership row in `workspaceId` | `deny_target_not_member` |
| `workspaceId` is one the actor is not a member of | `deny_actor_insufficient_role` (actor lookup fails first) |
| Body contains `role`/`actorRole`/`isOwner`/`isAdmin`/`user_metadata.role`/display role | Structurally ignored — `updateWorkspaceMemberRole`'s parameter type has no field for any of these |
| Valid update (e.g. owner demotes a viewer to pm) | `workspace_memberships.role` updated to the normalized role, `member_role_updated` audit event written, response is `{ workspaceId, targetUserId, role }` only |

## Remove member / owner transfer: not implemented

There is no remove-member or owner-transfer endpoint, server action, or
helper anywhere in this codebase (confirmed by the same repo-wide grep
described above). Per this perilla's scope, no new one is invented:

- **Remove member**: not implemented. If added later, it must resolve
  `actorRole` via `requireWorkspaceRoleUpdateActor` (or an equivalent
  server-side lookup) and enforce the same last-owner protection
  (`countWorkspaceOwners`) before any delete — never trust
  `body.actorRole`/`isOwner`.
- **Owner transfer**: not implemented; blocked structurally by
  `canUpdateWorkspaceMemberRole` refusing `requestedTargetRole === "owner"`
  unconditionally. If implemented later, it must be its own explicit flow
  per the rules in the "Owner assignment" section above, not a loosening of
  this policy.

## Tests

`tests/workspace-role-update-boundary.test.mjs` covers, against the real
functions (fake injected Supabase client, no live database):

- `compareWorkspaceRolePrivilege` / `isWorkspaceRolePromotion` ranking
- `canUpdateWorkspaceMemberRole`: viewer/pm denied outright; admin denied
  owner-assignment; owner denied owner-assignment; owner allowed to set
  admin/pm/viewer on non-owner members; admin restricted to pm/viewer
  targets and pm/viewer requested roles; self-promotion denied;
  self-owner-assignment denied (owner-check precedence over self-check);
  self-demotion/lateral denied; last-owner downgrade denied; non-last-owner
  downgrade still denied (no transfer flow); admin cannot touch an owner's
  role at all
- `requireWorkspaceRoleUpdateActor` / `requireWorkspaceRoleUpdateTarget`:
  resolves any valid role without a minimum gate, fails closed on missing
  membership (workspaceId manipulation) and on an unrecognized stored role
- `countWorkspaceOwners`: query shape and count
- `updateWorkspaceMemberRole` end to end: valid update succeeds and writes
  the normalized role plus an audit event; denied requests never call
  `UPDATE` (membership rows verified unchanged); `body.actorRole`/`isOwner`
  do not authorize anything — real actor membership always wins;
  `user_metadata.role`/display-role-shaped extra fields are structurally
  irrelevant; invalid target role fails closed before any DB call;
  non-member target fails closed; workspaceId manipulation fails closed;
  owner-count query fires only when the target currently holds `owner` and
  is skipped otherwise; response shape leaks nothing beyond
  `workspaceId`/`targetUserId`/`role`; audit event `actor_user_id` is always
  the server-resolved actor, never a client override

## Regression this fix prevents

- If a role-update endpoint/UI is ever added, it cannot ship by directly
  calling `supabase.from("workspace_memberships").update({ role })` with a
  client-supplied role — the only sanctioned path is
  `updateWorkspaceMemberRole`, which structurally cannot skip actor
  resolution, target resolution, or policy evaluation.
- No actor can ever self-promote, assign `owner` to anyone (themselves or
  otherwise) through this path, or change an existing owner's role without
  an (as yet nonexistent) explicit transfer flow.
- `admin` cannot escalate a `pm`/`viewer` straight to `admin`, and cannot
  touch another `admin`'s role at all.
- `pm`/`viewer` can never update anyone's role.
- `body.actorRole`, `body.isOwner`, `body.isAdmin`, `user_metadata.role`,
  and display role can never influence the outcome — the function's
  signature and implementation never read them.
- The last owner of a workspace can never be downgraded, and no owner can be
  downgraded at all outside a (not yet implemented) explicit transfer flow.

## Residual risks

- **Owner transfer is not implemented.** Blocked structurally, not designed.
  A future implementation needs its own atomic, confirmed, audited flow (see
  rules in "Owner assignment" above) — reusing
  `requireWorkspaceRoleUpdateActor`/`requireWorkspaceRoleUpdateTarget`/
  `countWorkspaceOwners` as building blocks, but adding new actor-must-be-
  current-owner and target-must-confirm checks specific to a transfer.
- **Remove-member flow does not exist.** Nothing to hardened today; a future
  implementation must reuse the actor/target/last-owner primitives here
  rather than reinventing them.
- **No production caller yet.** `updateWorkspaceMemberRole` is not wired to
  any route, server action, or UI — there is nothing in the product today
  that lets a user change another member's role. This is deliberate: this
  perilla is scoped to hardening the boundary "in advance of" a feature, not
  to shipping new team-management UI. The function and its tests exist so
  that whenever that UI is built, it has no safe alternative but to go
  through this path.
- **Admin lateral-management policy (`admin` cannot touch another `admin`,
  cannot promote to `admin`) is the safe default chosen by this perilla in
  the absence of an explicit product requirement.** If the product later
  wants `admin` to manage other `admin`s, that must be a deliberate,
  documented, tested policy change to `canUpdateWorkspaceMemberRole` step 5
  — not an incidental side effect of some other change.
- **No dedicated audit-log read surface** for `member_role_updated` events
  beyond the existing `workspace_audit_events` insert (same table/pattern
  `invitation_sent`/`invitation_accepted` already use) — no new reporting
  UI was added, matching this perilla's scope.
- **Race condition on owner count**: `countWorkspaceOwners` and the
  subsequent `UPDATE` are two separate statements, not one transaction. Two
  concurrent role-update calls that both target the workspace's only two
  owners, demoting each other, could theoretically both read
  `ownerCount = 2` before either write lands, and both succeed, leaving the
  workspace ownerless. This mirrors a pre-existing class of race risk noted
  in `invite-workspace-role-boundary.md` for other flows; a fully atomic
  fix would need a DB-level constraint (e.g. a trigger or check that blocks
  the last owner's `UPDATE`) rather than an application-level count-then-act
  check. Out of scope for this perilla, but flagged as the most concrete
  remaining gap in last-owner protection.
- **Two divergent role vocabularies** still both read
  `workspace_memberships.role`: `src/lib/workspace-access.ts`
  (`owner|admin|pm|viewer`) and `src/lib/security/rbac.ts`
  (`owner|admin|PM|contributor|...`), same as noted in
  `invite-workspace-role-boundary.md`. This perilla's functions use only the
  DB-matching vocabulary; consolidating the two systems remains out of
  scope.

## Veredicto de tuning

Tuned completamente para la frontera de actualización de roles y owner
safety: `canUpdateWorkspaceMemberRole` es la única fuente de decisión,
`actorRole`/`currentTargetRole` se resuelven exclusivamente desde
`workspace_memberships` server-side, `requestedTargetRole` se normaliza y
falla cerrado, owner assignment queda bloqueado estructuralmente, last-owner
queda protegido, self-promotion queda denegada, y ningún dato de cliente
(`body.actorRole`, `user_metadata.role`, display role) puede influir en el
resultado. Ver "Residual risks" arriba para lo que queda deliberadamente
fuera de alcance (owner transfer real, remove-member real, wiring a una
UI/endpoint, atomicidad completa del owner-count race).
