# Open PR Disposition — Perilla 11 (Beta Release Closure Gate)

Reviewed: 2026-07-10, against `main` @ `1f4119c` (post-Perilla 10). Every open
PR was compared against the *current* state of `main` — none were merged or
closed on the strength of being open; each intent was re-verified.

| PR | Tema | Estado actual | Decisión | Justificación |
| -: | ---- | ------------- | -------- | ------------- |
| [#89](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/89) | Dependabot: next 16.2.4 → 16.2.6 | Stale (>30 days, auto-rebase disabled) | **close as superseded** | Perilla 11 upgrades `next` directly to **16.2.10**, which includes every advisory 16.2.6 addressed plus later ones. Verified: `npm audit` no longer reports the next high advisories after the upgrade. |
| [#107](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/107) | Fix governance route typing for staging deployment | Stale (May 12; base `30bfea9`) | **close as superseded** | `npm run typecheck` on current `main` completes with **0 errors** (verified during this gate). The Next.js 16 route-typing blockers this PR fixed were resolved by later merged work. Its own description says the build still failed after it — nothing left to salvage. |
| [#148](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/148) | Workspace-native RLS for `onboarding_analyses` + `governance_audit_events` | Stale (May 17); intent **still valid** | **rebuild from clean branch (deferred, not a pilot blocker)** | Verified both tables still use `company_id`-based RLS on `main` (`20260430170000`, `20260511110000`). That model still enforces tenant isolation via the JWT `company_id` claim — it is *legacy*, not *open*, and is documented in `docs/security/rls-gap-inventory-phase-4.3.md`. The 2-month-old branch predates Perillas 4–10 and must not be merged as-is; recreate the migration from a clean branch in a follow-up sprint. |
| [#163](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/163) | Landing polish — remove demo references, tighten CTAs | Stale (May 18); intent partially still valid (`loadDemo` still present in `getting-started-flow.tsx`) | **defer as future scope** | Marketing/UI polish, explicitly out of the closure gate's scope (Q: "large UI redesign"/product polish). Its own build failed on a then-existing TS error, so the branch is contaminated; redo the copy changes fresh if still wanted. |
| [#179](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/179) | Canonical UI reference documentation structure | Stale (May 19), docs-only | **defer as future scope** | Adds `docs/ui-reference/**` describing a Bubble-derived UX reference. No conflict risk but also no bearing on beta readiness; product/design should decide whether that structure is still the intended canon before merging two-month-old docs. |
| [#308](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/308) | Move `src/proxy.ts` out of reserved path to fix Vercel build | Obsolete | **close as obsolete** | The conflict it fixed no longer exists: `main` has **no `middleware.ts`** and uses `src/proxy.ts` as the Next.js 16 proxy convention (the successor to middleware). `npm run build` passes on current `main` and emits "ƒ Proxy (Middleware)" (verified during this gate). Merging it would *reintroduce* the dual-entrypoint problem in reverse. |
| [#345](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/345) | Fix `workspace-compression` contract failures | Superseded | **close as superseded** | `node --test tests/workspace-compression.test.mjs` passes **4/4 on current `main`** (verified during this gate) — the readiness-chip labels and empty-state copy it adds already exist. |
| [#347](https://github.com/Architects-of-Change-Protocol/pmfreak/pull/347) | Customer-owned organizational memory framework doc | Open (Jun 16), docs-only | **defer as future scope** | Large architecture proposal (schema + API contracts + UI specs) — a roadmap document, not closure work. Note for future review: its DB schema proposals must be reconciled with the migrations that landed since (workspace tenancy, audit tables). |

## Acciones ejecutadas / pendientes

1. **Done (during this gate):** #89, #107, #308, #345 were closed, each with
   a comment stating the verification evidence and linking to this document.
2. **Pending for repo owner:** label **#148** `rebuild-from-clean-branch`
   and schedule it in the next hardening sprint (it is the only stale PR
   whose underlying gap still exists on `main`).
3. **Pending for repo owner:** label **#163, #179, #347** `future-scope`
   (or close, at product's discretion) — they remain open deliberately.

No historical PR was merged during this gate, per the closure-gate ground
rules ("No fusiones PRs históricos sin verificar primero su vigencia").
