# Founder Circle — Program Decision Gate and Metrics

Implementation: `src/lib/founder-program/decisions.ts`,
`founder_program_decisions` (append-only, service-role-only), operator route
`/api/founder-program/operator/decisions`, console section "Program decision
gate".

## The gate

At the end of each review window (settings `review_due_on`), a human
operator records exactly one of: **CONTINUE**, **CONTINUE WITH
REMEDIATION**, **PAUSE**, **STOP**, **EXPAND COHORT**.

The record includes decision, date, owner (the authenticated operator —
never client-supplied), evidence window, participant count, activation
count, retention-evidence availability, positive/negative signals, critical
defects, requested capabilities, security incidents, data-quality
limitations, rationale (required), required remediation, next review date.

**Human ratification is structural**: the software computes
`participant_count`, `activation_count`, and `retention_evidence_available`
from real records at ratification time (client-supplied counts are ignored),
but no code path creates a decision without an operator's authenticated
request, and nothing acts automatically on a recorded decision.

## Metrics — proposed decision thresholds

Every threshold below is **PROPOSED, UNVALIDATED, and SUBJECT TO FOUNDER
EVIDENCE**. They are hypotheses to make the first review discussable — not
targets, not facts, and not success claims. With ≤10 participants each
metric has huge variance; read them directionally.

| Metric (how measured) | Hypothesis to test |
| --- | --- |
| Invitation → application conversion (funnel) | ≥ 50% suggests the invite pitch and audience match |
| Application → approval ratio (funnel) | 40–80%; ~100% means the bar is too low, ~0% means sourcing is off |
| Approval → agreement conversion (funnel) | ≥ 80% within 7 days |
| Agreement → activation conversion (funnel) | ≥ 80% (operator-driven; below that is an ops problem, not a user problem) |
| Median time to `activated` (transition trail) | ≤ 7 days from approval |
| Reaching first value (= `activated` criteria) | ≥ 60% of access-activated participants |
| Day-7 return (return-visit events vs activation) | ≥ 50% of eligible participants |
| Feedback participation | ≥ 70% submit ≥1 structured feedback in the window |
| Critical-defect incidence | 0 unresolved criticals at review |
| Same missing capability requested | ≥ 3 participants naming one capability = strong roadmap signal |
| Willingness to continue (discovery sessions) | ≥ 70% state they want to continue |
| Willingness to pay (bounded WTP signal) | ≥ 2 participants at medium/high before any paid-pilot conversation |

Vanity metrics (page views, total events, cumulative signups) are
deliberately absent from the dashboard.

## Decision semantics

- **CONTINUE** — evidence supports the current cohort as-is.
- **CONTINUE WITH REMEDIATION** — continue while fixing named blockers by a
  named date (required_remediation must be filled).
- **PAUSE** — stop onboarding/activation; participants keep or lose access
  per an explicit note in the rationale.
- **STOP** — wind down per runbook §17.
- **EXPAND COHORT** — raise capacity in the settings row; requires the
  evidence fields to justify it and does NOT change the platform launch
  state (still no public beta).
