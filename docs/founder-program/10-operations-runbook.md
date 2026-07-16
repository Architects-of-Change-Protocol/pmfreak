# Founder Circle — Operations Runbook

Operator = founder/internal user (`isFounderOrInternalUser`). All operator
actions run through `/founder-program` (console) or the
`/api/founder-program/operator/**` routes and are audited
(`founder_membership_transitions` + `security_events`).

## 1. Enable the program

1. Ensure the migration `20260828000000_founder_program.sql` is applied
   (seeds a **disabled** settings row).
2. Set env flags on the deployment (all are independent, all default off):
   `PMFREAK_FOUNDER_PROGRAM_ENABLED=true`, plus
   `..._OPERATOR_UI_ENABLED`, `..._INVITATIONS_ENABLED`,
   `..._APPLICATIONS_ENABLED`, `..._ACTIVATION_ENABLED`,
   `..._FEEDBACK_ENABLED`, `..._ANALYTICS_ENABLED` as needed.
3. Update the DB settings row (service-role SQL — there is deliberately no
   API for this):
   `update founder_program_settings set program_enabled = true, applications_enabled = true, support_contact = '…', review_due_on = '…' where singleton;`
4. Verify `/founder-program` shows the program as enabled.

**Checklist**: flags set → settings row enabled → capacity values reviewed →
required_agreement_version equals `PILOT_AGREEMENT_VERSION` → support
contact set → review date set.

## 2. Disable the program

Fast path: unset `PMFREAK_FOUNDER_PROGRAM_ENABLED` (participant surfaces and
APIs return controlled 404s immediately). Durable path: also set
`program_enabled = false` in the settings row. Data is retained; nothing is
deleted by disabling.

## 3. Invitations

- Create: console → "Invite a participant" (email + archetype + optional
  internal note; "send email" unchecked = silent nomination).
- If the email provider is unconfigured, the console shows the invite link
  ONCE — copy it and deliver manually. Never paste invite links into logs,
  tickets, or chat systems with retention you don't control.
- Revoke (reason required) and resend (rotates the token; old link dies)
  from the invitations table.
- Batch: `POST /api/founder-program/operator/invitations` with
  `action: "create_batch"` (≤ `max_invitations_per_batch`).

## 4. Review applications

Console → "Participants & review queue": start review, approve (capacity
enforced; explicit `capacityOverride: true` via API only, audited), waitlist
(reason), reject (reason). Approval automatically moves the participant to
`agreement_pending` — access is NOT granted by approval.

## 5. Activation

When the participant shows `onboarding_pending` (they accepted the current
agreement), press "activate". The system re-verifies agreement + capacity
atomically. Idempotent — a double click cannot double-activate.

## 6. Requesting clarification from an applicant

There is no in-product messaging. Documented manual workflow: email the
applicant from the program support address using your own mail client;
record the fact as an internal note (`set_internal_fields` action or the
feedback/discovery notes where applicable).

## 7. Pause / resume / revoke / complete

All from the console; pause and revoke require a reason (audited). Paused
participants have NO program access. Resume re-checks active capacity.

## 8. Invitation expiry

Expiry is lazy: an expired link resolves to an honest "expired" response and
the participant record is revoked with reason `invitation_expired`. To
re-invite the same person after expiry, use resend while the invitation
still exists, or create a fresh invitation if it was revoked.

## 9. Duplicate accounts

One account ⇔ one participant (unique `user_id`). If someone applies with
the wrong account: revoke the participant (reason `duplicate_account`),
create a fresh invitation to the correct email.

## 10. Workspace mismatch

Activation associates the participant's canonical (bootstrap) workspace. If
a participant ends up with the wrong workspace associated, pause them,
verify `workspace_id` on `founder_participants` (service-role SQL), correct
it manually, document the correction, resume.

## 11. Agreement-version changes

Bump `PILOT_AGREEMENT_VERSION` (code) and `required_agreement_version`
(settings row) together. Pre-access participants regress to
`agreement_pending` automatically; active participants keep access and
appear under "agreement renewal required" on the dashboard — contact them
manually (template `agreement_required`).

## 12. Communications

Only the invitation email is machine-sent. Every other message uses the
manual templates in `src/lib/email/templates/founder-program.ts`
(`FOUNDER_MANUAL_EMAIL_TEMPLATES`) sent from the operator's mail client.
Never claim an email was delivered without provider evidence.

## 13. Analytics failure

Analytics is optional telemetry: insert failures log a warning and the
workflow continues. If `founder_program_events` writes fail persistently,
lifecycle metrics still come from the transitions table; retention metrics
will honestly report unavailable. No remediation is urgent.

## 14. Email-provider failure

Invitation creation still succeeds and returns the manual link. Deliver
manually (§3). `early_access`-style delivery-event records are not kept for
founder invitations; the `emailDelivery.ok` flag in the API response is the
only delivery signal.

## 15. Exporting program evidence

Service-role SQL export of: `founder_participants`,
`founder_membership_transitions`, `founder_onboarding_checkpoints`,
`founder_feedback`, `founder_discovery_sessions`, `founder_program_decisions`,
`founder_program_events`, plus `pilot_agreement_acceptances` filtered to
participant user ids. CSV via `\copy`. Store exports with the same care as
the database — they contain participant PII (names, emails).

## 16. Incident response

Follow the existing platform incident process (docs/release/
pilot-operational-runbook.md). Program-specific additions: revoke affected
invitations (rotating resend also invalidates a leaked link), pause or
revoke affected participants, and record a `security_incidents` entry in the
next program decision.

## 17. Closing the program

1. Record a final decision (STOP or COMPLETE-equivalent CONTINUE decision
   with rationale) in the decision gate.
2. Complete or revoke every remaining participant (reason recorded).
3. Export evidence (§15).
4. Disable flags (§2).
5. Data retention/deletion per §18.

## 18. Participant data deletion / retention

On a deletion request: delete the participant's `founder_applications` row
and null `full_name` on `founder_participants` (manual service-role SQL),
delete their `founder_feedback` bodies if requested. The pseudonymous
lifecycle transition trail is retained as program evidence (documented in
04-data-model.md). Deleting the auth user cascades the whole program record.
There is no automated purge job — this is a manual, documented operation.
