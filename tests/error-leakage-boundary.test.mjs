/**
 * Pilot Gate Sprint 01 — Task 3 (F-07 error-leakage sweep) static
 * regression guard.
 *
 * Scans every API route handler for the leak patterns that were removed in
 * this sprint: raw driver/exception text (`error.message`, `err.message`,
 * `String(err)`, a captured `msg`/`message` variable) returned to the
 * client in a 5xx response body. Server-side logging of the raw error is
 * fine — returning it is not.
 *
 * 4xx branches that return the app's own controlled validation/denial
 * vocabulary are allowed (VALIDATION_ERROR 422s, `code::message`
 * early-access contract, `invalid_*`-prefixed program errors, Supabase
 * auth vocabulary on the login flow).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = path.join(ROOT, "src/app/api");

function collectRouteFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

// A raw error expression, or a captured local carrying one, that must
// never appear in a client-visible 5xx response body.
const RAW_IN_BODY = /(?:message|error):\s*(?:msg\b|message\b|raw\b|(?:error|err)\.message|(?:error|err)\s+instanceof\s+Error\s*\?\s*(?:error|err)\.message|String\((?:error|err)\))/;

/**
 * Extracts each `*.json( <args> )` call with balanced parentheses so a
 * response body is never conflated with surrounding statements.
 */
function extractJsonCalls(src) {
  const calls = [];
  const opener = /(?:NextResponse|Response)\.json\(/g;
  for (const match of src.matchAll(opener)) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      i += 1;
    }
    calls.push({ args: src.slice(match.index + match[0].length, i - 1), index: match.index });
  }
  return calls;
}

test("no API route returns raw error text in a 5xx response body", () => {
  const violations = [];
  for (const file of collectRouteFiles(API_DIR)) {
    const src = readFileSync(file, "utf8");
    for (const call of extractJsonCalls(src)) {
      if (!/status:\s*5\d\d/.test(call.args)) continue;
      if (RAW_IN_BODY.test(call.args)) {
        const line = src.slice(0, call.index).split("\n").length;
        violations.push(`${path.relative(ROOT, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Raw error text returned to clients in 5xx responses (route error.message leakage — F-07):\n  ${violations.join("\n  ")}\n` +
      "Use safeInternalErrorResponse()/safeLegacyErrorResponse() from src/lib/security/safe-route-error.ts instead.",
  );
});

test("no API route returns a caught msg variable on INTERNAL_ERROR", () => {
  const violations = [];
  for (const file of collectRouteFiles(API_DIR)) {
    const src = readFileSync(file, "utf8");
    if (/code:\s*"INTERNAL(?:_ERROR)?",\s*message:\s*(?:msg\b|message\b|`[^`]*\$\{message\})/.test(src)) {
      violations.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(violations, [], `INTERNAL_ERROR responses passing through caught error text:\n  ${violations.join("\n  ")}`);
});
