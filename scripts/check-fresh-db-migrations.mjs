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
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const ROLES_FILE = path.join(ROOT, "supabase/roles.sql");
const REPORT_DIR = path.join(ROOT, ".fresh-db-migration-logs");

const KNOWN_PRODUCTION_HOST_FRAGMENTS = ["prod", "production", "pilot"];

// ─── Hosted target identity: the PROJECT REF is the authority ──────────────
//
// Ref equality alone is not a safeguard. Setting BOTH `SUPABASE_PROJECT_REF` and
// `FRESH_DB_EXPECTED_PROJECT_REF` to the live project satisfies the match check,
// and the production-fragment heuristic does not fire on either real ref (neither
// contains "prod", "production" or "pilot") — so name- and URL-shaped signals
// cannot be relied on here. The destructive hosted fresh-apply is therefore pinned
// to ONE explicitly designated disposable project and denied against the live one.
const HOSTED_ALLOWED_MIGRATION_VALIDATION_REF = "ecwkldflddnmdwusatuh"; // pmfreak-migration-validation
const HOSTED_DENIED_ACTIVE_PMFREAK_REF = "refvllnadfzjkxlpidrr"; // PMFreak (ACTIVE_HEALTHY) — never a target

function redact(value) {
  if (!value) return "(unset)";
  return value.replace(/:\/\/[^@]+@/, "://[redacted]@").replace(/\/\/.*/, (m) => (m.length > 24 ? `${m.slice(0, 16)}...[redacted]` : m));
}

function sh(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return result;
}

// ─── Portable `npx` invocation ─────────────────────────────────────────────
//
// HARNESS DEFECT (Windows). `spawnSync("npx", [...])` fails with
//   status=null, error.code=ENOENT, error.message="spawnSync npx ENOENT"
// because on Windows `npx` is `npx.cmd` — a batch script, not an executable
// image — and CreateProcess cannot launch it. The first real hosted attempt
// therefore died BEFORE `supabase link`, leaving the hosted database untouched.
//
// The fix is deliberately narrow:
//   * `shell: true` is NOT enabled globally. That would re-parse every argument
//     of every command through a shell.
//   * `sh()` is left alone. It is shared with `psql` (a real executable image),
//     and its execution semantics must not change.
// Only npx-launched commands route through the interpreter, and only on
// Windows: ComSpec with `/d /s /c` (skip AutoRun, strict quote handling).
const WINDOWS_CMD_METACHARACTERS = /[&|<>^"%\r\n]/;

function runNpx(args, opts = {}) {
  if (process.platform !== "win32") return sh("npx", args, opts);

  // Routing through cmd.exe means the interpreter, not CreateProcess, splits
  // the command line. Every argument here is harness-controlled except the
  // project ref, which arrives from the environment — refuse anything carrying
  // cmd metacharacters rather than let it become a second command.
  const unsafe = args.find((arg) => WINDOWS_CMD_METACHARACTERS.test(String(arg)));
  if (unsafe !== undefined) {
    return {
      status: null,
      stdout: "",
      stderr: "",
      error: Object.assign(new Error("refusing to pass an argument containing cmd.exe metacharacters to npx"), {
        code: "ERR_UNSAFE_NPX_ARGUMENT",
      }),
    };
  }

  return sh(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npx", ...args], opts);
}

// ─── Child-process failure diagnostics ─────────────────────────────────────
//
// A launch failure sets `result.error` and leaves `result.status === null` and
// `result.stderr === undefined`. The harness printed that stderr directly, so a
// hard ENOENT rendered as a blank line and read like "the command ran and said
// nothing". Launch failures and non-zero exits are now reported as distinct
// kinds, and a failure can never render an empty diagnostic again.

function scrubSecrets(text) {
  let out = String(text ?? "");
  const secrets = [
    process.env.SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_DB_URL,
    process.env.FRESH_DB_URL,
    process.env.SUPABASE_DB_PASSWORD,
    process.env.POSTGRES_PASSWORD,
  ].filter((value) => typeof value === "string" && value.length >= 8);
  for (const secret of secrets) out = out.split(secret).join("[redacted]");
  // Any surviving postgres URL credentials, whatever their source.
  return out.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@");
}

function describeSpawnResult(result, command) {
  const stderr = scrubSecrets(result?.stderr ?? "").trim();
  if (result?.error) {
    return {
      kind: "PROCESS_SPAWN_FAILURE",
      command,
      status: result.status ?? null,
      spawnErrorCode: result.error.code ?? null,
      spawnErrorMessage: scrubSecrets(result.error.message ?? String(result.error)),
      stderr,
    };
  }
  return {
    kind: "COMMAND_EXIT_NONZERO",
    command,
    status: result?.status ?? null,
    spawnErrorCode: null,
    spawnErrorMessage: null,
    stderr,
  };
}

function formatFailure(failure) {
  if (!failure) return "  FAILURE_KIND=UNKNOWN (no diagnostic captured)";
  const lines = [
    `  FAILURE_KIND=${failure.kind}`,
    `  COMMAND=${failure.command}`,
    `  EXIT_STATUS=${failure.status === null ? "null" : failure.status}`,
  ];
  if (failure.kind === "PROCESS_SPAWN_FAILURE") {
    lines.push(`  SPAWN_ERROR_CODE=${failure.spawnErrorCode ?? "(none)"}`);
    lines.push(`  SPAWN_ERROR_MESSAGE=${failure.spawnErrorMessage || "(none)"}`);
    if (failure.spawnErrorCode === "ENOENT") {
      lines.push("  HINT=the command could not be launched at all (not found, or not an executable image on this platform)");
    }
  }
  lines.push(`  STDERR=${failure.stderr ? failure.stderr.slice(0, 2000) : "(empty)"}`);
  return lines.join("\n");
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
    const actual = (process.env.SUPABASE_PROJECT_REF ?? "").trim();
    const expected = (process.env.FRESH_DB_EXPECTED_PROJECT_REF ?? "").trim();

    if (!actual) {
      return fail("SUPABASE_PROJECT_REF is required in hosted mode. Refusing to run.");
    }
    if (!expected) {
      return fail("FRESH_DB_EXPECTED_PROJECT_REF is required in hosted mode and must exactly match SUPABASE_PROJECT_REF.");
    }
    if (expected !== actual) {
      return fail(`FRESH_DB_EXPECTED_PROJECT_REF (${expected}) does not match SUPABASE_PROJECT_REF (${redact(actual)}). Refusing to run.`);
    }

    // Explicit denial of the live project, checked BEFORE the allowlist so the
    // refusal names the real hazard rather than a generic "not the target" message.
    if (actual === HOSTED_DENIED_ACTIVE_PMFREAK_REF || expected === HOSTED_DENIED_ACTIVE_PMFREAK_REF) {
      return fail(
        "Refusing to run: the target is the ACTIVE PMFreak project. The destructive hosted fresh-apply " +
          "must never run against it, regardless of matching refs or explicit confirmation.",
      );
    }

    // Positive allowlist: exactly one designated disposable validation project.
    if (actual !== HOSTED_ALLOWED_MIGRATION_VALIDATION_REF) {
      return fail(
        `Refusing to run: SUPABASE_PROJECT_REF (${redact(actual)}) is not the designated disposable ` +
          "migration-validation project. The destructive hosted fresh-apply is pinned to one explicitly " +
          "designated non-production project; the project ref is the authority, not the project name.",
      );
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

  const roles = sh("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", ROLES_FILE]);
  if (roles.status !== 0) {
    return {
      ok: false,
      failedFile: "supabase/roles.sql",
      failure: describeSpawnResult(roles, "psql -f supabase/roles.sql"),
      stderr: roles.stderr,
      applied: 0,
    };
  }

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    const result = sh("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", full]);
    if (result.status !== 0) {
      return {
        ok: false,
        failedFile: file,
        failure: describeSpawnResult(result, `psql -f ${file}`),
        stderr: result.stderr,
        applied: files.indexOf(file),
      };
    }
  }
  return { ok: true, applied: files.length };
}

