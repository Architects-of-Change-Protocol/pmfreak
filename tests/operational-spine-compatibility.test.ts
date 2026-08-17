import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  COMPATIBILITY_CONTRACT_VERSION,
  OPERATIONAL_SPINE_CONSUMER_MAP,
  mapCompatibilityEvent,
  resolveLegacyReference,
  runConsumerSafetyGate,
  validateLineageEdges,
  type CompatibilityMapping,
  type CorrelationSpine,
  type LegacyReference,
} from "../src/lib/operational-spine/index";

const legacy: LegacyReference = { kind: "project_decision", id: "legacy-decision-7", workspaceId: "workspace-a", projectId: "project-a" };
const mapping: CompatibilityMapping = {
  canonicalReference: { kind: "decision", id: "00000000-0000-4000-8000-000000000002" as CompatibilityMapping["canonicalReference"]["id"], workspaceId: "workspace-a", projectId: "project-a", legacyReferences: [legacy] },
  legacyReference: legacy,
  owner: "decision-governance",
  method: "persisted_link",
  contractVersion: COMPATIBILITY_CONTRACT_VERSION,
  evidence: [{ reference: "platform-event:7", basis: "versioned_event" }],
};
const resolve = (overrides: Partial<Parameters<typeof resolveLegacyReference>[0]> = {}) => resolveLegacyReference({
  reference: legacy, scope: { workspaceId: "workspace-a", projectId: "project-a" },
  contractVersion: COMPATIBILITY_CONTRACT_VERSION, readMappings: () => [mapping], ...overrides,
});

test("supported legacy references resolve deterministically without mutating inputs", () => {
  const snapshot = structuredClone({ legacy, mapping });
  assert.deepEqual(resolve(), { status: "resolved", mapping });
  assert.deepEqual({ legacy, mapping }, snapshot);
  assert.deepEqual(resolve(), resolve(), "retry is idempotent");
});

test("unsupported, unresolved, stale, invalid and unavailable references fail explicitly", () => {
  const unsupported = { ...legacy, kind: "recommended_action_decision" as const };
  assert.equal(resolve({ reference: unsupported }).status, "failed");
  assert.equal(resolve({ readMappings: () => [] }).status, "failed");
  assert.deepEqual(resolve({ contractVersion: "p2-01.v1" }), { status: "failed", code: "stale_contract_version", legacyReference: legacy, detail: "The compatibility contract version is stale.", retryable: false });
  assert.equal(resolve({ reference: { ...legacy, id: "" } }).status, "failed");
  const unavailable = resolve({ readMappings: () => ({ unavailable: true }) });
  assert.equal(unavailable.status, "failed");
  if (unavailable.status === "failed") assert.equal(unavailable.retryable, true);
});

test("Workspace and Project scope mismatch fails closed", () => {
  for (const scope of [{ workspaceId: "workspace-b", projectId: "project-a" }, { workspaceId: "workspace-a", projectId: "project-b" }]) {
    const result = resolve({ scope });
    assert.equal(result.status, "failed");
    if (result.status === "failed") assert.equal(result.code, "scope_mismatch");
  }
});

test("duplicate and conflicting ownership mappings never resolve optimistically", () => {
  const duplicate = resolve({ readMappings: () => [mapping, mapping] });
  assert.equal(duplicate.status, "failed");
  if (duplicate.status === "failed") assert.equal(duplicate.code, "duplicate_mapping");
  const conflicting = resolve({ readMappings: () => [mapping, { ...mapping, owner: "other-owner" }] });
  assert.equal(conflicting.status, "failed");
  if (conflicting.status === "failed") assert.equal(conflicting.code, "conflicting_canonical_ownership");
});

test("correlation remains partial when missing and cycles or ambiguity are rejected", () => {
  assert.deepEqual(validateLineageEdges([{ id: "root", causationId: null }, { id: "child", causationId: "root" }]), { ok: true, partial: true });
  assert.equal(validateLineageEdges([{ id: "a", causationId: "b" }, { id: "b", causationId: "a" }]).ok, false);
  assert.equal(validateLineageEdges([{ id: "a", causationId: null }, { id: "a", causationId: null }]).ok, false);
});

test("event projection preserves missing lineage and never invents a canonical reference", () => {
  const spine: CorrelationSpine = {
    actor: { id: "user-1", type: "user" }, evaluatedAt: "2026-08-10T00:00:00Z", occurredAt: "2026-08-10T00:00:00Z", recordedAt: "2026-08-10T00:00:01Z",
    correlationId: null, causationId: null, evidenceReferences: [], confidence: "unavailable", missingData: ["correlation", "causation", "evidence"],
    authority: { businessAuthority: "project_manager", aocPolicyReference: null, aocGrantReference: null }, sourceReferences: [], legacyReferences: [legacy], correctionOf: null, supersedes: null,
  };
  const unresolved = resolve({ readMappings: () => [] });
  const event = mapCompatibilityEvent({ eventType: "project_decision.compatibility_checked", eventVersion: "1", spine, resolution: unresolved, legacyReference: legacy, owner: "decision-governance" });
  assert.equal(event.canonicalReference, null);
  assert.equal(event.correlationId, null);
  assert.equal(event.lineageStatus, "unresolved");
});

test("consumer safety gate verifies all 32 paths and symbols and detects drift", () => {
  const reader = { exists: fs.existsSync, read: (path: string) => fs.readFileSync(path, "utf8") };
  const result = runConsumerSafetyGate(reader);
  // 30 at P2-01 + the two P2-20 audit-export entries.
  assert.deepEqual(result, { ok: true, inspected: 32, issues: [] });
  const drifted = OPERATIONAL_SPINE_CONSUMER_MAP.map((entry, index) => index === 0 ? { ...entry, symbol: "removedSymbol" } : entry);
  const drift = runConsumerSafetyGate(reader, drifted);
  assert.equal(drift.ok, false);
  assert.ok(drift.issues.some((issue) => issue.code === "missing_symbol"));
});
