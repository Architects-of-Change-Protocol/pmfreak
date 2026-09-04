// Behavioral safety-guard and hosted-mode coverage for
// scripts/check-fresh-db-migrations.mjs (Perilla 13B — RR-MIGRATE hosted
// prep). These tests exercise the real script logic (subprocess and direct
// import), not a re-implementation of it. None of them require network
// access or real Supabase credentials — every case here is designed to
// fail closed at the safety-guard step, before any network call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  determineMode,
  safetyGuard,
  parseHostedMigrationList,
  classifyHostedTarget,
  classifyObjectEmptiness,
  classifyObservedTriggers,
  STOCK_PLATFORM_TRIGGER_BASELINE,
  extractSupabaseProjectRefFromDbUrl,
  verifyHostedTargetBinding,
  applyHosted,
  recognizeMigrationListRows,
  classifyManagedSchemaObjects,
  STOCK_MANAGED_OBJECT_BASELINE,
  isRealtimeDailyPartition,
  readHostedMigrationVersions,
  HOSTED_ALLOWED_VALIDATION_REFS,
  redact,
  loadMigrationFiles,
  main,
  runNpx,
  scrubSecrets,
  describeSpawnResult,
  formatFailure,
  KNOWN_PRODUCTION_HOST_FRAGMENTS,
  HOSTED_ALLOWED_MIGRATION_VALIDATION_REF,
  HOSTED_DENIED_ACTIVE_PMFREAK_REF,
} from "../scripts/check-fresh-db-migrations.mjs";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/check-fresh-db-migrations.mjs");

function run(env) {
  return spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env });
}

// ─── Subprocess behavioral tests (no network reached in any case below) ───

test("verify-only mode (no DB vars) passes with exit 0", () => {
  const result = run({ PATH: process.env.PATH });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Mode: verify-only/);
});

test("refuses to run local mode without ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true", () => {
  const result = run({ PATH: process.env.PATH, FRESH_DB_URL: "postgresql://user:pass@localhost:5432/scratch" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ALLOW_DESTRUCTIVE_FRESH_DB_TEST must be explicitly set/);
});

test("rejects a production-looking database host even with destructive confirmation set", () => {
  const result = run({
    PATH: process.env.PATH,
    FRESH_DB_URL: "postgresql://user:pass@my-production-db.example.com:5432/app",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to run: database URL host looks production-like/);
});

test("hosted mode refuses to run without FRESH_DB_EXPECTED_PROJECT_REF", () => {
  const result = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_value",
    SUPABASE_PROJECT_REF: "abcxyz",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /FRESH_DB_EXPECTED_PROJECT_REF is required in hosted mode/);
});

test("hosted mode refuses to run when FRESH_DB_EXPECTED_PROJECT_REF does not match SUPABASE_PROJECT_REF", () => {
  const result = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_value",
    SUPABASE_PROJECT_REF: "abcxyz",
    FRESH_DB_EXPECTED_PROJECT_REF: "different-ref",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match SUPABASE_PROJECT_REF/);
});

test("hosted mode never accepts an empty-string project ref as a match", () => {
  const result = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_value",
    SUPABASE_PROJECT_REF: "",
    FRESH_DB_EXPECTED_PROJECT_REF: "",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
  });
  // Empty SUPABASE_PROJECT_REF means hasHosted is false (falsy check in
  // determineMode), so this falls through to verify-only — it must not be
  // silently treated as a "linked" hosted run.
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Mode: verify-only/);
});

test("rejected runs never print the raw access token or db URL credentials to stdout/stderr", () => {
  const secretToken = "sbp_super_secret_token_value_should_never_appear";
  const secretPassword = "SuperSecretDbPassword123";
  const result = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: `postgresql://postgres:${secretPassword}@db.abcxyz.supabase.co:5432/postgres`,
    SUPABASE_ACCESS_TOKEN: secretToken,
    SUPABASE_PROJECT_REF: "abcxyz",
    FRESH_DB_EXPECTED_PROJECT_REF: "mismatched-ref",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
  });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secretToken));
  assert.doesNotMatch(result.stderr, new RegExp(secretToken));
  assert.doesNotMatch(result.stdout, new RegExp(secretPassword));
  assert.doesNotMatch(result.stderr, new RegExp(secretPassword));
});

// ─── Direct-import unit tests (pure functions, no subprocess needed) ──────

test("determineMode: no DB vars set at all falls to verify-only", () => {
  const saved = { ...process.env };
  delete process.env.SUPABASE_DB_URL;
  delete process.env.SUPABASE_ACCESS_TOKEN;
  delete process.env.SUPABASE_PROJECT_REF;
  delete process.env.FRESH_DB_URL;
  assert.equal(determineMode(), "verify-only");
  process.env = saved;
});

test("determineMode: hosted requires all three of SUPABASE_DB_URL/ACCESS_TOKEN/PROJECT_REF — two of three is not enough", () => {
  const saved = { ...process.env };
  delete process.env.FRESH_DB_URL;
  process.env.SUPABASE_DB_URL = "postgresql://x/y";
  process.env.SUPABASE_ACCESS_TOKEN = "tok";
  delete process.env.SUPABASE_PROJECT_REF;
  assert.equal(determineMode(), "verify-only");
  process.env = saved;
});

test("determineMode: recognizes local mode from FRESH_DB_URL alone", () => {
  const saved = { ...process.env };
  delete process.env.SUPABASE_DB_URL;
  delete process.env.SUPABASE_ACCESS_TOKEN;
  delete process.env.SUPABASE_PROJECT_REF;
  process.env.FRESH_DB_URL = "postgresql://localhost/scratch";
  assert.equal(determineMode(), "local");
  process.env = saved;
});

test("determineMode: recognizes hosted mode only when all three hosted vars are set", () => {
  const saved = { ...process.env };
  delete process.env.FRESH_DB_URL;
  process.env.SUPABASE_DB_URL = "postgresql://db.ref.supabase.co/postgres";
  process.env.SUPABASE_ACCESS_TOKEN = "tok";
  process.env.SUPABASE_PROJECT_REF = "ref";
  assert.equal(determineMode(), "hosted");
  process.env = saved;
});

test("safetyGuard: verify-only mode always passes without requiring any confirmation", () => {
  const savedExitCode = process.exitCode;
  process.exitCode = undefined;
  const saved = { ...process.env };
  delete process.env.ALLOW_DESTRUCTIVE_FRESH_DB_TEST;
  assert.equal(safetyGuard("verify-only"), true);
  assert.equal(process.exitCode, undefined);
  process.env = saved;
  process.exitCode = savedExitCode;
});

test("safetyGuard: KNOWN_PRODUCTION_HOST_FRAGMENTS covers prod/production/pilot", () => {
  assert.deepEqual(KNOWN_PRODUCTION_HOST_FRAGMENTS, ["prod", "production", "pilot"]);
});

test("redact: never returns the raw value for a populated connection string", () => {
  const secret = "postgresql://postgres:hunter2@db.abcxyz.supabase.co:5432/postgres";
  const result = redact(secret);
  assert.notEqual(result, secret);
  assert.doesNotMatch(result, /hunter2/);
});

test("redact: passes through unset values as (unset), never null/undefined text leakage", () => {
  assert.equal(redact(undefined), "(unset)");
  assert.equal(redact(""), "(unset)");
});

// ─── parseHostedMigrationList: CLI-output row parsing controls ────────────
// The Supabase CLI emits migration timestamps either bare or wrapped in
// backticks depending on version. The original parser accepted only the bare
// form, so against real (backtick) CLI output it matched ZERO rows and
// falsely reported every local migration as remote-pending. These controls
// pin both renderings, both drift directions, and the non-row text that must
// never be mistaken for a migration row.

const CLEAN_TABLE = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260428120000 | 20260428120000 | 2026-04-28 12:00:00
   20260501000000 | 20260501000000 | 2026-05-01 00:00:00
`;

const PENDING_LOCAL_TABLE = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260428120000 | 20260428120000 | 2026-04-28 12:00:00
   20260501000000 |                | 2026-05-01 00:00:00
`;

const UNEXPECTED_REMOTE_TABLE = `
   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   20260428120000 | 20260428120000 | 2026-04-28 12:00:00
                  | 20260601000000 | 2026-06-01 00:00:00
`;

// Current CLI shape: every populated cell is wrapped in backticks.
const BACKTICK_CLEAN_TABLE = [
  "Local | Remote | Time (UTC)",
  "----|----|----",
  "`20260428120000` | `20260428120000` | 2026-04-28 12:00:00",
  "`20260501000000` | `20260501000000` | 2026-05-01 00:00:00",
].join("\n");

const BACKTICK_PENDING_LOCAL_TABLE = [
  "Local | Remote | Time (UTC)",
  "----|----|----",
  "`20260428120000` | `20260428120000` | 2026-04-28 12:00:00",
  "`20260501000000` |  | 2026-05-01 00:00:00",
].join("\n");

const BACKTICK_UNEXPECTED_REMOTE_TABLE = [
  "Local | Remote | Time (UTC)",
  "----|----|----",
  "`20260428120000` | `20260428120000` | 2026-04-28 12:00:00",
  " | `20260601000000` | 2026-06-01 00:00:00",
].join("\n");

test("parseHostedMigrationList: clean match reports no pending/unexpected rows", () => {
  const parsed = parseHostedMigrationList(CLEAN_TABLE, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.pendingLocal.length, 0);
  assert.equal(parsed.unexpectedRemote.length, 0);
  assert.equal(parsed.matchedCount, 2);
  assert.equal(parsed.matchedRows, 2);
});

test("parseHostedMigrationList: detects a local migration missing from remote (remote-pending)", () => {
  const parsed = parseHostedMigrationList(PENDING_LOCAL_TABLE, ["20260428120000", "20260501000000"]);
  assert.deepEqual(parsed.pendingLocal, ["20260501000000"]);
});

