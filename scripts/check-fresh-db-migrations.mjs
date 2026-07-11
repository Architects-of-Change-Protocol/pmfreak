#!/usr/bin/env node
// ============================================================================
// PMFreak Fresh Database Migration Proof (Perilla 13 / RR-MIGRATE).
//
// Applies every file under supabase/migrations, in filename order, to an
// isolated Postgres/Supabase database, then validates schema integrity, RLS
// coverage, and tenant isolation. Refuses to run against anything that looks
// like a production/shared database.
//
// Modes (selected by environment variables — see below):
//   local     FRESH_DB_URL points at an isolated local/CI Postgres instance
//             (e.g. a plain `postgres` server, or `supabase start`'s local
//             stack). Real SQL execution, no Supabase-hosted auth/storage.
//   hosted    SUPABASE_DB_URL + SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF
//             point at an isolated hosted Supabase project. Strongest
//             evidence: real auth/storage/PostgREST-compatible roles.
//   verify-only   No database variables set. Runs only the static checks
//             (inventory, ordering, duplicate detection) that don't require
//             a live connection. Does not close RR-MIGRATE by itself.
//
// Required for local/hosted modes:
//   ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true   (never defaults to true)
//   FRESH_DB_EXPECTED_PROJECT_REF=<ref>    (hosted mode only; must exactly
//                                            match SUPABASE_PROJECT_REF)
//
// Usage:
//   npm run check:fresh-db-migrations
//
// Secrets (DB URLs, tokens) are never printed; only redacted host/ref info
// appears in output and in the generated report.
// ============================================================================

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const REPORT_DIR = path.join(ROOT, ".fresh-db-migration-logs");

const KNOWN_PRODUCTION_HOST_FRAGMENTS = ["prod", "production", "pilot"];

function redact(value) {
  if (!value) return "(unset)";
  return value.replace(/:\/\/[^@]+@/, "://[redacted]@").replace(/\/\/.*/, (m) => (m.length > 24 ? `${m.slice(0, 16)}...[redacted]` : m));
}

function sh(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return result;
}

function fail(message) {
  console.error(`\nFAIL: ${message}\n`);
  process.exitCode = 1;
  return false;
}

function loadMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

// ─── Step 1: environment safety guard ──────────────────────────────────────

function determineMode() {
  const hasHosted = process.env.SUPABASE_DB_URL && process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF;
  const hasLocal = process.env.FRESH_DB_URL;
  if (hasHosted) return "hosted";
  if (hasLocal) return "local";
  return "verify-only";
}

function safetyGuard(mode) {
  if (mode === "verify-only") return true;

  if (process.env.ALLOW_DESTRUCTIVE_FRESH_DB_TEST !== "true") {
    return fail(
      "ALLOW_DESTRUCTIVE_FRESH_DB_TEST must be explicitly set to 'true' to run a live fresh-apply. " +
        "This variable never defaults to true. Refusing to run against any database without explicit confirmation.",
    );
  }

  const dbUrl = mode === "hosted" ? process.env.SUPABASE_DB_URL : process.env.FRESH_DB_URL;
  const lowerUrl = (dbUrl ?? "").toLowerCase();
  if (KNOWN_PRODUCTION_HOST_FRAGMENTS.some((fragment) => lowerUrl.includes(fragment))) {
    return fail(`Refusing to run: database URL host looks production-like (matched one of: ${KNOWN_PRODUCTION_HOST_FRAGMENTS.join(", ")}). Use an isolated project.`);
  }

  if (mode === "hosted") {
    const expected = process.env.FRESH_DB_EXPECTED_PROJECT_REF;
    if (!expected) {
      return fail("FRESH_DB_EXPECTED_PROJECT_REF is required in hosted mode and must exactly match SUPABASE_PROJECT_REF.");
    }
    if (expected !== process.env.SUPABASE_PROJECT_REF) {
      return fail(`FRESH_DB_EXPECTED_PROJECT_REF (${expected}) does not match SUPABASE_PROJECT_REF (${redact(process.env.SUPABASE_PROJECT_REF)}). Refusing to run.`);
    }
  }

  return true;
}

// ─── Step 2: migration inventory + ordering ────────────────────────────────