function applyHosted() {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  console.log(`[apply:hosted] project ref: ${redact(projectRef)}`);

  const link = runNpx(["-y", "supabase", "link", "--project-ref", projectRef], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (link.status !== 0) {
    return { ok: false, failedFile: "(supabase link)", failure: describeSpawnResult(link, "npx supabase link"), stderr: link.stderr };
  }

  const push = runNpx(["-y", "supabase", "db", "push", "--include-roles"], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (push.status !== 0) {
    return {
      ok: false,
      failedFile: "(supabase db push)",
      failure: describeSpawnResult(push, "npx supabase db push --include-roles"),
      stderr: push.stderr,
    };
  }

  return { ok: true };
}

// ─── Step 3b: hosted repeatability verification ────────────────────────────
//
// After a hosted apply, `supabase migration list --linked` prints a table
// comparing the local migration history against what the linked project has
// actually recorded. Two cell renderings are in the wild and BOTH must parse:
//
//   plain (older CLI):
//     Local          | Remote         | Time (UTC)
//    ----------------|----------------|---------------------
//     20260428120000 | 20260428120000 | 2026-04-28 12:00:00
//     20260501000000 |                | 2026-05-01 00:00:00
//
//   backtick-wrapped (current CLI):
//     Local          | Remote         | Time (UTC)
//    ----------------|----------------|---------------------
//     `20260428120000` | `20260428120000` | 2026-04-28 12:00:00
//     `20260501000000` |                  | 2026-05-01 00:00:00
//
// A row with a populated Local column and an empty Remote column is a local
// migration the linked project never recorded (remote-pending — the apply
// didn't fully take, or drifted). A row with a populated Remote column and
// an empty Local column is a migration the project has recorded that no
// local file explains (remote-unexpected — manual/out-of-band drift). The
// Local and Remote columns are read independently: a timestamp on one side
// is never inferred from the other.
//
// parseHostedMigrationList() is a pure function so it can be unit-tested
// against synthetic CLI output. Its row shape has been verified against real
// `supabase migration list --linked` stdout from the linked validation
// project (see docs/release/hosted-supabase-migration-proof.md); the
// backtick form is what that CLI actually emits, and the earlier
// plain-digits-only regex silently matched zero rows against it, reporting
// every local migration as remote-pending.

// A migration cell is either empty, a bare 14-digit timestamp, or the same
// timestamp wrapped in backticks. Anything else means the line is not a
// migration row (header, separator, log noise, truncated digits).
const MIGRATION_CELL_PATTERN = /^\s*(?:`(\d{14})`|(\d{14}))\s*$/;

// null      -> cell is present but empty (the pending / unexpected side)
// string    -> the timestamp the cell carries
// undefined -> not a migration cell at all; the whole line must be ignored
function parseMigrationCell(cell) {
  if (cell.trim() === "") return null;
  const match = MIGRATION_CELL_PATTERN.exec(cell);
  if (!match) return undefined;
  return match[1] ?? match[2];
}

function parseHostedMigrationList(output, localTimestamps) {
  // Grab the first two pipe-delimited cells of every line, then validate
  // them. Validating cells (rather than baking the timestamp shape into the
  // line regex) is what keeps headers, `---|---|---` separators and stray
  // CLI chatter out of the row set while still accepting both cell forms.
  const linePattern = /^([^|\n]*)\|([^|\n]*)\|/gm;
  const rows = [];
  let match;
  while ((match = linePattern.exec(output)) !== null) {
    const local = parseMigrationCell(match[1]);
    const remote = parseMigrationCell(match[2]);
    if (local === undefined || remote === undefined) continue; // not a row
    if (local === null && remote === null) continue; // blank filler line
    rows.push({ local, remote });
  }

  const remoteSet = new Set(rows.map((r) => r.remote).filter(Boolean));
  const remoteOnly = [...new Set(rows.filter((r) => r.remote && !r.local).map((r) => r.remote))];
  const pendingLocal = localTimestamps.filter((ts) => !remoteSet.has(ts));
  const matchedRows = rows.filter((r) => r.local && r.remote && r.local === r.remote).length;

  return { rows, pendingLocal, unexpectedRemote: remoteOnly, matchedCount: remoteSet.size, matchedRows };
}

function verifyHostedRepeatability(files) {
  const list = runNpx(["-y", "supabase", "migration", "list", "--linked"], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (list.status !== 0) {
    return {
      ok: false,
      reason: "`supabase migration list --linked` failed",
      failure: describeSpawnResult(list, "npx supabase migration list --linked"),
      stderr: list.stderr,
    };
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
  if (result.status !== 0) return { ok: false, failure: describeSpawnResult(result, "psql (schema smoke)"), stderr: result.stderr };
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
    console.error(formatFailure(applyResult.failure));
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
      console.error(formatFailure(smoke.failure));
      process.exitCode = 1;
    }
  } else {
    results.push(["Schema contracts", "MANUAL (run docs/release/database-bootstrap-runbook.md §5 against the linked project)"]);

    const repeatability = verifyHostedRepeatability(files);
    results.push(["Repeatability (remote state)", repeatability.ok ? "PASS" : "FAIL"]);
    if (!repeatability.ok) {
      console.error(`  ${repeatability.reason}`);
      if (repeatability.failure) console.error(formatFailure(repeatability.failure));
      process.exitCode = 1;
    } else {
      console.log(`  Matched local+remote migration rows: ${repeatability.matchedCount}`);
    }
  }

  results.push(["Decision", process.exitCode ? "FAIL — see above" : "PASS"]);
  printAndWriteReport(results.map(([k, v]) => `${k.padEnd(26, ".")} ${v}`));
}

// Main-module detection must compare resolved filesystem paths, not a hand-built
// file:// string. On Windows `process.argv[1]` is `C:\...\script.mjs` while
// `import.meta.url` is `file:///C:/.../script.mjs`, so the string comparison was
// always false and `main()` never ran — a silent EXIT=0 with no output.
// Importing the module (tests) must still NOT execute the destructive harness.
const isMainModule = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMainModule) main();

export {
  determineMode,
  safetyGuard,
  checkInventoryAndOrdering,
  redact,
  parseHostedMigrationList,
  verifyHostedRepeatability,
  runNpx,
  scrubSecrets,
  describeSpawnResult,
  formatFailure,
  KNOWN_PRODUCTION_HOST_FRAGMENTS,
  HOSTED_ALLOWED_MIGRATION_VALIDATION_REF,
  HOSTED_DENIED_ACTIVE_PMFREAK_REF,
  loadMigrationFiles,
  main,
};