test("parseHostedMigrationList: detects a remote migration with no matching local file (remote-unexpected drift)", () => {
  const parsed = parseHostedMigrationList(UNEXPECTED_REMOTE_TABLE, ["20260428120000"]);
  assert.deepEqual(parsed.unexpectedRemote, ["20260601000000"]);
});

test("parseHostedMigrationList: migration count mismatch is detectable via matchedCount vs. local file count", () => {
  const parsed = parseHostedMigrationList(CLEAN_TABLE, ["20260428120000", "20260501000000", "20260601000000"]);
  // Third local timestamp has no row at all in this synthetic table, so it
  // surfaces as pendingLocal rather than a silently-accepted match.
  assert.deepEqual(parsed.pendingLocal, ["20260601000000"]);
});

// ── 1. backtick-wrapped matched rows (the regression that caused the false
//       negative: this used to parse to zero rows) ────────────────────────
test("parseHostedMigrationList: backtick-wrapped matched rows parse as local+remote matches", () => {
  const parsed = parseHostedMigrationList(BACKTICK_CLEAN_TABLE, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.rows.length, 2, "backtick-wrapped rows must not be skipped");
  assert.deepEqual(parsed.rows, [
    { local: "20260428120000", remote: "20260428120000" },
    { local: "20260501000000", remote: "20260501000000" },
  ]);
  assert.deepEqual(parsed.pendingLocal, [], "backtick rows must not read as remote-pending");
  assert.deepEqual(parsed.unexpectedRemote, []);
  assert.equal(parsed.matchedCount, 2);
  assert.equal(parsed.matchedRows, 2);
});

// ── 2. plain matched rows still parse (no regression on the older CLI) ────
test("parseHostedMigrationList: plain (un-backticked) matched rows still parse after the backtick fix", () => {
  const parsed = parseHostedMigrationList(CLEAN_TABLE, ["20260428120000", "20260501000000"]);
  assert.deepEqual(parsed.rows, [
    { local: "20260428120000", remote: "20260428120000" },
    { local: "20260501000000", remote: "20260501000000" },
  ]);
  assert.equal(parsed.matchedRows, 2);
});

// ── 3. local-only row with backticks -> remote-pending ────────────────────
test("parseHostedMigrationList: backtick local-only row is still detected as remote-pending", () => {
  const parsed = parseHostedMigrationList(BACKTICK_PENDING_LOCAL_TABLE, [
    "20260428120000",
    "20260501000000",
  ]);
  assert.deepEqual(parsed.pendingLocal, ["20260501000000"]);
  assert.deepEqual(parsed.unexpectedRemote, []);
  assert.equal(parsed.matchedRows, 1);
});

// ── 4. remote-only row with backticks -> remote-unexpected drift ──────────
test("parseHostedMigrationList: backtick remote-only row is still detected as unexpected remote drift", () => {
  const parsed = parseHostedMigrationList(BACKTICK_UNEXPECTED_REMOTE_TABLE, ["20260428120000"]);
  assert.deepEqual(parsed.unexpectedRemote, ["20260601000000"]);
  assert.deepEqual(parsed.pendingLocal, []);
  assert.equal(parsed.matchedRows, 1);
});

// ── 5. mixed whitespace (tabs, wide padding, no padding, CRLF) ────────────
test("parseHostedMigrationList: mixed whitespace and CRLF around both cell forms parses identically", () => {
  const messy =
    "   Local   |   Remote   |  Time (UTC)\r\n" +
    "-----------|------------|------------\r\n" +
    "`20260428120000`|`20260428120000`| 2026-04-28 12:00:00\r\n" +
    "\t`20260501000000`   \t|\t   `20260501000000`\t| 2026-05-01 00:00:00\r\n" +
    "  20260601000000   |   20260601000000   | 2026-06-01 00:00:00\r\n";
  const parsed = parseHostedMigrationList(messy, ["20260428120000", "20260501000000", "20260601000000"]);
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(parsed.pendingLocal, []);
  assert.deepEqual(parsed.unexpectedRemote, []);
  assert.equal(parsed.matchedRows, 3);
});

// ── 6. headers and separators are never counted as rows ───────────────────
test("parseHostedMigrationList: header and separator lines are ignored, not parsed as rows", () => {
  const headerOnly = ["Local | Remote | Time (UTC)", "----------------|----------------|-------------", "", "   |   |   "].join("\n");
  const parsed = parseHostedMigrationList(headerOnly, []);
  assert.deepEqual(parsed.rows, [], "no header/separator/blank line may become a migration row");
  assert.equal(parsed.matchedCount, 0);
  assert.equal(parsed.matchedRows, 0);
});

// ── 7. malformed text is ignored rather than half-parsed ──────────────────
test("parseHostedMigrationList: malformed and noisy lines are ignored, never coerced into rows", () => {
  const noisy = [
    "Connecting to remote database...",
    "WARN: something happened | with a pipe | in it",
    "2026042812 | 20260428120000 | too-few-digits-on-the-left",
    "202604281200001 | 20260428120000 | too-many-digits-on-the-left",
    "`20260428120000 | `20260428120000` | unbalanced-backtick",
    "20260428120000x | 20260428120000 | trailing-junk",
    "`20260501000000` | `20260501000000` | 2026-05-01 00:00:00",
  ].join("\n");
  const parsed = parseHostedMigrationList(noisy, ["20260501000000"]);
  assert.deepEqual(parsed.rows, [{ local: "20260501000000", remote: "20260501000000" }],
    "only the one well-formed row may be parsed out of the noise");
  assert.deepEqual(parsed.pendingLocal, []);
  assert.deepEqual(parsed.unexpectedRemote, []);
});

// ── 8. real current CLI-shaped multi-row fixture ──────────────────────────
// Shaped exactly like observed `supabase migration list --linked` stdout:
// a header, a separator, and backtick-wrapped matched rows, preceded by the
// CLI's "Connecting to remote database..." chatter.
test("parseHostedMigrationList: real current-CLI-shaped multi-row output parses every row as matched", () => {
  const timestamps = Array.from({ length: 12 }, (_, i) =>
    `2026${String(4 + i).padStart(2, "0")}01000000`);
  const body = timestamps
    .map((ts) => `   \`${ts}\` | \`${ts}\` | \`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} 00:00:00\` `)
    .join("\n");
  // Observed verbatim shape: leading blank lines, a padded header, a dashed
  // separator, and every cell — Time included — wrapped in backticks.
  const realShaped = [
    "",
    "  ",
    "   Local            | Remote           | Time (UTC)            ",
    "  ------------------|------------------|-----------------------",
    body,
    "",
  ].join("\n");

  const parsed = parseHostedMigrationList(realShaped, timestamps);
  assert.equal(parsed.rows.length, timestamps.length);
  assert.equal(parsed.matchedRows, timestamps.length);
  assert.equal(parsed.matchedCount, timestamps.length);
  assert.deepEqual(parsed.pendingLocal, []);
  assert.deepEqual(parsed.unexpectedRemote, []);
});

test("parseHostedMigrationList: the parser accepts backtick cells by shape, not by a hardcoded timestamp list", () => {
  const source = readFileSync(SCRIPT, "utf8");
  // Guard against a "fix" that pins the current 161 migration timestamps.
  // Only executable lines count — the doc comment legitimately shows sample
  // CLI rows, which are illustration, not parser input.
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  const hardcoded = code.match(/\b20\d{12}\b/g) ?? [];
  assert.deepEqual(hardcoded, [], "no migration timestamp may be hardcoded into the parser script");
  // The cell grammar must admit both renderings.
  assert.match(source, /`\?\(\\d\{14\}\)`\?|`\(\\d\{14\}\)`/,
    "the cell pattern must explicitly accept backtick-wrapped timestamps");
});

