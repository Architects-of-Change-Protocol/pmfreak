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

// Version-controlled allowlist of disposable validation projects. Rotation happens by
// adding a ref HERE, through reviewed code — never by setting an environment variable.
// Two matching env vars are two copies of the same typo, so a matching handshake is
// NECESSARY BUT NOT SUFFICIENT. Being allowlisted is likewise not sufficient for a fresh
// apply: the target must additionally prove application-object emptiness.
const HOSTED_ALLOWED_VALIDATION_REFS = Object.freeze([HOSTED_ALLOWED_MIGRATION_VALIDATION_REF]);
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

    if (!HOSTED_ALLOWED_VALIDATION_REFS.includes(actual)) {
      return fail(
        `Refusing to run: SUPABASE_PROJECT_REF (${redact(actual)}) is not in HOSTED_ALLOWED_VALIDATION_REFS. ` +
          "Matching SUPABASE_PROJECT_REF and FRESH_DB_EXPECTED_PROJECT_REF is necessary but NOT sufficient: a " +
          "rotated validation project must first be added to the version-controlled allowlist through reviewed " +
          "source. An empty migration ledger is not proof that a project is disposable.",
      );
    }

    // Historical note. The original single-ref pin cannot express a SECOND validation
    // project, and it had a worse problem: the pinned project now holds the full
    // migration chain, so re-running against it would apply a future migration as a
    // DELTA and still report "fresh apply". Emptiness — not identity — is the property
    // that makes a fresh-apply certification true, so the pin is replaced by a
    // PRE-APPLY emptiness precondition enforced in classifyHostedTarget(), which every
    // ref must satisfy including the originally designated one.
    //
    // Nothing else is relaxed: the active-project denial above still runs FIRST and is
    // absolute, the two-variable ref handshake is still mandatory, the production-like
    // host check still applies, ALLOW_DESTRUCTIVE_FRESH_DB_TEST is still required, and
    // no target is ever inferred — both refs must be supplied explicitly and match.
    if (actual !== HOSTED_ALLOWED_MIGRATION_VALIDATION_REF) {
      console.log(
        `[safety] hosted target ${redact(actual)} is an ALLOWLISTED ROTATED validation project. It may be ` +
          "fresh-applied only after proving BOTH an empty PMFreak migration ledger and an empty application " +
          "object/data state; both preconditions are enforced before any destructive push.",
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

// `runner` is an injected seam so the credential-free suite can exercise this whole path
// — link, classification, reason propagation — without npx, a CLI or any network.
function applyHosted(files = loadMigrationFiles(), runner = runNpx) {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  console.log(`[apply:hosted] project ref: ${redact(projectRef)}`);

  const link = runner(["-y", "supabase", "link", "--project-ref", projectRef], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (link.status !== 0) {
    return { ok: false, failedFile: "(supabase link)", failure: describeSpawnResult(link, "npx supabase link"), stderr: link.stderr };
  }

  // PRE-APPLY gate. Read the target's existing history and classify BEFORE any
  // destructive push, so a populated project can never be delta-applied and then
  // reported as a fresh apply.
  const localTimestamps = files.map((f) => f.match(/^(\d{14})_/)?.[1]).filter(Boolean);
  const history = readHostedMigrationVersions(localTimestamps, runner);
  if (!history.ok) {
    // Keep the actionable reason. "Failed at: (supabase migration list)" alone hides the
    // single most useful fact — that the output format was not recognised — which is
    // exactly the class of regression this check exists to catch.
    return {
      ok: false,
      failedFile: "(supabase migration list)",
      reason: history.reason ? `HOSTED_MIGRATION_LIST_FAILURE=UNRECOGNIZED_OUTPUT — ${history.reason}` : undefined,
      failure: history.failure,
      stderr: history.stderr,
    };
  }
  const target = classifyHostedTarget(history.remoteVersions, localTimestamps);
  console.log(`[apply:hosted] PRE_APPLY_REMOTE_MIGRATION_COUNT=${target.preApplyRemoteMigrationCount}`);
  console.log(`[apply:hosted] HOSTED_TARGET_CLASSIFICATION=${target.mode.toUpperCase()}`);

  if (target.mode === "fail") {
    return { ok: false, failedFile: "(hosted target classification)", reason: target.reason };
  }

  if (target.mode === "fresh") {
    // The emptiness proof is only meaningful if psql and the CLI address the SAME
    // project. Prove that binding first — before the probe, and before any push.
    const binding = verifyHostedTargetBinding(process.env.SUPABASE_DB_URL, projectRef);
    console.log(`[apply:hosted] DB_URL_PROJECT_REF_IDENTIFIED=${binding.identified ? "YES" : "NO"}`);
    if (!binding.ok) {
      return { ok: false, failedFile: "(hosted target binding)", reason: binding.reason };
    }
    console.log(`[apply:hosted] DB_URL_PROJECT_REF=SUPABASE_PROJECT_REF (${binding.form} form)`);

    // Allowlisted + bound + empty ledger is still not enough. Prove the database carries
    // no application workload before anything destructive runs.
    const probe = probeHostedApplicationState(process.env.SUPABASE_DB_URL);
    if (!probe.ok) {
      return { ok: false, failedFile: "(hosted application-emptiness probe)", reason: probe.reason, failure: probe.failure, stderr: probe.stderr };
    }
    console.log(`[apply:hosted] APPLICATION_EMPTINESS=${probe.verdict.empty ? "EMPTY" : "NOT_EMPTY"}`);
    if (!probe.verdict.empty) {
      // Explicitly NOT repeatability and NOT a delta apply — a populated project with an
      // empty ledger is simply not certifiable here.
      return { ok: false, failedFile: "(hosted application-emptiness probe)", reason: probe.verdict.reason };
    }
  }

  if (target.mode === "repeatability") {
    // Already fully migrated: prove repeatability, never re-run the destructive push,
    // and never call this a fresh apply.
    console.log("[apply:hosted] target already holds the complete local chain — REPEATABILITY only, no push.");
    return { ok: true, certification: "REPEATABILITY", freshApply: false, preApplyRemoteMigrationCount: target.preApplyRemoteMigrationCount };
  }

  const push = runner(["-y", "supabase", "db", "push", "--include-roles"], {
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

  return { ok: true, certification: "FRESH_APPLY", freshApply: true, preApplyRemoteMigrationCount: 0 };
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

// ─── Hosted target classification (pre-apply) ──────────────────────────────
//
// A "fresh apply" certification is only true if the target had NO PMFreak migration
// history before the apply. Applying to an already-populated project applies a DELTA;
// calling that a fresh apply would certify something that never happened.
//
//   fresh          remote history empty                  -> full chain may be applied
//   repeatability  remote set === local set exactly      -> already proven; do NOT re-push
//   fail           partial, or any unexpected remote      -> not certifiable as fresh
//
// Pure so it can be unit-tested without network or credentials.
function classifyHostedTarget(remoteVersions, localVersions) {
  const remote = [...new Set(remoteVersions)].sort();
  const local = [...new Set(localVersions)].sort();
  const unexpected = remote.filter((v) => !local.includes(v));
  const missing = local.filter((v) => !remote.includes(v));

  if (unexpected.length > 0) {
    return {
      mode: "fail",
      preApplyRemoteMigrationCount: remote.length,
      unexpected,
      missing,
      reason:
        `hosted target carries ${unexpected.length} migration version(s) with no local file ` +
        `(${unexpected.slice(0, 5).join(", ")}${unexpected.length > 5 ? ", ..." : ""}). Drifted targets are ` +
        "never certifiable as a fresh apply.",
    };
  }

  if (remote.length === 0) {
    return { mode: "fresh", preApplyRemoteMigrationCount: 0, unexpected: [], missing: local };
  }

  if (missing.length === 0) {
    return { mode: "repeatability", preApplyRemoteMigrationCount: remote.length, unexpected: [], missing: [] };
  }

  return {
    mode: "fail",
    preApplyRemoteMigrationCount: remote.length,
    unexpected: [],
    missing,
    reason:
      `hosted target already holds ${remote.length} of ${local.length} local migration(s) and is missing ` +
      `${missing.length}. Applying only the delta would NOT be a fresh apply; use an empty project to certify ` +
      "a fresh apply, or a fully-migrated one to prove repeatability.",
  };
}

// The harness addresses the hosted target through TWO independent channels: the CLI
// (linked by SUPABASE_PROJECT_REF) and psql (SUPABASE_DB_URL). If those point at
// different projects, an emptiness proof taken over one says nothing about the other —
// so the binding is proven before the probe is trusted, and before anything destructive.
//
// Positive extraction only. A URL is never accepted because it merely ends in a Supabase
// domain, contains a ref as a substring, or because the two ref variables agree.
// Supabase project refs are lowercase alphanumeric; both supported connection shapes
// encode the ref in a fixed position.
function extractSupabaseProjectRefFromDbUrl(dbUrl) {
  let parsed;
  try {
    parsed = new URL(String(dbUrl ?? ""));
  } catch {
    return { ok: false, reason: "SUPABASE_DB_URL is not a parseable connection URL." };
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    return { ok: false, reason: `SUPABASE_DB_URL is not a postgres connection URL (protocol ${parsed.protocol}).` };
  }
  const host = parsed.hostname.toLowerCase();
  const user = decodeURIComponent(parsed.username ?? "");

  // Direct database host: db.<PROJECT_REF>.supabase.co
  const direct = /^db\.([a-z0-9]{16,32})\.supabase\.(co|com)$/.exec(host);
  if (direct) return { ok: true, ref: direct[1], form: "direct" };

  // Pooler: the ref is encoded in the authenticated username as postgres.<PROJECT_REF>
  if (/(^|\.)pooler\.supabase\.(com|co)$/.test(host)) {
    const pooled = /^postgres\.([a-z0-9]{16,32})$/.exec(user);
    if (pooled) return { ok: true, ref: pooled[1], form: "pooler" };
    return {
      ok: false,
      reason: "SUPABASE_DB_URL uses a pooler host but its username is not postgres.<PROJECT_REF>, so the target project cannot be positively identified.",
    };
  }

  return {
    ok: false,
    reason: `SUPABASE_DB_URL host is not a recognized Supabase project form (expected db.<ref>.supabase.co or a pooler host with a postgres.<ref> username); refusing to guess the target project.`,
  };
}

function verifyHostedTargetBinding(dbUrl, projectRef) {
  const extracted = extractSupabaseProjectRefFromDbUrl(dbUrl);
  if (!extracted.ok) {
    return { ok: false, identified: false, reason: `DB_URL_PROJECT_REF_IDENTIFIED=NO — ${extracted.reason}` };
  }
  if (extracted.ref !== projectRef) {
    return {
      ok: false,
      identified: true,
      reason:
        `DB_URL_PROJECT_REF (${redact(extracted.ref)}) does not match SUPABASE_PROJECT_REF (${redact(projectRef)}). ` +
        "The CLI and the emptiness probe would address different projects; refusing to proceed.",
    };
  }
  return { ok: true, identified: true, ref: extracted.ref, form: extracted.form };
}

// An empty MIGRATION LEDGER is not an empty DATABASE. A project can carry a real
// application workload with no PMFreak migration history at all, and pushing into it
// would be destructive. This classifier turns raw counts into a structured verdict that
// NAMES the non-empty category, so a refusal is diagnosable instead of a bare boolean.
//
// Normal Supabase platform schemas and system objects must NOT make a genuinely new
// project look non-fresh, so the probe below counts only non-platform state.
function classifyObjectEmptiness(counts) {
  // Tables are not the only way a project carries an application. A target holding only
  // views, materialised views, sequences, foreign tables, functions/procedures or
  // user-defined types is NOT pristine and must never be fresh-applied.
  const categories = [
    ["user_schemas", "user-created schemas outside the Supabase platform set"],
    ["user_relations", "application relations (tables, partitioned tables, views, materialised views, sequences, foreign tables)"],
    ["public_rows", "rows in public application tables"],
    ["user_functions", "user-defined functions/procedures"],
    ["user_types", "user-defined types (composite, domain, enum)"],
    ["user_policies", "RLS policies that are not platform/extension-owned (including on managed relations such as storage.objects)"],
    ["user_triggers", "triggers that do not exactly match the certified stock platform baseline (extra, altered, or MISSING)"],
    ["user_event_triggers", "database-level event triggers that are not platform/extension-owned"],
    ["migration_rows", "PMFreak migration-history rows"],
    ["auth_users", "auth.users identities"],
    ["storage_buckets", "storage buckets"],
    ["storage_objects", "storage objects"],
  ];
  const nonEmpty = categories
    .filter(([key]) => Number(counts[key] ?? 0) > 0)
    .map(([key, description]) => ({ category: key, count: Number(counts[key] ?? 0), description }));
  return {
    empty: nonEmpty.length === 0,
    nonEmpty,
    reason: nonEmpty.length === 0
      ? null
      : `hosted target is NOT application-empty: ${nonEmpty.map((n) => `${n.category}=${n.count}`).join(", ")}. ` +
        "A fresh-apply certification requires a genuinely new project; this one already carries application state.",
  };
}

/**
 * CERTIFIED STOCK PLATFORM TRIGGER BASELINE.
 *
 * Measured on a genuinely stock, isolated Supabase project (no migrations, no seed):
 * a fresh instance carries ZERO non-extension-owned policies but FOUR non-internal,
 * non-extension-owned triggers. Those four are shipped by the storage service's own
 * migrations, so neither `tgisinternal` nor `pg_depend deptype='e'` excludes them —
 * counting them naively would make EVERY project non-fresh and disable fresh-apply.
 *
 * This is a STRICT STRUCTURAL baseline, deliberately NOT a names-only allowlist and
 * NOT an owner-based exemption: a user-created trigger can invoke a platform-owned
 * function, so function ownership alone proves nothing about the trigger's provenance.
 * A trigger is treated as platform stock ONLY when every fingerprint field matches,
 * including the normalised `pg_get_triggerdef()` text. A stock NAME with a changed
 * definition, a different function, or a different target relation is NOT stock.
 *
 * Drift is deliberately biased toward refusal: if a future Supabase version changes
 * its stock triggers, this baseline stops matching and the target is reported NON-empty
 * until the baseline is re-certified by hand. A false NON_EMPTY is always preferable to
 * a false EMPTY followed by a destructive push. The baseline is versioned source and is
 * NEVER learned from the target under inspection.
 */
const STOCK_PLATFORM_TRIGGER_BASELINE = Object.freeze([
  {
    relation_schema: "storage", relation_name: "buckets", trigger_name: "enforce_bucket_name_length_trigger",
    function_schema: "storage", function_name: "enforce_bucket_name_length", function_owner: "supabase_storage_admin",
    definition: 'CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length()',
  },
  {
    relation_schema: "storage", relation_name: "buckets", trigger_name: "protect_buckets_delete",
    function_schema: "storage", function_name: "protect_delete", function_owner: "supabase_storage_admin",
    definition: 'CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()',
  },
  {
    relation_schema: "storage", relation_name: "objects", trigger_name: "protect_objects_delete",
    function_schema: "storage", function_name: "protect_delete", function_owner: "supabase_storage_admin",
    definition: 'CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete()',
  },
  {
    relation_schema: "storage", relation_name: "objects", trigger_name: "update_objects_updated_at",
    function_schema: "storage", function_name: "update_updated_at_column", function_owner: "supabase_storage_admin",
    definition: 'CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column()',
  },
]);

/** Whitespace-normalised so formatting differences are not mistaken for drift. */
function normalizeTriggerDefinition(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Classifies observed triggers against the certified baseline. Every field must match
 * for a trigger to be treated as stock; anything unmatched — extra, altered, retargeted,
 * or simply unrecognised — counts as an application customization. Ambiguity never
 * resolves to "empty".
 */
function classifyObservedTriggers(observed) {
  const remaining = STOCK_PLATFORM_TRIGGER_BASELINE.map((b) => ({ ...b, definition: normalizeTriggerDefinition(b.definition) }));
  const nonStock = [];
  for (const t of observed ?? []) {
    if (t.is_internal) continue;              // PostgreSQL internal (FK enforcement) triggers
    if (t.extension_owned) continue;          // positively proven extension-owned
    const fingerprint = {
      relation_schema: t.relation_schema, relation_name: t.relation_name, trigger_name: t.trigger_name,
      function_schema: t.function_schema, function_name: t.function_name, function_owner: t.function_owner,
      definition: normalizeTriggerDefinition(t.definition),
    };
    const idx = remaining.findIndex((b) =>
      b.relation_schema === fingerprint.relation_schema &&
      b.relation_name === fingerprint.relation_name &&
      b.trigger_name === fingerprint.trigger_name &&
      b.function_schema === fingerprint.function_schema &&
      b.function_name === fingerprint.function_name &&
      b.function_owner === fingerprint.function_owner &&
      b.definition === fingerprint.definition);
    if (idx === -1) {
      nonStock.push(`${fingerprint.relation_schema}.${fingerprint.relation_name}:${fingerprint.trigger_name}`);
      continue;
    }
    remaining.splice(idx, 1); // consume: a duplicated stock fingerprint is still an extra
  }
  // BOTH DRIFT DIRECTIONS. Checking only for extras meant an empty or partially
  // initialised target — one MISSING certified platform triggers — scored zero and
  // sailed through to the destructive push; `classifyObservedTriggers([])` literally
  // returned nonStockCount 0. A fresh target must present EXACTLY the certified stock
  // set: anything extra, altered, or absent is drift and refuses FRESH.
  const missingStock = remaining.map((b) => `${b.relation_schema}.${b.relation_name}:${b.trigger_name}`);
  return {
    nonStockCount: nonStock.length,
    nonStock,
    missingStockCount: missingStock.length,
    missingStock,
    baselineSatisfied: nonStock.length === 0 && missingStock.length === 0,
  };
}

const PLATFORM_SCHEMA_PREDICATE =
  "n.nspname NOT LIKE 'pg\\_%' AND n.nspname NOT IN ('information_schema','public','auth','storage','realtime'," +
  "'extensions','graphql','graphql_public','pgbouncer','pgsodium','pgsodium_masks','pgtle','vault','cron','net'," +
  "'dbdev','pgmq','repack','tiger','tiger_data','topology','supabase_functions','supabase_migrations','etl'," +
  "'_analytics','_realtime','_supavisor','_timescaledb_cache','_timescaledb_catalog','_timescaledb_config'," +
  "'_timescaledb_internal','timescaledb_experimental','timescaledb_information')";

// Read-only probe over the already-required SUPABASE_DB_URL, through the existing psql
// runner. Never mutates; used only to decide whether a fresh apply may proceed.
function probeHostedApplicationState(dbUrl, runner = sh) {
  // Application schemas = public, plus any schema outside the Supabase platform set.
  const APP = `(n.nspname = 'public' OR (${PLATFORM_SCHEMA_PREDICATE}))`;
  // Extension-owned objects are NOT application state. A stock Supabase project ships
  // plenty of them, so they are excluded through PostgreSQL's own dependency metadata
  // (pg_depend deptype 'e') rather than a hand-maintained list that would rot.
  const notExtensionOwned = (cls, alias) =>
    `not exists (select 1 from pg_depend d where d.classid = '${cls}'::regclass and d.objid = ${alias}.oid and d.deptype = 'e')`;
  const query = `
    select
      (select count(*) from pg_namespace n where ${PLATFORM_SCHEMA_PREDICATE}) as user_schemas,
      (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r','p','v','m','S','f') and ${APP}
           and ${notExtensionOwned("pg_class", "c")}) as user_relations,
      (select coalesce(sum(n_live_tup), 0) from pg_stat_user_tables where schemaname = 'public') as public_rows,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where ${APP} and ${notExtensionOwned("pg_proc", "p")}) as user_functions,
      (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
         where ${APP} and t.typtype in ('c','d','e')
           and ${notExtensionOwned("pg_type", "t")}
           -- composite types implicitly created for a relation are already counted above
           and (t.typtype <> 'c' or not exists (
                 select 1 from pg_class rc where rc.oid = t.typrelid and rc.relkind <> 'c'))) as user_types,
      -- Policies are counted across EVERY schema, managed ones included: Supabase
      -- explicitly supports application RLS policies on storage.objects, so a managed
      -- schema does not make a policy platform state. A genuinely stock project was
      -- measured at ZERO non-extension-owned policies, so this needs no baseline.
      (select count(*) from pg_policy pol
         where not exists (select 1 from pg_depend d
                             where d.classid = 'pg_policy'::regclass and d.objid = pol.oid and d.deptype = 'e')) as user_policies,
      (select case when to_regclass('supabase_migrations.schema_migrations') is null then 0
                   else (select count(*) from supabase_migrations.schema_migrations) end) as migration_rows,
      (select case when to_regclass('auth.users') is null then 0
                   else (select count(*) from auth.users) end) as auth_users,
      (select case when to_regclass('storage.buckets') is null then 0
                   else (select count(*) from storage.buckets) end) as storage_buckets,
      (select case when to_regclass('storage.objects') is null then 0
                   else (select count(*) from storage.objects) end) as storage_objects;
  `;
  const result = runner("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", ",", dbUrl, "-c", query]);
  if (result.status !== 0) {
    // Fail closed: an unprovable target is never a fresh target.
    return { ok: false, failure: describeSpawnResult(result, "psql (hosted application-emptiness probe)"), stderr: result.stderr };
  }
  const fields = (result.stdout ?? "").trim().split(/\r?\n/).pop()?.split(",") ?? [];
  const keys = ["user_schemas", "user_relations", "public_rows", "user_functions", "user_types", "user_policies", "migration_rows", "auth_users", "storage_buckets", "storage_objects"];
  if (fields.length !== keys.length || fields.some((f) => !/^\d+$/.test(f.trim()))) {
    return { ok: false, reason: `the application-emptiness probe returned unrecognized output (${fields.length} field(s)); refusing to infer emptiness.` };
  }
  const counts = Object.fromEntries(keys.map((k, i) => [k, Number(fields[i].trim())]));

  // Triggers need per-object FINGERPRINTS, not a count, because the stock platform
  // baseline is matched structurally. A separate read-only query returns one row per
  // non-internal trigger; `~|~` is used as the field separator because a trigger
  // definition can legitimately contain almost anything else.
  const triggerQuery = `
    select n.nspname || '~|~' || c.relname || '~|~' || t.tgname || '~|~' || fn.nspname || '~|~' ||
           pr.proname || '~|~' || pg_get_userbyid(pr.proowner) || '~|~' ||
           replace(replace(pg_get_triggerdef(t.oid), chr(10), ' '), chr(13), ' ') || '~|~' ||
           case when exists (select 1 from pg_depend d
                               where d.classid = 'pg_trigger'::regclass and d.objid = t.oid and d.deptype = 'e')
                then 'ext' else 'user' end
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc pr on pr.oid = t.tgfoid
      join pg_namespace fn on fn.oid = pr.pronamespace
     where not t.tgisinternal;
  `;
  const trig = runner("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", dbUrl, "-c", triggerQuery]);
  if (trig.status !== 0) {
    // Fail closed: an unprovable trigger surface is never an empty one.
    return { ok: false, failure: describeSpawnResult(trig, "psql (hosted trigger-fingerprint probe)"), stderr: trig.stderr };
  }
  const observed = [];
  for (const line of (trig.stdout ?? "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const f = line.split("~|~");
    if (f.length !== 8) {
      return { ok: false, reason: `the trigger-fingerprint probe returned an unrecognized row (${f.length} field(s)); refusing to infer emptiness.` };
    }
    observed.push({
      relation_schema: f[0], relation_name: f[1], trigger_name: f[2],
      function_schema: f[3], function_name: f[4], function_owner: f[5],
      definition: f[6], is_internal: false, extension_owned: f[7] === "ext",
    });
  }
  // EVENT TRIGGERS are database-level and live in pg_event_trigger, entirely outside
  // pg_trigger — so every counter above can read zero while a user event trigger sits
  // ready to fire during the migration DDL itself and rewrite or block the push. The
  // measured stock project carries ZERO of them, so no structural baseline is needed and
  // no schema exemption applies: anything not positively extension-owned refuses FRESH.
  const eventQuery = `
    select evt.evtname || '~|~' || evt.evtevent || '~|~' || evt.evtenabled || '~|~' ||
           fn.nspname || '~|~' || pr.proname || '~|~' ||
           case when exists (select 1 from pg_depend d
                               where d.classid = 'pg_event_trigger'::regclass and d.objid = evt.oid and d.deptype = 'e')
                then 'ext' else 'user' end
      from pg_event_trigger evt
      join pg_proc pr on pr.oid = evt.evtfoid
      join pg_namespace fn on fn.oid = pr.pronamespace;
  `;
  const evt = runner("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", dbUrl, "-c", eventQuery]);
  if (evt.status !== 0) {
    return { ok: false, failure: describeSpawnResult(evt, "psql (hosted event-trigger probe)"), stderr: evt.stderr };
  }
  const eventTriggers = [];
  for (const line of (evt.stdout ?? "").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const f = line.split("~|~");
    if (f.length !== 6) {
      return { ok: false, reason: `the event-trigger probe returned an unrecognized row (${f.length} field(s)); refusing to infer emptiness.` };
    }
    // Extension ownership is the ONLY exemption, and only when pg_depend proves it. A
    // platform-owned trigger FUNCTION never launders the event trigger's own provenance.
    if (f[5] === "ext") continue;
    eventTriggers.push({ name: f[0], event: f[1], enabled: f[2], function_schema: f[3], function_name: f[4] });
  }
  counts.user_event_triggers = eventTriggers.length;

  const triggers = classifyObservedTriggers(observed);
  // Drift in EITHER direction defeats fresh certification.
  counts.user_triggers = triggers.nonStockCount + triggers.missingStockCount;

  const verdict = classifyObjectEmptiness(counts);
  return {
    ok: true, counts, observedTriggers: observed,
    nonStockTriggers: triggers.nonStock, missingStockTriggers: triggers.missingStock,
    eventTriggers, verdict,
  };
}

// Reads the linked project's migration history WITHOUT mutating it.
//
// FAIL-CLOSED RECOGNITION. A zero exit does not prove the output was understood. The CLI
// prints one row per LOCAL migration even when the remote is empty, so with local
// migrations present, "zero recognized rows" can never legitimately mean "empty remote" —
// it means the format was not recognized. That is exactly how the earlier backtick
// regression behaved, and it must never be readable as TARGET_IS_FRESH.
function readHostedMigrationVersions(localTimestamps, runner = runNpx) {
  const list = runner(["-y", "supabase", "migration", "list", "--linked"], {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN },
  });
  if (list.status !== 0) {
    return { ok: false, failure: describeSpawnResult(list, "npx supabase migration list --linked"), stderr: list.stderr };
  }
  const parsed = parseHostedMigrationList(list.stdout ?? "", localTimestamps);
  const recognition = recognizeMigrationListRows(parsed.rows, localTimestamps);
  if (!recognition.ok) return { ok: false, reason: recognition.reason };
  return { ok: true, remoteVersions: parsed.rows.map((r) => r.remote).filter(Boolean) };
}

// Pure, so the invariant is unit-testable without a CLI.
function recognizeMigrationListRows(rows, localTimestamps) {
  const locals = [...new Set(localTimestamps)];
  if (locals.length === 0) return { ok: true };
  if (rows.length === 0) {
    return {
      ok: false,
      reason:
        `UNRECOGNIZED_OUTPUT: 'supabase migration list --linked' exited 0 but no migration rows were recognized, ` +
        `while ${locals.length} local migration(s) exist. The CLI lists every LOCAL migration even against an empty ` +
        "remote, so zero recognized rows means the output format was not understood — not that the target is fresh.",
    };
  }
  const seenLocal = new Set(rows.map((r) => r.local).filter(Boolean));
  const unaccounted = locals.filter((v) => !seenLocal.has(v));
  if (unaccounted.length > 0) {
    return {
      ok: false,
      reason:
        `UNRECOGNIZED_OUTPUT: the parsed migration table does not account for ${unaccounted.length} local ` +
        `migration(s) (${unaccounted.slice(0, 5).join(", ")}${unaccounted.length > 5 ? ", ..." : ""}). Refusing to ` +
        "classify the target from partially-understood output.",
    };
  }
  return { ok: true };
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
    applyResult = applyHosted(files);
  }

  const label = mode === "hosted" && applyResult.ok && applyResult.certification === "REPEATABILITY"
    ? "Fresh apply (SKIPPED — target already fully migrated; REPEATABILITY only)"
    : "Fresh apply";
  results.push([label, applyResult.ok ? "PASS" : "FAIL"]);
  if (!applyResult.ok) {
    console.error(`  Failed at: ${applyResult.failedFile ?? "(link/push step)"}`);
    if (applyResult.reason) console.error(`  ${applyResult.reason}`);
    if (applyResult.failure) console.error(formatFailure(applyResult.failure));
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
  classifyHostedTarget,
  classifyObjectEmptiness,
  classifyObservedTriggers,
  normalizeTriggerDefinition,
  STOCK_PLATFORM_TRIGGER_BASELINE,
  probeHostedApplicationState,
  extractSupabaseProjectRefFromDbUrl,
  verifyHostedTargetBinding,
  recognizeMigrationListRows,
  readHostedMigrationVersions,
  HOSTED_ALLOWED_VALIDATION_REFS,
  applyHosted,
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
