import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
const TIMESTAMP_PATTERN = /^(\d{14})_[a-z0-9_]+\.sql$/;

test("every migration filename matches <14-digit timestamp>_<name>.sql", () => {
  for (const file of files) {
    assert.match(file, TIMESTAMP_PATTERN, `${file} does not match the canonical migration filename format`);
  }
});

test("no duplicate migration timestamps", () => {
  const seen = new Map();
  for (const file of files) {
    const ts = file.match(TIMESTAMP_PATTERN)?.[1];
    if (!ts) continue;
    if (seen.has(ts)) {
      assert.fail(`Duplicate migration timestamp ${ts}: ${seen.get(ts)} and ${file}`);
    }
    seen.set(ts, file);
  }
});

test("filesystem discovery order matches lexicographic sort order (deterministic apply order)", () => {
  const discovered = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  assert.deepEqual(discovered, [...discovered].sort());
});

test("no SQL migration files exist outside supabase/migrations/", () => {
  const strayLocations = ["database/migrations", "migrations", "sql"];
  for (const loc of strayLocations) {
    const full = path.join(ROOT, loc);
    assert.equal(existsSync(full), false, `Unexpected legacy migration directory found: ${loc}`);
  }
});

test("no migration uses the invalid CREATE POLICY IF NOT EXISTS syntax (Postgres has no such clause)", () => {
  for (const file of files) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const lines = content.split("\n");
    for (const [i, line] of lines.entries()) {
      if (/^\s*--/.test(line)) continue;
      assert.doesNotMatch(line, /create policy if not exists/i, `${file}:${i + 1} uses invalid CREATE POLICY IF NOT EXISTS syntax`);
    }
  }
});

test("no migration uses the invalid ADD CONSTRAINT IF NOT EXISTS syntax (Postgres has no such clause)", () => {
  for (const file of files) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const lines = content.split("\n");
    for (const [i, line] of lines.entries()) {
      if (/^\s*--/.test(line)) continue;
      assert.doesNotMatch(line, /add constraint if not exists/i, `${file}:${i + 1} uses invalid ADD CONSTRAINT IF NOT EXISTS syntax`);
    }
  }
});

test("no migration references the nonexistent public.workspace_members table (correct name is workspace_memberships)", () => {
  for (const file of files) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const codeOnly = content
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n");
    assert.doesNotMatch(codeOnly, /\bworkspace_members\b/, `${file} references nonexistent table workspace_members`);
  }
});

test("check:fresh-db-migrations npm script and harness script exist", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:fresh-db-migrations"], "node scripts/check-fresh-db-migrations.mjs");
  assert.equal(existsSync(path.join(ROOT, "scripts/check-fresh-db-migrations.mjs")), true);
});

test("fresh-db-migrations harness refuses to run without ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true", () => {
  const script = readFileSync(path.join(ROOT, "scripts/check-fresh-db-migrations.mjs"), "utf8");
  assert.match(script, /ALLOW_DESTRUCTIVE_FRESH_DB_TEST/);
  assert.doesNotMatch(script, /ALLOW_DESTRUCTIVE_FRESH_DB_TEST\s*(!==|===)?\s*['"]?true['"]?\s*\?\s*true\s*:\s*true/);
});

test("fresh-db-migrations harness redacts database URLs before logging them", () => {
  const script = readFileSync(path.join(ROOT, "scripts/check-fresh-db-migrations.mjs"), "utf8");
  assert.match(script, /function redact\(/);
  assert.match(script, /redact\(dbUrl\)/);
});

test("fresh-db-migrations harness rejects production-looking database hosts", () => {
  const script = readFileSync(path.join(ROOT, "scripts/check-fresh-db-migrations.mjs"), "utf8");
  assert.match(script, /KNOWN_PRODUCTION_HOST_FRAGMENTS/);
  assert.match(script, /"prod"/);
});
