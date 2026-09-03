/**
 * Harness integrity regressions for the P0-LAUNCH-06 child-process lifecycle.
 *
 * These are UNIT-level and deliberately standalone: they need no build, no Supabase,
 * no server and no fixture, so the properties the rehearsal's evidence rests on can be
 * re-proved without consuming an authoritative battery execution.
 *
 * Three exact-head review findings are covered:
 *
 *   F1  X1 accepted `/next build/` against raw output, which npm's own lifecycle banner
 *       already emits before the script executable proves anything.
 *   F2  A synchronous `timeout` bounds only the direct child, so npm's shell and the
 *       `next`/`tsx` process under it could outlive the deadline unrecorded.
 *   F3  `npm_execpath` is also populated by pnpm and yarn, so "present, JavaScript,
 *       exists" did not establish that the CLI is npm.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HARNESS_PROCESS_RESIDUE,
  PROC_AVAILABLE,
  nextBuildHelpProof,
  npmCliPath,
  pidAlive,
  pidExistsBySignal,
  processGroupPids,
  runBoundedChild,
  windowsTreeKill,
} from "./acceptance/support/runtime-acceptance";

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), "harness-child-lifecycle-"));

// ──────── F1 — npm's lifecycle banner is not proof that Next's binary ran ────────

test("F1. npm's lifecycle BANNER alone does not satisfy the `next build` proof", () => {
  // The exact bytes npm emits before it runs the script. The second line is npm
  // echoing the script's command string, so a wrapper or a no-op produces it too.
  const banner = ["", "> pmfreak@0.1.0 build", "> next build --help", ""].join("\n");
  const verdict = nextBuildHelpProof(banner);
  assert.equal(verdict.ok, false, "npm's lifecycle banner alone was accepted as proof Next ran");
  assert.equal(verdict.body, "", "the banner filter left npm's own output in the body");
  assert.match(verdict.reason, /usage signature/, `unexpected refusal reason: ${verdict.reason}`);

  // A banner plus arbitrary non-Next chatter is still not proof.
  const noisy = [banner, "build complete", "next build finished successfully"].join("\n");
  assert.equal(nextBuildHelpProof(noisy).ok, false, "prose merely mentioning `next build` was accepted as proof");

  // A usage line with NO options listing is not proof that help actually rendered.
  const usageOnly = [banner, "Usage: next build [directory] [options]"].join("\n");
  const usageVerdict = nextBuildHelpProof(usageOnly);
  assert.equal(usageVerdict.ok, false, "a bare usage line without an options listing was accepted");
  assert.match(usageVerdict.reason, /options listing/, `unexpected refusal reason: ${usageVerdict.reason}`);
});

test("F1. the real npm -> build script -> next build chain DOES satisfy the proof", async () => {
  // npm is deliberately NOT bypassed: the claim under test is the chain `before()`
  // uses, so the proof must travel through npm's own CLI exactly as the build does.
  const run = await runBoundedChild({
    label: "F1 regression: build-chain launch proof",
    command: process.execPath,
    args: [npmCliPath(), "run", "build", "--", "--help"],
    cwd: process.cwd(),
    timeoutMs: 120_000,
  });
  assert.equal(run.launchError, null, `the build chain could not be launched: ${run.launchError}`);
  assert.equal(run.timedOut, false, "the build-chain launch proof timed out");
  assert.equal(run.exit, 0, `the build chain exited ${run.exit}: ${run.stderr.slice(0, 300)}`);

  const raw = `${run.stdout}\n${run.stderr}`;
  // The raw output DOES contain npm's banner — which is precisely why the old
  // assertion could pass without Next. The proof must survive removing it.
  assert.match(raw, /^\s*>\s.*next build/m, "npm's lifecycle banner was not present, so this is not the chain under test");
  const verdict = nextBuildHelpProof(raw);
  assert.ok(verdict.ok, `Next's own help output was not observed: ${verdict.reason}; body=${verdict.body.slice(0, 300)}`);
  assert.match(verdict.body, /^Usage: next build \[directory\] \[options\]/m, "the surviving body carries no Next usage signature");
});

// ─────────────────────────── F3 — npm CLI identity ───────────────────────────

/** Runs `body` with npm_execpath forced to `value`, always restoring the real one. */
function withExecpath<T>(value: string | undefined, body: () => T): T {
  const saved = process.env.npm_execpath;
  if (value === undefined) delete process.env.npm_execpath;
  else process.env.npm_execpath = value;
  try {
    return body();
  } finally {
    if (saved === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = saved;
  }
}

const refusedBy = (value: string | undefined): string | null =>
  withExecpath(value, () => {
    try {
      npmCliPath();
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  });

test("F3. npmCliPath ACCEPTS the real npm lifecycle CLI this test is running under", () => {
  const resolved = npmCliPath();
  assert.equal(resolved, process.env.npm_execpath, "the accepted path is not the lifecycle value");
  assert.ok(fs.existsSync(resolved), "the accepted npm CLI does not exist");
  // Ownership, not a path substring: the manifest that ships the file must BE npm.
  let dir = path.dirname(fs.realpathSync(resolved));
  let manifest: { name?: string } | null = null;
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      manifest = JSON.parse(fs.readFileSync(candidate, "utf8")) as { name?: string };
      break;
    }
    dir = path.dirname(dir);
  }
  assert.equal(manifest?.name, "npm", "the accepted CLI is not owned by the npm package");
});

