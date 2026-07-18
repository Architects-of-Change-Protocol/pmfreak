# Sprint 0 — Baseline Verification and Regression Protection

**Scope of this document:** verification only. No product code, styles, routes, or components were modified to produce this report. No merges were performed. This document does not evaluate whether the current UX is *good* — only which candidate is the correct, current, non-regressed baseline to build on.

---

## 1. Repository verification

| Item | Value | Evidence |
| --- | --- | --- |
| Repository | `Architects-of-Change-Protocol/pmfreak` | `git remote -v` |
| Current branch | `claude/pmfreak-baseline-regression-vj5u0q` | `git branch --show-current` |
| HEAD commit | `b09c111c6155783fd960c4026c5bb9620b5d2804` | `git rev-parse HEAD` |
| HEAD message | `Unify authenticated shell: restore modern UI across all Workspace/PMO/Project routes (#528)` | `git log -1` |
| Relationship to `origin/main` | **Identical** — 0 ahead, 0 behind | `git rev-list --left-right --count HEAD...origin/main` → `0 0` |
| Working tree | Clean before and after this audit | `git status` |
| Total remote branches | 559 | `git branch -r \| wc -l` |
| Open pull requests | 4 (#347, #179, #163, #148 — all dated May–June, none touch the current shell) | GitHub API (`list_pull_requests`, state=open) |

**Conclusion:** the branch this session was asked to work from starts at the exact tip of `main`. There is no divergence to reconcile between "my branch" and "main" — the only real question is whether `main`'s current tip is itself trustworthy, and if not, where the correct state actually lives.

---

## 2. Recent history on `main` (last 5 merges, newest first)

| # | Commit | Title |
| --- | --- | --- |
| #528 | `b09c111c` | Unify authenticated shell: restore modern UI across all Workspace/PMO/Project routes |
| #527 | `429457d8` | Workspace → PMO → Project: fix defects found by post-merge review of #526 |
| #525 | `96a5be34` | docs(audit): reconcile and close PMFreak baseline |
| #526 | `3343eca3` | Implement Workspace → PMO → Project hierarchy refactor |
| #524 | `626cc6c7` | chore(governance): harden intellectual property and license compliance |

This is the exact sequence the roadmap's Sprint 0 warns about, and it already happened once, two days ago:

1. **#526** (Jul 16) landed the Workspace → PMO → Project hierarchy refactor. It added new routes (`/workspaces`, `/pmos`, `/pmos/[id]`, `/projects/[id]`, `/chat`) but **never added them to the pre-existing allowlist** in `src/app/(protected)/layout.tsx` that decided which shell to render. Every one of those new routes silently fell through to the old legacy dark `OperationalShell` branch instead of the modern shell.
2. **#527** (Jul 16) fixed seven defects found by automated post-merge review — none of them were the shell-routing regression.
3. **#528** (Jul 17) is titled *"Unify authenticated shell: restore modern UI across all Workspace/PMO/Project routes"* — this is the commit that actually found and fixed the shell regression from #526, by collapsing the special-casing in `(protected)/layout.tsx` down to a single rule: every onboarding-complete route except `/workspace/setup` renders through one `OperationalShell`, and that shell now carries a single unified marker (`data-shell="pmfreak-shell"`) with the legacy marker removed entirely.

**This means `main`'s current tip is not merely "the latest commit" — it is specifically the commit that resolved the exact class of regression this sprint exists to guard against.** That is strong evidence in favor of `main`/HEAD as the baseline, not against it.

---

## 3. Technical verification (not just trusting the commit message)

Trusting a commit message alone would repeat the mistake the roadmap is worried about. Each claim below was independently re-executed in this session.

### 3.1 Regression-guard test suite

`tests/legacy-shell-quarantine.test.mjs` exists specifically to pin the #526 → #528 fix. Re-ran it directly against current HEAD:

```
$ node --test tests/legacy-shell-quarantine.test.mjs
# tests 17
# pass 17
# fail 0
```

All 17 assertions pass, including:
- `/workspace` redirects to `/command-center` and never mounts the legacy shell.
- No legacy dark-shell strings (`"Operational Command Center"`, `"No active context"`, `"Create your first context"`) appear in the command-center, workspace-setup, or getting-started surfaces.
- `OperationalShell` carries `data-shell="pmfreak-shell"` and **not** the retired `pmfreak-legacy-operational-shell` marker.
- `(protected)/layout.tsx` no longer special-cases `/command-center` for onboarding-complete users — everything routes through the one shell.
- The Workspace/PMO/Project routes added by #526 (`/workspaces`, `/pmos`, `/projects/[id]`, `/chat`, `/dashboard`) render through the unified shell, not a bare `<div>`.

### 3.2 Source-level confirmation

Read `src/app/(protected)/layout.tsx` directly (not just the test that asserts about it):

- Onboarding-incomplete users get a bare light shell only on `/command-center` and `/workspace/setup`.
- Onboarding-complete users get a bare light shell only on `/workspace/setup` (line 63–65).
- **Every other authenticated route** — including `/projects`, `/pmos`, `/programs`, `/meetings`, `/political-risk`, `/stakeholder-intel`, `/dashboard`, `/chat` — falls through to `<OperationalShell>` (line 68), confirmed to carry the modern marker in `operational-shell.tsx` line 848.

### 3.3 Build and route inventory

```
$ npm ci        # 586 packages, clean install
$ npm run build # production build — succeeded, all routes compiled
```

The build succeeded and emitted a full route manifest (100+ routes: `/command-center`, `/projects`, `/projects/[id]`, `/pmos`, `/pmos/[pmoId]`, `/meetings`, `/political-risk`, `/stakeholder-intel`, `/programs/[id]`, etc.), confirming the tree is not merely committed but compiles.

### 3.4 Live visual confirmation (public/unauthenticated surfaces)

The app has no seeded Supabase instance available in this sandboxed environment (no Docker daemon, no live database), so authenticated screens (Command Center, Projects, PMO, Risk Center/`political-risk`, Stakeholders/`stakeholder-intel`, Meetings) could not be captured by clicking through a real session — see §6 limitation below. What *could* be verified live:

```
$ npm run dev            # Next.js 16.2.10, ready in 588ms
$ curl /login             → 200
$ curl /                  → 200
$ curl /command-center    → 307 (redirects unauthenticated users, as expected)
```

Screenshots captured with Playwright against the running dev server (saved to session scratchpad, sent to the user separately):
- `/` — modern dark marketing landing page, "Stop leaking project intelligence" hero, light navbar.
- `/login` — modern light two-panel auth screen ("Keep projects aligned. Lead with clarity.").
- `/signup`, `/pricing` — render cleanly, no error boundaries, no legacy styling.

No legacy/dark authenticated shell, broken layout, or error page was observed on any reachable route.

---

## 4. Baseline candidate comparison

The roadmap asks for a comparison matrix across candidate baselines. In this repository, that comparison resolves quickly because of how PRs are merged: **`main` uses squash-merge**, so all named "candidate" branches are either (a) the literal source branch of a commit already squashed into `main`, or (b) forks from a `main` that is now 50+ merged PRs stale.

| Candidate | Relationship to current `main` (`b09c111c`) | Verdict |
| --- | --- | --- |
| **`origin/main`** (= current HEAD) | Self | **Baseline** — contains hierarchy refactor + shell unification fix, tests green, build green |
| `claude/pmfreak-ui-regression-investigation-i6ntb3` | 1 ahead / 1 behind `main`; its one commit has the **identical title** to #528 | This is the literal source branch squash-merged into `main` as #528. Not a separate candidate — already absorbed. |
| `claude/pmfreak-workspace-pmo-project-h78vqa` | 1 ahead / 1 behind `main` | Source branch of a defect-fix commit already on `main`'s lineage. Not a separate candidate. |
| `claude/pmfreak-architecture-audit-r6fhfo` | 1 ahead / 0 behind `main` (created 2026-07-18, today) | Branches cleanly from current `main` tip, adds one docs-only commit (conceptual domain-model audit). Compatible with this baseline, not a competing one — likely useful input for Sprint 1. |
| `codex/establecer-baseline-del-repositorio-pmfreak` | 1 ahead / **4 behind** `main` | Stale — forked before #524–#528 landed. Its own "baseline" conclusion predates the shell-unification fix and should not be trusted over current `main`. |
| `claude/pmfreak-capability-audit-w89p9c` | 1 ahead / **4 behind** `main` | Same staleness as above. |
| `claude/pmfreak-dark-ui-production-g88a5r` | dated 2026-07-01, 719 commits of independent history, ~50 merged PRs behind `main` | **Danger candidate.** Branch name and last commit ("Add /api/build-info diagnostic endpoint") suggest this line of work put the dark UI into production. Predates the hierarchy refactor entirely. |
| `claude/remove-dark-ui-user-journey-y999iu` | same generation as above (2026-07-01) | Its own last commit is literally titled *"Quarantine the legacy dark OperationalShell from the authenticated user journey"* — i.e. a **prior, now-superseded attempt** at the same fix #528 later delivered properly. Confirms the dark/light shell oscillation is a recurring, historical failure mode in this repo, not a one-off. |
| `claude/command-center-ui-redesign-l1wasv`, `claude/command-center-redesign-routing-3za2mw`, `claude/pmfreak-command-center-ui-vd1w5i` | same generation (2026-07-01), 700+ commits behind `main` | Stale UI-redesign lineage predating the current architecture; not candidates. |
| `codex/unify-product-experience-and-navigation` | dated 2026-05-10, ~50 PRs behind `main` | Very stale; a much earlier attempt at shell unification, superseded twice over. |

**No open pull request currently targets `main` with changes to `operational-shell.tsx` or `(protected)/layout.tsx`.** The immediate merge risk is zero. The risk is entirely about someone *manually* reviving one of the ~500 stale branches above (see §5).

### Matrix by area (requested format)

| Área | `main` (current HEAD) | Stale dark-UI lineage (Jul 1 branches) | Pre-#524 baseline docs (`codex/establecer-baseline...`) | Ganador | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Shell | Single unified `OperationalShell`, `data-shell="pmfreak-shell"` | Legacy dark `OperationalShell` special-cased per route | N/A (predates refactor) | `main` | §3.1, §3.2 |
| Sidebar/Navigation | Workspace → PMO tree, tier-based nav partitioning (#526) | Flat/legacy nav, no PMO tier | Flat (pre-hierarchy) | `main` | #526 commit body |
| Header/Layout | Unified across all authenticated routes | Command-center bypassed shell entirely | N/A | `main` | `(protected)/layout.tsx` |
| Routes | `/workspaces`, `/pmos`, `/pmos/[id]`, `/projects/[id]`, `/chat` all present, all render through the unified shell | Routes did not exist yet | Routes did not exist yet | `main` | build route manifest, §3.3 |
| Responsive | Not independently re-verified visually this sprint (see §6) | — | — | Not evaluated | — |
| Tests | 17/17 regression-guard tests green; full suite reported ~12,450 tests green as of #527/#528 commit messages | — | — | `main` | §3.1 |
| Architecture | Workspace → PMO → Project hierarchy, isolated per-scope chat, RLS-enforced | Project-as-root (pre-hierarchy) | Project-as-root | `main` | #526 commit body |

---

## 5. Divergences and risks detected

1. **Historical oscillation risk (real, not hypothetical).** This repository has already regressed its own shell from modern → legacy → modern again at least twice: once around 2026-07-01 (`claude/remove-dark-ui-user-journey-y999iu` fixing a dark-shell problem), and again on 2026-07-16→17 (#526 regressing it, #528 fixing it). The pattern is structural: **the shell-selection logic in `(protected)/layout.tsx` has repeatedly been the single point of failure**, because it requires every new route to be explicitly reasoned about rather than defaulting safely.
2. **559 remote branches, most stale.** No tooling currently prevents someone from opening a PR from a Jul 1-era branch (e.g. `claude/pmfreak-dark-ui-production-g88a5r`) against current `main`. Because these branches carry hundreds of their own unsquashed commits and pre-date the hierarchy refactor by ~50 merged PRs, a naive merge (or a `git merge -X theirs`, or resolving conflicts in the branch's favor) would silently reintroduce the legacy shell and drop the Workspace/PMO/Project data model.
3. **The only automated protection today is string/marker-based, not visual.** `tests/legacy-shell-quarantine.test.mjs` greps source for legacy strings and shell markers. It cannot catch a *visual* regression that doesn't change those specific strings (e.g., a spacing/color/component regression that keeps the correct `data-shell` marker). There is **no Playwright config, no visual regression tooling, and no screenshot-diffing** anywhere in the repository (`find . -iname "playwright.config*"` → no results; `.github/workflows/` has no visual-regression job).
4. **`docs/ui-reference/*.png` are not baseline evidence.** These images (Command Center, Projects, Risk Center, Stakeholders, Meetings, etc.) were added by PR #179, dated 2026-05-19, and per that PR's own description are **Bubble no-code exploration screenshots** — a design reference, explicitly *not* the production runtime — added roughly two months before the current architecture existed. If a future sprint treats these images as "the correct UI to restore," that would itself be a regression vector. They should be relabeled or retired as design inspiration only, not treated as canonical.
5. **Naming drift between the roadmap's page names and actual routes.** The roadmap (and `docs/ui-reference/`) refer to "Risk Center" and "Stakeholders" as page names. The actual current routes are `/political-risk` and `/stakeholder-intel` — there is no `/risk-center` or `/stakeholders` route in `src/app/(protected)/`. This is not evaluated as good or bad here (that's Sprint 2's job), just recorded as a real divergence between roadmap vocabulary and shipped routes.
6. **CI gate exists but has no visual/UI-regression step.** `.github/workflows/ci-governance.yml` runs `npm run build:aoc`, `typecheck`, `lint`, `npm test`, `check:governance`, `check:publish-ready`, `check:package-purity` on every PR and push to `main`. This is a real, working gate — but it is entirely non-visual. A change that passes every one of those checks could still silently reintroduce a legacy-looking shell as long as it kept the right `data-shell` string somewhere.

---

## 6. Limitations of this verification (stated explicitly, not hidden)

Per the sprint's own rules, this is stated plainly rather than glossed over:

- **No live database was available in this sandboxed session** (no Docker daemon, no seeded Supabase project). This session used a placeholder `.env.local` to run `next build`/`next dev` for structural and public-route verification, then deleted it — no credentials were committed. As a result, **authenticated screens (Command Center, Projects, PMO, Risk Center/`political-risk`, Stakeholders/`stakeholder-intel`, Meetings) were verified at the source and shell-routing level (§3.1–3.2), not by visually clicking through a live authenticated session.** This is a real gap relative to the roadmap's request for visual evidence of every screen; it is a sandbox/environment limitation, not a repository ambiguity.
- The 559-branch comparison in §4 is not exhaustive. It covers `main`, the branches directly implicated in the #526→#528 regression/fix cycle, and a targeted keyword sweep (`shell|regression|navig|onboard|command-center|ux|ui-|legacy|baseline`) across all remote branch names. A branch with an unrelated-sounding name that happens to touch the shell would not have been caught by this sweep.
- Responsive/mobile behavior and full end-to-end authenticated flows were not re-verified visually this sprint.

None of these limitations create ambiguity about **which commit is the baseline** — that question has a clear, multiply-corroborated answer (commit message + passing regression tests + source-level confirmation + successful build + clean public-route screenshots). They limit how much can be said about picture-perfect UI fidelity on authenticated screens specifically.

---

## 7. Recommended baseline

- **Baseline commit:** `b09c111c6155783fd960c4026c5bb9620b5d2804`
- **Baseline branch:** `main` (identical to current session branch `claude/pmfreak-baseline-regression-vj5u0q`)
- **Do not** treat `docs/ui-reference/*.png` (PR #179, pre-architecture Bubble mockups) as baseline UI evidence.
- **Do not** merge, cherry-pick from, or use as a reference any branch dated on or before 2026-07-01 that touches `operational-shell.tsx`, `(protected)/layout.tsx`, navigation, or onboarding, without first diffing it against current `main` and re-running `tests/legacy-shell-quarantine.test.mjs`.

### Strategy for creating subsequent sprint branches

All Sprint 1+ work should branch directly from `main` at `b09c111c` (or later, once new work lands), never from any of the stale branches enumerated in §4–5. Each subsequent sprint branch should:
1. Start with `git fetch origin main && git checkout -b <branch> origin/main`.
2. Before any implementation PR (Sprint 9+), re-run `node --test tests/legacy-shell-quarantine.test.mjs` and the full CI governance gate locally as a pre-flight check that the branch still starts from a non-regressed shell.
3. Never resolve a merge conflict in `(protected)/layout.tsx` or `operational-shell.tsx` by accepting "theirs" from an old branch without manually re-verifying the single-shell invariant.

### Acceptance criteria for future PRs (protection proposal, not implemented)

Proposed, not built this sprint:
- Add a Playwright visual-regression job (none exists today) that screenshots at minimum: `/login`, `/command-center`, `/projects`, `/pmos`, `/political-risk`, `/stakeholder-intel`, `/meetings`, against a seeded test database in CI.
- Expand `tests/legacy-shell-quarantine.test.mjs`-style marker assertions to cover every new top-level route as it's added, as a required CI check (already partially true — this file already exists and runs in `npm test`, which is already a required CI step; the gap is that it must be *remembered* per new route rather than being structurally guaranteed).
- Add a PR checklist item: "If this PR touches `(protected)/layout.tsx` or any `*-shell.tsx` file, paste before/after screenshots of `/command-center`, `/projects`, and one PMO route."
- Canonical screenshots: once a live Supabase-backed environment is available, capture and commit a fresh, dated `docs/product-architecture/baseline-screenshots/` set from *this* baseline commit, superseding the stale 2026-05-19 Bubble mockups in `docs/ui-reference/`.

---

## 8. Closing status

**BASELINE VERIFIED**

`main` at `b09c111c6155783fd960c4026c5bb9620b5d2804` is the correct, current, non-regressed baseline: it contains both the Workspace → PMO → Project architecture (#526/#527) and the fix for the one regression that refactor caused (#528), confirmed by passing regression tests, a clean production build, and clean live screenshots of every publicly reachable route. No other branch is a legitimate competing candidate — the closest lookalikes are either the already-merged source branches of this same lineage, or stale pre-refactor forks that should explicitly be avoided.

This sprint made no changes to product code, styles, routes, or components, and performed no merges.
