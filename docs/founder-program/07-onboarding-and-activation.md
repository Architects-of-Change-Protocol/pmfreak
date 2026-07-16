# Founder Circle — Onboarding Checkpoints and Activation

Implementation: `src/lib/founder-program/checkpoints.ts`,
`src/lib/founder-program/admission.ts` (activation), migration table
`founder_onboarding_checkpoints`.

## Checkpoint model

Checkpoints are idempotent facts — unique `(participant_id, checkpoint)`;
recording twice is a no-op. The 13 canonical keys and how each is recorded:

| Checkpoint | Recorded by | Source of truth |
| --- | --- | --- |
| `invite_opened` | Invitation landing page / API on first authenticated open (email-matched only) | server |
| `application_submitted` | Application submission | server |
| `approved` | Operator approval | server |
| `agreement_accepted` | Pilot-agreement acceptance hook | `pilot_agreement_acceptances` |
| `first_login` | Participant status page/API visit while in an access state | server |
| `workspace_ready` | Activation (workspace association) | server |
| `first_project_created` | **Derived from real records**: ≥1 row in `projects` for the program workspace | reconciler |
| `first_data_entered` | Derived: ≥1 row in `execution_tasks` for the workspace | reconciler |
| `first_command_center_visit` | Explicit flag-gated hook in the command-center page (fail-silent) | server |
| `first_core_capability_used` | Derived: ≥1 `platform_events` row for the workspace | reconciler |
| `first_feedback_submitted` | Feedback submission | server |
| `first_followup_session_completed` | Operator records a completed discovery session | operator |
| `activation_completed` | System, when the activation criteria are met | server |

The reconciler (`reconcileFounderUsageCheckpoints`) runs opportunistically on
participant status loads. **No checkpoint is client-self-reported** — page
views alone never count, and usage checkpoints require actual domain rows.

## Activation (two distinct concepts, deliberately)

1. **Access activation** (operator action, state `onboarding_active`):
   requires `onboarding_pending` + current agreement acceptance + active
   capacity (atomic in the DB function). Grants the curated pilot surface
   only. Idempotent.
2. **Canonical "activated"** (system promotion, state `activated`): all five
   criteria checkpoints present (`agreement_accepted`, `first_login`,
   `workspace_ready`, `first_project_created`,
   `first_core_capability_used`) while `onboarding_active`.

`activated` is the number the program reports as activation — access
activation alone is not "activated" in any dashboard metric.

## Abandonment

The dashboard's checkpoint funnel (participants reaching each checkpoint)
exposes where participants stall; `needsAttention` counts participants
sitting in `agreement_pending`/`onboarding_pending` for more than 7 days.
