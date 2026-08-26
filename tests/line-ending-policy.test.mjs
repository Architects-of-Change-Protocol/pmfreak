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
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const trackedFiles = () =>
  execFileSync("git", ["ls-files", "-z"], { maxBuffer: 1 << 28 })
    .toString()
    .split("\0")
    .filter(Boolean);

/** A NUL byte is Git's own binary heuristic; binaries legitimately contain 0x0d. */
const isBinary = (buffer) => buffer.includes(0);

/**
 * The EFFECTIVE `text` / `eol` attributes Git will actually apply, per path.
 *
 * Asking Git rather than reading `.gitattributes` is the point. Attribute resolution is
 * last-match-wins over increasingly specific patterns, so a single later line — `*.ts
 * eol=crlf`, `src/** eol=crlf` — silently overrides the `*` default while any textual
 * assertion about that default keeps passing. Only Git can answer what a checkout will do.
 */
function effectiveEolAttributes(paths, cwd = process.cwd()) {
  const out = execFileSync("git", ["check-attr", "-z", "--stdin", "text", "eol"], {
    input: paths.join("\0"),
    cwd,
    maxBuffer: 1 << 28,
  }).toString();
  // -z output is a flat NUL-separated stream of (path, attribute, value) triples.
  const fields = out.split("\0");
  const resolved = new Map();
  for (let i = 0; i + 2 < fields.length; i += 3) {
    const [file, attribute, value] = [fields[i], fields[i + 1], fields[i + 2]];
    if (!resolved.has(file)) resolved.set(file, {});
    resolved.get(file)[attribute] = value;
  }
  return resolved;
}

/**
 * Does this resolution permit CRLF in the working tree?
 *
 * `text: unset` is the `binary` macro (`-text`): no conversion happens and `eol` is inert, so
 * those files are exempt by construction. For everything Git treats as text, `eol` must be
 * `lf`. `unspecified` is a FAILURE, not a neutral: it is precisely the original defect — the
 * checkout falls back to the cloner's `core.autocrlf`, which on Git for Windows means CRLF.
 */
const permitsCrlf = ({ text, eol }) => text !== "unset" && eol !== "lf";

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

test("EFFECTIVE POLICY: every tracked text file resolves to eol=lf, as Git itself reports it", () => {
  // The authoritative form of the check above. The textual assertion proves the default is
  // DECLARED; this proves it is not overridden for any actual file in the repository.
  const files = trackedFiles();
  assert.ok(files.length > 1000, `expected a populated repository, got ${files.length} tracked files`);

  const resolved = effectiveEolAttributes(files);
  const offenders = [];
  let exemptBinaries = 0;

  for (const file of files) {
    const attributes = resolved.get(file);
    assert.ok(attributes, `git check-attr returned no resolution for ${file}`);
    if (attributes.text === "unset") {
      exemptBinaries += 1;
      continue;
    }
    if (permitsCrlf(attributes)) {
      offenders.push(`${file} (text=${attributes.text}, eol=${attributes.eol})`);
    }
  }

  assert.ok(exemptBinaries > 0, "expected at least the frozen tarballs to be exempt as binary");
  assert.deepEqual(
    offenders.slice(0, 20),
    [],
    offenders.length === 0
      ? ""
      : `${offenders.length} tracked text file(s) resolve to an EOL policy that permits CRLF. ` +
        `A later or more specific .gitattributes rule has overridden the repository default, or the ` +
        `default was weakened. eol=unspecified is a failure too: it hands the decision back to the ` +
        `cloner's core.autocrlf. First offenders: ${offenders.slice(0, 20).join(", ")}`
  );
});

test("NEGATIVE GUARD: the effective-attribute check detects an override that the textual check cannot", () => {
  // Proven in a throwaway repository, so the real one is never made dirty to run this.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pmfreak-eol-guard-"));
  try {
    execFileSync("git", ["init", "-q", "."], { cwd: scratch });
    const probes = ["src/engine.ts", "README.md", "vendor/frozen.tgz"];
    const write = (policy) => fs.writeFileSync(path.join(scratch, ".gitattributes"), policy);
    const resolve = () => effectiveEolAttributes(probes, scratch);

    const BASE = "* text=auto eol=lf\n*.tgz binary\n";

    // Baseline: the repository's own policy shape is clean, and the tarball is exempt.
    write(BASE);
    let attributes = resolve();
    assert.equal(permitsCrlf(attributes.get("src/engine.ts")), false, "base policy must not permit CRLF");
    assert.equal(attributes.get("vendor/frozen.tgz").text, "unset", "binary artifacts stay exempt");

    // 1. The exact override this finding is about. The textual assertion still matches BASE.
    write(`${BASE}*.ts eol=crlf\n`);
    attributes = resolve();
    assert.match(fs.readFileSync(path.join(scratch, ".gitattributes"), "utf8"), /^\*\s+text=auto\s+eol=lf\s*$/m);
    assert.equal(permitsCrlf(attributes.get("src/engine.ts")), true, "*.ts eol=crlf must be detected");
    assert.equal(permitsCrlf(attributes.get("README.md")), false, "and must not be attributed to unrelated files");

    // 2. A path-scoped override reaches the same place by a different route.
    write(`${BASE}src/** eol=crlf\n`);
    assert.equal(permitsCrlf(resolve().get("src/engine.ts")), true, "src/** eol=crlf must be detected");

    // 3. Weakening the default to `text=auto` alone — eol becomes `unspecified`, which hands
    //    the decision back to core.autocrlf. That IS the original defect, so it must fail.
    write("* text=auto\n");
    const weakened = resolve().get("src/engine.ts");
    assert.equal(weakened.eol, "unspecified");
    assert.equal(permitsCrlf(weakened), true, "a policy without eol=lf must be detected as permitting CRLF");

    // 4. Removing the policy entirely — the state the repository was actually in.
    write("");
    assert.equal(permitsCrlf(resolve().get("src/engine.ts")), true, "no policy at all must be detected");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
