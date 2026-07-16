# Founder Circle — Participant Archetypes and Intake Data

## Archetypes

Canonical archetype keys (enforced by the `founder_invitations.archetype` /
`founder_participants.archetype` check constraints and
`FOUNDER_ARCHETYPES` in `src/lib/founder-program/lifecycle.ts`):

| Key | Description |
| --- | --- |
| `independent_pm` | Independent Project Manager |
| `pmo_practitioner` | PMO practitioner |
| `agile_lead` | Scrum Master / Agile Delivery Lead |
| `program_manager` | Program Manager |
| `consultant` | Project or transformation consultant |
| `operations_leader` | Operations leader managing cross-functional initiatives |
| `founder_operator` | Founder/operator managing multiple workstreams |
| `other` | Explicitly recorded catch-all (operator-assigned only) |

Operators assign the archetype at nomination/invitation time; participants
cannot self-assign a privileged profile through the archetype field (it maps
to no capability difference in this sprint — all participants receive the
same curated `pilot` capability profile).

## Application / intake fields

Collected in `founder_applications` (see 04-data-model.md). All input is
validated server-side (`src/lib/founder-program/applications.ts`) with
bounded enums and length caps; free-text fields are stored as plain text and
rendered escaped (React default) — never as HTML.

| Field | Type / bound |
| --- | --- |
| Name | ≤ 120 chars |
| Email | Bound to the invitation email (not re-collected free-form) |
| Role title | ≤ 120 chars |
| Company or independent | `company` \| `independent` \| `other` |
| Years of experience | `lt_2` \| `2_5` \| `5_10` \| `10_plus` |
| Main PM pain point | ≤ 1000 chars |
| Current tools | ≤ 500 chars |
| Active projects | `1_2` \| `3_5` \| `6_10` \| `10_plus` |
| Primary reason for joining | ≤ 1000 chars |
| Consent to be contacted | boolean (required true to submit) |
| Feedback session availability | `weekly` \| `biweekly` \| `monthly` \| `async_only` |
| Referral source | ≤ 200 chars, optional |
| LinkedIn URL | optional, must parse as `https://` URL ≤ 300 chars |
| Timezone | optional, ≤ 60 chars |

## Explicitly NOT collected

Government IDs, payment information, medical/political/religious or any other
sensitive-category profile data, birth dates, addresses, phone numbers.
Adding any such field requires a new privacy review — do not extend the
schema casually.

## Data minimization in analytics

`founder_program_events` never stores name, email, LinkedIn URL, free-text
answers, or tokens — only the internal participant id, archetype, cohort and
bounded enum values (enforced by the property allowlist in
`src/lib/founder-program/analytics.ts`; regression-tested).
