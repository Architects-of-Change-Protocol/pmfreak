/**
 * P0-LAUNCH-01 — line-ending policy guard.
 *
 * THE DEFECT THIS EXISTS FOR
 *
 * Every text blob in this repository is committed LF, and nothing enforced that on the way
 * out. There was no `.gitattributes` at all. Git for Windows ships `core.autocrlf=true` as
 * its DEFAULT, so an ordinary, permitted clone materialises those LF blobs as CRLF on disk.
 *
 * That contamination is invisible to `git status`: `autocrlf` normalises CRLF back to LF on
 * read, so the worktree compares clean against the LF blob while every file on disk carries
 * CR. The repository could not see its own contamination.
 *
 * It is not cosmetic. This repository gates itself largely by INSPECTING ITS OWN SOURCE
 * TEXT, and those assertions are anchored with `\n` and `$`. In JavaScript `.` does not
 * match `\r` (it is a line terminator) and `$` without the `m` flag matches only
 * end-of-input — so a single `\r` silently defeats them. Reproduced at 85511ce on a
 * pristine `git -c core.autocrlf=true checkout-index` of the exact committed tree:
 *
 *     LF materialisation   — 13332 tests, 0 failing
 *     CRLF materialisation — 13332 tests, 13 failing
 *
 * and `check:ci-workflow-integrity` reports a FALSE failure, because its `stripComments`
 * helper stops stripping and prose that literally reads "no `|| true`" then trips the
 * assertion forbidding `|| true`.
 *
 * `.gitattributes` (`* text=auto eol=lf`) is the fix. This is the negative guard: it fails
 * if that policy is ever weakened, removed, or if any tracked text file is materialised
 * with CR. It asserts the WORKTREE, which is exactly the surface the source-inspecting
 * gates read and the one `git status` cannot speak about.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const trackedFiles = () =>
  execFileSync("git", ["ls-files", "-z"], { maxBuffer: 1 << 28 })
    .toString()
    .split("\0")
    .filter(Boolean);

/** A NUL byte is Git's own binary heuristic; binaries legitimately contain 0x0d. */
const isBinary = (buffer) => buffer.includes(0);

const attributes = fs.readFileSync(".gitattributes", "utf8");

test("the repository declares a line-ending policy at all", () => {
  // The original defect was the ABSENCE of this file, not its contents.
  assert.ok(fs.existsSync(".gitattributes"), ".gitattributes must exist");
});

test("the policy pins every text file to LF on checkout, on every platform", () => {
  // `eol=lf` is the operative clause: it makes materialisation deterministic regardless of
  // the cloner's `core.autocrlf`. `text=auto` alone would still honour autocrlf=true.
  assert.match(
    attributes,
    /^\*\s+text=auto\s+eol=lf\s*$/m,
    "`* text=auto eol=lf` must be declared, or a default Windows clone reintroduces CRLF"
  );
});

test("checksum-verified binary artifacts are excluded from text filtering", () => {
  // The frozen upstream tarballs are pinned by SHA-256 (check:tarball-purity,
  // check:packaged-aoc-artifacts). Their integrity must not rest on a content heuristic.
  for (const pattern of ["*.tgz", "*.png", "*.gif", "*.ico"]) {
    assert.match(
      attributes,
      new RegExp(`^\\${pattern}\\s+binary\\s*$`.replace("\\*", "\\*"), "m"),
      `${pattern} must be declared binary so no filter can ever rewrite it`
    );
  }
});

test("NEGATIVE GUARD: no tracked text file is materialised with CR", () => {
  const offenders = [];
  for (const file of trackedFiles()) {
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch {
      continue; // not materialised in this checkout (sparse/partial) — not this gate's concern
    }
    if (isBinary(buffer)) continue;
    if (buffer.includes(0x0d)) offenders.push(file);
  }

  assert.deepEqual(
    offenders.slice(0, 20),
    [],
    offenders.length === 0
      ? ""
      : `${offenders.length} tracked text file(s) contain CR. This checkout is CRLF-contaminated, ` +
        `so every source-inspecting assertion in this suite is unreliable. The committed blobs are ` +
        `LF — this is a materialisation defect. Re-checkout with the repository's .gitattributes in ` +
        `place (git add --renormalize . && git checkout -- .), or clone with core.autocrlf=input. ` +
        `First offenders: ${offenders.slice(0, 20).join(", ")}`
  );
});

test("the CR-sensitivity that made this silent is real and still worth guarding", () => {
  // Pins the exact JavaScript semantics behind the 13 failures, so nobody later "simplifies"
  // the guard away believing CRLF is merely cosmetic.
  const stripComments = (text) =>
    text
      .split("\n")
      .map((line) => line.replace(/(^|\s)#.*$/, ""))
      .join("\n");

  assert.equal(/./.test("\r"), false, "`.` must not match CR — this is why `.*$` fails on CRLF");
  assert.equal(
    /\|\|\s*true/.test(stripComments("  # prose mentioning `|| true`\n")),
    false,
    "on LF the comment is stripped"
  );
  assert.equal(
    /\|\|\s*true/.test(stripComments("  # prose mentioning `|| true`\r\n")),
    true,
    "on CRLF it is NOT stripped — the exact mechanism of the false governance failure"
  );
});
