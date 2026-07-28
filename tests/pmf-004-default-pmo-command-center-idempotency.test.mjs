/**
 * PMF-004 — real-database concurrency tests for default-PMO bootstrap and
 * Command Center activation idempotency.
 *
 * Unlike most of this suite (static readFileSync + regex contract tests),
 * this file exercises actual concurrent Postgres transactions against the
 * real production function bodies (ensure_default_pmo, ensure_user_workspace,
 * both defined in supabase/migrations/20260831000000_*.sql) so the
 * concurrency guarantee is demonstrated, not merely asserted from source
 * text. It also reproduces — against a real table, with real overlapping
 * transactions — the exact unguarded check-then-insert pattern previously in
 * src/lib/pmo/save-pmo-tenant.ts and src/lib/workspaces.ts's
 * ensureUserWorkspace, to show concretely what the fix closes.
 *
 * Requires a reachable Postgres instance. Uses PMF004_TEST_DATABASE_URL_TEMPLATE
 * (a connection string with a `{db}` placeholder, e.g.
 * "postgresql://user:pass@host:5432/{db}") and PMF004_PSQL_ADMIN (a psql
 * invocation, as a shell-split string, connected to a maintenance database
 * capable of CREATE/DROP DATABASE) when set. Falls back to this sandbox's
 * local Postgres via `sudo -u postgres psql`, which is what this remediation
 * was developed and verified against. If neither is reachable, every test in
 * this file is skipped with an explicit reason — see the PMF-004 remediation
 * record for this disclosed, environment-dependent coverage gap.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const SCHEMA_FIXTURE = join(ROOT, "tests/fixtures/pmf-004-schema.sql");
const IDEMPOTENCY_MIGRATION = join(
  ROOT,
  "supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql"
);

function adminCommand() {
  if (process.env.PMF004_PSQL_ADMIN) return process.env.PMF004_PSQL_ADMIN.split(" ");
  return ["sudo", "-n", "-u", "postgres", "psql", "-d", "postgres"];
}

function dbCommand(dbName) {
  if (process.env.PMF004_TEST_DATABASE_URL_TEMPLATE) {
    return ["psql", process.env.PMF004_TEST_DATABASE_URL_TEMPLATE.replace("{db}", dbName)];
  }
  return ["sudo", "-n", "-u", "postgres", "psql", "-d", dbName];
}

// psql -t suppresses SELECT's row-count footer, but always prints the
// command-completion tag (e.g. "INSERT 0 1") after INSERT/UPDATE/DELETE —
// including when the statement also has a RETURNING clause producing real
// tuple output. Filtered out here so every caller can treat the result as
// just the returned value(s).
function stripCommandTags(stdout) {
  return stdout
    .split("\n")
    .filter((line) => !/^(INSERT \d+ \d+|UPDATE \d+|DELETE \d+)$/.test(line.trim()))
    .join("\n")
    .trim();
}

async function runSql(command, sql) {
  const [cmd, ...args] = command;
  const { stdout } = await execFileAsync(cmd, [...args, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    timeout: 20000,
  });
  return stripCommandTags(stdout);
}

async function runSqlFile(command, filePath) {
  const [cmd, ...args] = command;
  const { stdout } = await execFileAsync(cmd, [...args, "-v", "ON_ERROR_STOP=1", "-f", filePath], {
    timeout: 20000,
  });
  return stdout;
}

// Strips grant/revoke statements referencing Supabase-specific roles
// (authenticated, service_role) that do not exist on a plain local Postgres,
// so the *function bodies* under test are still executed verbatim from the
// real migration file.
function stripSupabaseRoleGrants(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\s*(revoke|grant)\b/i.test(line))
    .join("\n");
}

const DB_NAME = `pmf004_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
let DB_AVAILABLE = false;
let SKIP_REASON = "";

try {
  await runSql(adminCommand(), "select 1;");
  await runSql(adminCommand(), `create database ${DB_NAME};`);
  await runSqlFile(dbCommand(DB_NAME), SCHEMA_FIXTURE);
  const migrationSql = stripSupabaseRoleGrants(readFileSync(IDEMPOTENCY_MIGRATION, "utf8"));
  const tmpFnFile = join(ROOT, "tests/fixtures/.pmf-004-functions.generated.sql");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmpFnFile, migrationSql);
  try {
    await runSqlFile(dbCommand(DB_NAME), tmpFnFile);
  } finally {
    unlinkSync(tmpFnFile);
  }
  DB_AVAILABLE = true;
} catch (err) {
  SKIP_REASON = `No usable local Postgres for PMF-004 concurrency tests (${String(err.message || err).split("\n")[0]}). Disclosed as residual, environment-dependent coverage in the PMF-004 remediation record — set PMF004_PSQL_ADMIN / PMF004_TEST_DATABASE_URL_TEMPLATE to enable in CI.`;
}

test.after(async () => {
  if (!DB_AVAILABLE) return;
  try {
    await runSql(adminCommand(), `drop database if exists ${DB_NAME} with (force);`);
  } catch {
    // best-effort cleanup only
  }
});

async function seedUser(id) {
  await runSql(dbCommand(DB_NAME), `insert into auth.users (id) values ('${id}') on conflict do nothing;`);
}

async function seedWorkspace(id, userId) {
  await runSql(
    dbCommand(DB_NAME),
    `insert into public.workspaces (id, name, created_by_user_id) values ('${id}', 'Workspace', '${userId}');`
  );
}

async function pmosCountFor(workspaceId) {
  const out = await runSql(
    dbCommand(DB_NAME),
    `select count(*) from public.pmos where workspace_id = '${workspaceId}';`
  );
  return Number(out);
}

async function workspaceCountFor(userId) {
  const out = await runSql(
    dbCommand(DB_NAME),
    `select count(distinct workspace_id) from public.workspace_memberships where user_id = '${userId}';`
  );
  return Number(out);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Faithfully reproduces the exact two-round-trip, no-lock pattern that was
// in save-pmo-tenant.ts before this fix: a SELECT (existence check), an
// app-level gap (two separate network round trips in production; modelled
// here as a real inter-process delay), then a conditional INSERT.
async function racerCheckThenInsertPmo(workspaceId, userId) {
  const existing = await runSql(
    dbCommand(DB_NAME),
    `select count(*) from public.pmos where workspace_id = '${workspaceId}' and status = 'active';`
  );
  await sleep(250);
  if (Number(existing) === 0) {
    await runSql(
      dbCommand(DB_NAME),
      `insert into public.pmos (workspace_id, name, pmo_type, created_by_user_id) values ('${workspaceId}', 'General PMO', 'company_pmo', '${userId}');`
    );
  }
}

// Faithfully reproduces ensureUserWorkspace's pre-fix pattern: SELECT
// existing membership, app-level gap, then INSERT workspace + membership if
// none was found.
async function racerCheckThenInsertWorkspace(userId) {
  const existing = await runSql(
    dbCommand(DB_NAME),
    `select workspace_id from public.workspace_memberships where user_id = '${userId}' limit 1;`
  );
  await sleep(250);
  if (!existing) {
    const workspaceId = await runSql(
      dbCommand(DB_NAME),
      `insert into public.workspaces (name, created_by_user_id) values ('Workspace', '${userId}') returning id;`
    );
    await runSql(
      dbCommand(DB_NAME),
      `insert into public.workspace_memberships (workspace_id, user_id, role) values ('${workspaceId}', '${userId}', 'owner') on conflict (workspace_id, user_id) do nothing;`
    );
  }
}

async function callEnsureDefaultPmo(workspaceId, userId, { name = "General PMO", pmoType = "company_pmo", syncExisting = false, preSleepMs = 0 } = {}) {
  const sleepStmt = preSleepMs > 0 ? `select pg_sleep(${preSleepMs / 1000});` : "";
  const out = await runSql(
    dbCommand(DB_NAME),
    `${sleepStmt} select (ensure_default_pmo('${workspaceId}', '${name.replace(/'/g, "''")}', '${userId}', '${pmoType}', ${syncExisting})).id;`
  );
  return out.trim().split("\n").pop();
}

async function callEnsureUserWorkspace(userId, defaultName = "Workspace") {
  const out = await runSql(
    dbCommand(DB_NAME),
    `select (ensure_user_workspace('${userId}', '${defaultName.replace(/'/g, "''")}')).id;`
  );
  return out.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.1 (pre-fix pattern reproduction) — the exact defect this sprint closes.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "[pre-fix defect reproduction] two concurrent check-then-insert calls (save-pmo-tenant.ts's removed pattern) create two pmos rows for one workspace",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    await Promise.all([
      racerCheckThenInsertPmo(workspaceId, userId),
      racerCheckThenInsertPmo(workspaceId, userId),
    ]);

    const count = await pmosCountFor(workspaceId);
    assert.equal(count, 2, "the pre-fix pattern reproduces the exact duplicate-PMO race PMF-004 reports");
  }
);

test(
  "[pre-fix defect reproduction] two concurrent check-then-insert calls (ensureUserWorkspace's removed pattern) create two workspaces for one user",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const userId = randomUUID();
    await seedUser(userId);

    await Promise.all([racerCheckThenInsertWorkspace(userId), racerCheckThenInsertWorkspace(userId)]);

    const count = await workspaceCountFor(userId);
    assert.equal(count, 2, "the pre-fix pattern reproduces the sibling workspace-duplication race flagged in this sprint's scope");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.1 (post-fix) — concurrent calls through the real advisory-lock RPC.
// ─────────────────────────────────────────────────────────────────────────────

for (const concurrency of [2, 5, 10]) {
  test(
    `[post-fix] ${concurrency} concurrent ensure_default_pmo calls for one brand-new workspace converge to exactly one pmos row`,
    { skip: !DB_AVAILABLE && SKIP_REASON },
    async () => {
      const workspaceId = randomUUID();
      const userId = randomUUID();
      await seedUser(userId);
      await seedWorkspace(workspaceId, userId);

      const ids = await Promise.all(
        Array.from({ length: concurrency }, () => callEnsureDefaultPmo(workspaceId, userId))
      );

      const count = await pmosCountFor(workspaceId);
      assert.equal(count, 1, `expected exactly one pmos row after ${concurrency} concurrent calls`);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, 1, "every concurrent caller must receive the same canonical PMO id");
    }
  );
}

for (const concurrency of [2, 5, 10]) {
  test(
    `[post-fix] ${concurrency} concurrent ensure_user_workspace calls for one brand-new user converge to exactly one workspace`,
    { skip: !DB_AVAILABLE && SKIP_REASON },
    async () => {
      const userId = randomUUID();
      await seedUser(userId);

      const ids = await Promise.all(Array.from({ length: concurrency }, () => callEnsureUserWorkspace(userId)));

      const count = await workspaceCountFor(userId);
      assert.equal(count, 1, `expected exactly one workspace after ${concurrency} concurrent calls`);
      assert.equal(new Set(ids).size, 1, "every concurrent caller must receive the same canonical workspace id");

      const memberCount = await runSql(
        dbCommand(DB_NAME),
        `select count(*) from public.workspace_memberships where user_id = '${userId}';`
      );
      assert.equal(Number(memberCount), 1, "no duplicate membership row may be created");
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9.2 Repeated (sequential) activation is idempotent.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "repeated sequential ensure_default_pmo calls return the same PMO and never duplicate it",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    const first = await callEnsureDefaultPmo(workspaceId, userId);
    const second = await callEnsureDefaultPmo(workspaceId, userId);
    const third = await callEnsureDefaultPmo(workspaceId, userId);

    assert.equal(second, first);
    assert.equal(third, first);
    assert.equal(await pmosCountFor(workspaceId), 1);
  }
);

test(
  "project-creation callers (syncExisting=false) never rename an existing default PMO",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    await callEnsureDefaultPmo(workspaceId, userId, { name: "General PMO" });
    // A later project-creation call must not rename the workspace's default.
    await callEnsureDefaultPmo(workspaceId, userId, { name: "Some Other Project's Preferred Name", syncExisting: false });

    const name = await runSql(dbCommand(DB_NAME), `select name from public.pmos where workspace_id = '${workspaceId}';`);
    assert.equal(name, "General PMO", "syncExisting=false must never overwrite the canonical default PMO's name");
  }
);

test(
  "Command Center re-activation (syncExisting=true) syncs the existing default PMO's name and type",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    await callEnsureDefaultPmo(workspaceId, userId, { name: "Initial Name", pmoType: "company_pmo", syncExisting: true });
    await callEnsureDefaultPmo(workspaceId, userId, { name: "Renamed Command Center", pmoType: "independent", syncExisting: true });

    const row = await runSql(
      dbCommand(DB_NAME),
      `select name || '|' || pmo_type from public.pmos where workspace_id = '${workspaceId}';`
    );
    assert.equal(row, "Renamed Command Center|independent");
    assert.equal(await pmosCountFor(workspaceId), 1, "re-activation must never create a second row");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.3 Timeout followed by retry: a slow original call and a fast retry must
// converge on one canonical PMO, with no duplicate and no raw DB error.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "a slow original activation and a fast retry converge on the same canonical PMO",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    const [originalId, retryId] = await Promise.all([
      callEnsureDefaultPmo(workspaceId, userId, { preSleepMs: 300 }),
      callEnsureDefaultPmo(workspaceId, userId),
    ]);

    assert.equal(originalId, retryId, "the delayed original and the retry must resolve to the same PMO");
    assert.equal(await pmosCountFor(workspaceId), 1, "no duplicate default PMO from the timeout/retry interleaving");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.4 Multiple legitimate PMOs: activation resolves to the canonical default,
// other PMOs are left untouched — no arbitrary selection, no consolidation.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "with multiple legitimate PMOs present, ensure_default_pmo resolves to the oldest active one and leaves the rest untouched",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    const canonicalId = await runSql(
      dbCommand(DB_NAME),
      `insert into public.pmos (workspace_id, name, pmo_type, created_by_user_id) values ('${workspaceId}', 'Canonical Default', 'company_pmo', '${userId}') returning id;`
    );
    await sleep(10); // guarantee a distinct, later created_at
    const secondaryId = await runSql(
      dbCommand(DB_NAME),
      `insert into public.pmos (workspace_id, name, pmo_type, created_by_user_id) values ('${workspaceId}', 'Client Delivery PMO', 'client_portfolio', '${userId}') returning id;`
    );

    const resolved = await callEnsureDefaultPmo(workspaceId, userId, { name: "Should Not Matter" });

    assert.equal(resolved, canonicalId, "must resolve to the oldest active PMO, not an arbitrary row");
    assert.equal(await pmosCountFor(workspaceId), 2, "both legitimate PMOs must remain — no consolidation");
    const secondaryName = await runSql(dbCommand(DB_NAME), `select name from public.pmos where id = '${secondaryId}';`);
    assert.equal(secondaryName, "Client Delivery PMO", "the non-default PMO must remain untouched");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.5 Partial bootstrap: a workspace exists with no default PMO yet — repair
// only the missing piece, exactly once.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "a workspace with no PMO yet gets exactly one default PMO created on first activation",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);
    assert.equal(await pmosCountFor(workspaceId), 0);

    await callEnsureDefaultPmo(workspaceId, userId);

    assert.equal(await pmosCountFor(workspaceId), 1);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.6 Different-workspace / different-user isolation.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "concurrent activation of two different workspaces produces independent defaults with no cross-contamination",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const [wsA, wsB, userA, userB] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await Promise.all([seedUser(userA), seedUser(userB)]);
    await Promise.all([seedWorkspace(wsA, userA), seedWorkspace(wsB, userB)]);

    const [idA, idB] = await Promise.all([
      callEnsureDefaultPmo(wsA, userA, { name: "Workspace A PMO" }),
      callEnsureDefaultPmo(wsB, userB, { name: "Workspace B PMO" }),
    ]);

    assert.notEqual(idA, idB);
    assert.equal(await pmosCountFor(wsA), 1);
    assert.equal(await pmosCountFor(wsB), 1);
    const nameA = await runSql(dbCommand(DB_NAME), `select name from public.pmos where id = '${idA}';`);
    const nameB = await runSql(dbCommand(DB_NAME), `select name from public.pmos where id = '${idB}';`);
    assert.equal(nameA, "Workspace A PMO");
    assert.equal(nameB, "Workspace B PMO");
  }
);

test(
  "concurrent ensure_user_workspace calls for two different users produce independent workspaces",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const [userA, userB] = [randomUUID(), randomUUID()];
    await Promise.all([seedUser(userA), seedUser(userB)]);

    const [wsA, wsB] = await Promise.all([callEnsureUserWorkspace(userA), callEnsureUserWorkspace(userB)]);

    assert.notEqual(wsA, wsB, "different users' brand-new-workspace bootstrap must not share a lock or collide");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 9.7 Loser behavior: no raw DB error reaches the caller under contention.
// ─────────────────────────────────────────────────────────────────────────────

test(
  "high-contention concurrent calls never surface a raw database exception",
  { skip: !DB_AVAILABLE && SKIP_REASON },
  async () => {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await seedUser(userId);
    await seedWorkspace(workspaceId, userId);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => callEnsureDefaultPmo(workspaceId, userId))
    );

    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(rejected.length, 0, `no concurrent caller may reject with a raw DB error: ${JSON.stringify(rejected)}`);
    assert.equal(await pmosCountFor(workspaceId), 1);
  }
);