test("hosted apply path invokes the official Supabase CLI via npx, not a hand-rolled HTTP client", () => {
  const source = readFileSync(SCRIPT, "utf8");
  // The three hosted commands now go through an injected `runner` seam so the
  // credential-free suite can exercise the path offline. The seam must DEFAULT to the
  // portable npx helper — the intent of this control is unchanged: the official Supabase
  // CLI, never a hand-rolled HTTP client and never a bare spawn.
  assert.match(source, /function applyHosted\(files = loadMigrationFiles\(\), runner = runNpx\)/,
    "the hosted apply seam does not default to the portable npx helper");
  assert.match(source, /function readHostedMigrationVersions\(localTimestamps, runner = runNpx\)/,
    "the migration-list seam does not default to the portable npx helper");
  assert.match(source, /runner\(\["-y", "supabase", "link", "--project-ref", projectRef\]/);
  assert.ok(source.includes('runner(["-y", "supabase", "db", "push", "--include-roles"]'));
  assert.match(source, /runner\(\["-y", "supabase", "migration", "list", "--linked"\]/);
  // The unportable direct form must not come back at any hosted call site.
  assert.doesNotMatch(source, /sh\("npx", \["-y"/);
  // No hand-rolled HTTP client on the hosted path.
  assert.doesNotMatch(source, /\bfetch\(|require\("https?"\)|from "node:https"/, "the hosted path must not speak HTTP directly");
});


// ─── Main-module detection (harness executability) ────────────────────────
//
// Regression control for a HARNESS DEFECT that produced a silent EXIT=0 with
// no output and no database contact: main-module detection was written as
//   import.meta.url === `file://${process.argv[1]}`
// which is false on Windows (argv[1] is `C:\...\x.mjs`, the URL is
// `file:///C:/.../x.mjs`), so main() was never invoked. The comparison must
// resolve both sides to filesystem paths. Both directions are pinned here:
// direct execution MUST run main(); importing the module MUST NOT.

const BANNER = "PMFreak Fresh Database Migration Proof";

test("direct execution invokes main(): banner, mode and discovered-file count are printed", () => {
  const result = run({ PATH: process.env.PATH });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(BANNER), `expected banner in stdout, got: ${JSON.stringify(result.stdout)}`);
  assert.match(result.stdout, /^Mode: (verify-only|local|hosted)$/m);

  const discovered = result.stdout.match(/^Migration files discovered: (\d+)$/m);
  assert.ok(discovered, "main() must print the discovered migration-file count");
  // Pinned to the real inventory rather than a literal, so the control keeps
  // proving execution as migrations are added.
  assert.equal(Number(discovered[1]), loadMigrationFiles().length);
  assert.ok(Number(discovered[1]) > 0, "a run that discovers zero migrations is not proof of execution");
});

test("main-module detection holds for the Windows argv/URL shapes that broke it", () => {
  // The real Windows values Node produces for the same file. Node resolves
  // argv[1] itself, so the defect cannot be reproduced on POSIX by passing an
  // odd path — it is specifically the backslash/file-URL mismatch below.
  const winArgv = "C:\\Users\\Founder\\pmfreak\\scripts\\check-fresh-db-migrations.mjs";
  const winUrl = "file:///C:/Users/Founder/pmfreak/scripts/check-fresh-db-migrations.mjs";

  // The old expression: `file://${process.argv[1]}` === import.meta.url.
  assert.notEqual(`file://${winArgv}`, winUrl, "the hand-built file:// string never matched on Windows");

  // The shipped expression, evaluated with Windows semantics.
  const fromUrl = fileURLToPath(winUrl, { windows: true });
  assert.equal(path.win32.resolve(winArgv), path.win32.resolve(fromUrl));

  // ...and it still holds for this platform's own values.
  assert.equal(path.resolve(SCRIPT), path.resolve(fileURLToPath(pathToFileURL(SCRIPT).href)));
});

test("module import does NOT invoke main(): importing the harness executes nothing", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "fresh-db-import-"));
  const runner = path.join(dir, "import-only-runner.mjs");
  try {
    // argv[1] is the runner, not the harness — the realistic shape for a test
    // runner or any consumer importing the exported helpers.
    writeFileSync(
      runner,
      `import * as harness from ${JSON.stringify(pathToFileURL(SCRIPT).href)};\n` +
        `console.log("IMPORT_COMPLETED:" + typeof harness.main + ":" + typeof harness.safetyGuard);\n`,
      "utf8",
    );
    const result = spawnSync(process.execPath, [runner], { encoding: "utf8", env: { PATH: process.env.PATH }, cwd: ROOT });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("IMPORT_COMPLETED:function:function"), "import must resolve and expose the helpers");
    assert.ok(!result.stdout.includes(BANNER), "importing the module must not execute main()");
    assert.doesNotMatch(result.stdout, /Migration files discovered:/);
    assert.doesNotMatch(result.stdout + result.stderr, /Fresh apply/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("main-module detection resolves paths instead of building a file:// string", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.ok(source.includes('import { fileURLToPath } from "node:url"'), "must use Node's URL conversion");
  assert.match(source, /path\.resolve\(process\.argv\[1\]\)\s*===\s*path\.resolve\(fileURLToPath\(import\.meta\.url\)\)/);
  // The non-portable construction must not come back.
  assert.doesNotMatch(source, /import\.meta\.url\s*===\s*`file:\/\/\$\{/);
  // main() must stay conditional: importing the module must never be destructive.
  assert.match(source, /if \(isMainModule\) main\(\);/);
  assert.equal(typeof main, "function");
});

// ─── Hosted target identity: denylist + single-project allowlist ──────────

test("hosted mode refuses the ACTIVE PMFreak project ref even with matching refs and destructive confirmation", () => {
  const result = run({
    PATH: process.env.PATH,
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
    SUPABASE_DB_URL: `postgresql://postgres:pw@db.${HOSTED_DENIED_ACTIVE_PMFREAK_REF}.supabase.co:5432/postgres`,
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    SUPABASE_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
    FRESH_DB_EXPECTED_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /ACTIVE PMFreak project/);
  assert.doesNotMatch(result.stdout + result.stderr, /sbp_test_token_not_real/);
});

test("hosted mode REFUSES a matching-but-unallowlisted ref, in-process and offline", () => {
  // Deliberately in-process. The previous version of this control supplied a complete
  // hosted environment that PASSED safetyGuard, so the child immediately ran
  // `npx -y supabase link` — a credential-free suite that could hang on an npx download
  // or make a real hosted request. safetyGuard is a pure exported function; call it.
  const saved = { ...process.env };
  const savedExit = process.exitCode;
  try {
    Object.assign(process.env, {
      ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
      SUPABASE_DB_URL: "postgresql://user:pass@db.someotherprojectref.supabase.co:5432/postgres",
      SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
      SUPABASE_PROJECT_REF: "someotherprojectref",
      FRESH_DB_EXPECTED_PROJECT_REF: "someotherprojectref",
    });
    assert.equal(safetyGuard("hosted"), false, "a matching handshake alone must not authorise a destructive target");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    process.exitCode = savedExit;
  }
});

test("the allowlist is version-controlled source, and the active project is never in it", () => {
  assert.ok(Array.isArray(HOSTED_ALLOWED_VALIDATION_REFS) && HOSTED_ALLOWED_VALIDATION_REFS.length > 0);
  assert.ok(HOSTED_ALLOWED_VALIDATION_REFS.includes(HOSTED_ALLOWED_MIGRATION_VALIDATION_REF));
  assert.ok(!HOSTED_ALLOWED_VALIDATION_REFS.includes(HOSTED_DENIED_ACTIVE_PMFREAK_REF), "the ACTIVE project must never be allowlisted");
});

// ─── Parser fail-closed: a regression must never read as "fresh" ──────────
test("recognizeMigrationListRows: zero recognized rows with local migrations FAILS CLOSED", () => {
  const r = recognizeMigrationListRows([], ["20260428120000", "20260501000000"]);
  assert.equal(r.ok, false, "an unrecognized table must never be treated as an empty remote");
  assert.match(r.reason, /UNRECOGNIZED_OUTPUT/);
});

test("recognizeMigrationListRows: rows that do not account for every local migration FAIL CLOSED", () => {
  const rows = [{ local: "20260428120000", remote: null }];
  const r = recognizeMigrationListRows(rows, ["20260428120000", "20260501000000"]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not account for 1 local migration/);
});

test("recognizeMigrationListRows: a legitimately EMPTY remote is recognized (local rows, empty Remote)", () => {
  const locals = ["20260428120000", "20260501000000"];
  const rows = locals.map((v) => ({ local: v, remote: null }));
  assert.equal(recognizeMigrationListRows(rows, locals).ok, true);
  // ...and only then may it classify as fresh.
  assert.equal(classifyHostedTarget(rows.map((r) => r.remote).filter(Boolean), locals).mode, "fresh");
});

test("readHostedMigrationVersions: an unparseable-but-successful CLI run cannot yield remoteVersions=[]", () => {
  // Injected runner seam: no npx, no network, no CLI.
  const stubbed = () => ({ status: 0, stdout: "Connecting to remote database...\n<unrecognised new format>\n", stderr: "" });
  const out = readHostedMigrationVersions(["20260428120000"], stubbed);
  assert.equal(out.ok, false, "a zero exit with unrecognized output must fail closed");
  assert.match(out.reason, /UNRECOGNIZED_OUTPUT/);
});

test("readHostedMigrationVersions: the real backtick format parses through the injected runner", () => {
  const stubbed = () => ({ status: 0, stdout: "  Local | Remote | Time\n----|----|----\n  `20260428120000` | `20260428120000` | x\n", stderr: "" });
  const out = readHostedMigrationVersions(["20260428120000"], stubbed);
  assert.equal(out.ok, true);
  assert.deepEqual(out.remoteVersions, ["20260428120000"]);
});

// ─── Object emptiness: an empty LEDGER is not an empty DATABASE ───────────
const EMPTY_COUNTS = { user_schemas: 0, user_relations: 0, public_rows: 0, user_functions: 0, user_types: 0, user_policies: 0, user_triggers: 0, user_event_triggers: 0, migration_rows: 0, auth_users: 0, storage_buckets: 0, storage_objects: 0 };

test("classifyObjectEmptiness: a genuinely new project is empty", () => {
  const v = classifyObjectEmptiness(EMPTY_COUNTS);
  assert.equal(v.empty, true);
  assert.deepEqual(v.nonEmpty, []);
});

test("classifyObjectEmptiness: an empty ledger with application state is NOT fresh, and names the category", () => {
  for (const key of ["user_relations", "public_rows", "user_functions", "user_types", "user_policies", "user_triggers", "user_event_triggers", "auth_users", "storage_buckets", "storage_objects", "user_schemas"]) {
    const v = classifyObjectEmptiness({ ...EMPTY_COUNTS, [key]: 3 });
    assert.equal(v.empty, false, `${key} must defeat a fresh-apply certification`);
    assert.equal(v.nonEmpty[0].category, key, "the refusal must name the non-empty category");
    assert.match(v.reason, /NOT application-empty/);
  }
});

test("classifyObjectEmptiness: normal Supabase platform state alone does not make a new project non-fresh", () => {
  // The probe counts only non-platform schemas, so a stock project reports all zeros.
  assert.equal(classifyObjectEmptiness(EMPTY_COUNTS).empty, true);
});

test("the emptiness probe SQL excludes platform schemas and never mutates", () => {
  const source = readFileSync(SCRIPT, "utf8");
  // Bounded on BOTH ends, and it slices the harness (a different file), so it cannot
  // match its own assertions. The predicate constant sits just above the probe function.
  const start = source.indexOf("const PLATFORM_SCHEMA_PREDICATE");
  const end = source.indexOf("// Reads the linked project's migration history");
  assert.ok(start > 0 && end > start, "the emptiness probe region could not be located");
  const fn = source.slice(start, end);
  for (const schema of ["auth", "storage", "realtime", "extensions", "graphql", "vault", "supabase_migrations"]) {
    assert.ok(fn.includes(`'${schema}'`), `the platform predicate does not exclude ${schema}`);
  }
  assert.doesNotMatch(fn, /\b(insert|update|delete|drop|truncate|alter)\b/i, "the emptiness probe is not read-only");
});

test("SUPERSEDED shape check: the rotated-ref control no longer spawns a child process", () => {
  const suite = readFileSync(new URL(import.meta.url), "utf8");
  const control = suite.slice(suite.indexOf('test("hosted mode REFUSES a matching-but-unallowlisted ref'));
  const body = control.slice(0, control.indexOf("\n});"));
  assert.doesNotMatch(body, /\brun\(/, "the offline control must not spawn the harness as a child process");
});



test("hosted mode precheck accepts the designated migration-validation ref (guard only, no apply)", () => {
  // Deliberately in-process: calling safetyGuard directly proves the precheck
  // verdict without ever reaching the destructive `supabase db push` path.
  const savedEnv = { ...process.env };
  const savedExitCode = process.exitCode;
  try {
    process.env.ALLOW_DESTRUCTIVE_FRESH_DB_TEST = "true";
    process.env.SUPABASE_DB_URL = `postgresql://postgres:pw@db.${HOSTED_ALLOWED_MIGRATION_VALIDATION_REF}.supabase.co:5432/postgres`;
    process.env.SUPABASE_ACCESS_TOKEN = "sbp_test_token_not_real";
    process.env.SUPABASE_PROJECT_REF = HOSTED_ALLOWED_MIGRATION_VALIDATION_REF;
    process.env.FRESH_DB_EXPECTED_PROJECT_REF = HOSTED_ALLOWED_MIGRATION_VALIDATION_REF;
    process.exitCode = undefined;
    assert.equal(determineMode(), "hosted");
    assert.equal(safetyGuard("hosted"), true);
    assert.equal(process.exitCode, undefined, "an accepted precheck must not set a failing exit code");
  } finally {
    process.env = savedEnv;
    process.exitCode = savedExitCode;
  }
});

test("the two hosted refs are distinct and neither is empty", () => {
  assert.equal(HOSTED_ALLOWED_MIGRATION_VALIDATION_REF, "ecwkldflddnmdwusatuh");
  assert.equal(HOSTED_DENIED_ACTIVE_PMFREAK_REF, "refvllnadfzjkxlpidrr");
  assert.notEqual(HOSTED_ALLOWED_MIGRATION_VALIDATION_REF, HOSTED_DENIED_ACTIVE_PMFREAK_REF);
});

// ─── Windows npx invocation (harness portability) ─────────────────────────
//
// Regression controls for a HARNESS DEFECT that killed the first real hosted
// attempt BEFORE `supabase link`, leaving the hosted database untouched:
//
//   spawnSync("npx", ["--version"])
//     -> status=null, error.code=ENOENT, error.message="spawnSync npx ENOENT"
//
// On Windows `npx` is `npx.cmd`, a batch script rather than an executable
// image, so CreateProcess cannot launch it. The fix must stay narrow: no
// global `shell: true`, and no change to how `psql` is executed.
//
// NOTE: none of the controls below execute a hosted Supabase command. The only
// npx invocation here is `npx --version`, which is purely local.

test("NPX_VERSION_CONTROL: the portable npx invocation launches and exits 0 on this host", () => {
  const result = runNpx(["--version"]);
  assert.equal(
    result.error,
    undefined,
    `npx failed to launch: code=${result.error?.code} message=${result.error?.message}`,
  );
  assert.equal(result.status, 0, `npx --version exited ${result.status}: ${result.stderr}`);
  assert.match((result.stdout ?? "").trim(), /^\d+\.\d+\.\d+/, "npx must report a version");
});

test("runNpx executes npx directly on POSIX and routes through ComSpec on Windows", () => {
  const source = readFileSync(SCRIPT, "utf8");
  // POSIX: unchanged, direct execution.
  assert.match(source, /if \(process\.platform !== "win32"\) return sh\("npx", args, opts\);/);
  // Windows: the interpreter, taken from ComSpec, with /d /s /c.
  assert.match(source, /process\.env\.ComSpec \|\| "cmd\.exe"/);
  assert.match(source, /\["\/d", "\/s", "\/c", "npx", \.\.\.args\]/);
});

test("the fix stays narrow: no global shell:true, and psql execution is untouched", () => {
  const source = readFileSync(SCRIPT, "utf8");
  // Comment lines are excluded: the harness documents *why* it refuses
  // `shell: true`, and that prose must not trip the control.
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  // `shell: true` would re-parse every argument of every command through a
  // shell — including the psql invocations that carry a DB URL.
  assert.doesNotMatch(code, /shell:\s*true/);
  // psql still goes through the shared helper, unchanged, as a direct exec.
  assert.ok(source.includes('sh("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", full])'));
  assert.ok(source.includes('sh("psql", ["-v", "ON_ERROR_STOP=1", dbUrl, "-f", ROLES_FILE])'));
  assert.match(source, /sh\("psql", \["-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", ",", dbUrl, "-c", query\]\)/);
  // psql must never be routed through runNpx.
  assert.doesNotMatch(source, /runNpx\(\[\s*"psql"/);
});

test("runNpx refuses arguments carrying cmd.exe metacharacters", { skip: process.platform !== "win32" }, () => {
  const result = runNpx(["-y", "supabase", "link", "--project-ref", "abc & calc.exe"]);
  assert.equal(result.status, null);
  assert.equal(result.error?.code, "ERR_UNSAFE_NPX_ARGUMENT");
});

// ─── Child-process error visibility ───────────────────────────────────────
//
// The launch failure above surfaced as an empty line, because the harness
// printed `result.stderr` (undefined on a spawn failure) and nothing else.
// A failure must now always name its kind and can never render empty.

test("describeSpawnResult distinguishes PROCESS_SPAWN_FAILURE from COMMAND_EXIT_NONZERO", () => {
  const enoent = describeSpawnResult(
    {
      status: null,
      stdout: undefined,
      stderr: undefined,
      error: Object.assign(new Error("spawnSync npx ENOENT"), { code: "ENOENT" }),
    },
    "npx supabase link",
  );
  assert.equal(enoent.kind, "PROCESS_SPAWN_FAILURE");
  assert.equal(enoent.status, null);
  assert.equal(enoent.spawnErrorCode, "ENOENT");
  assert.match(enoent.spawnErrorMessage, /spawnSync npx ENOENT/);

  const nonzero = describeSpawnResult({ status: 1, stdout: "", stderr: "supabase: link failed" }, "npx supabase db push");
  assert.equal(nonzero.kind, "COMMAND_EXIT_NONZERO");
  assert.equal(nonzero.status, 1);
  assert.equal(nonzero.spawnErrorCode, null);
  assert.equal(nonzero.spawnErrorMessage, null);
  assert.equal(nonzero.stderr, "supabase: link failed");
});

test("a spawn failure can never render an empty diagnostic again", () => {
  const rendered = formatFailure(
    describeSpawnResult(
      { status: null, stderr: undefined, error: Object.assign(new Error("spawnSync npx ENOENT"), { code: "ENOENT" }) },
      "npx supabase link",
    ),
  );
  assert.match(rendered, /FAILURE_KIND=PROCESS_SPAWN_FAILURE/);
  assert.match(rendered, /COMMAND=npx supabase link/);
  assert.match(rendered, /EXIT_STATUS=null/);
  assert.match(rendered, /SPAWN_ERROR_CODE=ENOENT/);
  assert.match(rendered, /SPAWN_ERROR_MESSAGE=spawnSync npx ENOENT/);
  // The exact shape of the original silent failure: stderr was undefined.
  assert.match(rendered, /STDERR=\(empty\)/);
  assert.ok(rendered.trim().length > 0);

  // A non-zero exit must NOT be dressed up as a spawn failure.
  const exited = formatFailure(describeSpawnResult({ status: 2, stderr: "boom" }, "npx supabase db push"));
  assert.match(exited, /FAILURE_KIND=COMMAND_EXIT_NONZERO/);
  assert.doesNotMatch(exited, /SPAWN_ERROR_CODE=/);
  assert.doesNotMatch(exited, /SPAWN_ERROR_MESSAGE=/);
});

test("failure diagnostics never print the access token, DB URL or database password", () => {
  const token = "sbp_test_token_not_real_0123456789";
  const password = "sup3rs3cretpassword";
  const dbUrl = `postgresql://postgres:${password}@db.example.supabase.co:5432/postgres`;
  const saved = {
    token: process.env.SUPABASE_ACCESS_TOKEN,
    url: process.env.SUPABASE_DB_URL,
    pw: process.env.SUPABASE_DB_PASSWORD,
  };
  process.env.SUPABASE_ACCESS_TOKEN = token;
  process.env.SUPABASE_DB_URL = dbUrl;
  process.env.SUPABASE_DB_PASSWORD = password;
  try {
    const rendered = formatFailure(
      describeSpawnResult(
        { status: 1, stderr: `authentication failed using ${token} against ${dbUrl} (password ${password})` },
        "npx supabase link",
      ),
    );
    assert.doesNotMatch(rendered, new RegExp(token));
    assert.doesNotMatch(rendered, new RegExp(password));
    assert.doesNotMatch(rendered, /db\.example\.supabase\.co:5432/);
    assert.match(rendered, /\[redacted\]/);

    // The scrubber must also catch credentials it was never handed via env.
    const foreign = scrubSecrets("postgresql://someuser:someotherpw@db.other.supabase.co:5432/postgres");
    assert.doesNotMatch(foreign, /someotherpw/);
    assert.match(foreign, /postgresql:\/\/\[redacted\]@/);
  } finally {
    for (const [key, value] of [
      ["SUPABASE_ACCESS_TOKEN", saved.token],
      ["SUPABASE_DB_URL", saved.url],
      ["SUPABASE_DB_PASSWORD", saved.pw],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("main() reports failures through the structured formatter, not a bare stderr line", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.match(source, /console\.error\(formatFailure\(applyResult\.failure\)\);/);
  assert.match(source, /console\.error\(formatFailure\(smoke\.failure\)\);/);
  assert.match(source, /if \(repeatability\.failure\) console\.error\(formatFailure\(repeatability\.failure\)\);/);
  // The old shape printed `result.stderr` directly, which is undefined on a
  // spawn failure and rendered as a blank line.
  assert.doesNotMatch(source, /console\.error\(`  \$\{\(applyResult\.stderr \?\? ""\)/);
});

test("these regression controls execute no hosted Supabase command", () => {
  // Assertion lines are excluded: the source-pinning controls above quote the
  // harness's own hosted command lines as string literals without running them.
  const rawTestSource = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const testSource = rawTestSource
    .split("\n")
    .filter((line) => !line.includes("assert."))
    .join("\n");
  const invocations = [...testSource.matchAll(/runNpx\(\[([^\]]*)\]/g)].map((m) => m[1].trim());
  const distinct = [...new Set(invocations)];
  assert.deepEqual(
    distinct,
    ['"--version"', '"-y", "supabase", "link", "--project-ref", "abc & calc.exe"'],
    `unexpected npx invocation in the regression controls: ${JSON.stringify(distinct)}`,
  );
  // The one supabase-shaped invocation above is the metacharacter refusal
  // control: it is rejected before launch and never reaches the network.
  assert.match(rawTestSource, /ERR_UNSAFE_NPX_ARGUMENT/);
});

// ─── Hosted target classification (fresh vs repeatability vs fail) ────────
// The originally designated validation project now holds the full chain. Re-running
// against it would apply a FUTURE migration as a delta and still report "fresh apply",
// so emptiness — not project identity — is what a fresh-apply certification rests on.
const LOCAL_CHAIN = ["20260428120000", "20260501000000", "20260601000000"];

test("classifyHostedTarget: 1. an EMPTY hosted history may enter fresh-apply mode", () => {
  const c = classifyHostedTarget([], LOCAL_CHAIN);
  assert.equal(c.mode, "fresh");
  assert.equal(c.preApplyRemoteMigrationCount, 0, "fresh apply requires PRE_APPLY_REMOTE_MIGRATION_COUNT=0");
  assert.deepEqual(c.unexpected, []);
});

test("classifyHostedTarget: 2. a COMPLETE existing history is repeatability, never fresh", () => {
  const c = classifyHostedTarget([...LOCAL_CHAIN], LOCAL_CHAIN);
  assert.equal(c.mode, "repeatability", "a fully-migrated target must not be classified as a fresh apply");
  assert.notEqual(c.mode, "fresh");
  assert.equal(c.preApplyRemoteMigrationCount, LOCAL_CHAIN.length);
  // Order must not matter: the CLI does not guarantee sorted output.
  assert.equal(classifyHostedTarget([...LOCAL_CHAIN].reverse(), LOCAL_CHAIN).mode, "repeatability");
});

test("classifyHostedTarget: 3. a PARTIAL existing history cannot be certified as fresh", () => {
  const c = classifyHostedTarget(LOCAL_CHAIN.slice(0, 2), LOCAL_CHAIN);
  assert.equal(c.mode, "fail", "applying only the delta must never be reported as a fresh apply");
  assert.deepEqual(c.missing, ["20260601000000"]);
  assert.match(c.reason, /would NOT be a fresh apply/i);
});

test("classifyHostedTarget: 4. UNEXPECTED remote migrations fail outright", () => {
  const c = classifyHostedTarget([...LOCAL_CHAIN, "20260701000000"], LOCAL_CHAIN);
  assert.equal(c.mode, "fail");
  assert.deepEqual(c.unexpected, ["20260701000000"]);
  // Drift must fail even when every local migration is also present.
  assert.equal(classifyHostedTarget(["20260428120000", "29990101000000"], LOCAL_CHAIN).mode, "fail");
});

test("classifyHostedTarget: the once-designated validation project is no longer fresh-appliable", () => {
  // 161/161 applied: exactly the state that made the old single-ref pin unsafe.
  const chain = Array.from({ length: 161 }, (_, i) => String(20260428120000 + i));
  const c = classifyHostedTarget(chain, chain);
  assert.equal(c.mode, "repeatability");
  assert.notEqual(c.mode, "fresh");
});

test("classifyHostedTarget: rotation — a brand-new empty project is fresh-appliable", () => {
  assert.equal(classifyHostedTarget([], LOCAL_CHAIN).mode, "fresh");
});

// ─── 5-8: the pre-existing safety properties must all survive rotation ────
test("5. expected-ref mismatch still fails after the rotation change", () => {
  const r = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
    SUPABASE_PROJECT_REF: "aaaaaaaaaaaaaaaaaaaa",
    FRESH_DB_EXPECTED_PROJECT_REF: "bbbbbbbbbbbbbbbbbbbb",
  });
  assert.match(r.stdout + r.stderr, /does not match/i, "a ref-handshake mismatch must still refuse");
});

test("6. the ACTIVE PMFreak project is still rejected, even with a matching handshake", () => {
  const r = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
    SUPABASE_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
    FRESH_DB_EXPECTED_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
  });
  assert.match(r.stdout + r.stderr, /ACTIVE PMFreak project/i, "rotation must not open a path to the live project");
});

test("7. destructive confirmation is still required after the rotation change", () => {
  const r = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    SUPABASE_PROJECT_REF: HOSTED_ALLOWED_MIGRATION_VALIDATION_REF,
    FRESH_DB_EXPECTED_PROJECT_REF: HOSTED_ALLOWED_MIGRATION_VALIDATION_REF,
    // ALLOW_DESTRUCTIVE_FRESH_DB_TEST deliberately unset
  });
  assert.match(r.stdout + r.stderr, /ALLOW_DESTRUCTIVE_FRESH_DB_TEST/, "the destructive confirmation gate must still apply");
});

test("8. secret redaction is preserved across the rotation change", () => {
  const r = run({
    PATH: process.env.PATH,
    SUPABASE_DB_URL: "postgresql://user:pass@db.abcxyz.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
    SUPABASE_PROJECT_REF: "cccccccccccccccccccc",
    FRESH_DB_EXPECTED_PROJECT_REF: "dddddddddddddddddddd",
  });
  const out = r.stdout + r.stderr;
  assert.doesNotMatch(out, /sbp_test_token_not_real/, "the access token leaked into harness output");
  assert.doesNotMatch(out, /user:pass@/, "the database URL credentials leaked into harness output");
});

test("a rotated (non-designated) ref is no longer hard-refused by identity alone", () => {
  // Rotation is the point of the change: identity is not the gate, emptiness is.
  const source = readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(source, /is not the designated disposable/, "the single-ref pin still hard-refuses rotation");
  assert.match(source, /PRE_APPLY_REMOTE_MIGRATION_COUNT/, "the emptiness precondition is not reported");
  // The destructive push must be reachable only after classification.
  const applyHostedSrc = source.slice(source.indexOf("function applyHosted"));
  const classifyAt = applyHostedSrc.indexOf("classifyHostedTarget(");
  const pushAt = applyHostedSrc.indexOf('"db", "push"');
  assert.ok(classifyAt > 0 && pushAt > 0 && classifyAt < pushAt, "the destructive push is not gated behind classification");
});

// ─── DB_URL <-> PROJECT_REF binding (offline; no network) ─────────────────
const REF = HOSTED_ALLOWED_MIGRATION_VALIDATION_REF;

test("binding: a matching DIRECT db.<ref>.supabase.co URL is positively identified", () => {
  const r = verifyHostedTargetBinding(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`, REF);
  assert.equal(r.ok, true);
  assert.equal(r.identified, true);
  assert.equal(r.form, "direct");
});

test("binding: a MISMATCHED direct URL is refused even though both ref variables agree", () => {
  const r = verifyHostedTargetBinding("postgresql://postgres:pw@db.aaaaaaaaaaaaaaaaaaaa.supabase.co:5432/postgres", REF);
  assert.equal(r.ok, false);
  assert.equal(r.identified, true, "the ref was extractable; it simply names a different project");
  assert.match(r.reason, /does not match SUPABASE_PROJECT_REF/);
});

test("binding: a matching POOLER URL (postgres.<ref> username) is identified", () => {
  const r = verifyHostedTargetBinding(`postgresql://postgres.${REF}:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres`, REF);
  assert.equal(r.ok, true);
  assert.equal(r.form, "pooler");
});

test("binding: a MISMATCHED pooler URL is refused", () => {
  const r = verifyHostedTargetBinding("postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres", REF);
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not match/);
});

test("binding: an AMBIGUOUS/unrecognized Supabase URL fails closed rather than guessing", () => {
  for (const url of [
    `postgresql://postgres:pw@${REF}.supabase.co:5432/postgres`,          // ref present but not the direct db.<ref> form
    `postgresql://postgres:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres`, // pooler without postgres.<ref>
    `postgresql://postgres:pw@my-${REF}-proxy.example.com:5432/postgres`, // ref as an arbitrary substring
    "postgresql://postgres:pw@db.internal:5432/postgres",
    "not-a-url",
  ]) {
    const r = verifyHostedTargetBinding(url, REF);
    assert.equal(r.ok, false, `refusing to guess: ${url}`);
    assert.equal(r.identified, false, "an unrecognized form must not report a positively identified ref");
  }
});

test("binding: ending in a Supabase domain is never sufficient on its own", () => {
  assert.equal(extractSupabaseProjectRefFromDbUrl("postgresql://postgres:pw@something.supabase.com:5432/postgres").ok, false);
  assert.equal(extractSupabaseProjectRefFromDbUrl("https://db.abc.supabase.co").ok, false, "a non-postgres protocol must be refused");
});

test("binding: the ACTIVE project is still denied by the guard regardless of a well-formed URL", () => {
  const saved = { ...process.env };
  const savedExit = process.exitCode;
  try {
    Object.assign(process.env, {
      ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
      SUPABASE_DB_URL: `postgresql://postgres:pw@db.${HOSTED_DENIED_ACTIVE_PMFREAK_REF}.supabase.co:5432/postgres`,
      SUPABASE_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
      FRESH_DB_EXPECTED_PROJECT_REF: HOSTED_DENIED_ACTIVE_PMFREAK_REF,
    });
    assert.equal(safetyGuard("hosted"), false, "a perfectly-bound URL must not unlock the ACTIVE project");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    process.exitCode = savedExit;
  }
});

test("binding: an allowlisted ref paired with an UNRELATED database URL is denied", () => {
  const r = verifyHostedTargetBinding("postgresql://postgres:pw@db.zzzzzzzzzzzzzzzzzzzz.supabase.co:5432/postgres", REF);
  assert.equal(r.ok, false, "an allowlisted ref must not authorise a probe against a different database");
});

// ─── All user-defined object classes defeat FRESH ─────────────────────────
test("emptiness: view / materialised view / sequence / foreign table / function / type only are all NOT pristine", () => {
  // They arrive through the relation and proc/type counters respectively.
  for (const key of ["user_relations", "user_functions", "user_types"]) {
    const v = classifyObjectEmptiness({ ...EMPTY_COUNTS, [key]: 1 });
    assert.equal(v.empty, false, `${key} must defeat a fresh-apply certification`);
    assert.equal(v.nonEmpty[0].category, key);
  }
});

test("emptiness: the probe counts every material relkind and both proc and type objects", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const start = source.indexOf("const PLATFORM_SCHEMA_PREDICATE");
  const fn = source.slice(start, source.indexOf("// Reads the linked project's migration history"));
  // Indexes ('i','I') are counted too: a custom index on a stock managed relation is
  // operator-created DDL that no other counter sees.
  assert.match(fn, /relkind in \('r','p','v','m','S','f','i','I'\)/, "the probe omits a material relation kind");
  assert.match(fn, /pg_proc/, "the probe does not count user functions/procedures");
  assert.match(fn, /pg_type/, "the probe does not count user-defined types");
  // Range and multirange types are user-definable and were previously uncounted.
  assert.match(fn, /typtype in \('c','d','e','r','m'\)/, "the probe omits range/multirange types");
  // Managed schemas are inventoried rather than excluded wholesale.
  assert.match(fn, /managed-schema ownership probe|MANAGED/, "managed schemas are not inventoried");
  assert.match(fn, /pg_extension/, "installed extensions are not inventoried");
  assert.match(fn, /query_to_xml/, "rows in stock managed tables are not counted");
  // Extension-owned objects excluded via dependency metadata, not a hand-maintained list.
  assert.match(fn, /pg_depend/, "extension-owned objects are not excluded via pg_depend");
  assert.match(fn, /deptype = 'e'/, "the extension-ownership predicate is missing");
  assert.doesNotMatch(fn, /\b(insert|update|delete|drop|truncate|alter)\b/i, "the emptiness probe is not read-only");
});

test("emptiness: platform/extension-only state keeps a genuinely new project FRESH-eligible", () => {
  assert.equal(classifyObjectEmptiness(EMPTY_COUNTS).empty, true);
});

// ─── The unrecognized-output reason survives the whole result path ────────
test("the UNRECOGNIZED_OUTPUT reason survives from the parser out to the harness result", () => {
  const savedEnv = { ...process.env };
  const savedExit = process.exitCode;
  try {
    Object.assign(process.env, {
      SUPABASE_PROJECT_REF: REF,
      FRESH_DB_EXPECTED_PROJECT_REF: REF,
      SUPABASE_DB_URL: `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`,
      SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    });
    // Injected runner: `link` succeeds, `migration list` returns unrecognizable output.
    const runner = (args) => args.includes("link")
      ? { status: 0, stdout: "", stderr: "" }
      : { status: 0, stdout: "Connecting to remote database...\n<new unrecognised format>\n", stderr: "" };
    const result = applyHosted(["20260428120000_a.sql"], runner);
    assert.equal(result.ok, false, "unrecognized output must not be treated as an empty target");
    assert.match(String(result.reason), /HOSTED_MIGRATION_LIST_FAILURE=UNRECOGNIZED_OUTPUT/,
      "the actionable reason was lost between the parser and the harness result");
    assert.doesNotMatch(String(result.reason), /sbp_test_token_not_real/, "the reason leaked a secret");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in savedEnv)) delete process.env[k];
    Object.assign(process.env, savedEnv);
    process.exitCode = savedExit;
  }
});

// ─── Policies and the STRICT stock trigger baseline (offline) ─────────────
// Measured on a genuinely stock isolated Supabase project: ZERO non-extension-owned
// policies, and exactly FOUR non-internal, non-extension-owned platform triggers.
const stock = () => STOCK_PLATFORM_TRIGGER_BASELINE.map((b) => ({ ...b, is_internal: false, extension_owned: false }));

test("policy: a custom policy anywhere — including on storage.objects — blocks FRESH", () => {
  for (const key of ["user_policies"]) {
    const v = classifyObjectEmptiness({ ...EMPTY_COUNTS, [key]: 1 });
    assert.equal(v.empty, false, "a custom RLS policy must defeat a fresh-apply certification");
    assert.equal(v.nonEmpty[0].category, "user_policies");
    // The category text must not pretend managed schemas are exempt.
    assert.match(v.nonEmpty[0].description, /storage\.objects/, "the policy category does not state that managed relations count");
  }
});

test("trigger baseline: the exact four measured stock fingerprints do NOT make a target non-fresh", () => {
  const r = classifyObservedTriggers(stock());
  assert.equal(r.nonStockCount, 0, "the certified stock baseline must not defeat fresh classification");
  assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, user_triggers: r.nonStockCount }).empty, true);
});

test("trigger baseline: an ARBITRARY extra trigger is NON_EMPTY", () => {
  const r = classifyObservedTriggers([...stock(), {
    relation_schema: "public", relation_name: "projects", trigger_name: "audit_projects",
    function_schema: "public", function_name: "audit_fn", function_owner: "postgres",
    definition: "CREATE TRIGGER audit_projects AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_fn()",
    is_internal: false, extension_owned: false,
  }]);
  assert.equal(r.nonStockCount, 1);
  assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, user_triggers: r.nonStockCount }).empty, false);
});

test("trigger baseline: a custom trigger INVOKING A PLATFORM-OWNED FUNCTION is still NON_EMPTY", () => {
  // Function ownership alone must never launder provenance: a user can point their own
  // trigger at storage.protect_delete, owned by supabase_storage_admin.
  const r = classifyObservedTriggers([...stock(), {
    relation_schema: "storage", relation_name: "objects", trigger_name: "sneaky_user_trigger",
    function_schema: "storage", function_name: "protect_delete", function_owner: "supabase_storage_admin",
    definition: "CREATE TRIGGER sneaky_user_trigger BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()",
    is_internal: false, extension_owned: false,
  }]);
  assert.equal(r.nonStockCount, 1, "a platform-owned trigger FUNCTION must not make a user trigger stock");
  assert.match(r.nonStock[0], /sneaky_user_trigger/);
});

test("trigger baseline: a stock NAME with a changed DEFINITION is NON_EMPTY", () => {
  const tampered = stock();
  tampered[3] = { ...tampered[3], definition: tampered[3].definition.replace("BEFORE UPDATE", "AFTER UPDATE") };
  assert.equal(classifyObservedTriggers(tampered).nonStockCount, 1, "a redefined stock trigger must not pass as stock");
});

test("trigger baseline: a stock NAME pointing at a DIFFERENT FUNCTION is NON_EMPTY", () => {
  const tampered = stock();
  tampered[2] = { ...tampered[2], function_name: "exfiltrate", function_schema: "public", function_owner: "postgres" };
  assert.equal(classifyObservedTriggers(tampered).nonStockCount, 1);
});

test("trigger baseline: a stock NAME on a DIFFERENT TARGET relation is NON_EMPTY", () => {
  const tampered = stock();
  tampered[1] = { ...tampered[1], relation_schema: "public", relation_name: "workspaces" };
  assert.equal(classifyObservedTriggers(tampered).nonStockCount, 1);
});

test("trigger baseline: a DUPLICATED stock fingerprint counts as an extra", () => {
  assert.equal(classifyObservedTriggers([...stock(), stock()[0]]).nonStockCount, 1, "each baseline entry is consumed once");
});

test("trigger baseline: internal and positively extension-owned triggers are ignored", () => {
  const r = classifyObservedTriggers([
    ...stock(),
    { relation_schema: "public", relation_name: "t", trigger_name: "RI_ConstraintTrigger", function_schema: "pg_catalog", function_name: "RI_FKey_check_ins", function_owner: "postgres", definition: "internal", is_internal: true, extension_owned: false },
    { relation_schema: "cron", relation_name: "job", trigger_name: "ext_trigger", function_schema: "cron", function_name: "fn", function_owner: "postgres", definition: "CREATE TRIGGER ext_trigger ...", is_internal: false, extension_owned: true },
  ]);
  assert.equal(r.nonStockCount, 0, "internal and extension-owned triggers are not application customizations");
});

test("trigger baseline: an UNKNOWN trigger under a managed schema fails closed", () => {
  const r = classifyObservedTriggers([...stock(), {
    relation_schema: "auth", relation_name: "users", trigger_name: "on_auth_user_created",
    function_schema: "public", function_name: "handle_new_user", function_owner: "postgres",
    definition: "CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()",
    is_internal: false, extension_owned: false,
  }]);
  assert.equal(r.nonStockCount, 1, "a managed-schema attachment must not exempt a user trigger");
});

test("trigger baseline: it is versioned SOURCE, never learned from the target under test", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.equal(STOCK_PLATFORM_TRIGGER_BASELINE.length, 4, "the certified baseline is the four measured stock triggers");
  assert.ok(Object.isFrozen(STOCK_PLATFORM_TRIGGER_BASELINE), "the baseline must be immutable");
  for (const b of STOCK_PLATFORM_TRIGGER_BASELINE) {
    for (const field of ["relation_schema", "relation_name", "trigger_name", "function_schema", "function_name", "function_owner", "definition"]) {
      assert.ok(b[field], `baseline entry is missing the ${field} fingerprint field`);
    }
  }
  // Never derived from the inspected database: declared exactly once as a frozen const,
  // and never appended to or reassigned. (The const declaration itself is the one
  // legitimate assignment, so it is matched explicitly rather than banned.)
  const declarations = source.match(/const STOCK_PLATFORM_TRIGGER_BASELINE = Object\.freeze\(/g) ?? [];
  assert.equal(declarations.length, 1, "the baseline must be declared exactly once as a frozen constant");
  assert.doesNotMatch(source, /STOCK_PLATFORM_TRIGGER_BASELINE\s*\.\s*(push|splice|unshift|pop)/, "the baseline must not be mutated at runtime");
  // Count assignments rather than using a lookahead: `\s*` backtracks to zero-width and
  // makes a negative lookahead match the declaration itself.
  const assignments = source.match(/STOCK_PLATFORM_TRIGGER_BASELINE\s*=[^=]/g) ?? [];
  assert.equal(assignments.length, 1, "the baseline is assigned more than once, so it can be replaced at runtime");
});

test("the trigger-fingerprint probe fails closed on an unrecognized row", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.match(source, /unrecognized row/, "the trigger probe does not fail closed on malformed output");
  assert.match(source, /trigger-fingerprint probe/, "the trigger probe failure is not attributable");
});

