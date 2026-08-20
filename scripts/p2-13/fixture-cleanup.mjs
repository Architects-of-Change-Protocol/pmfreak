/**
 * P2-13 — fixture-scoped reset.
 *
 * Scope rule: this file may only ever address rows that belong to the
 * deterministic P2-13 scenario, addressed by the scenario's own workspace,
 * project, invite and actor identities. It never truncates, never drops a
 * schema, never resets migrations, never disables RLS and never disables a
 * foreign key.
 *
 * ── Why raw SQL, and why named triggers are briefly disabled ──────────────
 *
 * The verified P2-03/P2-04/P2-06 contracts make Raw Input, Normalized Event,
 * derived Evidence, Material Action records and platform events *immutable*,
 * with no service-role exemption — deliberately, because production history
 * must never be rewritten. That is the right contract and P2-13 must not
 * weaken it.
 *
 * A disposable local fixture scenario still has to be removable, so reset:
 *   - runs only after the isolation guard proves LOCAL_ISOLATED,
 *   - runs only under the explicit P2_13_ALLOW_LOCAL_RESET opt-in,
 *   - opens ONE transaction,
 *   - adopts the sanctioned service-role exemption for the append-only tables
 *     that already have one,
 *   - disables ONLY the named immutability triggers that have no exemption,
 *     re-enabling them in the same transaction,
 *   - deletes in explicit reverse-dependency order with foreign keys fully
 *     enforced throughout.
 *
 * If the transaction fails at any point, Postgres rolls the whole thing back
 * — including the trigger state — so a partial reset cannot leave the
 * database with weakened immutability.
 *
 * ── Privilege, stated precisely ──────────────────────────────────────────
 *
 * The reset connection authenticates as the local `postgres` maintenance
 * role. On the disposable local Supabase stack that role is NOT a superuser
 * but it DOES hold `rolbypassrls`, exactly as `service_role` does. So:
 *
 *   - every RLS policy remains configured and unchanged, and
 *   - RLS is NOT enforced against this maintenance connection.
 *
 * "RLS is enabled" and "RLS constrains this actor" are different statements
 * and only the first one is true here. Tenant isolation is therefore never
 * argued from this path: it is proven separately, as ordinary authenticated
 * actors, by `scripts/check-p2-13-db.mjs`. This privilege is used only to
 * delete fixture rows, and only after the fail-closed isolation guard has
 * classified the target LOCAL_ISOLATED under the destructive opt-ins.
 */

import { spawnSync } from "node:child_process";

import { GUARD_MODES, classifyP2_13Target } from "./isolation-guard.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Immutability triggers with no service-role exemption. Each entry is
 * (table, trigger) and is disabled/re-enabled by name — never `DISABLE
 * TRIGGER ALL`, which would also switch off foreign-key enforcement.
 */
export const UNEXEMPTED_IMMUTABILITY_TRIGGERS = Object.freeze([
  ["operational_raw_inputs", "operational_raw_inputs_immutable"],
  ["operational_normalized_events", "operational_normalized_events_immutable"],
  ["evidence_items", "evidence_items_derived_append_only"],
  ["material_action_proposals", "material_action_proposals_immutable"],
  ["material_action_governance_evaluations", "material_action_evaluations_immutable"],
  ["material_action_audit_events", "material_action_audit_immutable"],
  ["platform_events", "platform_events_prevent_delete"],
  ["platform_events", "platform_events_immutability_guard"],
]);

/**
 * Explicit reverse-dependency cleanup order.
 *
 * Derived from the live `pg_constraint` graph (every RESTRICT / NO ACTION
 * edge into a table this scenario owns), not from memory. `scope` is a SQL
 * predicate template using the placeholders substituted in `buildResetSql`.
 */
