# Founder Circle — Launch Checklist (Closed Program Only)

This checklist gates ENABLING THE CLOSED PROGRAM — it does not authorize a
public beta, open signup, or production billing under any outcome.

## A. Technical preconditions (all must be checked)

- [ ] Migration `20260828000000_founder_program.sql` applied to the target
      database (record where and when — hosted apply is currently an OPEN
      gate, see RR-MIGRATE).
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green on the deployed
      commit.
- [ ] `PMFREAK_CAPABILITY_PROFILE` unset (participants must resolve to the
      curated `pilot` profile).
- [ ] `PMFREAK_GOVERNANCE_CAPABILITY_ENABLED` unset/false (M-03 stays
      closed for the pilot).
- [ ] Founder Program env flags set per runbook §1; every other environment
      keeps them unset (fail-closed).
- [ ] Settings row reviewed: capacity (10/5 defaults), expiry (7 days),
      `required_agreement_version` == `PILOT_AGREEMENT_VERSION`, support
      contact, `review_due_on`.
- [ ] Email provider configured, or the manual-link procedure (runbook §3)
      acknowledged by the operator.

## B. Program preconditions

- [ ] Pilot agreement status verified: while the text is a placeholder,
      participants must ALSO sign the offline agreement per the existing
      pilot process (docs/release/pilot-agreement-readiness.md) — the
      in-product click-through alone is not a contract yet.
- [ ] Candidate list reviewed against the archetypes (02).
- [ ] Operator has read the runbook (10) and the known limitations (13).
- [ ] Decision-gate review date scheduled (12).

## C. Explicitly NOT authorized by this checklist

Public beta signup · open/self-service registration · production Stripe
checkout · marketing that implies general availability · claims of legal
"founder"/equity status for participants · raising capacity beyond the
settings-row bounds without a recorded EXPAND COHORT decision.
