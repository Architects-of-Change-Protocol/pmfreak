# Founder Circle — Authorization Model

Five actor classes, reusing PMFreak's existing authorization infrastructure.
No authorization decision relies on hidden UI controls; everything is
enforced server-side, before request bodies are parsed where possible.

## Actor classes

| Actor | Resolution | Program authority |
| --- | --- | --- |
| **Participant** | `requireAuthUser()` + `founder_participants.user_id = auth.uid()` | Read own invitation state, submit one application, withdraw, read own status/checkpoints, accept agreement, submit/read own feedback |
| **Founder Program operator** | `isFounderOrInternalUser(user)` (email domain/allowlist, server-resolved — never client metadata; Perilla 5 convention) | All operator routes: invitations, review, activation, pause/revoke, triage, discovery records, decisions, dashboard |
| **Workspace administrator** | Existing `workspace_memberships` roles | Unchanged. Program membership grants no workspace-admin rights; activation associates the participant's own canonical workspace with role semantics unchanged |
| **Internal system actor** | Server-side code paths (`actor_type = 'system'`) | Fixed-reason automatic transitions only (invite viewed, expiry, agreement version change, activation-criteria promotion) |
| **Ordinary authenticated user** | Everyone else | 404/controlled-denial on every program route; no data visibility (RLS `user_id = auth.uid()` yields zero rows) |

## Required properties and how each is enforced

1. **Ordinary users cannot access operator endpoints** — every
   `/api/founder-program/operator/**` route checks
   `isFounderOrInternalUser` before parsing the body; denials emit
   `founder_program_denied` security events. Registered in
   `route-guard-registry.ts` (classification `founder-internal`) and enforced
   by `tests/route-guard-consistency.test.mjs`.
2. **Participants see only their own records** — participant-visible tables
   (`founder_participants`, `founder_applications`,
   `founder_onboarding_checkpoints`, `founder_feedback`) have RLS
   self-select policies (`user_id = auth.uid()`), and the participant routes
   additionally filter by the resolved user id (defense in depth — RLS is
   never the only layer).
3. **Invitation tokens grant nothing but invitation resolution** — a token
   resolves an invitation row via its sha256 hash; the route still requires
   an authenticated session to view details or apply, and the token is
   neither a session nor an operator credential. Tokens are single-purpose,
   expiring, revocable, and invalidated once an application is submitted.
4. **Approval ≠ access** — approval only moves lifecycle state; access states
   (`onboarding_active`, `activated`, `feedback_active`) are reachable only
   through the operator activation route, which independently verifies
   agreement acceptance and active capacity.
5. **Revoked participants lose program access** — terminal `revoked` state is
   excluded from every access check; the status route reports it honestly.
6. **Paused participants: defined behavior** — `paused` grants **no** program
   access (documented in 03); resume is operator-driven and
   capacity-enforced.
7. **Operator actions are auditable** — every operator mutation applies a
   lifecycle transition (append-only row + security event) or writes an
   append-only record (decisions, discovery sessions) with the operator's
   user id.
8. **Service-role use is minimized and registered** — all founder-program
   service-role access goes through a single factory in
   `src/lib/founder-program/db.ts`, registered in
   `src/lib/security/privileged-access-registry.ts`. Rationale: operator
   surfaces aggregate cross-workspace program data (L4) and participant
   writes are validated route-side against tables with no client write
   grants (L1-style deliberate lockdown).
9. **Internal fields never reach participants** — column-scoped grants
   exclude `state_reason`, `internal_owner_user_id`, `internal_notes`,
   `nomination_note`, `token_hash` from the `authenticated` role, mirroring
   the `workspace_invitations.token_hash` precedent.
10. **Rate limits** — invitation viewing (per-IP+token), application
    submission, feedback submission, and operator actions all pass through
    `enforceAbuseLimit`, registered in `abuse-protection-registry.ts`.
11. **No client-supplied authority** — no route reads role/founder/admin
    flags from the request body (forbidden-pattern scan in
    `tests/route-guard-consistency.test.mjs` applies to these files like any
    other server file).
12. **Feature flags fail closed** — with flags unset, every founder-program
    route returns a controlled `founder_program_disabled` response before any
    authorization or database work (see 14-launch-checklist.md).

## Capability assignment at activation

Activation grants **only** the curated pilot surface: the participant remains
a non-founder account (curated `pilot` capability profile is the existing
default) on the free plan; governance/experimental surfaces stay hidden and
runtime-disabled (M-03). Activation never grants service-role, operator, or
workspace-admin privileges, and never flips any env-level switch. This is
asserted in `tests/founder-program-activation.test.ts`.
