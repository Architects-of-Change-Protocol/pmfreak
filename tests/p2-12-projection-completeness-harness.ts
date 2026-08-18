/**
 * P2-12 regression: a truncated projection must never read as canonical absence.
 *
 * `getOperationalSummary` windows each collection to the newest N rows project-wide. A
 * consumer that JOINS those collections cannot distinguish "this chain has no Observation"
 * from "this chain's Observation fell outside a different collection's window", so absence
 * inferred from a truncated read is a false statement about the domain.
 *
 * This harness runs the REAL `getOperationalSummary` against a faithful stub of the
 * Supabase Data API query builder, seeded with an old governed chain plus more than thirty
 * newer unrelated rows in every downstream collection. If the linked rows are only fetched
 * through project-wide windows, the old chain's Task, Execution, Outcome and Observation
 * are all pushed out and the chain reads as if it never had them.
 *
 * The stub implements only what the service actually calls, and it applies `order`/`limit`
 * exactly as PostgREST would, so the truncation being tested is real rather than simulated.
 */

import { getOperationalSummary } from "@/lib/operational-flow/operational-flow-service";

type Row = Record<string, unknown>;

const WORKSPACE = "ws-1";
const PROJECT = "proj-1";
const ACTOR = "actor-pm";

/** The chain under test: old enough that every newer row outranks it in every window. */
const OLD = "2026-01-01T00:00:00Z";
/** Thirty-five unrelated rows per collection, all newer than the chain above. */
const NEWER = (index: number) => `2026-06-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`;
const NOISE = 35;

const scoped = (row: Row): Row => ({ workspace_id: WORKSPACE, project_id: PROJECT, ...row });

const oldDecision = scoped({
  id: "dec-old",
  decision_status: "accepted",
  decided_by: ACTOR,
  recommendation_id: "rec-old",
  rationale: "Recorded long ago.",
  governance_event_id: "gov-old",
  created_at: OLD,
});

const oldAction = scoped({
  id: "act-old",
  source_decision_id: "dec-old",
  proposed_by: ACTOR,
  action_class: "external_write",
  materiality: "material",
  proposal_digest: "a".repeat(64),
  correlation_id: "corr-old",
  proposal: { evidenceReferenceIds: ["ev-old"] },
  expires_at: "2027-01-01T00:00:00Z",
  created_at: OLD,
  persisted_at: OLD,
});

const oldEvaluation = scoped({
  id: "eval-old",
  action_id: "act-old",
  governance_state: "authorized",
  can_commit_action: true,
  can_execute: false,
  policy_decision_reference: "pmfreak-governance-event:gov-old",
  grant_references: ["workspace-role-grant:owner:actor-pm"],
  valid_until: "2027-01-01T00:00:00Z",
  evaluated_at: OLD,
  recorded_at: OLD,
});

const oldTask = scoped({
  id: "task-old",
  title: "Old governed task",
  status: "completed",
  created_at: OLD,
  completed_at: OLD,
  source_payload: { source: "governed_action", sourceActionId: "act-old" },
});

const oldExecution = scoped({
  id: "exec-old",
  task_id: "task-old",
  source_action_id: "act-old",
  status: "completed",
  attempt_count: 1,
  dispatched_by: ACTOR,
  queued_at: OLD,
  completed_at: OLD,
  created_at: OLD,
});

const oldOutcome = scoped({
  id: "out-old",
  task_id: "task-old",
  source_action_id: "act-old",
  internal_execution_id: "exec-old",
  state: "achieved",
  expected_result: "The old expectation.",
  created_at: OLD,
});

const oldObservation = scoped({
  id: "obs-old",
  outcome_id: "out-old",
  task_id: "task-old",
  observation_state: "achieved",
  summary: "Evidence confirmed the old outcome.",
  evidence_reference_ids: ["ev-old"],
  confidence_score: 0.9,
  missing_data_state: "COMPLETE",
  idempotency_key: "p2-12:observation:out-old:old",
  recorded_at: OLD,
});

/** Unrelated newer rows: each belongs to a DIFFERENT chain, so none of them can stand in
 *  for the linked row the old chain actually has. */
function noise(prefix: string, extra: (index: number) => Row, dateColumn: string): Row[] {
  return Array.from({ length: NOISE }, (_, index) =>
    scoped({ id: `${prefix}-${index}`, [dateColumn]: NEWER(index), ...extra(index) })
  );
}