// ─── Baseline drift in BOTH directions ────────────────────────────────────
test("trigger baseline: ZERO observed triggers is DRIFT, not emptiness", () => {
  // The original classifier reported nonStockCount 0 here, so a wiped or partially
  // initialised project read as pristine and could reach the destructive push.
  const r = classifyObservedTriggers([]);
  assert.equal(r.missingStockCount, 4, "every certified stock trigger must be reported missing");
  assert.equal(r.baselineSatisfied, false);
  assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, user_triggers: r.nonStockCount + r.missingStockCount }).empty, false);
});

test("trigger baseline: THREE of four stock triggers is DRIFT", () => {
  const r = classifyObservedTriggers(stock().slice(0, 3));
  assert.equal(r.missingStockCount, 1);
  assert.equal(r.baselineSatisfied, false);
  assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, user_triggers: r.nonStockCount + r.missingStockCount }).empty, false);
});

test("trigger baseline: the exact four in ANY ORDER satisfy the baseline", () => {
  const shuffled = [stock()[2], stock()[0], stock()[3], stock()[1]];
  const r = classifyObservedTriggers(shuffled);
  assert.equal(r.baselineSatisfied, true, "ordering alone must not be treated as drift");
  assert.equal(r.nonStockCount + r.missingStockCount, 0);
});

