# Founder Circle — Invitations and Admission

## Invitation security model

Same primitive as the hardened workspace-invite system
(`src/lib/security/invite-tokens.ts` rationale):

- **Entropy**: 24 CSPRNG bytes (192 bits), base64url.
- **At rest**: sha256 hex only (`token_hash`); plaintext exists exactly once,
  inside the invite link returned to the operator / sent by email.
- **Single-purpose**: resolves one invitation; it is not a session and grants
  no privileges. Viewing details and applying require an authenticated user.
- **Single-use semantics**: once an application is submitted the invitation
  status becomes `applied` and the token no longer opens the application
  form; resend/regenerate rotates the hash and invalidates the old link
  (early-access precedent).
- **Expiry**: `expires_at` from `invitation_expiry_days` (default 7);
  expired tokens resolve to an honest "expired" response and the participant
  record transitions to `revoked` with system reason `invitation_expired`.
- **Enumeration resistance**: lookup is by exact 64-char hash; invalid tokens
  return a generic `invalid_or_expired` response indistinguishable from
  revoked/unknown, plus per-IP+token abuse limits.
- **Redaction**: tokens/hashes never appear in logs, analytics events,
  security events, or API list responses (regression-tested).
- **No participant data in the token** — random bytes only.

## Operator invitation workflow

Routes (founder-gated, body parsed only after authorization):

- `POST /api/founder-program/operator/invitations` with
  `action: "create"` (single) or `action: "create_batch"` (≤
  `max_invitations_per_batch`, default 5) — fields: email(s), archetype,
  optional internal nomination note, optional expiry override (bounded),
  `send: true|false` (false = `nominated` state, link generated but not
  emailed).
- `action: "revoke"` — unused invitations only; reason required.
- `action: "resend"` — rotates the token, re-issues the link/email; safe
  against duplicate sends (previous link invalidated).
- `GET /api/founder-program/operator/invitations` — status list: created,
  viewed, applied, agreement accepted, activated (joined from the
  participant record), expired, revoked. Never includes token material.

Email delivery reuses the `sendEmail` provider abstraction. When the provider
is unconfigured, the invitation is still created and the route returns a
**manual invite link** for the operator to deliver out-of-band (early-access
pattern) — delivery is never claimed without provider evidence.

## Participant application flow

1. Participant opens `/founder-circle/invite/[token]` (authenticated;
   unauthenticated users pass through the standard login redirect).
2. The page shows the honest program description: early closed pilot,
   functionality may change, feedback expectations, no cofounder/equity
   implication, support contact.
3. First authenticated open marks `invite_viewed` (system transition +
   checkpoint + analytics event).
4. Participant submits the bounded application form
   (`POST /api/founder-program/application`). Server-side validation
   (see 02); consent to be contacted and feedback willingness are required.
   The authenticated account becomes the bound `user_id`.
   The invitation email must match the authenticated user's email
   (email-binding, early-access precedent).
5. State becomes `applied`; participant sees a clear "application received"
   status and may withdraw (`POST /api/founder-program/application/withdraw`)
   until (and after) approval.

Participants cannot: approve themselves, choose capabilities, create program
workspaces before approval, bypass the agreement, edit review fields, see
operator notes, or infer other participants (all list endpoints are
operator-only; participant endpoints are self-scoped).

## Operator review

- `GET /api/founder-program/operator/participants?state=…&page=…` — review
  queue with lifecycle filter and pagination; shows capacity before approval
  (`approved_used/approved_limit`, `active_used/active_limit`).
- `POST /api/founder-program/operator/participants/actions` with
  `action: review_approve | review_reject | review_waitlist |
  start_review | set_owner | set_cohort` (+ later lifecycle actions, see 07).
- Approve is capacity-enforced in the database; an over-capacity approve
  requires `override: true` and records reason `capacity_override` in the
  audit trail. Without override the operator receives `capacity_reached`
  and may waitlist instead.
- Reject/waitlist/pause/revoke require a reason (stored internally, audited).
- "Request clarification" has **no in-product channel** in this sprint — it
  is a documented manual workflow (email from the operator; see runbook §6).

## Communication states

Only the invitation email is machine-sent (with manual-link fallback). All
other program communications (approved, waitlisted, rejected, agreement
required, activation ready, feedback request, pause/revoke notices, review
outcome) have templates/builders in `src/lib/email/templates/founder-program.ts`
but are **operator-sent via documented manual procedure** in this sprint —
no delivery is claimed without provider evidence (see runbook §12).
