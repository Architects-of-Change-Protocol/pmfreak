# Founder Circle — Product Analytics

Implementation: `src/lib/founder-program/analytics.ts` (single writer +
central schema registry) → `founder_program_events` (service-role-only).

## Classification

**Optional telemetry.** The authoritative lifecycle evidence is
`founder_membership_transitions` (written atomically with every state
change). Analytics inserts NEVER block or fail the main workflow — the
recorder returns `{ok:false, skipped}` instead of throwing, and rejected
events are logged (name + problem only). Security/agreement evidence never
depends on this table.

## Schema

- `schema_version` (currently 1) on every row.
- Event names: the `FOUNDER_PROGRAM_EVENT_NAMES` allowlist (26 events —
  invitation/application/review/agreement/activation/lifecycle/checkpoint/
  feedback/discovery/decision/return-visit). The migration additionally pins
  the `founder_*` namespace with a check constraint.
- Property keys: `FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS` only (states, actor
  type, archetype, checkpoint, feedback type/severity/status, session type,
  decision, batch size, capacity fields, product area, WTP, reason code,
  visit spacing).
- Property values: scalars only; strings must be ≤64 chars and match
  `^[a-z0-9_.:-]*$/i` — **emails, URLs, tokens, and free text are
  structurally impossible**, not merely discouraged.
- `participant_id` is the pseudonymous internal identifier; email/name never
  appear in this table. Cohort is an operator-assigned short label.

## Questions the events answer (with the funnel/dashboard)

Sent/viewed/applied/approved/agreement/activated counts; time from
invitation→application, approval→agreement, agreement→activation (medians
from the transition audit trail); first/any curated capability used
(checkpoints); abandonment (checkpoint funnel); 1/7/14-day returns
(`founder_return_visit` vs `activated_at` — **computed only over
participants for whom that much real time has elapsed**); feedback
participation; paused/revoked/withdrawn counts.

## Explicit non-claims

- No retention cohort is reported before the elapsed time actually exists
  (dashboard returns `available:false` with a reason).
- Event rows are evidence of instrumented actions, not of value delivered.
- If the analytics flag is off, only the authoritative transition trail
  exists; dashboards still work for lifecycle metrics but return-visit
  retention reports unavailable.
