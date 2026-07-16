/**
 * Founder Circle Program — in-memory Supabase stand-in for route/lib tests.
 *
 * Mirrors the repo's per-domain fake pattern (tests/stripe-webhook-test-helpers.ts):
 * a small chainable query builder over plain arrays, with real 23505
 * unique-violation emulation for the constraints the domain relies on, and a
 * JS emulation of the founder_program_transition SQL function (settings
 * lock + capacity + compare-and-swap + append-only audit row) so capacity
 * and idempotency behavior can be exercised without a database.
 */
import crypto from "node:crypto";

type Row = Record<string, unknown>;

export type FounderFakeDb = {
  tables: Record<string, Row[]>;
  client: FounderFakeClient;
  seedSettings: (overrides?: Row) => Row;
};

const UNIQUE_CONSTRAINTS: Record<string, Array<(row: Row, existing: Row[]) => boolean>> = {
  founder_invitations: [
    (row, existing) => existing.some((r) => r.token_hash === row.token_hash),
    (row, existing) =>
      ["pending", "viewed"].includes(String(row.status ?? "pending")) &&
      existing.some((r) => r.email === row.email && ["pending", "viewed"].includes(String(r.status))),
  ],
  founder_participants: [
    (row, existing) => existing.some((r) => r.invitation_id === row.invitation_id),
    (row, existing) => row.user_id != null && existing.some((r) => r.user_id === row.user_id),
  ],
  founder_applications: [(row, existing) => existing.some((r) => r.participant_id === row.participant_id)],
  founder_onboarding_checkpoints: [
    (row, existing) => existing.some((r) => r.participant_id === row.participant_id && r.checkpoint === row.checkpoint),
  ],
};

const DEFAULTS: Record<string, (row: Row) => Row> = {
  founder_invitations: (row) => ({ status: "pending", created_at: new Date().toISOString(), ...row }),
  founder_participants: (row) => ({ lifecycle_state: "nominated", created_at: new Date().toISOString(), ...row }),
  founder_feedback: (row) => ({ status: "new", severity: "medium", created_at: new Date().toISOString(), ...row }),
  founder_onboarding_checkpoints: (row) => ({ reached_at: new Date().toISOString(), ...row }),
  founder_program_events: (row) => ({ occurred_at: new Date().toISOString(), ...row }),
  founder_membership_transitions: (row) => ({ created_at: new Date().toISOString(), ...row }),
  founder_discovery_sessions: (row) => ({ status: "scheduled", willingness_to_pay: "unknown", consent_status: "not_requested", created_at: new Date().toISOString(), ...row }),
  founder_program_decisions: (row) => ({ created_at: new Date().toISOString(), ...row }),
};

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  private pendingInsert: Row[] | null = null;
  private pendingUpdate: Row | null = null;
  private orderKey: { column: string; ascending: boolean } | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private selectedError: { message: string; code?: string } | null = null;

  constructor(
    private readonly db: FounderFakeDb,
    private readonly table: string,
  ) {}

  private projection: string[] | null = null;

  select(columns?: string) {
    if (columns && columns.trim() !== "*") {
      this.projection = columns.split(",").map((c) => c.trim()).filter(Boolean);
    }
    return this;
  }

  insert(rows: Row | Row[]) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((row) => ({
      id: crypto.randomUUID(),
      ...(DEFAULTS[this.table]?.(row) ?? row),
    }));
    const existing = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    for (const row of list) {
      for (const violates of UNIQUE_CONSTRAINTS[this.table] ?? []) {
        if (violates(row, existing)) {
          this.selectedError = { message: "duplicate key value violates unique constraint", code: "23505" };
          this.pendingInsert = [];
          return this;
        }
      }
    }
    existing.push(...list);
    this.pendingInsert = list;
    return this;
  }

  update(patch: Row) {
    this.pendingUpdate = patch;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this.maybeApplyUpdate();
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this.maybeApplyUpdate();
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value || (value === null && row[column] === undefined));
    return this.maybeApplyUpdate();
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderKey = { column, ascending: opts?.ascending !== false };
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = { from, to };
    return this;
  }

  private maybeApplyUpdate() {
    return this;
  }

  private materialize(): Row[] {
    let rows = [...(this.db.tables[this.table] ?? [])].filter((row) => this.filters.every((f) => f(row)));
    if (this.pendingUpdate) {
      const patch = this.pendingUpdate;
      const targets = rows;
      for (const row of targets) Object.assign(row, patch);
      rows = targets;
    } else if (this.pendingInsert) {
      rows = this.pendingInsert;
    }
    if (this.orderKey) {
      const { column, ascending } = this.orderKey;
      rows.sort((a, b) => (String(a[column]) < String(b[column]) ? (ascending ? -1 : 1) : ascending ? 1 : -1));
    }
    if (this.rangeBounds) rows = rows.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
    if (this.projection) {
      const projection = this.projection;
      rows = rows.map((row) => Object.fromEntries(projection.filter((c) => c in row).map((c) => [c, row[c]])));
    }
    return rows;
  }

  private result() {
    if (this.selectedError) return { data: null, error: this.selectedError };
    return { data: this.materialize(), error: null };
  }

  async maybeSingle() {
    const { data, error } = this.result();
    return { data: data ? ((data as Row[])[0] ?? null) : null, error };
  }

  async single() {
    const { data, error } = this.result();
    const row = data ? ((data as Row[])[0] ?? null) : null;
    if (!row && !error) return { data: null, error: { message: "no rows" } };
    return { data: row, error };
  }

  then<T>(resolve: (value: { data: Row[] | null; error: { message: string; code?: string } | null }) => T) {
    return Promise.resolve(this.result()).then(resolve);
  }
}

