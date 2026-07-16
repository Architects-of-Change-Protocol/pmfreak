# Founder Circle — Security Review (Sprint 01)

Reviewer: implementation-time self-audit (this sprint). Independent external
review remains an OPEN platform gate (RR-PENTEST). Scope: everything under
`src/lib/founder-program/**`, `src/app/api/founder-program/**`, the two UI
route families, migration `20260828000000_founder_program.sql`, and the
pilot-agreement route hook.

## Findings by review area

| Area | Assessment | Evidence |
| --- | --- | --- |
| Token entropy | 24 CSPRNG bytes (192 bits), base64url — same primitive as the hardened workspace-invite system | `invitations.ts`; `tests/founder-program-invitations.test.ts` |
| Token hashing | Unsalted sha256 at rest (safe at 192-bit entropy; documented rationale mirrors `invite-tokens.ts`); plaintext returned exactly once; length pinned in SQL | migration check `char_length(token_hash) = 64`; migration test |
| Token expiry | DB-configured (default 7 days, bounded 1–90); lazy expiry revokes the participant with a system reason | invitations tests |
| Replay / single-use | Application submission flips invitation to `applied`; the CAS transition makes double-submits `already_applied`; resend rotates the hash (old link dead) | application/invitation tests |
| Enumeration | Lookup by exact hash; unknown/revoked/expired indistinguishable at the API; per-IP+token abuse limit; 404 for disabled program | security tests; route code |
| Horizontal escalation | Participant reads are triple-layered: route self-scoping by authenticated user id, RLS `user_id = auth.uid()`, column-scoped grants; no participant list endpoint exists | migration + feedback tests |
| Operator escalation | `requireFounderProgramOperator` = founder/internal (email-domain/allowlist, never client metadata) before body parse; forbidden-pattern scan covers these files; wrapper implementation pinned by `tests/route-guard-consistency.test.mjs` | route-guard registry + tests |
| Workspace crossover | Activation associates only the participant's own canonical workspace; feedback discards client-supplied workspace ids; no route accepts a foreign workspace id | admission/feedback tests |
| Application spoofing | Invite-bound + email-bound (invitation email must equal the authenticated account email); one participant per invitation and per account (unique constraints) | application tests |
| Agreement spoofing | Acceptance rows are written only by the pre-existing version-pinned route (unique per version, no client update/delete); activation independently re-reads the acceptance table | admission tests; pre-existing migration |
| Activation bypass | Only transition path is `onboarding_pending → onboarding_active` (operator) — the allowlist has no other route to access states; agreement + capacity verified in the same call | lifecycle tests |
| Capacity races | `founder_program_transition` locks the settings row `FOR UPDATE`, counts, CAS-updates and audits in one transaction; execute granted only to service_role | migration; SECURITY DEFINER checker |
| Duplicate activation | CAS returns `state_conflict`; the route resolves to idempotent success only if the concurrent winner fully activated | admission idempotency test |
| Feedback exposure | Internal triage fields excluded by projection + column grant; participants see own rows only | feedback tests |
| Free-text / HTML injection | All free text bounded server-side and stored as plain text; UI renders via React text nodes (no dangerouslySetInnerHTML anywhere in the domain); emails escape interpolations | applications/feedback validation; template escaping |
| Email-link leakage | Invite links returned once, never persisted; log-call scanner bans token/link identifiers in log arguments | `tests/founder-program-security.test.ts` |
| Sensitive logs | Domain uses `logger` with `safeErrorMessage`; security-event metadata is scrubbed (`scrubMetadata`) and carries enum values only | transitions tests |
| Analytics leakage | Event/property allowlists + enum-like value grammar make emails/tokens/free text structurally impossible | analytics tests |
| Service-role use | Single factory (`db.ts`), registered in `privileged-access-registry.ts` (L4); all founder tables intentionally have zero client write grants | registry entry |
| RLS coverage | 10/10 tables RLS-enabled; explicit revokes; 4 participant-visible tables with self-select policies + column-scoped grants; the rest service-role-only | migration static tests |
| Default grants | `revoke all … from anon, authenticated` on every table; function `revoke all … from public` | migration; `check:security-definer-hardening` |
| Error leakage | Routes return the domain `code::message` vocabulary or generic messages; raw driver text logged server-side only | route code; existing error-leakage suite passes |
| CSRF | Mutations are same-origin `fetch` JSON POSTs from authenticated pages; Supabase session cookies + JSON content-type; consistent with the platform's existing posture (no bespoke CSRF token system exists platform-wide) | — |
| Rate limiting | Every mutation route + token resolution enforce `enforceAbuseLimit`; registered in the abuse registry (9 entries) | abuse-boundary test |
| Abuse scenarios | Invitation spam bounded per operator + batch cap; application/feedback spam bounded per user; enumeration bounded per IP+token | registry |

## Remediations applied during the review

1. Operator participants list initially filtered on a non-existent column —
   fixed before commit.
2. Applied-invitation resubmission returned a generic invalid response —
   changed to an explicit `already_applied` (no information hidden from the
   legitimate holder; unknown tokens still generic).
3. Log-scanner false positive logic hardened to strip string literals so it
   scans data flows, not route ids.

## Accepted residual risks (documented, not hidden)

- **R1 — No platform-level lockout**: any authenticated user still gets the
  standard signup/trial surface; the program controls program membership,
  not platform entry (pre-existing behavior; see 13-known-limitations.md).
- **R2 — Operator = founder/internal**: no finer-grained program-operator
  role exists; acceptable at ≤10 participants, revisit before expansion.
- **R3 — In-memory abuse store fallback** in environments without the
  service-role key (existing platform-wide residual, RR in abuse registry).
- **R4 — settings row edited via manual SQL**: no settings API by design
  (smaller attack surface); operator errors mitigated by bounded check
  constraints and the fail-closed parser.
- **R5 — no external pentest** of this surface (platform RR-PENTEST OPEN).
