#!/usr/bin/env node
// ============================================================================
// P2-15 — CI workflow integrity gate.
//
// Exists because of a defect that every other gate in this repository was
// blind to: `.github/workflows/ip-compliance.yml` carried `timeout-minutes`
// at the WORKFLOW top level, which is not a valid key there (it is valid on a
// job and on a step). GitHub refused to parse the file, so all 168 of its runs
// completed as `failure` in 0s with ZERO jobs — the workflow appeared in the
// UI under its raw path rather than its `name:`, and nothing in the repository
// noticed that a declared compliance gate had never once executed.
//
// A gate that cannot run is worse than no gate: it reports a red check that
// reviewers learn to ignore, while the checks it claims to perform never
// happen. This script asserts the structural facts that make that class of
// defect visible locally, before it reaches GitHub.
//
// Deliberately NOT a general YAML framework or a schema validator. It extracts
// two things — the top-level key set, and each job's block — and makes narrow,
// named assertions against them. The workflows here use a simple 2-space block
// style with no anchors or flow mappings, and this reads exactly that.
//
// Usage:  node scripts/check-ci-workflow-integrity.mjs
// Exit:   0 — workflows are structurally sound
//         1 — a workflow would fail to parse, run zero jobs, or fake a pass
// ============================================================================

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const WORKFLOW_DIR = ".github/workflows";

/**
 * Valid workflow-level keys, per the GitHub Actions workflow syntax.
 *
 * This list is the whole point of the gate: anything outside it is silently
 * accepted by a YAML parser and rejected by GitHub, which is exactly how
 * `timeout-minutes` sat at top level for 168 runs. `timeout-minutes` is
 * conspicuously absent — it belongs to a job or a step, never here.
 */
const VALID_TOP_LEVEL_KEYS = new Set([
  "name",
  "run-name",
  "on",
  "permissions",
  "env",
  "defaults",
  "concurrency",
  "jobs",
]);

/** Top-level keys are the only ones at column 0 that are not list items. */
function topLevelKeys(text) {
  return text
    .split("\n")
    .filter((line) => /^[A-Za-z_][\w-]*:/.test(line))
    .map((line) => line.slice(0, line.indexOf(":")));
}

/** Each job is the 2-space-indented key block under `jobs:`. Returns name -> block text. */
function jobBlocks(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const jobs = new Map();
  if (start === -1) return jobs;
  let current = null;
  let buffer = [];
  for (const line of lines.slice(start + 1)) {
    // A new column-0 key ends the jobs section entirely.
    if (/^[A-Za-z_][\w-]*:/.test(line)) break;
    const header = line.match(/^ {2}([A-Za-z_][\w-]*):\s*$/);
    if (header) {
      if (current) jobs.set(current, buffer.join("\n"));
      current = header[1];
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  if (current) jobs.set(current, buffer.join("\n"));
  return jobs;
}

/** Strip `#` comments so prose about `|| true` cannot trip a content assertion. */
const stripComments = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, ""))
    .join("\n");

const errors = [];
const checked = [];

const workflowFiles = fs
  .readdirSync(path.join(root, WORKFLOW_DIR))
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

if (!workflowFiles.length) errors.push("No workflow files found under .github/workflows.");

const parsed = new Map();

for (const file of workflowFiles) {
  const raw = fs.readFileSync(path.join(root, WORKFLOW_DIR, file), "utf8");
  const body = stripComments(raw);
  const jobs = jobBlocks(body);
  parsed.set(file, { raw, body, jobs });

  // 1. Every top-level key must be one GitHub actually accepts.
  for (const key of topLevelKeys(body)) {
    if (!VALID_TOP_LEVEL_KEYS.has(key)) {
      errors.push(
        `${file}: '${key}' is not a valid workflow-level key. GitHub will refuse to parse the file and every run will fail in 0s with zero jobs.` +
          (key === "timeout-minutes" ? " Move it under the job (jobs.<id>.timeout-minutes) or the step." : "")
      );
    }
  }

  // 2. A workflow with no jobs cannot gate anything.
  if (jobs.size === 0) errors.push(`${file}: declares no jobs — it can never gate anything.`);

  // 3. `name:` must be present, so a broken workflow is not merely identified by its path.
  if (!/^name:\s*\S/m.test(body)) errors.push(`${file}: has no top-level 'name:'.`);

  for (const [job, block] of jobs) {
    // 4. Every job must actually do something.
    if (!/^\s+-\s+(run:|uses:|name:)/m.test(block)) {
      errors.push(`${file} job '${job}': has no steps — it would report success without running anything.`);
    }
    if (!/\brun:/.test(block) && !/\buses:/.test(block)) {
      errors.push(`${file} job '${job}': has no run/uses step.`);
    }
    if (!/runs-on:/.test(block)) errors.push(`${file} job '${job}': has no 'runs-on:'.`);

    // 5. No gate may launder its own failure into a pass.
    if (/\|\|\s*true/.test(block)) errors.push(`${file} job '${job}': contains '|| true', which turns a failing gate into a pass.`);
    if (/continue-on-error:\s*true/.test(block)) errors.push(`${file} job '${job}': sets 'continue-on-error: true', which hides a failing gate.`);
    if (/\|\|\s*exit\s+0/.test(block)) errors.push(`${file} job '${job}': masks a failure with 'exit 0'.`);
  }
  checked.push(`${file} (${jobs.size} job${jobs.size === 1 ? "" : "s"})`);
}

