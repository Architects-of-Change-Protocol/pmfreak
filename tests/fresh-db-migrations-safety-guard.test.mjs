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
  // All three hosted commands go through the portable helper, never bare spawn.
  assert.match(source, /runNpx\(\["-y", "supabase", "link", "--project-ref", projectRef\]/);
  assert.ok(source.includes('runNpx(["-y", "supabase", "db", "push", "--include-roles"]'));
  assert.match(source, /runNpx\(\["-y", "supabase", "migration", "list", "--linked"\]/);
  // The unportable direct form must not come back at any hosted call site.
  assert.doesNotMatch(source, /sh\("npx", \["-y"/);
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

test("hosted mode refuses an unknown project ref that is neither the allowed validation project nor the live one", () => {
  const result = run({
    PATH: process.env.PATH,
    ALLOW_DESTRUCTIVE_FRESH_DB_TEST: "true",
    SUPABASE_DB_URL: "postgresql://postgres:pw@db.someotherprojectref.supabase.co:5432/postgres",
    SUPABASE_ACCESS_TOKEN: "sbp_test_token_not_real",
    SUPABASE_PROJECT_REF: "someotherprojectref",
    FRESH_DB_EXPECTED_PROJECT_REF: "someotherprojectref",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /not the designated disposable/);
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