export type FounderFakeClient = {
  from: (table: string) => Query;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const ACCESS_STATES = ["onboarding_active", "activated", "feedback_active"];
const APPROVED_STATES = ["approved", "agreement_pending", "agreement_accepted", "onboarding_pending", ...ACCESS_STATES, "paused"];

export function createFounderFakeDb(): FounderFakeDb {
  const tables: Record<string, Row[]> = {
    founder_program_settings: [],
    founder_invitations: [],
    founder_participants: [],
    founder_applications: [],
    founder_membership_transitions: [],
    founder_onboarding_checkpoints: [],
    founder_program_events: [],
    founder_feedback: [],
    founder_discovery_sessions: [],
    founder_program_decisions: [],
  };

  const db: FounderFakeDb = {
    tables,
    client: {
      from: (table: string) => new Query(db, table),
      rpc: async (fn, args) => {
        if (fn !== "founder_program_transition") return { data: null, error: { message: `unknown rpc ${fn}` } };
        const settings = tables.founder_program_settings[0];
        if (!settings) return { data: "settings_missing", error: null };

        const scope = args.p_capacity_scope as string | null;
        const override = args.p_capacity_override === true;
        if (scope === "approved" && !override) {
          const count = tables.founder_participants.filter((p) => APPROVED_STATES.includes(String(p.lifecycle_state))).length;
          if (count >= Number(settings.max_approved_participants)) return { data: "capacity_reached", error: null };
        }
        if (scope === "active" && !override) {
          const count = tables.founder_participants.filter((p) => ACCESS_STATES.includes(String(p.lifecycle_state))).length;
          if (count >= Number(settings.max_active_participants)) return { data: "capacity_reached", error: null };
        }

        const participant = tables.founder_participants.find((p) => p.id === args.p_participant_id);
        if (!participant) return { data: "participant_not_found", error: null };
        if (participant.lifecycle_state !== args.p_expected_from) return { data: "state_conflict", error: null };

        participant.lifecycle_state = args.p_to;
        if (args.p_reason) participant.state_reason = args.p_reason;
        tables.founder_membership_transitions.push({
          id: crypto.randomUUID(),
          participant_id: args.p_participant_id,
          from_state: args.p_expected_from,
          to_state: args.p_to,
          actor_type: args.p_actor_type,
          actor_user_id: args.p_actor_user_id ?? null,
          reason: args.p_reason ?? null,
          created_at: new Date().toISOString(),
        });
        return { data: "ok", error: null };
      },
    },
    seedSettings: (overrides: Row = {}) => {
      const row: Row = {
        id: crypto.randomUUID(),
        singleton: true,
        display_name: "PMFreak Founder Circle",
        program_enabled: true,
        invite_only: true,
        applications_enabled: true,
        max_approved_participants: 10,
        max_active_participants: 5,
        max_invitations_per_batch: 5,
        invitation_expiry_days: 7,
        required_agreement_version: "0.1-draft",
        required_onboarding_version: "v1",
        capability_profile: "pilot",
        support_contact: "founder@pmfreak.com",
        feedback_cadence_days: 14,
        program_starts_on: null,
        review_due_on: null,
        ...overrides,
      };
      tables.founder_program_settings = [row];
      return row;
    },
  };

  return db;
}

/** Silences the analytics/security side channels in lib tests. */
export const silentTransitionDeps = {
  logEvent: (async () => {}) as never,
  recordEvent: (async () => ({ ok: true as const })) as never,
};
