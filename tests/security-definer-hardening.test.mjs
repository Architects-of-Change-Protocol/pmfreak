// Coverage for scripts/check-security-definer-hardening.mjs (Perilla 13B —
// PR brief section F.3: "Para toda función SECURITY DEFINER, verificar:
// explicit safe search_path ... minimal EXECUTE grants ... no PUBLIC
// execution unless intentionally public"). Static, source-only — see the
// script's own header for what this does and does not verify.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { findSecurityDefinerFunctions, hasPublicRevoke, loadMigrationFiles } from "../scripts/check-security-definer-hardening.mjs";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const SCRIPT = path.join(ROOT, "scripts/check-security-definer-hardening.mjs");

test("check:security-definer-hardening npm script and harness script exist", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["check:security-definer-hardening"], "node scripts/check-security-definer-hardening.mjs");
  assert.equal(existsSync(SCRIPT), true);
});

test("check:security-definer-hardening is wired into the beta release gate as a blocking check", () => {
  const gateSource = readFileSync(path.join(ROOT, "scripts/check-beta-release.mjs"), "utf8");
  assert.match(gateSource, /check:security-definer-hardening/);
});

test("the checker passes (exit 0) against the current migration set", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 0, `expected PASS, got:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS: every SECURITY DEFINER function/);
});

test("every real SECURITY DEFINER function in supabase/migrations/ has a pinned search_path (direct check, independent of the harness's own verdict)", () => {
  const files = loadMigrationFiles();
  const byName = new Map();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const f of findSecurityDefinerFunctions(sql, file)) {
      const bare = f.name.replace(/^public\./, "");
      const prev = byName.get(bare);
      byName.set(bare, (prev ?? false) || f.hasSearchPath);
    }
  }
  assert.ok(byName.size > 0, "expected at least one SECURITY DEFINER function to be found");
  for (const [name, hasSearchPath] of byName) {
    assert.ok(hasSearchPath, `${name} is missing a pinned search_path`);
  }
});

test("every non-trigger SECURITY DEFINER function has an explicit PUBLIC execute revocation", () => {
  const files = loadMigrationFiles();
  const allSql = files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")).join("\n");
  const byName = new Map();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const f of findSecurityDefinerFunctions(sql, file)) {
      const bare = f.name.replace(/^public\./, "");
      const prev = byName.get(bare);
      byName.set(bare, { isTrigger: (prev?.isTrigger ?? false) || f.isTrigger });
    }
  }
  for (const [name, info] of byName) {
    if (info.isTrigger) continue;
    assert.ok(hasPublicRevoke(allSql, name), `${name} has no 'revoke all on function ... from public'`);
  }
});

test("purge_expired_nonces was the originally-missing-search_path function; the corrective migration fixes it", () => {
  const fixMigration = path.join(MIGRATIONS_DIR, "20260824000000_fix_purge_expired_nonces_search_path.sql");
  assert.equal(existsSync(fixMigration), true);
  const content = readFileSync(fixMigration, "utf8");
  assert.match(content, /create or replace function public\.purge_expired_nonces\(\)/);
  assert.match(content, /set search_path = public/);
  assert.match(content, /revoke all on function public\.purge_expired_nonces\(\) from public;/);
});

test("quota and RLS-helper SECURITY DEFINER functions gained an explicit PUBLIC revoke without changing their intended callers' grants", () => {
  const fixMigration = path.join(MIGRATIONS_DIR, "20260825000000_fix_security_definer_public_execute_grants.sql");
  assert.equal(existsSync(fixMigration), true);
  const content = readFileSync(fixMigration, "utf8");
  for (const fn of [
    "public.reserve_upload_quota(text, integer, integer, text, text)",
    "public.commit_upload_quota(uuid, text)",
    "public.cancel_upload_quota(uuid, text)",
    "public.is_organizational_memory_governor(uuid)",
    "public.is_organizational_pattern_governor(uuid)",
    "public.is_decision_effectiveness_governor(uuid)",
    "public.is_bridge_owner(uuid, uuid)",
  ]) {
    const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(content, new RegExp(`revoke all on function ${escaped} from public;`), `missing revoke for ${fn}`);
  }
  // Quota functions keep their existing authenticated + service_role callers.
  assert.match(content, /grant execute on function public\.reserve_upload_quota\([^)]*\) to authenticated, service_role;/);
  assert.match(content, /grant execute on function public\.commit_upload_quota\([^)]*\) to authenticated, service_role;/);
  assert.match(content, /grant execute on function public\.cancel_upload_quota\([^)]*\) to authenticated, service_role;/);
});
