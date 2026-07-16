# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## Executive status

* Final state: **BASELINE VERIFIED WITH LIMITATIONS**.
* Repository: `pmfreak` at `/workspace/pmfreak` — VERIFIED (`git-identity.txt`).
* Branch: `work` — VERIFIED.
* HEAD: `626cc6c763d64f41f2a3bb3b3fb11eb3b5629946` — VERIFIED.
* Relationship with `origin/main`: **UNVERIFIED / NOT PRESENT** because no git remote is configured and `origin/main` is absent.
* Working tree: initial tracked tree clean; Sprint 0 created only this audit directory.
* Target implementation: VERIFIED by `package.json`, Next.js app routes, Supabase migrations, AOC packages, PMFreak domain modules, and product terms in code.
* Installation: VERIFIED, `npm ci` exit 0 in 47s with warnings and 4 moderate npm audit vulnerabilities.
* Typecheck: VERIFIED, `npm run typecheck` exit 0 in 92s.
* Lint: VERIFIED, `npm run lint` exit 0 in 137s with 610 warnings.
* Tests: PARTIALLY VERIFIED, `timeout 240 npm test` reached 6067 passing subtests but timed out with exit 124.
* Build: VERIFIED, `npm run build` exit 0 in 211s.
* Conclusion: checkout is materially auditable, but remote chain of custody and full test completion are limited.

## Repository identity

| Field | Value | Status | Evidence |
|---|---|---:|---|
| Path | `/workspace/pmfreak` | VERIFIED | `git-identity.txt` |
| Origin | `NOT PRESENT (no remotes configured)` | NOT PRESENT | `git-identity.txt`, `git-sync.txt` |
| Branch | `work` | VERIFIED | `git-identity.txt` |
| Commit | `626cc6c763d64f41f2a3bb3b3fb11eb3b5629946` | VERIFIED | `git-identity.txt` |
| Date | `2026-07-16 12:07:15 -0600` | VERIFIED | `git-identity.txt` |
| Author | `vicvalch <36937201+vicvalch@users.noreply.github.com>` | VERIFIED | `git-identity.txt` |
| Subject | `chore(governance): harden intellectual property and license compliance (#524)` | VERIFIED | `git-identity.txt` |
| Tags | none listed | VERIFIED | `git-identity.txt` |
| Shallow clone | `true` | VERIFIED | `git-identity.txt` |
| Submodules | none reported | VERIFIED | `git-identity.txt` |

## Chain of custody

* Commit recommended to freeze: `626cc6c763d64f41f2a3bb3b3fb11eb3b5629946`.
* Evidence: local HEAD, branch, commit metadata, package manifest, code inventory, migrations, tests, build, and generated evidence.
* Divergences: cannot compare to `origin/main`; no remotes or remote branches are configured.
* Local changes: only Sprint 0 documentation under `docs/audit/pmfreak-integrated-audit/`.
* Reproducibility risks: shallow clone, absent remote, missing `origin/main`, timed-out full test command, secrets/services not functionally verified.

## Environment decision

The checkout **can be used with limitations** because the local implementation is inspectable and validates installation, typecheck, lint, and build. It cannot be marked `BASELINE VERIFIED` because origin/main synchronization is unavailable and tests did not complete inside the 240s safety window.

## Exact next action

Before Phase 1, configure or provide read access to the authoritative Git remote and record `origin/main`; then rerun `npm test` with an agreed timeout or suite split.
