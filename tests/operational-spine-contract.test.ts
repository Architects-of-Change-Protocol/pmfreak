import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_OBJECT_KINDS,
  OPERATIONAL_SPINE_CONSUMER_MAP,
  parseCanonicalId,
  summarizeConsumerMap,
  validateCanonicalTransition,
  validateConsumerMap,
} from "../src/lib/operational-spine/index";

const IDS = {
  recommendation: "00000000-0000-4000-8000-000000000001",
  decision: "00000000-0000-4000-8000-000000000002",
  action: "00000000-0000-4000-8000-000000000003",
  task: "00000000-0000-4000-8000-000000000004",
  outcome: "00000000-0000-4000-8000-000000000005",
} as const;

test("canonical IDs validate independently for all five objects", () => {
  for (const kind of CANONICAL_OBJECT_KINDS) {
    assert.deepEqual(parseCanonicalId(kind, IDS[kind]), { ok: true, value: IDS[kind] });
    const invalid = parseCanonicalId(kind, `${kind}-legacy-id`);
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.kind, kind);
  }
  assert.equal(new Set(Object.values(IDS)).size, 5);
});

test("each lifecycle accepts legal transitions and explicitly rejects collapse", () => {
  assert.equal(validateCanonicalTransition("recommendation", "proposed", "accepted").ok, true);
  assert.equal(validateCanonicalTransition("decision", "recorded", "approved").ok, true);
  assert.equal(validateCanonicalTransition("action", "requested", "authorized").ok, true);
  assert.equal(validateCanonicalTransition("task", "in_progress", "completed").ok, true);
  assert.equal(validateCanonicalTransition("outcome", "observing", "achieved").ok, true);
  assert.deepEqual(validateCanonicalTransition("task", "completed", "in_progress"), {
    ok: false, code: "illegal_canonical_transition", kind: "task", from: "completed", to: "in_progress", allowed: [],
  });
  assert.equal(validateCanonicalTransition("outcome", "expected", "achieved").ok, false, "Outcome must be observed before achievement");
});

test("state validation has no downstream object creation side effect", () => {
  const accepted = validateCanonicalTransition("recommendation", "proposed", "accepted");
  assert.deepEqual(Object.keys(accepted).sort(), ["from", "kind", "ok", "to"]);
  const approved = validateCanonicalTransition("decision", "recorded", "approved");
  assert.deepEqual(Object.keys(approved).sort(), ["from", "kind", "ok", "to"]);
});

test("machine-readable consumer map is valid, complete across canonical kinds, and has no unresolved entries", () => {
  assert.deepEqual(validateConsumerMap(OPERATIONAL_SPINE_CONSUMER_MAP), []);
  const covered = new Set(OPERATIONAL_SPINE_CONSUMER_MAP.flatMap((entry) => entry.objects));
  assert.deepEqual([...covered].sort(), [...CANONICAL_OBJECT_KINDS].sort());
  const summary = summarizeConsumerMap();
  assert.equal(summary.total, 30);
  assert.equal(summary.unresolved, 0);
  assert.ok(summary.classifications.CANONICAL >= 3);
  assert.ok(summary.classifications.BOUNDED_CONTEXT_MODEL >= 5);
});

test("consumer map preserves governed spine and classifies direct legacy conversion outside it", () => {
  const governed = OPERATIONAL_SPINE_CONSUMER_MAP.find((entry) => entry.symbol === "recordHumanDecision");
  assert.equal(governed?.classification, "CANONICAL");
  const legacy = OPERATIONAL_SPINE_CONSUMER_MAP.find((entry) => entry.symbol === "materializeTaskDraftForRecommendedAction");
  assert.equal(legacy?.classification, "MIGRATION_SOURCE");
  assert.match(legacy?.compatibility ?? "", /never expose as canonical Action-to-Task/);
});

test("remote decision writeback remains disabled in all integration configurations", async () => {
  const fs = await import("node:fs/promises");
  const files = [
    "src/features/pmfreak-integrations/aoc-governance-request-client/pmfreak-aoc-governance-client-config.ts",
    "src/features/pmfreak-integrations/aoc-governance-request-client/pmfreak-aoc-governed-action-gate-config.ts",
    "src/features/pmfreak-integrations/aoc-governance-request-client/pmfreak-aoc-remote-governance-transport-config.ts",
  ];
  for (const file of files) assert.match(await fs.readFile(file, "utf8"), /allowDecisionWriteback:\s*false/);
});