test("F3. npmCliPath REFUSES every non-npm shape, and never falls back to PATH", () => {
  const dir = scratch();
  try {
    // A pnpm-style CLI: a real, existing `.cjs` owned by a package named `pnpm`.
    const pnpmDir = path.join(dir, "pnpm-install", "pnpm");
    fs.mkdirSync(path.join(pnpmDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(pnpmDir, "package.json"), JSON.stringify({ name: "pnpm", version: "9.0.0", bin: { pnpm: "bin/pnpm.cjs" } }));
    const pnpmCli = path.join(pnpmDir, "bin", "pnpm.cjs");
    fs.writeFileSync(pnpmCli, "// pnpm\n");

    // An arbitrary JavaScript CLI with no package.json at all.
    const orphanCli = path.join(dir, "orphan-cli.js");
    fs.writeFileSync(orphanCli, "// not a package manager\n");

    // A package that LIES about its name but declares no npm bin entry.
    const spoofDir = path.join(dir, "spoof", "npm");
    fs.mkdirSync(path.join(spoofDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(spoofDir, "package.json"), JSON.stringify({ name: "npm", version: "0.0.0" }));
    const spoofCli = path.join(spoofDir, "bin", "npm-cli.js");
    fs.writeFileSync(spoofCli, "// claims to be npm, declares no bin\n");

    // A package named npm whose declared npm bin is a DIFFERENT file.
    const mismatchDir = path.join(dir, "mismatch", "npm");
    fs.mkdirSync(path.join(mismatchDir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(mismatchDir, "package.json"), JSON.stringify({ name: "npm", version: "0.0.0", bin: { npm: "bin/real-cli.js" } }));
    fs.writeFileSync(path.join(mismatchDir, "bin", "real-cli.js"), "// the declared entry\n");
    const mismatchCli = path.join(mismatchDir, "bin", "impostor-cli.js");
    fs.writeFileSync(mismatchCli, "// not the declared entry\n");

    const cases: Array<[string, string | undefined, RegExp]> = [
      ["missing npm_execpath", undefined, /npm_execpath is not set/],
      ["a Windows .cmd launcher", "C:\\Program Files\\nodejs\\npm.cmd", /is not a JavaScript file/],
      ["a nonexistent JavaScript file", path.join(dir, "absent", "npm-cli.js"), /does not exist/],
      ["a pnpm CLI", pnpmCli, /belongs to package "pnpm", not npm/],
      ["an unowned JavaScript CLI", orphanCli, /no owning package\.json|belongs to package/],
      ["a package named npm with no npm bin", spoofCli, /declares no `npm` bin entry/],
      ["a package named npm whose bin is a different file", mismatchCli, /is not the CLI entry its own package declares/],
    ];

    for (const [label, value, expected] of cases) {
      const message = refusedBy(value);
      assert.ok(message, `${label} was ACCEPTED as the npm CLI`);
      assert.match(message, expected, `${label} was refused for the wrong reason: ${message}`);
      assert.match(message, /Refusing to guess at another npm installation\./, `${label} did not fail closed`);
    }

    // The real value still resolves afterwards: the probes restored the environment.
    assert.equal(npmCliPath(), process.env.npm_execpath, "the lifecycle npm_execpath was not restored");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ───────────── F2 — a timed-out child must not leave descendants alive ─────────────

test("F2 (linux). a timed-out child's DESCENDANT is reaped, and residue is never silently omitted", async (t) => {
  if (!PROC_AVAILABLE) {
    t.skip("the /proc group model is Linux-only; the Windows path is covered by its own case");
    return;
  }
  const dir = scratch();
  const residueBefore = HARNESS_PROCESS_RESIDUE.length;
  try {
    // A controlled parent that spawns a long-lived DESCENDANT and then outlives the
    // deadline itself. This is the exact shape a synchronous timeout mishandles: the
    // direct child is signalled, the grandchild keeps running.
    const marker = path.join(dir, "descendant.pid");
    const parent = path.join(dir, "parent.mjs");
    fs.writeFileSync(
      parent,
      [
        'import { spawn } from "node:child_process";',
        'import fs from "node:fs";',
        // The descendant sleeps far past any deadline this test uses.
        // `detached` is what makes this regression load-bearing. A plain descendant is
        // killed as a side effect of the root dying on both platforms (libuv places it
        // in the parent's job object on Windows; it stays in the root's process group on
        // Linux), so a plain child would pass even against direct-child-only cleanup.
        // A detached one escapes BOTH of those, and is exactly the shape a shell
        // launcher or a server process takes.
        'const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 600000)"], { stdio: "ignore", detached: true });',
        "child.unref();",
        `fs.writeFileSync(${JSON.stringify(marker)}, String(child.pid));`,
        "setTimeout(() => {}, 600000);",
      ].join("\n"),
    );

    const run = await runBoundedChild({
      label: "F2 regression: parent with a long-lived descendant",
      command: process.execPath,
      args: [parent],
      cwd: dir,
      timeoutMs: 2_000,
    });

    assert.equal(run.timedOut, true, "the controlled child did not exceed its deadline");
    assert.equal(run.treeVerified, true, "the process tree was not verified on a /proc platform");
    assert.equal(run.treeCleanup, "linux-proc-group", `the Linux path did not use the group model: ${run.treeCleanup}`);
    assert.equal(run.cleanupError, null, `cleanup reported a failure: ${run.cleanupError}`);
    assert.ok(run.rootPid, "no root pid was recorded for the bounded child");

    const descendantPid = Number(fs.readFileSync(marker, "utf8").trim());
    assert.ok(Number.isFinite(descendantPid) && descendantPid > 0, "the controlled descendant never started");

    // THE FINDING. A direct-child-only timeout leaves this process running.
    assert.equal(
      pidAlive(descendantPid),
      false,
      `the descendant (${descendantPid}) survived the timeout; a bounded child must reap its whole tree`,
    );
    assert.equal(pidAlive(run.rootPid!), false, `the root (${run.rootPid}) survived the timeout`);
    assert.equal(processGroupPids(run.rootPid!).filter(pidAlive).length, 0, "the child's process group still has running members");

    // Reaped cleanly, so nothing was added to the ledger. The two facts are asserted
    // together: "no residue" is only meaningful alongside "the tree really is gone".
    assert.deepEqual(run.survivors, [], `survivors were reported: ${run.survivors.join(",")}`);
    assert.deepEqual(run.unreaped, [], `uncollected processes were reported: ${run.unreaped.join(",")}`);
    assert.equal(
      HARNESS_PROCESS_RESIDUE.length,
      residueBefore,
      "residue was recorded even though the tree was reaped; the ledger and the reaping disagree",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("F2 (linux). a child that exits cleanly still reports a verified, empty process tree", async (t) => {
  if (!PROC_AVAILABLE) {
    t.skip("whole-tree observation of a clean exit requires /proc; authoritative evidence is Linux-only");
    return;
  }
  const residueBefore = HARNESS_PROCESS_RESIDUE.length;
  const run = await runBoundedChild({
    label: "F2 regression: clean exit",
    command: process.execPath,
    args: ["-e", "process.stdout.write('done'); process.exit(3);"],
    cwd: process.cwd(),
    timeoutMs: 30_000,
  });
  assert.equal(run.timedOut, false, "a fast child was reported as timed out");
  assert.equal(run.exit, 3, `the child's real exit code was not preserved: ${run.exit}`);
  assert.equal(run.stdout, "done", `stdout was not captured: ${JSON.stringify(run.stdout)}`);
  assert.equal(run.treeVerified, true, "the tree was not verified on a /proc platform");
  assert.deepEqual(run.survivors, [], "a clean exit reported survivors");
  assert.equal(HARNESS_PROCESS_RESIDUE.length, residueBefore, "a clean exit recorded residue");
});


// ───── F2 (windows) — a timeout must not leave the npm/next/tsx descendant alive ─────
//
// There is no process group to signal and no /proc to enumerate on Windows, so the
// Linux model above cannot run there and its absence must not degrade to killing the
// direct child only — which is the exact tree the original finding was about.
//
// These cases run ONLY under native Windows Node (`process.platform === "win32"`).
// They are not emulated from WSL: WSL reports "linux" and takes the branch above.

const onWindows = process.platform === "win32";

test("F2 (windows). a timed-out child's DESCENDANT is terminated by taskkill /T /F", async (t) => {
  if (!onWindows) {
    t.skip("native Windows only; the Linux /proc path is covered above");
    return;
  }
  const dir = scratch();
  const residueBefore = HARNESS_PROCESS_RESIDUE.length;
  try {
    // The controlled shape under test: a parent that spawns a long-lived DESCENDANT
    // and then outlives the deadline itself. The descendant's pid is persisted so this
    // test can check it directly — never inferred from taskkill's stdout.
    const marker = path.join(dir, "descendant.pid");
    const parent = path.join(dir, "parent.mjs");
    fs.writeFileSync(
      parent,
      [
        'import { spawn } from "node:child_process";',
        'import fs from "node:fs";',
        // `detached` is what makes this regression load-bearing. A plain descendant is
        // killed as a side effect of the root dying on both platforms (libuv places it
        // in the parent's job object on Windows; it stays in the root's process group on
        // Linux), so a plain child would pass even against direct-child-only cleanup.
        // A detached one escapes BOTH of those, and is exactly the shape a shell
        // launcher or a server process takes.
        'const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 600000)"], { stdio: "ignore", detached: true });',
        "child.unref();",
        `fs.writeFileSync(${JSON.stringify(marker)}, String(child.pid));`,
        "setTimeout(() => {}, 600000);",
      ].join("\n"),
    );

    const run = await runBoundedChild({
      label: "F2 windows regression: parent with a long-lived descendant",
      command: process.execPath,
      args: [parent],
      cwd: dir,
      timeoutMs: 4_000,
    });

    assert.equal(run.timedOut, true, "the controlled child did not exceed its deadline");
    assert.equal(run.treeCleanup, "windows-taskkill", `the Windows cleanup path did not run: ${run.treeCleanup}`);
    assert.equal(run.windowsTreeKill, "SUCCESS", `the Windows tree kill failed: ${run.cleanupError}`);
    assert.equal(run.cleanupError, null, `cleanup reported a failure: ${run.cleanupError}`);
    // Honest boundary: terminating a tree is not observing one. /proc remains the only
    // authoritative process-evidence platform, so this must NOT claim verification.
    assert.equal(run.treeVerified, false, "Windows must not claim /proc-grade tree verification");
    assert.ok(run.rootPid, "no root pid was recorded");

    const descendantPid = Number(fs.readFileSync(marker, "utf8").trim());
    assert.ok(Number.isFinite(descendantPid) && descendantPid > 0, "the controlled descendant never started");

    // THE FINDING, checked directly against the process table on both pids.
    assert.equal(pidExistsBySignal(run.rootPid!), false, `the root (${run.rootPid}) survived the timeout`);
    assert.equal(
      pidExistsBySignal(descendantPid),
      false,
      `the descendant (${descendantPid}) survived the timeout; /T did not reach the tree`,
    );
    assert.equal(HARNESS_PROCESS_RESIDUE.length, residueBefore, "clean Windows cleanup still recorded residue");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("F2 (windows). taskkill that CANNOT LAUNCH fails closed and is recorded", async (t) => {
  if (!onWindows) {
    t.skip("native Windows only");
    return;
  }
  const dir = scratch();
  const residueBefore = HARNESS_PROCESS_RESIDUE.length;
  try {
    const parent = path.join(dir, "parent.mjs");
    fs.writeFileSync(parent, "setTimeout(() => {}, 600000);\n");
    const run = await runBoundedChild({
      label: "F2 windows regression: taskkill cannot launch",
      command: process.execPath,
      args: [parent],
      cwd: dir,
      timeoutMs: 3_000,
      taskkillExecutable: path.join(dir, "no-such-taskkill.exe"),
    });
    assert.equal(run.timedOut, true, "the controlled child did not exceed its deadline");
    assert.equal(run.windowsTreeKill, "FAILED", "a taskkill that could not launch was reported as successful cleanup");
    assert.ok(run.cleanupError, "a cleanup failure produced no cleanupError");
    assert.equal(
      HARNESS_PROCESS_RESIDUE.length,
      residueBefore + 1,
      "a Windows cleanup failure was not recorded in the residue ledger",
    );
    assert.match(
      HARNESS_PROCESS_RESIDUE[HARNESS_PROCESS_RESIDUE.length - 1]!.control,
      /windows tree cleanup/,
      "the residue entry does not identify the Windows cleanup failure",
    );
    // Do not leave the deliberately-unkilled child behind.
    if (run.rootPid && pidExistsBySignal(run.rootPid)) await windowsTreeKill(run.rootPid);
    HARNESS_PROCESS_RESIDUE.length = residueBefore;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("F2 (windows). taskkill that exits NON-ZERO is a cleanup failure, not success", async (t) => {
  if (!onWindows) {
    t.skip("native Windows only");
    return;
  }
  // A pid that cannot exist: real taskkill runs and refuses it, exiting non-zero.
  const result = await windowsTreeKill(0x7ffffffe);
  assert.equal(result.ok, false, "taskkill's non-zero exit was read as successful cleanup");
  assert.notEqual(result.exit, 0, `expected a non-zero exit, got ${result.exit}`);
  assert.match(result.reason, /taskkill exited/, `unexpected reason: ${result.reason}`);
});

test("F2 (windows). the cleanup path never reaches a shell", async (t) => {
  if (!onWindows) {
    t.skip("native Windows only");
    return;
  }
  // taskkill is invoked directly with the pid as its own argv element. If a shell were
  // involved, this obviously-invalid pid string would be re-parsed rather than rejected
  // by taskkill itself, so a taskkill-shaped refusal is evidence there was no shell.
  const result = await windowsTreeKill(Number.NaN);
  assert.equal(result.ok, false, "an invalid pid was reported as successful cleanup");
  assert.match(result.reason, /taskkill (exited|could not be started|did not complete)/, `unexpected reason: ${result.reason}`);
});

test("F2. a child that cannot be launched fails fast rather than burning the deadline", async () => {
  const startedAt = Date.now();
  const run = await runBoundedChild({
    label: "F2 regression: launch failure",
    command: path.join(os.tmpdir(), "no-such-executable-a1b2c3"),
    args: [],
    cwd: process.cwd(),
    timeoutMs: 30_000,
  });
  assert.ok(run.launchError, "a nonexistent executable did not report a launch error");
  assert.equal(run.timedOut, false, "a launch failure was reported as a timeout");
  assert.ok(Date.now() - startedAt < 10_000, "a launch failure consumed the full deadline");
});