// ---------------------------------------------------------------------------
// Named assertions on the two workflows P2-15 repaired.
// ---------------------------------------------------------------------------

const ipCompliance = parsed.get("ip-compliance.yml");
if (!ipCompliance) {
  errors.push("ip-compliance.yml is missing.");
} else {
  const job = ipCompliance.jobs.get("compliance");
  if (!job) errors.push("ip-compliance.yml: expected a 'compliance' job.");
  else {
    // The specific regression this gate exists for.
    if (!/^\s{4}timeout-minutes:\s*\d+/m.test(job)) {
      errors.push("ip-compliance.yml job 'compliance': must declare its own 'timeout-minutes' (the repaired position for the key that used to sit at workflow level).");
    }
    if (!/npm run compliance:check/.test(job)) {
      errors.push("ip-compliance.yml job 'compliance': must run 'npm run compliance:check'.");
    }
    // The replaced byte-comparison could never pass; it must not come back.
    if (/git diff --exit-code[^\n]*artifacts\/compliance/.test(job)) {
      errors.push("ip-compliance.yml job 'compliance': byte-comparison drift check reintroduced. The generators stamp a fresh timestamp, serial number and HEAD sha per run, so it can never pass — use the semantic gate (npm run compliance:artifacts:drift).");
    }
  }
}

const releaseGovernance = parsed.get("release-governance.yml");
if (!releaseGovernance) {
  errors.push("release-governance.yml is missing.");
} else {
  const validation = releaseGovernance.jobs.get("beta-release-validation");
  const release = releaseGovernance.jobs.get("release");

  if (!validation) {
    errors.push("release-governance.yml: expected a 'beta-release-validation' job wiring the existing beta release gate into CI.");
  } else {
    if (!/npm run check:beta-release/.test(validation)) {
      errors.push("release-governance.yml job 'beta-release-validation': must run 'npm run check:beta-release'.");
    }
    // Validation must never hold release-write authority.
    if (/\bwrite\b/.test(validation.match(/permissions:[\s\S]*?(?=\n {4}\w|$)/)?.[0] ?? "")) {
      errors.push("release-governance.yml job 'beta-release-validation': must not request any write permission — validation carries no release authority.");
    }
    if (!/permissions:/.test(validation)) {
      errors.push("release-governance.yml job 'beta-release-validation': must declare explicit read-only 'permissions:'.");
    }
  }

  if (!release) {
    errors.push("release-governance.yml: expected a 'release' job.");
  } else {
    // A pull_request run must be structurally incapable of reaching write authority.
    const guard = release.match(/^\s{4}if:\s*(.+)$/m)?.[1] ?? "";
    if (!/github\.event_name\s*==\s*'push'/.test(guard) || !/github\.ref\s*==\s*'refs\/heads\/main'/.test(guard)) {
      errors.push("release-governance.yml job 'release': must be gated on `github.event_name == 'push' && github.ref == 'refs/heads/main'` so a pull_request run can never reach a write-authorised job.");
    }
    if (!/needs:\s*beta-release-validation/.test(release)) {
      errors.push("release-governance.yml job 'release': must declare `needs: beta-release-validation` so publication cannot precede the gate.");
    }
    if (!/contents:\s*write/.test(release)) {
      errors.push("release-governance.yml job 'release': expected 'contents: write' for the Changesets step.");
    }
  }

  // The workflow must be reachable from a pull request, or the gate cannot block a merge.
  if (!/^on:[\s\S]*?^\s{2}pull_request:/m.test(releaseGovernance.body)) {
    errors.push("release-governance.yml: must trigger on 'pull_request' — a release gate that only runs after merge cannot block anything.");
  }
}

console.log("[ci-workflow-integrity] Checked:");
for (const entry of checked) console.log(`    - ${entry}`);

if (errors.length) {
  console.error(`\n[ci-workflow-integrity] ${errors.length} problem(s):`);
  for (const message of errors) console.error(`[FAIL] ${message}`);
  process.exit(1);
}

console.log("[ci-workflow-integrity] Workflow structure is sound: valid top-level keys, no zero-job workflow, no masked failures.");