export const FIXTURE_CLEANUP_PLAN = Object.freeze([
  { table: "canonical_outcome_observations", scope: "workspace_id = any(:workspaces)" },
  { table: "canonical_task_outcomes", scope: "workspace_id = any(:workspaces)" },
  { table: "internal_task_executions", scope: "workspace_id = any(:workspaces)" },
  { table: "material_action_audit_events", scope: "workspace_id = any(:workspaces)" },
  { table: "material_action_governance_evaluations", scope: "workspace_id = any(:workspaces)" },
  { table: "material_action_proposals", scope: "workspace_id = any(:workspaces)" },
  {
    table: "execution_task_events",
    scope:
      "task_id in (select id from public.execution_tasks where workspace_id = any(:workspaces))",
  },
  { table: "execution_tasks", scope: "workspace_id = any(:workspaces)" },
  {
    table: "decision_evidence_links",
    scope:
      "decision_record_id in (select id from public.operational_decision_records where workspace_id = any(:workspaces))",
  },
  { table: "operational_decision_records", scope: "workspace_id = any(:workspaces)" },
  { table: "recommended_actions", scope: "workspace_id = any(:workspaces)" },
  { table: "governance_events", scope: "workspace_id = any(:workspaces)" },
  { table: "risk_issue_records", scope: "workspace_id = any(:workspaces)" },
  { table: "operational_signals", scope: "workspace_id = any(:workspaces)" },
  {
    table: "agent_outputs",
    scope: "agent_run_id in (select id from public.agent_runs where workspace_id = any(:workspaces))",
  },
  { table: "agent_runs", scope: "workspace_id = any(:workspaces)" },
  { table: "evidence_items", scope: "workspace_id = any(:workspaces)" },
  { table: "operational_normalized_events", scope: "workspace_id = any(:workspaces)" },
  { table: "operational_raw_inputs", scope: "workspace_id = any(:workspaces)" },
  { table: "operational_sources", scope: "workspace_id = any(:workspaces)" },
  { table: "platform_events", scope: "workspace_id = any(:workspaces)" },
  { table: "program_materializations", scope: "workspace_id = any(:workspaces)" },
  {
    table: "early_access_events",
    scope: "workspace_id = any(:workspaces) or invite_id = any(:invites)",
  },
  {
    table: "workspace_activations",
    scope: "workspace_id = any(:workspaces) or invite_id = any(:invites)",
  },
  {
    table: "trial_licenses",
    scope: "workspace_id = any(:workspaces) or invite_id = any(:invites)",
  },
  {
    table: "early_access_invites",
    scope:
      "id = any(:invites) or workspace_id = any(:workspaces) or invite_email = any(:actorEmails)",
  },
  { table: "projects", scope: "id = any(:projects) or workspace_id = any(:workspaces)" },
  { table: "workspace_memberships", scope: "workspace_id = any(:workspaces)" },
  { table: "workspaces", scope: "id = any(:workspaces)" },
]);

/** Tables whose residue `verify` must independently confirm is zero. */
export const RESIDUE_TABLES = Object.freeze(FIXTURE_CLEANUP_PLAN.map((step) => step.table));

function uuidArrayLiteral(values, label) {
  for (const value of values) {
    if (!UUID.test(String(value))) throw new Error(`p2_13_reset_invalid_${label}_id`);
  }
  // An empty array still needs its element type: Postgres cannot infer one,
  // and an untyped `array[]` would abort the whole reset transaction.
  if (values.length === 0) return "array[]::uuid[]";
  return `array[${values.map((value) => `'${value}'::uuid`).join(", ")}]`;
}