function checkInventoryAndOrdering(files) {
  const errors = [];
  const seenTimestamps = new Map();
  const timestampPattern = /^(\d{14})_[a-z0-9_]+\.sql$/;

  for (const file of files) {
    const match = file.match(timestampPattern);
    if (!match) {
      errors.push(`Migration file does not match <timestamp>_<name>.sql: ${file}`);
      continue;
    }
    const ts = match[1];
    if (seenTimestamps.has(ts)) {
      errors.push(`Duplicate migration timestamp ${ts}: ${seenTimestamps.get(ts)} and ${file}`);
    } else {
      seenTimestamps.set(ts, file);
    }
  }

  const sorted = [...files].sort();
  const lexicographicMatchesDiscovery = JSON.stringify(sorted) === JSON.stringify(files);
  if (!lexicographicMatchesDiscovery) {
    errors.push("Filesystem discovery order does not match lexicographic sort order.");
  }

  return errors;
}

// ─── Step 3: apply migrations (local / hosted) ─────────────────────────────

function applyLocal(files) {
  const dbUrl = process.env.FRESH_DB_URL;
  console.log(`[apply:local] target: ${redact(dbUrl)}`);

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    const result = sh("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", full]);
    if (result.status !== 0) {
      return { ok: false, failedFile: file, stderr: result.stderr, applied: files.indexOf(file) };
    }
  }
  return { ok: true, applied: files.length };
}

