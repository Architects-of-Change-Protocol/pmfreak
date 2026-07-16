# Founder Circle — Feedback and Discovery Evidence

## Structured feedback (`founder_feedback`)

Implementation: `src/lib/founder-program/feedback.ts` + participant route
`/api/founder-program/feedback` + operator route
`/api/founder-program/operator/feedback`.

- Types: onboarding_friction, defect, usability, feature_request,
  missing_integration, pricing_value, workflow_outcome, general.
- Severity: low/medium/high/critical (unknown values fall back to medium).
- Body: 1–4000 chars, stored as plain text, rendered escaped (React
  default) — never as HTML. Product area ≤120 chars. `allow_contact` boolean.
- Eligibility: admitted, non-terminal participants (applied → paused).
- First feedback records the `first_feedback_submitted` checkpoint and
  promotes `activated → feedback_active` (system transition, once).
- The related workspace is always the participant's own program workspace;
  a client-supplied workspace id is discarded.
- **Ownership**: participants read only their own rows (route projection +
  RLS self-select + column-scoped grant); `internal_notes`,
  `internal_owner_user_id` never reach a participant by any of the three
  layers. Regression-tested (`tests/founder-program-feedback.test.ts`).
- Triage (operator): status new/triaged/planned/declined/resolved/duplicate,
  internal owner, internal notes (≤4000), resolution reference (≤300);
  every triage action emits a `founder_program_operator_action` event.

This is not a general-purpose issue tracker; there is no threading, voting,
sharing, or cross-participant visibility.

## Discovery sessions (`founder_discovery_sessions`)

Implementation: `src/lib/founder-program/discovery.ts` + operator route
`/api/founder-program/operator/discovery-sessions`.

- Types: discovery, onboarding_observation, usability_review, value_review,
  retention_review, exit_interview; status scheduled/completed/cancelled.
- Structured findings: main pain point, moment of value, main friction,
  requested capability (all bounded), free-text findings ≤4000, follow-up
  actions ≤2000.
- Willingness-to-pay signal: bounded categories unknown/none/low/medium/high.
- **Recordings are never uploaded or stored.** `evidence_ref` (≤300 chars)
  is a reference (doc link/filename/note); `consent_status` is explicit
  (not_requested/requested/granted/declined).
- A completed session records the participant's
  `first_followup_session_completed` checkpoint.
- Operator-only surface (service-role-only RLS; founder-gated route).
