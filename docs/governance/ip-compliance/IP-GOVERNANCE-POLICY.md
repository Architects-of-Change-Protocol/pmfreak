# IP Governance Policy

Purpose: maintain a documented repository control posture for PMFreak proprietary code, third-party dependencies, assets, contributions, AI-assisted work, publication controls, and release evidence.

Scope: PMFreak source repository, package manifests, generated compliance artifacts, governance docs, workflows, internal packages, and release candidates. This policy does not replace legal advice.

PMFreak proprietary portions are marked UNLICENSED/all rights reserved. Third-party components retain their own terms. New contributions require authorization, rights confirmation, dependency intake, asset provenance, secret/customer-data exclusion, AI-output review where applicable, and approval.

Dependency intake requires business need, alternatives, project health, maintainer review, license review, vulnerability review, install-script review, transitive risk, data collection/telemetry/runtime permission review, lockfile update, SBOM update, approval, rollback, and replacement plan.

Publication controls require private root package, no root public publishConfig, no secrets in npm config, and release approver review. Exceptions require documented package, version/range, detected license, justification, approver, approval date, review date, compensating control, and legal-review flag.

Roles: Repository Owner, Product Owner, Security Reviewer, Open Source Compliance Reviewer, Release Approver, Legal Reviewer, Asset Owner. Escalate blocked licenses, unknown ownership, missing provenance, customer data, secrets, public-license changes, or release publication paths to the relevant reviewer.

Evidence retention: keep inventory, SBOM, notices, approval records, release manifests, and review reports with the commit/release they support. Review cadence: dependency and governance review before releases, on dependency changes, and at least periodically for diligence readiness. All changes use normal PR review and audit trail.