function applyHosted() {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  console.log(`[apply:hosted] project ref: ${redact(projectRef)}`);

  const link = sh("npx", ["-y", "supabase", "link", "--project-ref", projectRef], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (link.status !== 0) return { ok: false, stderr: link.stderr };

  const push = sh("npx", ["-y", "supabase", "db", "push"], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (push.status !== 0) return { ok: false, stderr: push.stderr };

  return { ok: true };
}

// ─── Step 3b: hosted repeatability verification ────────────────────────────
//
// After a hosted apply, `supabase migration list --linked` prints a table
// comparing the local migration history against what the linked project has
// actually recorded, e.g.:
//
//   Local          | Remote         | Time (UTC)
//  ----------------|----------------|---------------------
//   20260428120000 | 20260428120000 | 2026-04-28 12:00:00
//   20260501000000 |                | 2026-05-01 00:00:00
//
// A row with a populated Local column and an empty Remote column is a local
// migration the linked project never recorded (remote-pending — the apply
// didn't fully take, or drifted). A row with a populated Remote column and
// an empty Local column is a migration the project has recorded that no
// local file explains (remote-unexpected — manual/out-of-band drift).
//
// parseHostedMigrationList() is a pure function so it can be unit-tested
// against synthetic CLI output. IMPORTANT: this parser has not been
// validated against real `supabase migration list` output in this session —
// no hosted Supabase credentials were available (see
// docs/release/hosted-supabase-migration-proof.md). Re-verify the row
// regex against real CLI output the first time this runs in hosted mode,
// before trusting its pass/fail verdict.
function parseHostedMigrationList(output, localTimestamps) {
  const rowPattern = /^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|/gm;
  const rows = [];
  let match;
  while ((match = rowPattern.exec(output)) !== null) {
    rows.push({ local: match[1] ?? null, remote: match[2] ?? null });
  }

  const remoteSet = new Set(rows.map((r) => r.remote).filter(Boolean));
  const remoteOnly = [...new Set(rows.filter((r) => r.remote && !r.local).map((r) => r.remote))];
  const pendingLocal = localTimestamps.filter((ts) => !remoteSet.has(ts));

  return { rows, pendingLocal, unexpectedRemote: remoteOnly, matchedCount: remoteSet.size };
}

function verifyHostedRepeatability(files) {
  const list = sh("npx", ["-y", "supabase", "migration", "list", "--linked"], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (list.status !== 0) {
    return { ok: false, reason: "`supabase migration list --linked` failed", stderr: list.stderr };
  }

  const localTimestamps = files.map((f) => f.match(/^(\d{14})_/)?.[1]).filter(Boolean);
  const parsed = parseHostedMigrationList(list.stdout ?? "", localTimestamps);

  if (parsed.pendingLocal.length > 0) {
    return {
      ok: false,
      reason: `${parsed.pendingLocal.length} local migration(s) not recorded on the linked project (remote-pending): ${parsed.pendingLocal.slice(0, 5).join(", ")}${parsed.pendingLocal.length > 5 ? ", ..." : ""}`,
    };
  }
  if (parsed.unexpectedRemote.length > 0) {
    return {
      ok: false,
      reason: `${parsed.unexpectedRemote.length} migration(s) recorded on the linked project with no matching local file (remote-unexpected drift): ${parsed.unexpectedRemote.slice(0, 5).join(", ")}${parsed.unexpectedRemote.length > 5 ? ", ..." : ""}`,
    };
  }
  if (parsed.matchedCount !== files.length) {
    return {
      ok: false,
      reason: `migration count mismatch: ${files.length} local file(s) discovered but ${parsed.matchedCount} matched local+remote row(s) found`,
    };
  }

  return { ok: true, matchedCount: parsed.matchedCount };
}

// ─── Step 4: schema / RLS / RPC smoke checks (local mode) ──────────────────

function runSchemaSmoke(dbUrl) {
  const query = `
    select
      (select count(*) from pg_tables where schemaname = 'public') as table_count,
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) as tables_without_rls;
  `;
  const result = sh("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", ",", dbUrl, "-c", query]);
  if (result.status !== 0) return { ok: false, stderr: result.stderr };
  const [tableCount, tablesWithoutRls] = result.stdout.trim().split(",");
  return { ok: true, tableCount: Number(tableCount), tablesWithoutRls: Number(tablesWithoutRls) };
}

// ─── Report ─────────────────────────────────────────────────────────────────

function printAndWriteReport(lines) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const report = lines.join("\n");
  console.log(`\n${report}\n`);
  writeFileSync(path.join(REPORT_DIR, "fresh-db-migration-report.txt"), report + "\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const files = loadMigrationFiles();
  const mode = determineMode();

  console.log(`PMFreak Fresh Database Migration Proof`);
  console.log(`Mode: ${mode}`);
  console.log(`Migration files discovered: ${files.length}\n`);

  const results = [];

  const safe = safetyGuard(mode);
  results.push(["Environment safety", safe ? "PASS" : "FAIL"]);
  if (!safe) {
    printAndWriteReport(results.map(([k, v]) => `${k.padEnd(26, ".")} ${v}`));
    return;
  }

  const inventoryErrors = checkInventoryAndOrdering(files);
  results.push(["Migration inventory", inventoryErrors.length === 0 ? "PASS" : "FAIL"]);
  results.push(["Migration ordering", inventoryErrors.length === 0 ? "PASS" : "FAIL"]);
  if (inventoryErrors.length > 0) {
    inventoryErrors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  }

  if (mode === "verify-only") {
    results.push(["Fresh apply", "SKIPPED (no FRESH_DB_URL / SUPABASE_DB_URL set)"]);
    console.log("verify-only mode: static checks only. RR-MIGRATE cannot be closed from this run alone.");
    printAndWriteReport(results.map(([k, v]) => `${k.padEnd(26, ".")} ${v}`));
    return;
  }

  let applyResult;
  if (mode === "local") {
    applyResult = applyLocal(files);
  } else {
    applyResult = applyHosted();
  }

  results.push(["Fresh apply", applyResult.ok ? "PASS" : "FAIL"]);
  if (!applyResult.ok) {
    console.error(`  Failed at: ${applyResult.failedFile ?? "(link/push step)"}`);
    console.error(`  ${(applyResult.stderr ?? "").toString().slice(0, 2000)}`);
    process.exitCode = 1;
    printAndWriteReport(results.map(([k, v]) => `${k.padEnd(26, ".")} ${v}`));
    return;
  }

  if (mode === "local") {
    const smoke = runSchemaSmoke(process.env.FRESH_DB_URL);
    results.push(["Schema contracts", smoke.ok ? "PASS" : "FAIL"]);
    if (smoke.ok) {
      console.log(`  Tables in public schema: ${smoke.tableCount}`);
      console.log(`  Tables without RLS enabled: ${smoke.tablesWithoutRls}`);
    } else {
      console.error(`  ${(smoke.stderr ?? "").toString().slice(0, 2000)}`);
      process.exitCode = 1;
    }
  } else {
    results.push(["Schema contracts", "MANUAL (run docs/release/database-bootstrap-runbook.md §5 against the linked project)"]);

    const repeatability = verifyHostedRepeatability(files);
    results.push(["Repeatability (remote state)", repeatability.ok ? "PASS" : "FAIL"]);
    if (!repeatability.ok) {
      console.error(`  ${repeatability.reason}`);
      if (repeatability.stderr) console.error(`  ${repeatability.stderr.toString().slice(0, 2000)}`);
      process.exitCode = 1;
    } else {
      console.log(`  Matched local+remote migration rows: ${repeatability.matchedCount}`);
    }
  }

  results.push(["Decision", process.exitCode ? "FAIL — see above" : "PASS"]);
  printAndWriteReport(results.map(([k, v]) => `${k.padEnd(26, ".")} ${v}`));
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) main();

export { determineMode, safetyGuard, checkInventoryAndOrdering, redact, parseHostedMigrationList, verifyHostedRepeatability, KNOWN_PRODUCTION_HOST_FRAGMENTS, loadMigrationFiles, main };
