# Founder Circle Program Charter

Working product name: **PMFreak Founder Circle** (configurable via
`FOUNDER_PROGRAM_DEFAULT_DISPLAY_NAME` in `src/lib/founder-program/config.ts`
and the `display_name` column of `founder_program_settings` — the label is
never hardcoded across surfaces).

Status: **Disabled by default.** Enabling requires explicit env flags plus a
database settings row (see 14-launch-checklist.md). The platform launch state
remains **CONDITIONAL GO — closed pilot**; this program does not change it.

## Purpose

Convert PMFreak from "technically ready for a pilot" into an *operable*
closed program that can recruit, admit, activate, observe, and learn from a
small group of real founder participants, producing auditable evidence of:

1. Real interest (invitations → applications).
2. Controlled admission (human review, capacity-enforced).
3. Accepted pilot conditions (versioned agreement acceptance).
4. Initial activation (workspace + curated capability profile).
5. Concrete capability usage (checkpoints + first-party events).
6. Onboarding friction (abandonment points).
7. Qualitative feedback (structured submissions).
8. Product requests (feedback triage + discovery sessions).
9. Early retention (return events over real elapsed time).
10. A ratified human decision to continue, remediate, pause, stop, or expand.

## Principles (binding)

Closed by default · invite-only · human-approved admission · least privilege ·
honest claims · no fake AI · no fake metrics · no public-launch semantics ·
every participant attributable · every decision leaves evidence · minimal
personal data in analytics · removable/disableable · no hidden core-domain
coupling · flags fail closed · existing security and tenant isolation intact ·
no cross-workspace access · agreement records immutable from participant UI ·
operator actions auditable · documented manual operations are acceptable ·
no enterprise overbuild before evidence.

## What participants are — and are not

Participants are **"Founder Circle participants"**: early design partners in
a closed pilot. They are **not** legal founders, cofounders, equity holders,
or investors, and no UI or email copy may imply otherwise. Early-access
limitations are labeled honestly per the Pilot Gate Sprint 01 copy standards.

## Capacity (initial, conservative — operator-adjustable in DB)

| Knob | Default |
| --- | --- |
| Maximum approved participants | 10 |
| Maximum simultaneously active participants | 5 |
| Maximum invitations per operator batch | 5 |
| Invitation expiry | 7 days |
| Public application intake | disabled |
| Invite-only mode | enabled |
| Program enabled | disabled |

## Roles

| Role | Who | Authority |
| --- | --- | --- |
| Participant | Invited, admitted individual | Own application, own state, own feedback, agreement acceptance |
| Founder Program operator | Founder/internal user (`isFounderOrInternalUser`) | Invitations, review, activation, pause/revoke, triage, decisions |
| Workspace administrator | Existing workspace roles | Unchanged; program grants no workspace admin rights |
| Internal system actor | Server-side transitions (expiry, auto-promotions) | Fixed-reason system transitions only |
| Ordinary authenticated user | Everyone else | No program surface access |

## Review cadence and decision gate

The program runs toward a review date (`review_due_on` in settings). At
review, a human operator records exactly one decision — CONTINUE, CONTINUE
WITH REMEDIATION, PAUSE, STOP, or EXPAND COHORT — with the evidence fields
defined in 12-program-decision-gate.md. Software summarizes; a human ratifies.

## Out of scope (non-goals)

Public beta signup, self-service paid subscriptions, production Stripe
checkout, referral/affiliate/equity/token incentives, community forums, full
CRM/CS platforms, SCIM/SAML, automated legal generation, AI-generated
discovery conclusions presented as fact, automated approval, unlimited
batches, leaderboards, gamification, and AOC runtime integration unrelated to
this program.
