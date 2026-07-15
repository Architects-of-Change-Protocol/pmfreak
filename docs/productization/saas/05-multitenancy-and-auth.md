# 05 — Multi-Tenancy, Authentication, and Authorization

## A. Multi-tenancy isolation audit

| Surface | Isolation mechanism | Classification | Evidence |
|---|---|---|---|
| Core schema (workspaces, projects, programs, portfolio, tasks, RAID, execution-tasks) | `workspace_id`-scoped RLS, 408/409 tables covered | **B2B-ready** | `docs/release/rls-tenant-isolation-report.md:7,22-41` — live two-workspace SQL test, 10/10 pass |
| `workspace_memberships` | Service-role-only writes by design (no `authenticated` INSERT/UPDATE/DELETE policy); reads via `SECURITY DEFINER` helper after a fixed recursion bug | **B2B-ready** | `supabase/migrations/20260823000001_fix_workspace_memberships_rls_recursion.sql`; `docs/security/supabase-rls-service-role-boundary.md:64-69` |
| `onboarding_analyses`, `governance_audit_events` | Legacy `company_id`-based RLS, not workspace-native | **Acceptable for beta** | `docs/security/rls-gap-inventory-phase-4.3.md:26-39` (F-12) |
| `governance_delegations` | SELECT policy references non-existent table `workspace_members` (typo for `workspace_memberships`) — silently fails scoped reads | **Logically weak (known bug)** | `docs/security/service-role-risk-register.md:94-95` (F-06) |
| `agent_attestation_nonces` | RLS intentionally off — service-role-only nonce store | **B2B-ready** (deliberate design, not a gap) | `docs/release/rls-tenant-isolation-report.md:7` |
| `vault/intake` API route | Relies on RLS alone; no explicit app-layer membership check before query | **Acceptable for beta** (RLS backstop tested; defense-in-depth gap) | `src/app/api/vault/intake/route.ts:33-42` (F-13) |
| `pm-registry`, `execution-tasks` API routes | App-layer `requireWorkspaceMember`/`requireProjectAccess` + RLS (defense-in-depth) | **B2B-ready** | `src/app/api/pm-registry/[pmId]/route.ts:16-32`, `src/app/api/execution-tasks/route.ts:10-31` |
| Storage (uploads) | `storage_bucket_setup` migration + workspace-scoped paths | **Acceptable for beta** — not independently re-verified in this audit pass; carried from prior security docs | `supabase/migrations/20260515200000_storage_bucket_setup.sql` |
| Secrets (trust-domain signing key) | Single PMFreak-owned secret (`PMFREAK_CAPABILITY_CLAIM_SECRET`), not per-tenant | **Not multitenant at the trust layer** — but this whole layer is flagged for AOC externalization (F-02), so tenant-scoping it further is not recommended; better to migrate ownership | `src/lib/aoc/adapters/trust-domain.ts:51` |
| Queues / background jobs | No dedicated job queue system found in this audit pass; AI usage/ceiling enforcement is per-workspace in-request, not queue-based | Not applicable / not yet built | — |
| Logs | Structured logger redacts secret-shaped values; not independently verified for cross-tenant log leakage in this pass | **Acceptable for beta** (carried from prior work) | `src/lib/observability/logger.ts` |
| Exports | Only computed-artifact exports (reports/spreadsheets) exist, generated per authenticated/workspace-scoped request; no bulk cross-tenant export surface found | **Acceptable for beta** | `src/lib/spreadsheets` |

**Overall multi-tenancy classification: B2B-ready with known, bounded gaps.** The core schema has been genuinely tested against cross-tenant access (not just documented), including a real regression (the recursion bug) caught before this audit. The gaps that remain (F-06, F-12, F-13) are all specific, named, and low-complexity to close — they are hardening items, not evidence of a broken isolation model.

## B. Authentication and authorization audit

| Capability | State | Evidence |
|---|---|---|
| Signup | Real, rate-limited, real Supabase persistence | `src/app/signup/actions.ts:37-49` |
| Login | Real, rate-limited (10 attempts/15min), generic error messages | `src/app/login/actions.ts:22-48` |
| Email verification | Real, via Supabase confirmation link | `src/app/auth/callback/route.ts:16-21` |
| Password reset | Real | `src/app/forgot-password/page.tsx`, `src/app/auth/reset-password/page.tsx` |
| Social login | **Not implemented** | Confirmed absent (F-08) |
| MFA | **Not implemented** | Confirmed absent (F-08) |
| Invitations | Real, hashed tokens, atomic single-use claim, email-match enforced | `src/lib/workspace-team.ts`, `supabase/migrations/20260820000000_workspace_invite_token_hashing.sql` |
| Membership lifecycle | Real — role updates enforce owner-safety rules (no self-promotion, no last-owner demotion) | `src/lib/workspace-access.ts:178-207` |
| Roles/permissions | Real 4-tier model, server-enforced from `workspace_memberships`, never from client-controlled display role | `src/lib/workspace-access.ts:9-24`; `src/lib/auth.ts:32-47` |
| Session management | Supabase-default cookie-bound sessions | `src/lib/supabase/server.ts` |
| Logout | Real | `src/app/logout/route.ts:6-9` |
| Device/session visibility | Not found in this audit pass | — |
| Service accounts / API keys | Internal SDK exists (`src/sdk`) but "agent token issuance is currently server-managed/deferred" per its own README | `src/sdk/README.md:1,12` |
| Support impersonation | **Not implemented** | Confirmed absent (F-16) |
| Admin access | Founder-only, narrow, well-gated (email-domain/allowlist, never client-supplied role) | `src/lib/auth.ts:87-169`; `docs/security/admin-founder-endpoint-boundary.md` |

## C. Recommended role matrix (target state, not all roles exist today)

| Role | Scope | Capabilities | Restrictions |
|---|---|---|---|
| Individual user (B2C) | Own workspace | Full CRUD on own projects; billing self-manage | Single-seat plan limits |
| Workspace member (`viewer`) | Assigned workspace | Read-only | No mutation, no billing, no invite |
| Workspace member (`pm`) | Assigned workspace | Create/edit projects, tasks, RAID; invite at ≤ own level | Cannot manage billing or org-level settings |
| PMO manager | Multiple projects/programs within an org | Cross-project reporting, portfolio views, PMO governance modules (once un-orphaned per F-21) | Bound to org scope |
| Consultant | Cross-workspace (external) | Scoped read/limited-write per engagement | Needs a distinct invite type not yet modeled — **gap** |
| Billing admin | Workspace | Manage subscription, seats | Cannot manage members/roles unless also `owner`/`admin` |
| Organization admin (`owner`/`admin`) | Workspace | Full control including billing, member management, role assignment | `owner` role itself cannot be assigned via role-update (only via initial creation/transfer — and no transfer flow exists, F-20) |
| Security admin | N/A today | Would need audit-log visibility, session revocation | **Does not exist as a distinct role — gap** |
| Support operator | N/A today | Customer/org lookup, impersonation with audit trail | **Does not exist — gap** (F-16) |
| Service account | N/A functionally today | Scoped API-key access for integrations/SDK consumers | Deferred per SDK's own README |

**Gaps to close, in priority order:** (1) support operator role for scaled support (F-16), (2) MFA + at least one OAuth provider (F-08), (3) owner-transfer flow (F-20), (4) a distinct "consultant"/external-scoped role if B2B consulting-firm packaging (see `09-product-packaging.md`) is pursued, (5) security-admin role once audit-log visibility is customer-facing rather than founder-only.
