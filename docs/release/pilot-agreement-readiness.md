# Pilot Agreement Readiness — Technical Support (Pilot Gate Sprint 01, Task 9)

Status: **technical plumbing complete; legal content pending counsel**.
This sprint deliberately produced NO legal text (out of engineering scope).

## What exists (verified in this sprint)

| Piece | Path | State |
| --- | --- | --- |
| Versioned agreement source of truth | `src/lib/pilot/pilot-agreement.ts` (`PILOT_AGREEMENT_VERSION = "0.1-draft"`, `PILOT_AGREEMENT_IS_PLACEHOLDER = true`) | ✅ |
| Section structure for counsel to fill | `PILOT_AGREEMENT_SECTIONS` (parties, data handling, AI disclosure, availability, data return, termination, liability) | ✅ placeholders only |
| Agreement page (protected route) | `/pilot-agreement` — renders sections with a prominent "draft — not a legal document" banner while placeholder | ✅ |
| Acceptance records | migration `20260827000000_pilot_agreement_acceptances.sql` — RLS-scoped, immutable from clients, unique per (workspace, user, version) | ✅ |
| Acceptance API | `POST /api/pilot-agreement/accept` — auth + workspace-membership check, exact-version pinning (409 on mismatch), idempotent | ✅ |
| Offline path | `method = 'offline_signed'` supported in the schema for founder-recorded paper/PDF signatures | ✅ schema-level |
| Tests | `tests/pilot-agreement-readiness.test.ts` | ✅ |

## Links & routes audit

- Landing footer "Privacy Policy" / "Terms of Service" links remain
  `disabled: true` (`src/app/page.tsx`) — **correct**: no published legal
  documents exist, so no dead or misleading links are exposed.
- `/pilot-agreement` is inside the protected shell (pilot participants
  only); it is intentionally NOT in `NAVIGATION_HIERARCHY` — partners are
  directed to it during onboarding/signature, not via daily navigation.
- No route claims legal validity while `PILOT_AGREEMENT_IS_PLACEHOLDER` is true.

## Versioning rules

1. Counsel-approved text lands → set `PILOT_AGREEMENT_IS_PLACEHOLDER = false`
   and bump `PILOT_AGREEMENT_VERSION` to `1.0`.
2. Any content change → version bump; acceptances are per-version, so
   partners re-accept on material changes.
3. The accept API pins the exact version (stale tabs get `409`).

## Open legal dependencies (blocking, tracked — not engineering)

1. **Counsel drafts/approves the pilot agreement text** — blocks signing
   the first design partner (S1 entry per ERR-10 requires a signed
   agreement per partner; the offline signed path satisfies S1).
2. **Published ToS + Privacy Policy** — blocks the closed PAID pilot (S2)
   and enabling the landing footer links.
3. **Subprocessor list** (Supabase, Vercel, Stripe, OpenAI) — feeds the
   privacy documentation.
4. **DPA template** — blocks the first B2B contract that requests it; not
   required for the free pilot.
