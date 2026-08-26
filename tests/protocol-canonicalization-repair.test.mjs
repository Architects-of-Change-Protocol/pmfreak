/**
 * P0-PKG-09 — PMFreak-side consumer regression for the burned
 * `@aoc/protocol@0.2.0-rc.0` canonicalization defect.
 *
 * rc.0 was BURNED under UG-003: its canonical-JSON writer truncated the exponent
 * of numbers rendered in exponential notation with a fractional mantissa, so
 * `canonicalizeJSON(7.9e-10)` and `canonicalizeJSON(7.9e-100)` both produced
 * `"7.9e-1"` — two distinct values, one canonical form, therefore one digest. The
 * collision is wider than the reported pair: `1.5e-300` collapsed to `"1.5e-3"`.
 * `0.2.0-rc.1`, cut from Soberanía Protocol commit
 * eec79cdd4019dd42e1767909c5bd4e26d04c6f0f, repairs it.
 *
 * This matters to PMFreak specifically, not just to Protocol: `canonicalizeJSON`
 * is what `src/lib/governance/authority/capability-claims.ts` canonicalises claim
 * material with, so a canonical-form collision is digest material two different
 * claims could share.
 *
 * What is asserted here is a CONSUMPTION fact only PMFreak can assert: the
 * artifact this repository actually resolves from its own `node_modules` behaves
 * like rc.1. Canonicalization semantics stay Protocol's to own — nothing here
 * reimplements them, and this file adds no second owner of the algorithm. It
 * exercises the installed artifact through the declared public `./canonical`
 * export, which PMFreak already consumes in `src/` and already records in
 * `vendor/aoc-consumer.lock.json` under `declaredExports`; no allowlist is widened
 * to accommodate it.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { canonicalizeJSON } from "@aoc/protocol/canonical";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const lock = readJson(path.join(repositoryRoot, "vendor/aoc-consumer.lock.json"));
const installed = readJson(
  path.join(repositoryRoot, "node_modules/@aoc/protocol/package.json")
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("the installed @aoc/protocol is the artifact the consumer lock pins", () => {
  assert.equal(installed.name, "@aoc/protocol");
  assert.equal(installed.version, lock.artifacts["@aoc/protocol"].version);
});

test("the installed @aoc/protocol is NOT the burned 0.2.0-rc.0 candidate", () => {
  // An inequality against the literal burned identity, so it cannot quietly
  // mutate into a passing assertion when the pin moves again.
  assert.notEqual(installed.version, "0.2.0-rc.0");
  assert.equal(lock.artifacts["@aoc/protocol"].supersedes.version, "0.2.0-rc.0");
  assert.equal(lock.artifacts["@aoc/protocol"].supersedes.status, "BURNED");
  assert.equal(
    lock.artifacts["@aoc/protocol"].supersedes.sha256,
    "dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5"
  );
});

test("UG-003 is repaired: exponent digits survive canonicalization", () => {
  const small = canonicalizeJSON(7.9e-10);
  const smaller = canonicalizeJSON(7.9e-100);

  assert.equal(small, "7.9e-10");
  assert.equal(smaller, "7.9e-100");

  // The defect was not that either value was wrong in isolation — it was that
  // both collapsed to the SAME canonical form.
  assert.notEqual(small, smaller, 'rc.0 collapsed both to "7.9e-1"');
});

test("the repaired canonical forms yield distinct digest material", () => {
  // This is the property PMFreak's capability-claim digests actually rest on.
  assert.notEqual(sha256(canonicalizeJSON(7.9e-10)), sha256(canonicalizeJSON(7.9e-100)));
});

test("canonical forms round-trip rather than trading a collision for a corruption", () => {
  // A canonical form that is distinct but no longer parses back to the value it
  // came from would be a different defect, not a fix.
  for (const value of [7.9e-10, 7.9e-100, 1.5e-300, 1e-5, 1e-10, 1e-100, 1e5, 1e21, 9.87654321e-99]) {
    const canonical = canonicalizeJSON(value);
    assert.equal(JSON.parse(canonical), value, `canonicalizeJSON(${value}) => ${canonical}`);
  }
});

test("1.5e-300 is covered: the burn was wider than the reported pair", () => {
  const canonical = canonicalizeJSON(1.5e-300);
  assert.equal(canonical, "1.5e-300");
  assert.notEqual(canonical, "1.5e-3", 'rc.0 collapsed 1.5e-300 to "1.5e-3"');
  assert.notEqual(sha256(canonical), sha256(canonicalizeJSON(1.5e-3)));
});
