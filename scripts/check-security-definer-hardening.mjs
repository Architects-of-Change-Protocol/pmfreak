#!/usr/bin/env node
// ============================================================================
// Static SECURITY DEFINER hardening checker (Perilla 13B / RR-MIGRATE prep,
// PR brief section F.3).
//
// Scans every migration file for `security definer` function definitions
// and verifies, from source alone, that each one:
//   1. pins `set search_path` (prevents search_path hijacking), and
//   2. has an explicit `revoke all on function ... from public` somewhere
//      in the migration corpus (PostgreSQL grants EXECUTE to PUBLIC on
//      every newly created function by default — an un-revoked SECURITY
//      DEFINER function is callable by any role unless revoked).
//
// This is source-only static analysis. It does NOT verify (and cannot
// verify without a live database — see docs/release/hosted-grants-report.md):
//   - that the migration-time grants match the *effective* grants on a
//     real hosted project (a manual `grant`/`revoke` run outside migrations
//     would not be caught here),
//   - "no dynamic SQL from user input" (would require data-flow analysis,
//     not implemented — reviewed by hand in hosted-grants-report.md instead),
//   - "authorization inside function" (semantic, not mechanically checkable).
//
// Usage: npm run check:security-definer-hardening
// ============================================================================

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

function loadMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// Captures `create [or replace] function <name>(<args>) ... $$ ... $$;` —
// the whole definition, from the header through the closing body delimiter.
const FUNCTION_BLOCK_PATTERN = /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(([^)]*)\)[\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSecurityDefinerFunctions(sql, file) {
  const findings = [];
  let match;
  FUNCTION_BLOCK_PATTERN.lastIndex = 0;
  while ((match = FUNCTION_BLOCK_PATTERN.exec(sql)) !== null) {
    const block = match[0];
    if (!/security\s+definer/i.test(block)) continue;
    findings.push({
      file,
      name: match[1],
      hasSearchPath: /set\s+search_path/i.test(block),
      isTrigger: /returns\s+trigger/i.test(block),
    });
  }
  return findings;
}

function hasPublicRevoke(allSql, name) {
  const bareName = name.replace(/^public\./, "");
  const pattern = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+(?:public\\.)?${escapeRegex(bareName)}\\s*\\(`, "i");
  return pattern.test(allSql);
}

function main() {
  const files = loadMigrationFiles();
  const fileContents = new Map(files.map((f) => [f, readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")]));
  const allSql = [...fileContents.values()].join("\n");

  const allFindings = [];
  for (const [file, sql] of fileContents) {
    allFindings.push(...findSecurityDefinerFunctions(sql, file));
  }

  // A function may be `create or replace`d in more than one migration
  // (e.g. a later hardening fix, possibly schema-qualifying a name that
  // was previously bare); normalize to the bare name so re-definitions
  // collapse to one entry, and union hasSearchPath across all definitions.
  const byName = new Map();
  for (const f of allFindings) {
    const bareName = f.name.replace(/^public\./, "");
    const prev = byName.get(bareName);
    byName.set(bareName, {
      hasSearchPath: (prev?.hasSearchPath ?? false) || f.hasSearchPath,
      isTrigger: (prev?.isTrigger ?? false) || f.isTrigger,
      files: [...(prev?.files ?? []), f.file],
    });
  }

  console.log(`SECURITY DEFINER hardening check: ${byName.size} function(s) found across ${files.length} migration files.\n`);

  const problems = [];
  for (const [name, info] of byName) {
    const triggerNote = info.isTrigger ? "  [trigger function — not directly callable, PUBLIC grant is inert]" : "";
    console.log(`  ${name}  (defined in: ${info.files.join(", ")})${triggerNote}`);
    if (!info.hasSearchPath) {
      problems.push(`${name}: missing 'set search_path' in its most recent definition — SECURITY DEFINER function without a pinned search_path`);
    }
    if (!info.isTrigger && !hasPublicRevoke(allSql, name)) {
      problems.push(`${name}: no 'revoke all on function ... from public' found anywhere in supabase/migrations/ — relies on PostgreSQL's default PUBLIC execute grant`);
    }
  }

  if (problems.length > 0) {
    console.error(`\nFAIL: ${problems.length} problem(s):`);
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exitCode = 1;
  } else {
    console.log("\nPASS: every SECURITY DEFINER function has a pinned search_path and an explicit PUBLIC execute revocation (static, source-only check).");
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();

export { findSecurityDefinerFunctions, hasPublicRevoke, loadMigrationFiles };