function textArrayLiteral(values, label) {
  for (const value of values) {
    if (!EMAIL.test(String(value))) throw new Error(`p2_13_reset_invalid_${label}`);
  }
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map((value) => `'${value}'::text`).join(", ")}]`;
}

/**
 * Build the single-transaction reset script.
 *
 * Every identifier interpolated below is validated as a UUID or an email
 * first, so no scenario value can carry SQL. The table names come from the
 * frozen plan above and are never caller-supplied.
 */
export function buildResetSql({ workspaceIds, projectIds, inviteIds, actorEmails }) {
  const workspaces = uuidArrayLiteral(workspaceIds, "workspace");
  const projects = uuidArrayLiteral(projectIds, "project");
  const invites = uuidArrayLiteral(inviteIds, "invite");
  const emails = textArrayLiteral(actorEmails, "actor_email");

  const substitute = (predicate) =>
    predicate
      .replaceAll(":workspaces", workspaces)
      .replaceAll(":projects", projects)
      .replaceAll(":invites", invites)
      .replaceAll(":actorEmails", emails);

  const lines = [
    "\\set ON_ERROR_STOP on",
    "begin;",
    "-- Adopt the exemption the append-only contract already grants service role.",
    "set local \"request.jwt.claim.role\" = 'service_role';",
    "create temp table p2_13_reset_counts(step int, table_name text, deleted bigint) on commit drop;",
  ];

  for (const [table, trigger] of UNEXEMPTED_IMMUTABILITY_TRIGGERS) {
    lines.push(`alter table public.${table} disable trigger ${trigger};`);
  }

  // Self-referencing RESTRICT edges ("supersedes") are checked per row, so a
  // superseding chain inside the scenario could otherwise block its own
  // deletion. Detach the chain first; both columns are scenario-owned.
  lines.push(
    `update public.operational_decision_records set supersedes_decision_record_id = null where workspace_id = any(${workspaces}) and supersedes_decision_record_id is not null;`,
    `update public.evidence_items set supersedes_evidence_item_id = null where workspace_id = any(${workspaces}) and supersedes_evidence_item_id is not null;`,
  );

  FIXTURE_CLEANUP_PLAN.forEach((step, index) => {
    lines.push(
      `with deleted as (delete from public.${step.table} where ${substitute(step.scope)} returning 1)`,
      `insert into p2_13_reset_counts select ${index + 1}, '${step.table}', count(*) from deleted;`,
    );
  });

  for (const [table, trigger] of UNEXEMPTED_IMMUTABILITY_TRIGGERS) {
    lines.push(`alter table public.${table} enable trigger ${trigger};`);
  }

  lines.push(
    "select coalesce(json_agg(json_build_object('table', table_name, 'deleted', deleted) order by step), '[]'::json)::text as p2_13_reset_counts from p2_13_reset_counts;",
    "commit;",
  );

  return `${lines.join("\n")}\n`;
}

/**
 * Resolve how to reach the disposable local database.
 *
 * Preference order mirrors what the repository already does elsewhere
 * (`scripts/check-fresh-db-migrations.mjs` shells out to `psql`). Falling
 * back to the local Supabase database container avoids adding a Postgres
 * driver dependency for a harness-only concern.
 */
export function resolveSqlRunner(env = {}, options = {}) {
  /**
   * Fail closed at the point the capability is minted, not only at the call
   * sites that happen to exist today.
   *
   * This is the only function in the harness that can produce something able
   * to execute SQL against the database, so the isolation guard is re-run
   * here — under DESTRUCTIVE mode — over the very same `env` the executor
   * would use. A future caller that forgets to guard first therefore cannot
   * obtain an executor at all, rather than obtaining one that happens to be
   * pointed somewhere safe.
   */
  const verdict = classifyP2_13Target(env, { mode: GUARD_MODES.DESTRUCTIVE });
  if (!verdict.ok) {
    return {
      ok: false,
      refusals: verdict.refusals,
      reason: `refused: the target is not proven LOCAL_ISOLATED under the destructive opt-ins (${verdict.refusals.join(", ")}).`,
    };
  }

  const run = options.run ?? ((cmd, args, input) =>
    spawnSync(cmd, args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));

  const databaseUrl = env.OPERATIONAL_FLOW_TEST_DATABASE_URL;
  if (!databaseUrl) {
    return { ok: false, reason: "OPERATIONAL_FLOW_TEST_DATABASE_URL is required for reset." };
  }

  const psqlProbe = run("psql", ["--version"], "");
  if (psqlProbe.status === 0) {
    return {
      ok: true,
      kind: "psql",
      execute: (sql) => run("psql", ["-v", "ON_ERROR_STOP=1", "-t", "-A", databaseUrl, "-f", "-"], sql),
    };
  }

  const container = env.P2_13_DB_CONTAINER || findSupabaseDbContainer(run);
  if (!container) {
    return {
      ok: false,
      reason:
        "Neither `psql` nor a local Supabase database container is reachable; reset refuses rather than guessing a target.",
    };
  }

  return {
    ok: true,
    kind: "docker",
    container,
    execute: (sql) =>
      run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-f", "-"], sql),
  };
}

function findSupabaseDbContainer(run) {
  const listed = run("docker", ["ps", "--format", "{{.Names}}"], "");
  if (listed.status !== 0 || typeof listed.stdout !== "string") return null;
  const names = listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const matches = names.filter((name) => /^supabase_db_/.test(name));
  // Exactly one, or refuse: two local stacks means the target is ambiguous.
  return matches.length === 1 ? matches[0] : null;
}

/** Extract the counts JSON the reset transaction prints as its last payload. */
export function parseResetCounts(stdout) {
  const line = String(stdout ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("[") && entry.endsWith("]"))
    .pop();
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
