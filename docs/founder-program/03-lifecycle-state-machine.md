# Founder Circle — Lifecycle State Machine

Canonical implementation: `src/lib/founder-program/lifecycle.ts` (pure,
data-driven transition policy — no free-form state strings anywhere else).
Applied transitions go exclusively through
`src/lib/founder-program/transitions.ts`, which calls the
`founder_program_transition` SQL function (capacity- and race-safe) and
records an append-only row in `founder_membership_transitions` plus a
`founder_program_transition` security event.

## States (18)

| State | Meaning | Grants program access? | Terminal? |
| --- | --- | --- | --- |
| `nominated` | Operator recorded a candidate; no invitation sent yet | No | No |
| `invited` | Invitation issued (token active) | No | No |
| `invite_viewed` | Invitation opened at least once | No | No |
| `applied` | Application submitted | No | No |
| `under_review` | Operator actively reviewing | No | No |
| `approved` | Operator approved (capacity-enforced) | No | No |
| `rejected` | Operator rejected (reason required) | No | **Yes** |
| `waitlisted` | Approved-quality but over capacity / deferred (reason required) | No | No |
| `agreement_pending` | Must accept current pilot agreement version | No | No |
| `agreement_accepted` | Current agreement version accepted | No | No |
| `onboarding_pending` | Ready for operator activation | No | No |
| `onboarding_active` | Activated; onboarding checkpoints in progress | **Yes** | No |
| `activated` | Canonical activation criteria met (see below) | **Yes** | No |
| `feedback_active` | Activated and has submitted ≥ 1 structured feedback | **Yes** | No |
| `paused` | Operator-paused (reason required) — **no program access while paused** | No | No |
| `completed` | Program participation concluded normally | No | **Yes** |
| `withdrawn` | Participant exited voluntarily | No | **Yes** |
| `revoked` | Operator removed access (reason required) | No | **Yes** |

"Grants program access" means: the participant's Founder Circle status page
shows an active program membership and the operator dashboard counts them as
active. Platform-level entry (auth, workspace bootstrap, trial gating) is the
pre-existing PMFreak behavior and is documented in 13-known-limitations.md.

## Transition table

Actor legend: **P** participant · **O** operator · **S** system (server-side
automatic). Every transition writes an audit row; "Reason" = reason required.

| From | To | Actor | Reason | Notes |
| --- | --- | --- | --- | --- |
| nominated | invited | O | – | Invitation issued/sent |
| nominated | revoked | O | ✔ | Nomination cancelled |
| invited | invite_viewed | S | – | First authenticated open of the invite |
| invited, invite_viewed | applied | P | – | Application submitted (invite-bound) |
| invited, invite_viewed | revoked | O / S | ✔ | Operator revoke, or system `invitation_expired` |
| applied | under_review | O | – | Review started |
| applied, under_review, waitlisted | approved | O | – | **Capacity-enforced** (`max_approved_participants`); explicit audited override possible |
| applied, under_review, waitlisted | rejected | O | ✔ | |
| applied, under_review | waitlisted | O | ✔ | Also automatic (S) with reason `capacity_reached` when approving over capacity without override |
| waitlisted | under_review | O | – | Re-opened |
| approved | agreement_pending | S | – | Automatic, immediately after approval |
| agreement_pending | agreement_accepted | P | – | Acceptance of the **current required version** via the existing pilot-agreement route |
| agreement_accepted | onboarding_pending | S | – | Automatic |
| agreement_accepted, onboarding_pending | agreement_pending | S | ✔ (`agreement_version_changed`) | Newer required agreement version |
| onboarding_pending | onboarding_active | O | – | **Activation**: requires current agreement + active capacity; idempotent |
| onboarding_active | activated | S | – | Canonical activation criteria met (checkpoints) |
| activated | feedback_active | S | – | First structured feedback submitted |
| onboarding_active, activated, feedback_active | paused | O | ✔ | Access removed while paused |
| paused | onboarding_active | O | – | Resume (**active-capacity-enforced**); system re-promotes to `activated` when criteria hold |
| onboarding_active, activated, feedback_active | completed | O | – | Program conclusion for this participant |
| agreement_pending → feedback_active (any), paused | revoked | O | ✔ | |
| applied → feedback_active (any non-terminal, participant-owned), paused | withdrawn | P | – | Participant may exit at any point before/after approval |

## Forbidden transitions (non-exhaustive, all enforced)

- Anything out of a terminal state (`rejected`, `completed`, `withdrawn`, `revoked`).
- Participant-driven `approved`, `onboarding_active`, or any operator/system transition.
- `approved` → `onboarding_active` (skipping agreement).
- Any state → `activated` except from `onboarding_active` by the system.
- `invited`/`invite_viewed` → `approved` (skipping application).
- Any transition not present in the table — the policy is allowlist-based;
  unknown pairs are rejected with `invalid_transition`.

## Canonical activation criterion

A participant is **activated** only when ALL of the following hold (tracked
as onboarding checkpoints, computed in
`src/lib/founder-program/checkpoints.ts` — page views alone never count):

1. Current agreement version accepted (`agreement_accepted` checkpoint).
2. Entered the product (`first_login`).
3. Workspace created/associated (`workspace_ready`).
4. At least one project created or imported (`first_project_created`).
5. At least one curated core workflow used (`first_core_capability_used`).

## Audit strategy

- `founder_membership_transitions` — append-only, one row per applied
  transition: from/to, actor type, actor user id, reason, timestamp.
  Writes only via service role from the transition applier; participants have
  no read/write path to it.
- `logSecurityEvent("founder_program_transition", …)` — secondary channel
  into `security_events` (never carries emails/tokens/free text).
- Operator route denials emit `founder_program_denied`.