test("trigger baseline: an ALTERED stock trigger is both an extra AND a missing entry", () => {
  const tampered = stock();
  tampered[0] = { ...tampered[0], definition: tampered[0].definition.replace("BEFORE INSERT", "AFTER INSERT") };
  const r = classifyObservedTriggers(tampered);
  assert.equal(r.nonStockCount, 1);
  assert.equal(r.missingStockCount, 1, "the certified entry it impersonates is still absent");
  assert.equal(r.baselineSatisfied, false);
});

// ─── Event triggers (pg_event_trigger) ────────────────────────────────────
test("event triggers: none observed raises no objection", () => {
  assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, user_event_triggers: 0 }).empty, true);
});

test("event triggers: a single user event trigger refuses FRESH", () => {
  const v = classifyObjectEmptiness({ ...EMPTY_COUNTS, user_event_triggers: 1 });
  assert.equal(v.empty, false);
  assert.equal(v.nonEmpty[0].category, "user_event_triggers");
  assert.match(v.nonEmpty[0].description, /event triggers/i);
});

test("event triggers: the probe is read-only, database-level, and exempts ONLY proven extension ownership", () => {
  const source = readFileSync(SCRIPT, "utf8");
  const region = source.slice(source.indexOf("const PLATFORM_SCHEMA_PREDICATE"), source.indexOf("// Reads the linked project's migration history"));
  assert.match(region, /pg_event_trigger/, "event triggers are not probed at all");
  // No schema exemption may apply: event triggers are database-level, so a function in
  // storage/auth must NOT launder them, and a platform-owned FUNCTION is not provenance.
  const evtRegion = region.slice(region.indexOf("const eventQuery"));
  assert.doesNotMatch(evtRegion, /nspname NOT IN|PLATFORM_SCHEMA_PREDICATE/, "the event-trigger probe must not carry a schema exemption");
  assert.match(evtRegion, /classid = 'pg_event_trigger'::regclass[\s\S]{0,120}deptype = 'e'/, "extension ownership must be proven via pg_depend on the event trigger itself");
  assert.match(evtRegion, /unrecognized row/, "the event-trigger probe must fail closed on malformed output");
  assert.match(evtRegion, /event-trigger probe/, "an event-trigger probe failure must be attributable");
  assert.doesNotMatch(evtRegion, /\b(insert|update|delete|drop|truncate|alter)\b/i, "the event-trigger probe is not read-only");
});

