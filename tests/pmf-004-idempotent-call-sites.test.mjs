/**
 * PMF-004 — static regression guards pinning the idempotent call sites.
 *
 * These are fast, DB-free companions to
 * tests/pmf-004-default-pmo-command-center-idempotency.test.mjs (which
 * proves the concurrency behavior against a real Postgres and is skipped
 * where none is reachable). This file guarantees at least one PMF-004
 * regression check always runs in CI regardless of database availability:
 * it pins that the vulnerable check-then-insert pattern was removed and
 * that both entry points route through the shared, advisory-lock-guarded
 * RPC rather than a second, ad hoc mechanism.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const saveTenant = readFileSync(join(ROOT, "src/lib/pmo/save-pmo-tenant.ts"), "utf8");
const workspaces = readFileSync(join(ROOT, "src/lib/workspaces.ts"), "utf8");
const pmoService = readFileSync(join(ROOT, "src/lib/pmos/pmo-service.ts"), "utf8");
const migration = readFileSync(
  join(ROOT, "supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql"),
  "utf8"
);

test("save-pmo-tenant.ts no longer does a raw check-then-insert against pmos", () => {
  assert.ok(!/from\("pmos"\)\s*\.select/.test(saveTenant), "must not SELECT pmos directly");
  assert.ok(!/from\("pmos"\)\s*\.insert/.test(saveTenant), "must not INSERT into pmos directly");
  assert.match(saveTenant, /supabaseClient\.rpc\("ensure_default_pmo"/, "must route through the advisory-lock-guarded RPC");
  assert.match(saveTenant, /p_sync_existing:\s*true/, "Command Center re-activation must sync name/type on the existing default PMO");
});

test("workspaces.ts's ensureUserWorkspace no longer does a raw check-then-insert against workspaces", () => {
  const fn = workspaces.slice(workspaces.indexOf("export async function ensureUserWorkspace"));
  const body = fn.slice(0, fn.indexOf("\n}\n") + 2);
  assert.ok(!/from\("workspaces"\)\s*\.insert/.test(body), "must not INSERT into workspaces directly");
  assert.match(body, /supabase\.rpc\("ensure_user_workspace"/, "must route through the advisory-lock-guarded RPC");
});

test("ensureDefaultPmo() (pmo-service.ts) passes through pmoType/syncExisting to the RPC", () => {
  assert.match(pmoService, /p_pmo_type:\s*options\?\.pmoType/);
  assert.match(pmoService, /p_sync_existing:\s*options\?\.syncExisting/);
});

test("the migration extends the existing ensure_default_pmo lock pattern rather than adding a second mechanism", () => {
  assert.match(migration, /drop function if exists ensure_default_pmo\(uuid, text, uuid\)/, "must replace the old 3-arg signature, not shadow it with an overload");
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\('pmfreak_ensure_default_pmo_' \|\| p_workspace_id::text\)\)/, "must reuse the exact same lock key as the pre-existing project-creation path");
  assert.match(migration, /create function ensure_user_workspace/, "must add the sibling workspace-bootstrap guard");
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\('pmfreak_ensure_user_workspace_' \|\| p_user_id::text\)\)/, "workspace-bootstrap lock must be scoped per-user, distinct from the PMO lock");
});

test("no global uniqueness constraint on pmos.workspace_id was introduced", () => {
  assert.ok(!/unique\s*\(?\s*workspace_id\s*\)?/i.test(migration), "PMF-004 must not add a blanket UNIQUE(workspace_id) constraint on pmos");
});
