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
    package: "xlsx",
    reason:
      "No npm-published fix (SheetJS distributes fixed builds via cdn.sheetjs.com only). " +
      "Mitigated by upload size limits, auth + rate limits, and the prototype-pollution parse guard " +
      "(src/lib/security/prototype-pollution-guard.ts). Tracked: residual-risk-register RR-XLSX.",
    maxSeverity: "high",
  },
  {
    package: "postcss",
    reason:
      "Bundled by next; no stable next release carries the patched postcss yet. Build-time surface only " +
      "(stringifies our own trusted CSS, never user input). Tracked: residual-risk-register RR-POSTCSS.",
    maxSeverity: "moderate",
  },
  {
    package: "next",
    reason:
      "Flagged only through its bundled postcss (same advisory as above) — next itself is at the latest " +
      "stable security release (16.2.10).",
    maxSeverity: "moderate",
  },
];

const SEVERITY_ORDER = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

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