test("fresh composition: every objection category independently refuses FRESH", () => {
  for (const key of Object.keys(EMPTY_COUNTS)) {
    assert.equal(classifyObjectEmptiness({ ...EMPTY_COUNTS, [key]: 1 }).empty, false, `${key} must be able to refuse a fresh apply`);
  }
});

// ─── F4: custom objects inside MANAGED schemas must not evade emptiness ────
//
// The defect: the inventory excluded every managed schema from the relation, function
// and type counters, so a project holding only a user-created `storage.*` or `auth.*`
// object reported zero and was certified application-empty before a destructive push.
// The replacement decides per object, on positive ownership evidence.

const stockObject = (schema, kind, name) => {
  const entry = STOCK_MANAGED_OBJECT_BASELINE.find((b) => b.schema === schema && b.kind === kind && b.name === name);
  assert.ok(entry, `${schema}.${name} (${kind}) is not in the certified baseline; the fixture is stale`);
  return { ...entry };
};
/** The whole certified baseline, which by definition must classify as fully stock. */
const wholeBaseline = () => STOCK_MANAGED_OBJECT_BASELINE.map((b) => ({ ...b }));

test("classifyManagedSchemaObjects: the certified baseline itself is exactly stock", () => {
  const verdict = classifyManagedSchemaObjects(wholeBaseline());
  assert.equal(verdict.nonStockCount, 0, `stock objects were flagged: ${verdict.nonStock.slice(0, 5).join(", ")}`);
  assert.equal(verdict.missingStockCount, 0, `baseline objects were reported missing: ${verdict.missingStock.slice(0, 5).join(", ")}`);
  assert.equal(verdict.baselineSatisfied, true, "the baseline does not satisfy itself");
});