const TABLES: Record<string, Row[]> = {
  operational_decision_records: [
    oldDecision,
    // Newer decisions exist too, but the Decision window is the deliberate bounded ROOT
    // set. Keeping it under the limit isolates what is being tested: the LINKED rows.
    ...noise("dec", (i) => ({ decision_status: "accepted", decided_by: ACTOR, created_at: NEWER(i) }), "created_at").slice(0, 5),
  ],
  material_action_proposals: [
    oldAction,
    ...noise("act", (i) => ({
      source_decision_id: `dec-${i}`,
      proposed_by: ACTOR,
      proposal: {},
      expires_at: "2027-01-01T00:00:00Z",
      persisted_at: NEWER(i),
    }), "persisted_at"),
  ],
  material_action_governance_evaluations: [
    // Deliberately stored oldest-first, so a union that appends without re-sorting hands
    // consumers the SUPERSEDED evaluation as the current one.
    oldEvaluation,
    { ...oldEvaluation, id: "eval-old-superseding", governance_state: "revoked", recorded_at: "2026-02-01T00:00:00Z", evaluated_at: "2026-02-01T00:00:00Z" },
    ...noise("eval", (i) => ({ action_id: `act-${i}`, governance_state: "authorized", recorded_at: NEWER(i) }), "recorded_at"),
  ],
  execution_tasks: [
    oldTask,
    // A RAID task that happens to carry the same `sourceActionId`. The windowed query
    // excludes it via `source = 'governed_action'`; the by-id completion must too, or an
    // ungoverned row enters a collection consumers read as governed.
    scoped({
      id: "task-raid-old",
      status: "completed",
      created_at: OLD,
      source_payload: { source: "raid_item", sourceActionId: "act-old" },
    }),
    ...noise("task", (i) => ({
      status: "completed",
      source_payload: { source: "governed_action", sourceActionId: `act-${i}` },
    }), "created_at"),
  ],
  internal_task_executions: [
    oldExecution,
    ...noise("exec", (i) => ({ task_id: `task-${i}`, status: "completed", dispatched_by: ACTOR }), "created_at"),
  ],
  canonical_task_outcomes: [
    oldOutcome,
    ...noise("out", (i) => ({ task_id: `task-${i}`, state: "expected" }), "created_at"),
  ],
  canonical_outcome_observations: [
    oldObservation,
    ...noise("obs", (i) => ({ outcome_id: `out-${i}`, observation_state: "achieved" }), "recorded_at"),
  ],
  decision_evidence_links: [{ decision_record_id: "dec-old", evidence_item_id: "ev-old" }],
  governance_events: [scoped({ id: "gov-old", authority_required: "baseline review", created_at: OLD })],
  recommended_actions: [scoped({ id: "rec-old", recommendation: "Old recommendation", governance_event_id: "gov-old", created_at: OLD })],
  workspace_memberships: [{ workspace_id: WORKSPACE, user_id: ACTOR, role: "owner" }],
};

/** Exactly the query-builder surface `getOperationalSummary` uses. Naming it keeps the
 *  stub honest: a method the service starts calling fails to type rather than silently
 *  resolving to `undefined`. */
