# ADR — PMFreak Founder Circle Program (Sprint 01)

Status: **Accepted** (this sprint). Owner: Founder.
Scope: closed, invite-only, human-approved founder program on top of the
existing CONDITIONAL GO closed-pilot baseline. No public beta, no open
signup, no production billing changes.

## Context

PMFreak completed technical hardening (Perillas 1–13B), the SaaS readiness
baseline, and Pilot Gate Sprint 01 (capability gating, honest UX, pilot
agreement plumbing, safe error handling). Launch state is **CONDITIONAL GO
for a closed pilot**. This sprint adds the operating system for recruiting,
admitting, activating, observing, and learning from a small cohort of real
founder participants — without changing that launch state.

## Current-state findings (Phase 0)

Three invitation systems already exist and none is reusable as-is for the
Founder Circle without distortion:

| Existing system | Location | Why not reused directly |
| --- | --- | --- |
| Early-access invites + trials | `src/lib/early-access.ts`, `early_access_invites`/`trial_licenses` | Couples invite → immediate workspace + 90-day trial on accept. No application, no human review step, no lifecycle beyond accept/revoke. Changing its semantics would destabilize a hardened, tested flow. |
| Workspace member invites | `src/lib/workspace-team.ts`, `workspace_invitations` | Seat invites into an *existing* workspace with a role; not a program admission funnel. |
| PMO team invites | `pmo_team_invites` | Record-only onboarding placeholders; no tokens or acceptance. |

Other load-bearing facts:

- **Pilot agreement plumbing exists but is recorded-only**: `pilot_agreement_acceptances`
  (`supabase/migrations/20260827000000_...sql`) + `src/lib/pilot/pilot-agreement.ts`
  (`PILOT_AGREEMENT_VERSION = "0.1-draft"`, placeholder text). Nothing gates on it today.
- **Capability gating exists**: non-founder users resolve to the curated
  `pilot` profile by default (`src/lib/workspace/pilot-capability-set.ts`);
  governance signing is disabled by default (M-03).
- **Every authenticated user gets a bootstrap workspace** on first protected
  page load (`ensureUserWorkspace`, `src/lib/workspaces.ts`). Platform entry is
  therefore controlled by signup + trial gating, not by this program — see
  13-known-limitations.md.
- **Operator identity** = founder/internal, resolved server-side from email
  domain/allowlist only (`isFounderOrInternalUser`, `src/lib/auth.ts`) — never
  from client-writable metadata.
- **Conventions to honor**: service-role access only through
  `createSupabaseServiceRoleClient` with a registered context
  (`privileged-access-registry.ts`); abuse limits via `enforceAbuseLimit` and
  the abuse registry; route guards declared in `route-guard-registry.ts`;
  `code::message` domain-error vocabulary with generic fallbacks; security
  events via `logSecurityEvent`; migrations with `drop policy if exists` +
  explicit revokes; fresh-DB proof gates stay OPEN (RR-MIGRATE hosted, RR-BACKUP).

## Decision

1. **New, self-contained domain** under `src/lib/founder-program/**`,
   `src/app/api/founder-program/**`, `src/app/(protected)/founder-circle/**`
   (participant) and `src/app/(protected)/founder-program/**` (operator UI).
   Founder Circle logic never leaks into core project/workspace domain code.
   Removability: dropping the flag disables every route; dropping the
   migration removes all state.
2. **New `founder_*` tables** (see 04-data-model.md) instead of overloading
   `early_access_invites`: the admission funnel (nominate → invite → apply →
   review → agree → activate) has states and evidence requirements the
   early-access model cannot express without breaking its hardened contract.
3. **Reuse instead of rebuild** everywhere else:
   - Token construction: same primitive as `src/lib/security/invite-tokens.ts`
     (24 CSPRNG bytes base64url, sha256-only at rest, plaintext returned once).
   - Agreement: `pilot_agreement_acceptances` + `PILOT_AGREEMENT_VERSION`
     remain the single source of truth; activation *gates* on it (new).
   - Capability assignment: activation grants no new capabilities — the
     participant remains a non-founder account on the free plan, which
     resolves to the curated `pilot` profile that Pilot Gate Sprint 01
     already enforces. No security policy duplicated in UI.
   - Workspace: activation associates the participant's canonical bootstrap
     workspace (`resolveCanonicalWorkspace`) — no parallel workspace system.
   - Operator authorization: `isFounderOrInternalUser` (founder-internal
     route class), enforced before body parse, per Perilla 5/8 conventions.
   - Email: `sendEmail` provider abstraction + manual-link fallback exactly
     like early-access invitations.
   - Audit: `founder_membership_transitions` (append-only, primary evidence)
     + `logSecurityEvent` (secondary channel).
4. **Fail-closed configuration**: env flags (all default off) AND a
   database-managed singleton settings row (capacity, expiry, versions).
   Missing/incomplete config disables the program with a controlled response.
5. **Capacity + duplicate-activation races closed in the database** with a
   `security definer` RPC (`founder_program_transition`) that locks the
   settings row and applies a compare-and-swap state update — following the
   `abuse_rate_limit_increment` precedent.
6. **Analytics are first-party rows** in `founder_program_events` with a
   central event/property allowlist and forbidden-key scanning (adapting the
   `platform_events` payload-validation pattern). Lifecycle evidence lives in
   the transitions table (authoritative); analytics are optional telemetry
   and never break the main workflow.

## Rejected alternatives

- *Extend `early_access_invites` with program columns* — rejected: mixes two
  lifecycles in one table, risks regressing a hardened flow, and violates
  "Founder Program logic must not become hidden core-domain coupling."
- *Env-only configuration* — rejected: capacity/cohort data is operational
  data, belongs in the database; env stays for enablement switches only.
- *Hard platform lockout for non-participants* — out of scope: platform entry
  control (signup gating) is pre-existing behavior; changing it is not part
  of this sprint and is documented as a known limitation.
- *Automated approval / scoring* — explicitly forbidden by the brief.

## Consequences

- ~10 new tables, all RLS-enabled, participant-visible ones with
  column-scoped grants; all writes go through service-role route handlers.
- One new migration file; migration inventory and registers updated.
- The program ships **disabled by default**; enabling it in any environment
  requires explicit env flags plus an operator-managed settings row.
