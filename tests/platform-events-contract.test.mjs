/**
 * platform_events — governance contract tests
 *
 * Static source analysis (no TypeScript transpilation, no live DB).
 * Verifies:
 *  - P0-1: Immutability trigger exists in migrations
 *  - P0-2: Recursive forbidden key detection in create-event.ts
 *  - P0-3: Cross-workspace RLS validation in hardening migration
 *  - Additional: single-source column list, actor coherence
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const migrations = readdirSync(join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(ROOT, "supabase/migrations", f), "utf8"))
  .join("\n");

const foundation = read("supabase/migrations/20260616000000_platform_events_foundation.sql");
const hardening = read("supabase/migrations/20260616000001_platform_events_p0_hardening.sql");
const createEvent = read("src/lib/platform-events/create-event.ts");
const queryEvents = read("src/lib/platform-events/query-events.ts");
const contract = read("src/lib/db/database-contract.ts");
const docs = read("docs/platform-event-layer.md");

// ─── P0-1: Append-only / immutability ────────────────────────────────────────

test("P0-1: prevent_platform_event_mutation function exists in migrations", () => {
  assert.match(hardening, /create or replace function public\.prevent_platform_event_mutation/);
});

test("P0-1: immutability trigger fires before UPDATE and DELETE", () => {
  assert.match(hardening, /before update or delete/i);
  assert.match(hardening, /on public\.platform_events/);
  assert.match(hardening, /execute function public\.prevent_platform_event_mutation/);
});

test("P0-1: trigger error message mentions compensating event", () => {
  assert.match(hardening, /compensating event/);
});

test("P0-1: trigger error message includes the operation name", () => {
  assert.match(hardening, /tg_op/);
});

test("P0-1: no UPDATE policy exists on platform_events in any migration", () => {
  const updatePolicies = migrations.match(
    /create policy[^;]*for update[^;]*on public\.platform_events/gi
  );
  assert.equal(updatePolicies, null, "platform_events must have no UPDATE RLS policy");
});

test("P0-1: no DELETE policy exists on platform_events in any migration", () => {
  const deletePolicies = migrations.match(
    /create policy[^;]*for delete[^;]*on public\.platform_events/gi
  );
  assert.equal(deletePolicies, null, "platform_events must have no DELETE RLS policy");
});

// ─── P0-2: Recursive forbidden key detection ─────────────────────────────────

test("P0-2: detectForbiddenKeys traverses nested objects", () => {
  // The implementation must recurse into object values
  assert.match(createEvent, /Array\.isArray|typeof value.*object/s);
  assert.match(createEvent, /detectForbiddenKeys.*fullPath|detectForbiddenKeys.*path/s);
});

test("P0-2: detectForbiddenKeys handles arrays", () => {
  assert.match(createEvent, /Array\.isArray/);
  // Template literal path uses ${path}[${i}] — verify both variable references
  assert.match(createEvent, /\$\{path\}/);
  assert.match(createEvent, /\$\{i\}/);
});

test("P0-2: detectForbiddenKeys reports full dotted path on rejection", () => {
  // The error message in createPlatformEvent must include the path
  assert.match(createEvent, /Forbidden payload key detected: \$\{forbiddenPath\}/);
});

test("P0-2: all required forbidden keys are in the set", () => {
  const required = [
    "full_email_body",
    "full_contract_text",
    "raw_document_text",
    "password",
    "secret",
    "token",
    "api_key",
  ];
  for (const key of required) {
    assert.equal(createEvent.includes(`"${key}"`), true, `forbidden key missing: ${key}`);
  }
});

test("P0-2: rejection uses failureClass forbidden_payload_key", () => {
  assert.match(createEvent, /failureClass: "forbidden_payload_key"/);
});

// ─── Inline unit tests for detectForbiddenKeys logic ─────────────────────────
// Since we cannot import TypeScript modules, we re-implement the same algorithm
// in plain JS to verify the logic spec is correct before trusting the TS source.

{
  const FORBIDDEN = new Set([
    "full_email_body", "full_contract_text", "raw_document_text",
    "password", "secret", "token", "api_key", "private_key",
    "access_token", "refresh_token", "bearer_token", "authorization",
  ]);

  function detect(value, path = "") {
    if (value === null || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const found = detect(value[i], `${path}[${i}]`);
        if (found !== null) return found;
      }
      return null;
    }
    for (const key of Object.keys(value)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN.has(key.toLowerCase())) return fullPath;
      const found = detect(value[key], fullPath);
      if (found !== null) return found;
    }
    return null;
  }

  test("P0-2 unit: clean top-level payload is accepted", () => {
    assert.equal(detect({ risk_id: "uuid", severity: "high" }), null);
  });

  test("P0-2 unit: top-level forbidden key is detected", () => {
    assert.equal(detect({ token: "abc" }), "token");
  });

  test("P0-2 unit: nested object forbidden key is detected with dotted path", () => {
    assert.equal(detect({ data: { credentials: { api_key: "sk-live" } } }), "data.credentials.api_key");
  });

  test("P0-2 unit: forbidden key inside array item is detected with index path", () => {
    assert.equal(detect({ items: [{ password: "x" }] }), "items[0].password");
  });

  test("P0-2 unit: deeply nested forbidden key is detected", () => {
    const payload = { a: { b: { c: { d: { secret: "hidden" } } } } };
    assert.equal(detect(payload), "a.b.c.d.secret");
  });

  test("P0-2 unit: array of clean objects is accepted", () => {
    assert.equal(detect({ tags: [{ id: "1", label: "risk" }, { id: "2", label: "dependency" }] }), null);
  });

  test("P0-2 unit: forbidden key in second array element is detected", () => {
    assert.equal(detect({ items: [{ ok: true }, { full_email_body: "Dear..." }] }), "items[1].full_email_body");
  });

  test("P0-2 unit: null value at nested path does not throw", () => {
    assert.equal(detect({ data: null }), null);
  });

  test("P0-2 unit: empty object is accepted", () => {
    assert.equal(detect({}), null);
  });
}

// ─── P0-3: Cross-workspace project_id validation ─────────────────────────────

test("P0-3: hardening migration drops the old INSERT policy before replacing it", () => {
  assert.match(hardening, /drop policy if exists "workspace members can insert platform_events"/);
});

test("P0-3: replacement INSERT policy validates project workspace membership", () => {
  assert.match(hardening, /p\.workspace_id = platform_events\.workspace_id/);
  assert.match(hardening, /from public\.projects p/);
  assert.match(hardening, /where p\.id = project_id/);
});

test("P0-3: INSERT policy allows null project_id (workspace-level events)", () => {
  assert.match(hardening, /project_id is null/);
});

// ─── Additional: single-source column list ────────────────────────────────────

test("Additional: create-event.ts imports PLATFORM_EVENT_SELECTABLE_COLUMNS from database-contract", () => {
  assert.match(createEvent, /PLATFORM_EVENT_SELECTABLE_COLUMNS.*from.*database-contract/s);
});

test("Additional: query-events.ts imports PLATFORM_EVENT_SELECTABLE_COLUMNS from database-contract", () => {
  assert.match(queryEvents, /PLATFORM_EVENT_SELECTABLE_COLUMNS.*from.*database-contract/s);
});

test("Additional: create-event.ts does not define its own column list literal", () => {
  // Must not contain a local array with "workspace_id" column literals
  assert.doesNotMatch(createEvent, /const PLATFORM_EVENT_COLUMNS\s*=\s*\[/);
});

test("Additional: query-events.ts does not define its own column list literal", () => {
  assert.doesNotMatch(queryEvents, /const PLATFORM_EVENT_COLUMNS\s*=\s*\[/);
});

// ─── Additional: actor_id / actor_type coherence ─────────────────────────────

test("Additional: user actor_type requires actor_id — validation present", () => {
  assert.match(createEvent, /actorType === "user".*actorId/s);
  assert.match(createEvent, /actorId is required when actorType is 'user'/);
});

test("Additional: default actorType is 'system' not 'user'", () => {
  assert.match(createEvent, /input\.actorType \?\? "system"/);
  assert.doesNotMatch(createEvent, /input\.actorType \?\? "user"/);
});

// ─── Documentation completeness ───────────────────────────────────────────────

test("Docs: states that platform_events is immutable", () => {
  assert.equal(docs.toLowerCase().includes("immutable") || docs.toLowerCase().includes("append-only"), true);
});

test("Docs: explains compensating event pattern", () => {
  assert.match(docs, /compensating event|correction event/i);
});

test("Docs: states raw data belongs to customer", () => {
  assert.match(docs, /raw data belongs to the customer/i);
});

test("Docs: mentions project\/workspace ownership integrity", () => {
  assert.match(docs, /project_id.*workspace_id|workspace.*project.*integrit/si);
});

// ─── Foundation migration integrity ──────────────────────────────────────────

test("Foundation: platform_events table is created", () => {
  assert.match(foundation, /create table if not exists public\.platform_events/);
});

test("Foundation: RLS is enabled on platform_events", () => {
  assert.match(foundation, /alter table public\.platform_events enable row level security/);
});

test("Foundation: SELECT policy exists", () => {
  assert.match(foundation, /create policy.*for select.*on public\.platform_events/is);
});

test("Foundation: uses is_workspace_member for RLS", () => {
  assert.match(foundation, /is_workspace_member\(workspace_id\)/);
});

test("Foundation: workspace_id has cascade delete", () => {
  assert.match(foundation, /workspace_id.*references public\.workspaces.*on delete cascade/is);
});

test("Foundation: all composite indexes declared", () => {
  assert.match(foundation, /platform_events_workspace_time_idx/);
  assert.match(foundation, /platform_events_workspace_project_time_idx/);
  assert.match(foundation, /platform_events_workspace_type_time_idx/);
});

// ─── database-contract.ts integrity ──────────────────────────────────────────

test("Contract: PlatformEventRow is exported", () => {
  assert.match(contract, /export type PlatformEventRow/);
});

test("Contract: PLATFORM_EVENT_SELECTABLE_COLUMNS is exported", () => {
  assert.match(contract, /export const PLATFORM_EVENT_SELECTABLE_COLUMNS/);
});

test("Contract: DATABASE_CONTRACT_VERSION reflects platform_events addition", () => {
  assert.match(contract, /platform-events/);
});
