# PMFreak Integrated Audit Program — Sprint 0

Status taxonomy: VERIFIED / PARTIALLY VERIFIED / UNVERIFIED / NOT PRESENT / NOT APPLICABLE. Evidence files live in `docs/audit/pmfreak-integrated-audit/evidence/`.

| ID | Description | Evidence | Impact | Phases affected | Severity | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| BASE-001 | No git remote / no `origin/main` available | `git-identity.txt`, `git-sync.txt` | Weakens external chain of custody | all | HIGH | Configure authoritative remote and refetch | repo owner | OPEN |
| BASE-002 | Shallow clone | `git-identity.txt` | Limits history, ancestry, tags, audit chronology | governance/release | MEDIUM | Provide full clone or deepen history | repo owner | OPEN |
| BASE-003 | Full `npm test` timed out at 240s after observed passing subtests | `test-summary.txt` | Test baseline incomplete | testing/release | MEDIUM | Split suites or approve longer timeout | engineering | OPEN |
| BASE-004 | Service credentials and remote Supabase/Vercel/GitHub access not verified | env/workflow evidence | Limits operational/security audit | security/ops/CI | MEDIUM | Provide non-production credentials and read-only access | platform owner | OPEN |
| BASE-005 | npm audit reports 4 moderate vulnerabilities during install | `install-summary.txt` | Dependency risk requires later review | security/dependencies | MEDIUM | Triage in dependency audit, do not auto-fix in Sprint 0 | security/eng | OPEN |