test("classifyManagedSchemaObjects: a MISSING certified object is drift, not emptiness", () => {
  // Both directions, exactly as the trigger baseline: a target lacking platform objects
  // is not pristine either, and an extras-only check would have passed it.
  const short = wholeBaseline().slice(1);
  const verdict = classifyManagedSchemaObjects(short);
  assert.equal(verdict.missingStockCount, 1, "a missing certified platform object was not reported");
  assert.equal(verdict.baselineSatisfied, false, "a target missing platform objects satisfied the baseline");
});

test("classifyManagedSchemaObjects: OWNERSHIP ALONE no longer excuses anything", () => {
  // The correction Codex found: pg_class.relowner is the CURRENT owner, not the creator,
  // and an operator with an administrative connection can reassign it. A custom object
  // re-owned to the platform service role must still be counted.
  for (const [schema, owner] of [["storage", "supabase_storage_admin"], ["auth", "supabase_auth_admin"], ["realtime", "supabase_realtime_admin"]]) {
    const verdict = classifyManagedSchemaObjects([{ schema, kind: "relation", name: "custom_table", owner }]);
    assert.equal(verdict.nonStockCount, 1, `${schema}.custom_table re-owned to ${owner} was accepted as stock`);
  }
});

test("classifyManagedSchemaObjects: a CUSTOM object in a managed schema is counted, whoever owns it", () => {
  for (const owner of ["postgres", "supabase_storage_admin", "some_operator"]) {
    assert.equal(
      classifyManagedSchemaObjects([...wholeBaseline(), { schema: "storage", kind: "relation", name: "custom_table", owner }]).nonStockCount,
      1,
      `a custom storage table owned by ${owner} evaded the inventory`,
    );
  }
});

test("classifyManagedSchemaObjects: custom managed view, function, type, RANGE type and INDEX are all counted", () => {
  const injections = [
    { schema: "storage", kind: "relation", name: "custom_view", owner: "supabase_storage_admin" },
    { schema: "auth", kind: "function", name: "custom_function", owner: "supabase_auth_admin" },
    { schema: "cron", kind: "type", name: "custom_type", owner: "postgres" },
    { schema: "storage", kind: "type", name: "custom_range", owner: "supabase_storage_admin" },
    { schema: "storage", kind: "index", name: "custom_objects_idx", owner: "supabase_storage_admin" },
  ];
  for (const injected of injections) {
    const verdict = classifyManagedSchemaObjects([...wholeBaseline(), injected]);
    assert.equal(verdict.nonStockCount, 1, `${injected.schema}.${injected.name} (${injected.kind}) evaded the inventory`);
  }
});

test("classifyManagedSchemaObjects: a stock NAME under a different owner or kind is not that object", () => {
  const real = stockObject("storage", "relation", "objects");
  assert.equal(classifyManagedSchemaObjects([{ ...real, owner: "postgres" }]).nonStockCount, 1, "a re-owned stock name was excused");
  assert.equal(classifyManagedSchemaObjects([{ ...real, kind: "function" }]).nonStockCount, 1, "a stock name under a different kind was excused");
});

test("classifyManagedSchemaObjects: a DUPLICATED stock fingerprint is still an extra", () => {
  const real = stockObject("storage", "relation", "objects");
  const verdict = classifyManagedSchemaObjects([...wholeBaseline(), { ...real }]);
  assert.equal(verdict.nonStockCount, 1, "a duplicated stock object was consumed twice");
});

