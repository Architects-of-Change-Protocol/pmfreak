# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

## CI/CD baseline

Workflow evidence is captured in `evidence/ci-cd-workflows.txt`.

| Workflow | Trigger | Purpose | Checks | Secrets | Risk | Status |
|---|---|---|---|---|---|---:|
| GitHub Actions files | see evidence | CI/release/security as declared in YAML | parsed from files only | referenced names only; no values | remote run status unavailable | PARTIALLY VERIFIED |

Remote GitHub PRs, branch protection, check runs, deployments, and recent workflow executions are UNVERIFIED because no `origin` remote is configured in this checkout.
