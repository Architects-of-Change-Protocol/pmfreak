# SBOM Policy

Generate artifacts/compliance/sbom.cdx.json from the npm lockfile whenever dependencies change, before release candidates, and on demand for due diligence. The Open Source Compliance Reviewer reviews license metadata; the Security Reviewer reviews supply-chain and vulnerability context; Release Approver confirms inclusion in release evidence.

SBOMs are retained with release evidence and compliance artifacts. The SBOM is technical dependency evidence, not a legal opinion. It does not prove ownership, vulnerability absence, or license compatibility by itself.