test("isRealtimeDailyPartition: only the exact structural shape is accepted", () => {
  assert.equal(isRealtimeDailyPartition({ schema: "realtime", kind: "relation", name: "messages_2026_09_04", owner: "supabase_realtime_admin" }), true);
  assert.equal(isRealtimeDailyPartition({ schema: "realtime", kind: "index", name: "messages_2026_09_04_pkey", owner: "supabase_realtime_admin" }), true);
  // Every property is load-bearing: wrong schema, wrong owner, wrong kind, wrong shape.
  assert.equal(isRealtimeDailyPartition({ schema: "storage", kind: "relation", name: "messages_2026_09_04", owner: "supabase_realtime_admin" }), false);
  assert.equal(isRealtimeDailyPartition({ schema: "realtime", kind: "relation", name: "messages_2026_09_04", owner: "postgres" }), false);
  assert.equal(isRealtimeDailyPartition({ schema: "realtime", kind: "function", name: "messages_2026_09_04", owner: "supabase_realtime_admin" }), false);
  assert.equal(isRealtimeDailyPartition({ schema: "realtime", kind: "relation", name: "messages_custom", owner: "supabase_realtime_admin" }), false);
  // ...and a daily partition still passes through the classifier without being flagged.
  assert.equal(
    classifyManagedSchemaObjects([...wholeBaseline(), { schema: "realtime", kind: "relation", name: "messages_2026_12_31", owner: "supabase_realtime_admin" }]).nonStockCount,
    0,
    "a legitimate daily realtime partition was flagged as application state",
  );
});

test("classifyObjectEmptiness: the new managed categories all defeat application-emptiness", () => {
  assert.equal(classifyObjectEmptiness({}).empty, true, "an all-zero inventory was not empty");
  for (const key of ["user_managed_schema_objects", "user_extensions", "user_managed_table_rows"]) {
    const dirty = classifyObjectEmptiness({ [key]: 1 });
    assert.equal(dirty.empty, false, `${key}=1 still certified as application-empty`);
    assert.match(dirty.reason, new RegExp(`${key}=1`), `unexpected reason: ${dirty.reason}`);
  }
});

// ─── F5: local/remote ROW PAIRING must survive classification ──────────────

const table = (rows) =>
  ["   Local    |   Remote   |     Time", "  ---------|-----------|--------", ...rows].join("\n");
const row = (local, remote) => `   ${local ?? ""}   |   ${remote ?? ""}   | 2026-04-28`;

test("parseHostedMigrationList: SWAPPED local/remote pairs are reported as mismatched, not normalized", () => {
  const out = table([row("20260428120000", "20260501000000"), row("20260501000000", "20260428120000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.matchedRows, 0, "swapped rows produced matched rows");
  assert.equal(parsed.mismatchedPairs.length, 2, `swapped rows were not detected: ${JSON.stringify(parsed.mismatchedPairs)}`);
});

test("recognizeMigrationListRows: a swapped table FAILS CLOSED instead of being classified", () => {
  const out = table([row("20260428120000", "20260501000000"), row("20260501000000", "20260428120000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  const recognized = recognizeMigrationListRows(parsed.rows, ["20260428120000", "20260501000000"]);
  assert.equal(recognized.ok, false, "a shifted migration table was accepted as recognized output");
  assert.match(recognized.reason, /do not agree|not agree/, `unexpected reason: ${recognized.reason}`);
});

test("classifyHostedTarget: equal version SETS with zero matching ROWS are never repeatability", () => {
  const local = ["20260428120000", "20260501000000"];
  // The exact defect: sets are equal, so the set-only classifier said repeatability.
  const setOnly = classifyHostedTarget(local, local);
  assert.equal(setOnly.mode, "repeatability", "precondition: set comparison alone reports repeatability");
  const withPairing = classifyHostedTarget(local, local, {
    matchedRows: 0,
    mismatchedPairs: ["20260428120000!=20260501000000", "20260501000000!=20260428120000"],
    localMigrationCount: 2,
  });
  assert.equal(withPairing.mode, "fail", "a swapped pairing was still classified as repeatability");
  assert.match(withPairing.reason, /name different migrations/, `unexpected reason: ${withPairing.reason}`);
});

test("classifyHostedTarget: a partially-paired history is not repeatability even with equal sets", () => {
  const local = ["20260428120000", "20260501000000"];
  const verdict = classifyHostedTarget(local, local, { matchedRows: 1, mismatchedPairs: [], localMigrationCount: 2 });
  assert.equal(verdict.mode, "fail", "one matched row out of two was accepted as repeatability");
  assert.match(verdict.reason, /paired to the SAME remote version/, `unexpected reason: ${verdict.reason}`);
});

test("parseHostedMigrationList: A/A + B/B is a fully paired history", () => {
  const out = table([row("20260428120000", "20260428120000"), row("20260501000000", "20260501000000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.matchedRows, 2, "a correctly paired table did not report two matched rows");
  assert.deepEqual(parsed.mismatchedPairs, [], "a correctly paired table reported mismatches");
  assert.deepEqual(parsed.pendingLocal, [], "a correctly paired table reported pending local migrations");
  const verdict = classifyHostedTarget(["20260428120000", "20260501000000"], ["20260428120000", "20260501000000"], {
    matchedRows: parsed.matchedRows, mismatchedPairs: parsed.mismatchedPairs, localMigrationCount: 2,
  });
  assert.equal(verdict.mode, "repeatability", `a fully paired history was not repeatability: ${verdict.reason ?? ""}`);
});

test("parseHostedMigrationList: A/blank + B/blank is a FRESH remote history", () => {
  const out = table([row("20260428120000", null), row("20260501000000", null)]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.deepEqual(parsed.mismatchedPairs, [], "a fresh table reported mismatched pairs");
  assert.equal(parsed.matchedRows, 0, "a fresh table reported matched rows");
  assert.deepEqual(parsed.unexpectedRemote, [], "a fresh table reported unexpected remote rows");
  const recognized = recognizeMigrationListRows(parsed.rows, ["20260428120000", "20260501000000"]);
  assert.equal(recognized.ok, true, `a fresh table was not recognized: ${recognized.reason ?? ""}`);
  const verdict = classifyHostedTarget([], ["20260428120000", "20260501000000"], {
    matchedRows: 0, mismatchedPairs: [], localMigrationCount: 2,
  });
  assert.equal(verdict.mode, "fresh", "an empty remote history was not classified fresh");
});

test("parseHostedMigrationList: A/A + B/blank is a pending delta, not repeatability", () => {
  const out = table([row("20260428120000", "20260428120000"), row("20260501000000", null)]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.matchedRows, 1, "a partial history did not report exactly one matched row");
  assert.deepEqual(parsed.pendingLocal, ["20260501000000"], `unexpected pending set: ${parsed.pendingLocal.join(",")}`);
  const verdict = classifyHostedTarget(["20260428120000"], ["20260428120000", "20260501000000"], {
    matchedRows: 1, mismatchedPairs: [], localMigrationCount: 2,
  });
  assert.equal(verdict.mode, "fail", "a partially-applied target was not refused");
});

test("parseHostedMigrationList: blank/A is unexpected remote drift", () => {
  const out = table([row(null, "20260901000000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000"]);
  assert.deepEqual(parsed.unexpectedRemote, ["20260901000000"], "a remote-only row was not reported as unexpected");
  assert.deepEqual(parsed.mismatchedPairs, [], "a remote-only row was reported as a mismatched pair");
});

test("parseHostedMigrationList: BACKTICK-rendered swapped pairs are also detected", () => {
  const out = table([
    "   `20260428120000`   |   `20260501000000`   | 2026-04-28",
    "   `20260501000000`   |   `20260428120000`   | 2026-05-01",
  ]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.mismatchedPairs.length, 2, "backtick-rendered swapped rows evaded pairing detection");
  assert.equal(parsed.matchedRows, 0, "backtick-rendered swapped rows reported matched rows");
});

// ─── F5 (extended): one-sided and duplicate rows must reach classification ──

test("parseHostedMigrationList: a stray remote-only row is reported, not absorbed", () => {
  const out = table([row("20260428120000", "20260428120000"), row("20260501000000", "20260501000000"), row(null, "20260428120000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.equal(parsed.matchedRows, 2, "the two genuine pairs were not matched");
  assert.deepEqual(parsed.unexpectedRemote, ["20260428120000"], `stray row not reported: ${JSON.stringify(parsed.unexpectedRemote)}`);
  assert.equal(parsed.duplicateRemote.length, 1, "the duplicated remote version was not reported");
});

test("classifyHostedTarget: A|A + B|B + |A is NOT repeatability", () => {
  const local = ["20260428120000", "20260501000000"];
  const out = table([row("20260428120000", "20260428120000"), row("20260501000000", "20260501000000"), row(null, "20260428120000")]);
  const parsed = parseHostedMigrationList(out, local);
  // Set equality alone still says repeatability — which is exactly the defect.
  assert.equal(classifyHostedTarget(local, local).mode, "repeatability", "precondition: set-only classification passes");
  const verdict = classifyHostedTarget(local, local, {
    matchedRows: parsed.matchedRows,
    mismatchedPairs: parsed.mismatchedPairs,
    unexpectedRemote: parsed.unexpectedRemote,
    duplicateRemote: parsed.duplicateRemote,
    localMigrationCount: 2,
  });
  assert.equal(verdict.mode, "fail", "a stray remote-only row was normalized into a complete history");
  assert.match(verdict.reason, /row anomaly|anomalies/, `unexpected reason: ${verdict.reason}`);
});

test("verifyHostedRepeatability-shaped input: duplicate remote versions are refused", () => {
  const out = table([row("20260428120000", "20260428120000"), row("20260501000000", "20260428120000")]);
  const parsed = parseHostedMigrationList(out, ["20260428120000", "20260501000000"]);
  assert.ok(parsed.mismatchedPairs.length > 0 || parsed.duplicateRemote.length > 0, "neither mismatch nor duplication was detected");
});
