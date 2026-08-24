#!/usr/bin/env node
// ============================================================================
// Dependency security gate (Perilla 11).
//
// Runs `npm audit --json` and classifies findings against the accepted-risk
// allowlist below (each entry must have a matching row in
// docs/release/residual-risk-register.md with owner + target date).
//
// Exit codes:
//   0 — no critical/high findings at all
//   2 — only allowlisted (accepted, documented) findings remain → CONDITIONAL
//   1 — a critical, or a non-allowlisted high, is present → must be triaged
// ============================================================================

import { spawnSync } from "node:child_process";

// Accepted findings. Keep in sync with docs/release/dependency-security-review.md.
const ACCEPTED_FINDINGS = [
  {
    package: "uuid",
    reason:
      "Transitive via exceljs (Perilla 12 xlsx replacement). Advisory covers uuid v3/v5/v6 with a " +
      "caller-provided buffer; exceljs only calls uuid.v4() with no arguments (verified in " +
      "docs/release/xlsx-replacement-decision.md), so the flaw is unreachable. Re-check on exceljs upgrades.",
    maxSeverity: "moderate",
  },
  {
    package: "exceljs",
    reason:
      "Flagged only through its transitive uuid dependency (same advisory as above) — exceljs itself has " +
      "no advisory and the uuid flaw is unreachable from exceljs's uuid.v4() usage.",
    maxSeverity: "moderate",
  },
];

// Packages that must NEVER be present in the dependency tree again, at any
// severity. xlsx@0.18.5 (prototype pollution + ReDoS, no npm fix) was removed
// in Perilla 12 (RR-XLSX closed) — its reappearance is an instant failure
// even if a future version carries no advisory.
const FORBIDDEN_PACKAGES = ["xlsx"];

const SEVERITY_ORDER = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

for (const forbidden of FORBIDDEN_PACKAGES) {
  const ls = spawnSync("npm", ["ls", forbidden, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let tree;
  try {
    tree = JSON.parse(ls.stdout);
  } catch {
    console.error(`dependency-security: could not parse \`npm ls ${forbidden} --json\` output`);
    process.exit(1);
  }
  if (tree.dependencies && Object.keys(tree.dependencies).length > 0) {
    console.error(
      `FORBIDDEN   ${forbidden} is present in the dependency tree — it was removed in Perilla 12 (RR-XLSX) and must not return`,
    );
    process.exit(1);
  }
  console.log(`FORBIDDEN-CHECK ${forbidden}: absent from dependency tree`);
}

const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("dependency-security: could not parse `npm audit --json` output");
  process.exit(1);
}

const vulnerabilities = Object.values(report.vulnerabilities ?? {});
const relevant = vulnerabilities.filter((v) => SEVERITY_ORDER[v.severity] >= SEVERITY_ORDER.moderate);

let unexpected = 0;
let accepted = 0;

for (const vuln of relevant) {
  const allow = ACCEPTED_FINDINGS.find((a) => a.package === vuln.name);
  const withinAcceptedSeverity = allow && SEVERITY_ORDER[vuln.severity] <= SEVERITY_ORDER[allow.maxSeverity];
  const line = `${vuln.name} [${vuln.severity}] ${vuln.isDirect ? "direct" : "transitive"} fixAvailable=${JSON.stringify(vuln.fixAvailable)}`;
  if (withinAcceptedSeverity) {
    accepted += 1;
    console.log(`ACCEPTED    ${line}\n            ${allow.reason}`);
  } else if (SEVERITY_ORDER[vuln.severity] >= SEVERITY_ORDER.high) {
    unexpected += 1;
    console.error(`UNEXPECTED  ${line} — triage required (fix, or allowlist WITH a residual-risk entry)`);
  } else {
    accepted += 1;
    console.log(`MODERATE    ${line} — below blocking threshold; review during dependency maintenance`);
  }
}

const lowCount = vulnerabilities.length - relevant.length;
console.log(`\ndependency-security: ${vulnerabilities.length} total findings (${relevant.length} ≥ moderate, ${lowCount} low/info), ${accepted} accepted, ${unexpected} unexpected`);

if (unexpected > 0) process.exit(1);
process.exit(accepted > 0 ? 2 : 0);