type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
  single: () => Promise<{ data: Row | null; error: null }>;
  then: (
    onFulfilled: (value: { data: Row[]; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
};

/** A faithful-enough stand-in for the PostgREST query builder: filters, then orders, then
 *  limits — in that order, which is what makes the truncation under test real. */
function makeClient() {
  const queries: Array<{ table: string; filters: string[] }> = [];

  function builder(table: string): QueryBuilder {
    const eqs: Array<[string, unknown]> = [];
    const ins: Array<[string, unknown[]]> = [];
    const notNull: string[] = [];
    let orderColumn: string | null = null;
    let limit: number | null = null;
    const filters: string[] = [];

    const read = (column: string, row: Row): unknown => {
      // PostgREST JSON path filters, e.g. `source_payload->>sourceActionId`.
      const arrow = column.split("->>");
      if (arrow.length === 1) return row[column];
      const container = row[arrow[0]] as Row | undefined;
      return container?.[arrow[1]];
    };

    const resolve = () => {
      let rows = [...(TABLES[table] ?? [])];
      for (const [column, value] of eqs) rows = rows.filter((row) => String(read(column, row)) === String(value));
      for (const [column, values] of ins) rows = rows.filter((row) => values.map(String).includes(String(read(column, row))));
      for (const column of notNull) rows = rows.filter((row) => read(column, row) !== null && read(column, row) !== undefined);
      if (orderColumn) {
        rows.sort((a, b) => String(b[orderColumn!] ?? "").localeCompare(String(a[orderColumn!] ?? "")));
      }
      if (limit !== null) rows = rows.slice(0, limit);
      queries.push({ table, filters: [...filters] });
      return { data: rows, error: null };
    };

    const chain: QueryBuilder = {
      select: () => chain,
      eq: (column: string, value: unknown) => { eqs.push([column, value]); filters.push(`eq:${column}`); return chain; },
      in: (column: string, values: unknown[]) => { ins.push([column, values]); filters.push(`in:${column}`); return chain; },
      not: (column: string, operator: string, value: unknown) => {
        // The service only ever issues `.not(col, "is", null)`. Anything else would be a
        // filter this stub does not implement, and silently ignoring it would make the
        // truncation test pass against a query it never actually modelled.
        if (operator !== "is" || value !== null) {
          throw new Error(`unsupported_stub_filter: not(${column}, ${operator}, ${String(value)})`);
        }
        notNull.push(column);
        return chain;
      },
      order: (column: string) => { orderColumn = column; return chain; },
      limit: (value: number) => { limit = value; return chain; },
      maybeSingle: async () => { const result = resolve(); return { data: result.data[0] ?? null, error: null }; },
      single: async () => { const result = resolve(); return { data: result.data[0] ?? null, error: null }; },
      // Thenable, so `await client.from(...).select(...)` resolves to the query result the
      // service expects — the same shape PostgREST returns.
      then: (
        onFulfilled: (value: { data: Row[]; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };
    return chain;
  }

  return {
    client: {
      from: (table: string) => builder(table),
      rpc: async (name: string) => (name === "get_operational_assurance_summary" ? { data: {}, error: null } : { data: null, error: null }),
    },
    queries,
  };
}

async function main() {
  const { client, queries } = makeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub stands in for the Data API client
  const summary = await getOperationalSummary(client as any, WORKSPACE, PROJECT, ACTOR);

  const has = (rows: Array<Record<string, unknown>> | undefined, id: string) =>
    (rows ?? []).some((row) => String(row.id) === id);

  // Proof that the regression bites: the project-wide windows this service also issues
  // genuinely push the old chain's linked rows out. Without the by-id completion above,
  // every one of these would have been read as canonical absence.
  const { client: probeClient } = makeClient();
  const windowed = Object.fromEntries(
    await Promise.all(
      (
        [
          ["material_action_proposals", "persisted_at", "act-old"],
          ["material_action_governance_evaluations", "recorded_at", "eval-old"],
          ["execution_tasks", "created_at", "task-old"],
          ["internal_task_executions", "created_at", "exec-old"],
          ["canonical_task_outcomes", "created_at", "out-old"],
          ["canonical_outcome_observations", "recorded_at", "obs-old"],
        ] as Array<[string, string, string]>
      ).map(async ([table, column, id]) => {
        const result = (await probeClient
          .from(table)
          .select("*")
          .eq("workspace_id", WORKSPACE)
          .eq("project_id", PROJECT)
          .order(column, { ascending: false })
          .limit(30)) as { data: Row[] };
        return [table, result.data.some((row) => String(row.id) === id)] as const;
      })
    )
  );

  const { buildExecutionChains } = await import(
    "@/modules/workspace/presentation/command-center/execution-read-model"
  );
  const chains = buildExecutionChains(summary, new Date("2026-08-17T12:00:00Z"));
  const old = chains.find((chain) => chain.decisionId === "dec-old");
  const branch = old?.branches[0] ?? null;

  console.log(
    JSON.stringify({
      noiseRows: NOISE,
      // false for every collection: the newest-30 window does not contain the old row.
      windowedOnlyContainsOldRow: windowed,
      // Every linked row of the OLD chain survives, despite 35 newer unrelated rows in
      // each collection and a project-wide window of 30.
      summaryCarries: {
        action: has(summary.materialActions, "act-old"),
        evaluation: has(summary.materialActionEvaluations, "eval-old"),
        task: has(summary.tasks, "task-old"),
        execution: has(summary.executions, "exec-old"),
        outcome: has(summary.outcomes, "out-old"),
        observation: has(summary.observations, "obs-old"),
      },
      // The chain therefore states what is true rather than inferring absence.
      chainResolves: {
        found: Boolean(old),
        branches: old?.branches.length ?? 0,
        actionId: branch?.action.actionId ?? null,
        taskId: branch?.task?.taskId ?? null,
        executionId: branch?.latestExecution?.executionId ?? null,
        outcomeId: branch?.outcome?.outcomeId ?? null,
        observationCount: branch?.observations.length ?? 0,
        outcomeAchieved: branch?.boundary.outcomeAchieved ?? null,
        statement: branch?.boundary.statement ?? null,
      },
      // The by-id completion applies the SAME filter the window does, so the collection
      // still means what it says.
      governedTasksOnly: {
        governedPresent: has(summary.tasks, "task-old"),
        ungovernedExcluded: !has(summary.tasks, "task-raid-old"),
      },
      // And it restores the window's ordering, so "first row wins" still resolves the
      // newest evaluation rather than whichever the Data API happened to return.
      evaluationOrder: (summary.materialActionEvaluations ?? [])
        .filter((row) => String(row.action_id) === "act-old")
        .map((row) => String(row.id)),
      // The completion reads are by exact persisted reference, never a widened window.
      linkedByIdQueries: queries
        .filter((query) => query.filters.some((filter) => filter.startsWith("in:")))
        .map((query) => `${query.table}:${query.filters.filter((filter) => filter.startsWith("in:")).join(",")}`),
    })
  );
}

void main();
