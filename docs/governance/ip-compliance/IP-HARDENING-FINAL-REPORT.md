# PMFreak IP Hardening Final Report

## Executive Summary

Initial state: private repository evidence, no root LICENSE, root package private, root package missing explicit license marker, no versioned IP compliance inventory/SBOM/governance packet. Final state: repository marked with proprietary posture, root package UNLICENSED, compliance artifacts generated, workflow gate added, contribution and release governance documented. Readiness: Ready with conditions for due diligence review; legal and operational evidence remains required.

## Scope

Repository: /workspace/pmfreak. Base commit: 7c5e94cff489d4c4ba17305efd18b2c4b3c30d92. Final commit: to be filled by merge/PR. Reviewed files exclude node_modules, .git, build outputs, caches, coverage, and temporary directories.

## Changes Implemented

| Control | File | Objective | Evidence | Result | Residual risk |
| --- | --- | --- | --- | --- | --- |
| Proprietary root metadata | package.json | Prevent open source package interpretation | private true, license UNLICENSED | Implemented | Legal review still required |
| Ownership notices | COPYRIGHT, NOTICE | Document repository posture | Root files | Implemented | Does not prove entity ownership |
| Third-party inventory | artifacts/compliance/* | Dependency license evidence | Generated from lockfile | Implemented | Review-required entries remain |
| SBOM | artifacts/compliance/sbom.cdx.json | Supply-chain evidence | CycloneDX JSON | Implemented | Tool is internal lightweight generator |
| Publication safety | scripts/compliance/check-package-publication-safety.mjs | Fail closed for root publication risk | npm script | Implemented | Existing AOC publication workflows need approvals |
| Release gate | docs/governance/ip-compliance/RELEASE-IP-GATE.md | Commercial release checklist | Document | Implemented | Operational adoption required |

## License Posture

Product: proprietary / UNLICENSED technical posture. Root LICENSE: absent by design. README: proprietary section added. Notices: COPYRIGHT, NOTICE, THIRD_PARTY_NOTICES.md. Third parties retain their own terms. Exceptions: none approved. Publication: root remains private; AOC package publication paths documented for controlled review.

## Dependency Review

See artifacts/compliance/third-party-license-inventory.json for totals and package-level results. Review-required dependencies are not ignored; they are surfaced for compliance/legal review. No exceptions were invented.

## Asset Provenance

Assets reviewed by repository path. Provenance evidence for many product, icon, screenshot, and template assets was not found in repository scope; status remains pending provenance.

## Ownership Evidence

Found: repository notices, package metadata, CODEOWNERS, generated compliance evidence. Missing/required external evidence: entity records, IP assignments, contractor agreements, domain/brand records, registry/admin ownership, vendor/design asset records.

## Publication Safety

Root private true and no root publishConfig. Existing Changesets and AOC package publish workflows represent controlled publication paths, not releases executed in this sprint. npm pack dry-run should be used only as a non-publishing check.

## Supply Chain

SBOM and inventory are generated from package-lock.json. Workflow uses GitHub-maintained actions pinned to major versions with minimal permissions and no secrets.

## Validation Results

| Command | Result | Duration | Status | Observations |
| --- | --- | --- | --- | --- |
| npm run compliance:licenses:generate | Pass | recorded in terminal | Pass | Inventory generated |
| npm run compliance:check | Pass | recorded in terminal | Pass | Review-required dependency warnings surfaced; no exceptions invented |
| npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm pack --dry-run && git diff --check && git status --short | Pass | recorded in terminal | Pass with warnings | npm audit reported 4 moderate vulnerabilities; ESLint reported warnings only; tests emitted expected environment warnings for missing Supabase service role variables; npm pack was dry-run only |

## Preexisting Failures

No introduced product failures observed. Preexisting/environment observations: npm audit reports 4 moderate vulnerabilities; ESLint reports existing warnings; tests log missing Supabase service-role environment variables during telemetry paths but complete successfully.

## Residual Risks

- Critical: none identified in repository-scope review.
- High: no external legal evidence for IP assignments/entity ownership in repo.
- Medium: asset provenance pending; review-required dependency licenses require assessment.
- Low: existing release/package workflows require operational approval discipline.
- Informational: AI co-author trailers are documented as operational attribution, not license grants.

## Legal Review Queue

Entity ownership, contributor/contractor IP assignments, AOC package ownership/licensing, review-required dependency licenses, brand/trademark/domain clearance, asset/font/logo rights, customer/commercial terms, AI tool provider terms.

## Operational Follow-up

| Priority | Owner role | Target | Evidence | Closure |
| --- | --- | --- | --- | --- |
| High | Legal Reviewer | Before investment diligence | IP assignment/entity evidence | Stored externally with index reference |
| High | Asset Owner | Before public release | Asset provenance records | Register updated |
| Medium | Compliance Reviewer | Before release | Review-required dependency disposition | Policy updated or legal memo linked |
| Medium | Release Approver | Before release | Artifact manifest and approvals | Release gate signed |

## Due Diligence Readiness Assessment

- Ownership clarity: Ready with conditions.
- Repository license posture: Ready.
- Dependency compliance: Ready with conditions.
- Asset provenance: Partially ready.
- Contribution governance: Ready.
- Release governance: Ready with conditions.
- Supply chain evidence: Ready with conditions.
- Auditability: Ready with conditions.
- Transferability: Partially ready until external evidence is collected.

## Final Recommendation

The repository is now clearly marked with a proprietary technical posture. Accidental root package publication risk is reduced by private metadata and checks, but existing AOC publication paths require release approval. Dependencies are inventoried and SBOM evidence exists. Blocked licenses should fail the gate; review-required licenses and unknowns require review. Several assets lack provenance evidence. Counsel should review ownership chain, brand, dependency/license issues, commercial terms, AI terms, AOC boundaries, and asset rights before investment, acquisition, or first commercial release.

## Rollback Plan

Revert the commit for scripts, workflow, package.json script/license edits, generated artifacts, and governance documents. If desired, preserve reports as external evidence before revert. Do not reset history; use git revert. Product functionality should remain unaffected because changes are governance-only.
