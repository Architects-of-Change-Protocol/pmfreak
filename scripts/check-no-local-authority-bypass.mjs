/**
 * Governance guard: detect forbidden local-authority-bypass patterns.
 *
 * This script scans PMFreak source files for patterns that indicate PMFreak is making
 * final authorization decisions locally instead of delegating to the AOC Enterprise Runtime.
 *
 * Run via: node scripts/check-no-local-authority-bypass.mjs
 * Wired into package.json as "check:no-local-auth-bypass".
 *
 * Design notes:
 *  - False positives are flagged as WARN, not ERROR, for patterns that have legitimate uses.
 *  - File-level allowlists are provided for files that have intentionally non-authoritative local policy evaluation.
 *  - Only src/ is scanned (not tests/, scripts/, docs/).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");

// Files explicitly allowed to call evaluatePolicyDecision because their result is
// non-authoritative (simulation/playground only), or because they ARE the policy evaluator.
const POLICY_EVAL_ALLOWLIST = new Set([
  "src/app/api/sdk/policies/evaluate/route.ts",
  "src/app/(protected)/playground/actions.ts",
  "src/lib/aoc/adapters/policy-evaluation.ts",   // the adapter implementation itself
  "src/lib/security/policy-engine.ts",            // legacy shim re-export
]);

// Directory prefixes excluded from local-bypass checks because they ARE the runtime,
// not the application consuming it.
const RUNTIME_EXCLUSION_PREFIXES = [
  "src/lib/governance/authority/runtime/",   // PMFreak governance runtime internals
  "src/lib/governance/authority/",     // PMFreak governance domain and port contracts
];

// Files that may have a try/catch that could hide a fallback allow.
// Each entry is checked for accompanying fail-closed evidence.
const FAIL_CLOSED_REQUIRED_PATTERNS = [
  "src/lib/security/capability-flow.ts",
  "src/lib/security/agent-access.ts",
  "src/lib/security/access-guards.ts",
];

// SDK API routes under src/app/api/sdk/ that handle governance-sensitive data.
// Each must call authorizeRuntimeAction before returning data.
const SDK_GOVERNANCE_ROUTES = [
  "src/app/api/sdk/agents/route.ts",
  "src/app/api/sdk/agents/[id]/route.ts",
  "src/app/api/sdk/agents/scopes/route.ts",
  "src/app/api/sdk/audit/agents/route.ts",
  "src/app/api/sdk/audit/capabilities/route.ts",
  "src/app/api/sdk/audit/resources/route.ts",
  "src/app/api/sdk/audit/timeline/route.ts",
  "src/app/api/sdk/capabilities/grants/route.ts",
  "src/app/api/sdk/capabilities/requests/route.ts",
  "src/app/api/sdk/policies/route.ts",
  "src/app/api/sdk/policies/[id]/route.ts",
];

// ── helpers ───────────────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) results.push(full);
  }
  return results;
}

function rel(full) {
  return path.relative(root, full).replaceAll(path.sep, "/");
}

// ── rule definitions ──────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

function error(file, line, msg) {
  errors.push({ file, line, msg });
}

function warn(file, line, msg) {
  warnings.push({ file, line, msg });
}

// ── scan ──────────────────────────────────────────────────────────────────────

const files = walk(srcDir);

function isRuntimeExcluded(relPath) {
  return RUNTIME_EXCLUSION_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

for (const full of files) {
  const relPath = rel(full);
  const src = fs.readFileSync(full, "utf8");
  const lines = src.split("\n");

  // Skip the runtime package internals — they are the authority, not a consumer.
  if (isRuntimeExcluded(relPath)) continue;

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];

    // Rule 1: evaluatePolicyDecision used outside allowlisted files → likely a local authority bypass.
    if (/evaluatePolicyDecision\(/.test(line) && !POLICY_EVAL_ALLOWLIST.has(relPath)) {
      error(relPath, lineNo, "evaluatePolicyDecision() called outside allowed files. Route local policy results through authorizeRuntimeAction instead.");
    }

    // Rule 2: defaultGovernancePolicyEvaluator used as final authority in non-rbac context.
    if (/defaultGovernancePolicyEvaluator\(/.test(line) && !/rbac\.ts$/.test(relPath)) {
      error(relPath, lineNo, "defaultGovernancePolicyEvaluator() called outside rbac.ts. Local RBAC evaluator must not be used as final authority.");
    }

    // Rule 3: Explicit 'allowed: true' return without a preceding runtime decision reference.
    // This catches hand-rolled local allow returns.
    if (/return\s*\{\s*allowed:\s*true/.test(line)) {
      // Check surrounding context (5 lines back) for runtime decision reference.
      const context = lines.slice(Math.max(0, i - 5), i + 1).join("\n");
      if (!/authorizeRuntimeAction|runtimeDecision|decision\.allowed/.test(context)) {
        warn(relPath, lineNo, "Possible local allow return without runtime decision context. Verify this is not a final authorization decision.");
      }
    }

    // Rule 4: Catch block that RETURNS an allow decision → permissive fallback.
    // Only flag if a return statement with allow value appears inside the catch block body.
    // We detect the catch block body as lines between the catch keyword and the first
    // top-level closing brace (heuristic: look for lines with only "}" at the start).
    if (/catch\s*[\({]/.test(line)) {
      // Collect lines until we find the closing brace of the catch block.
      const catchLines = [];
      let depth = 0;
      for (let j = i; j < Math.min(lines.length, i + 30); j++) {
        const l = lines[j];
        catchLines.push(l);
        for (const ch of l) {
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth === 0 && j > i) break;
      }
      const catchBody = catchLines.join("\n");
      // Only flag if the catch block itself returns/yields an allow — not subsequent code.
      if (/return\s*\{[\s\S]*allowed:\s*true|return\s*\{[\s\S]*decision:\s*["']allow["']/.test(catchBody)) {
        error(relPath, lineNo, "Catch block returns an allow decision — permissive fallback detected. Must fail closed on error.");
      }
    }

    // Rule 5: ROLE_PERMISSION_MAP used outside rbac.ts in a final-decision context.
    if (/ROLE_PERMISSION_MAP/.test(line) && !/rbac\.ts$/.test(relPath)) {
      warn(relPath, lineNo, "ROLE_PERMISSION_MAP referenced outside rbac.ts. Local role map must not substitute for runtime authorization.");
    }

    // Rule 6: Direct grant insert without runtime decision reference nearby.
    if (/from\("capability_grants"\)\.insert/.test(line) || /\.from\("capability_grants"\)[\s\S]{0,20}\.insert/.test(line)) {
      const context = lines.slice(Math.max(0, i - 15), i + 1).join("\n");
      if (!/authorizeRuntimeAction|runtimeDecision|requireWorkspaceRole|requireGovernancePermission/.test(context)) {
        warn(relPath, lineNo, "capability_grants insert without nearby runtime authorization. Verify grant creation is runtime-authorized.");
      }
    }
  }
}

// Verify SDK governance routes each call authorizeRuntimeAction and check decision.allowed.
for (const relPath of SDK_GOVERNANCE_ROUTES) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    warn(relPath, 0, "Expected SDK governance route not found.");
    continue;
  }
  const src = fs.readFileSync(full, "utf8");
  if (!src.includes("authorizeRuntimeAction")) {
    error(relPath, 0, "SDK governance route does not call authorizeRuntimeAction. Runtime must be consulted before returning governance data.");
  } else if (!src.includes("SDK_GOVERNANCE_ACTIONS")) {
    warn(relPath, 0, "SDK governance route calls authorizeRuntimeAction but does not use SDK_GOVERNANCE_ACTIONS constants. Use canonical action mapping.");
  }
  if (!src.includes("decision.allowed")) {
    error(relPath, 0, "SDK governance route does not check decision.allowed. Must gate data access on runtime authorization result.");
  }
  // Must not use requireWorkspaceRole as terminal authority after adding runtime auth.
  if (/requireWorkspaceRole/.test(src)) {
    error(relPath, 0, "SDK governance route still uses requireWorkspaceRole as terminal authority. Replace with authorizeRuntimeAction.");
  }
}

// Verify fail-closed patterns in critical files.
for (const relPath of FAIL_CLOSED_REQUIRED_PATTERNS) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    warn(relPath, 0, "Expected critical file not found.");
    continue;
  }
  const src = fs.readFileSync(full, "utf8");
  if (!src.includes("authorizeRuntimeAction")) {
    error(relPath, 0, "Critical auth file does not call authorizeRuntimeAction. Must delegate to AOC Enterprise Runtime.");
  }
  if (!src.includes("AccessDeniedError") && !src.includes("throw new Error")) {
    warn(relPath, 0, "Critical auth file has no AccessDeniedError throw. Fail-closed behavior may be missing.");
  }
}

// ── report ────────────────────────────────────────────────────────────────────

const totalFiles = files.length;
console.log(`\ncheck-no-local-authority-bypass: scanned ${totalFiles} source files\n`);

if (warnings.length > 0) {
  console.log(`WARNINGS (${warnings.length}):`);
  for (const { file, line, msg } of warnings) {
    console.log(`  WARN  ${file}:${line || "?"}  —  ${msg}`);
  }
  console.log();
}

if (errors.length > 0) {
  console.log(`ERRORS (${errors.length}):`);
  for (const { file, line, msg } of errors) {
    console.log(`  ERROR ${file}:${line || "?"}  —  ${msg}`);
  }
  console.log();
  console.log("check-no-local-authority-bypass: FAILED — local authority bypass patterns detected.");
  process.exit(1);
}

console.log("check-no-local-authority-bypass: PASSED — no forbidden local authority bypass patterns found.");
