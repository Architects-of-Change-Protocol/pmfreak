# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

| Evidence ID | Claim | Source | Command or file | Result | Status |
|---|---|---|---|---|---:|
| EV-GIT-001 | Repo path, branch, HEAD, commit metadata | local git | `evidence/git-identity.txt` | identified local baseline | VERIFIED |
| EV-GIT-002 | Origin/main unavailable | local git | `evidence/git-sync.txt` | origin/main absent | VERIFIED |
| EV-PKG-001 | npm/Next/Supabase/AOC stack | package manifest | `evidence/package-json.txt` | direct deps/scripts captured | VERIFIED |
| EV-IMPL-001 | PMFreak implementation terms exist | git grep | `evidence/target-implementation-search.txt` | domain terms found | VERIFIED |
| EV-ENV-001 | Environment variable references inventoried | rg | `evidence/environment-variables.txt` | names/classes only | PARTIALLY VERIFIED |
| EV-DB-001 | Supabase migrations/schema vocabulary | find/rg | `evidence/database-summary.txt` | 149 migrations counted | VERIFIED |
| EV-AUTH-001 | Auth/multi-tenancy control surfaces | rg | `evidence/auth-tenancy-summary.txt` | references mapped | PARTIALLY VERIFIED |
| EV-AI-001 | AI/AOC/agent surfaces | rg | `evidence/ai-summary.txt` | references mapped | PARTIALLY VERIFIED |
| EV-TEST-001 | Test inventory and skip patterns | find/rg | `evidence/test-inventory.txt` | test files listed | VERIFIED |
| EV-INSTALL-001 | Dependencies install | npm | `evidence/install-summary.txt` | exit 0, warnings | VERIFIED |
| EV-TYPE-001 | Typecheck | npm | `evidence/typecheck-summary.txt` | exit 0 | VERIFIED |
| EV-LINT-001 | Lint | npm | `evidence/lint-summary.txt` | exit 0, warnings | VERIFIED |
| EV-TEST-002 | Main tests | npm | `evidence/test-summary.txt` | timeout exit 124 after 6067 observed passing subtests | PARTIALLY VERIFIED |
| EV-BUILD-001 | Production build | npm | `evidence/build-summary.txt` | exit 0 | VERIFIED |
| EV-CI-001 | CI workflow inventory | find/sed | `evidence/ci-cd-workflows.txt` | files captured if present | PARTIALLY VERIFIED |
