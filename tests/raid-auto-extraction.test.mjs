import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const migration = fs.readFileSync("supabase/migrations/20260602020000_raid_auto_extraction.sql", "utf8");
const raidTypes = fs.readFileSync("src/lib/raid/types.ts", "utf8");
const raidEngine = fs.readFileSync("src/lib/raid/extraction.ts", "utf8");
const vaultPipeline = fs.readFileSync("src/lib/vault/intake/pipeline.ts", "utf8");
const vaultStorage = fs.readFileSync("src/lib/vault/intake/storage.ts", "utf8");
const briefTypes = fs.readFileSync("src/lib/projects/first-insight/operational-governance-brief-types.ts", "utf8");
const commandCenter = fs.readFileSync("src/features/command-center/command-center-client.tsx", "utf8");

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import { ingestVaultDocument, normalizeVaultContent, extractVaultOperationalSignals } from "./src/lib/vault/intake/index.ts";
import { buildRaidOverview, calculateProjectRaidHealth, canonicalRaidFingerprint, detectRaidDueDate, detectRaidOwner, extractRaidItems } from "./src/lib/raid/index.ts";
import { generateOperationalGovernanceBrief } from "./src/lib/projects/first-insight/index.ts";

(async () => {
const ids = (() => { let i = 0; return () => "00000000-0000-0000-0000-" + String(++i).padStart(12, "0"); })();
const now = "2026-06-02T00:00:00.000Z";
const document = {
  id: ids(),
  workspaceId: "00000000-0000-0000-0000-000000000101",
  projectId: "00000000-0000-0000-0000-000000000202",
  title: "Firewall meeting",
  sourceType: "meeting_notes",
  rawContent: "El proveedor no entregará el firewall hasta el 15 de julio. Firewall delivery has an issue and uncertainty. Carlos actualizará el cronograma by Friday. La instalación depende del acceso al sitio. Se asume disponibilidad del equipo la próxima semana. Se aprobó continuar.",
  normalizedContent: "",
  createdAt: now,
  createdBy: "00000000-0000-0000-0000-000000000303",
  ingestionStatus: "document_persisted",
  classification: "mixed",
};
document.normalizedContent = normalizeVaultContent(document.rawContent);
const signals = extractVaultOperationalSignals({ documentId: document.id, workspaceId: document.workspaceId, projectId: document.projectId, normalizedContent: document.normalizedContent, createdAt: now, idFactory: ids });
const raidItems = extractRaidItems({ document, signals, idFactory: ids });
const risk = raidItems.find((item) => item.category === "risk");
const issue = raidItems.find((item) => item.category === "issue");
const dependency = raidItems.find((item) => item.category === "dependency");
const assumption = raidItems.find((item) => item.category === "assumption");
assert.ok(risk, "risk item is created from risk signal");
assert.ok(issue, "issue item is created from issue signal");
assert.ok(dependency, "dependency item is created from dependency signal");
assert.ok(assumption, "assumption item is created from assumption phrase");
assert.equal(detectRaidOwner("Carlos will update the timeline"), "Carlos");
assert.equal(detectRaidOwner("Owner: Victor"), "Victor");
assert.equal(detectRaidDueDate("entrega hasta el 15 de julio", now), "2026-07-15");
assert.equal(detectRaidDueDate("Carlos will review by Friday", now), "2026-06-05");
assert.equal(detectRaidDueDate("expected delivery next week", now), "2026-06-09");
assert.equal(canonicalRaidFingerprint("risk", "The vendor delivery delay!"), canonicalRaidFingerprint("risk", "Vendor delivery delay"));
assert.ok(risk.confidenceScore >= 60 && risk.confidenceScore <= 100);
const health = calculateProjectRaidHealth(raidItems);
assert.equal(health.riskCount >= 1, true);
assert.equal(health.issueCount >= 1, true);
assert.equal(health.dependencyCount >= 1, true);
assert.equal(health.assumptionCount >= 1, true);
assert.ok(health.healthScore < 100);
const overview = buildRaidOverview(raidItems);
const brief = generateOperationalGovernanceBrief({ workspaceId: document.workspaceId, projectId: document.projectId, detectedRaidOverview: { topRisks: overview.topRisks, topIssues: overview.topIssues, keyDependencies: overview.keyDependencies, keyAssumptions: overview.keyAssumptions, snapshot: overview.snapshot, healthScore: overview.health.healthScore } });
assert.ok(brief.detectedRaidOverview.snapshot.risks >= 1);
assert.ok(brief.sourceSummary.signalsEvaluated.includes("detected_raid_overview"));

const calls = { documents: [], signals: [], raidCreated: [], raidUpdated: [], synthesis: [] };
const seen = new Map();
const store = {
  async persistDocument(doc) { calls.documents.push(doc); return { ok: true }; },
  async persistSignals(items) { calls.signals.push(...items); return { ok: true }; },
  async updateDocumentStatus() { return { ok: true }; },
  async persistRaidItems(items) {
    const created = [];
    const updated = [];
    for (const item of items) {
      const key = item.fingerprint;
      if (seen.has(key)) {
        const next = { ...seen.get(key), occurrenceCount: seen.get(key).occurrenceCount + 1, confidenceScore: Math.min(100, seen.get(key).confidenceScore + 4) };
        seen.set(key, next);
        updated.push(next);
      } else {
        seen.set(key, item);
        created.push(item);
      }
    }
    calls.raidCreated.push(...created);
    calls.raidUpdated.push(...updated);
    return { ok: true, created, updated };
  },
  async triggerExecutiveSynthesisUpdate(input) { calls.synthesis.push(input); return { ok: true }; },
};
const input = { workspaceId: document.workspaceId, companyId: "company-1", projectId: document.projectId, rawContent: document.rawContent, createdBy: document.createdBy, now, sourceType: "meeting_notes", store, idFactory: ids };
const first = await ingestVaultDocument(input);
const second = await ingestVaultDocument({ ...input, rawContent: document.rawContent, idFactory: ids });
assert.equal(first.ingestionStatus, "completed");
assert.equal(first.raidSnapshot.risks >= 1, true);
assert.equal(first.raidItemsCreated > 0, true);
assert.equal(second.raidItemsUpdated > 0, true);
assert.equal(calls.synthesis.at(-1).raidItems.length > 0, true);
const payload = { categories: raidItems.map((i) => i.category), owner: detectRaidOwner("Juan revisará el plan"), dueDate: detectRaidDueDate("July 15", now), health, overview, first, second, synthesisRaidCount: calls.synthesis.at(-1).raidItems.length };
console.log(JSON.stringify(payload));
})();
`;

const runtime = JSON.parse(execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8" }).trim().split("\n").at(-1));

test("RAID persistence migration defines canonical table, FKs, indexes and RLS without Supabase-incompatible policy syntax", () => {
  assert.match(migration, /create table if not exists public\.raid_items/);
  assert.match(migration, /workspace_id uuid not null references public\.workspaces\(id\) on delete cascade/);
  assert.match(migration, /project_id uuid null references public\.projects\(id\) on delete cascade/);
  assert.match(migration, /source_document_id uuid not null references public\.vault_documents\(id\) on delete cascade/);
  assert.match(migration, /source_signal_id uuid null references public\.vault_operational_signals\(id\) on delete set null/);
  assert.match(migration, /raid_items_project_fingerprint_uidx/);
  assert.match(migration, /alter table public\.raid_items enable row level security/);
  assert.doesNotMatch(migration, /create policy if not exists/i);
});

test("canonical RAID types and deterministic engine exports exist", () => {
  for (const field of ["workspaceId", "projectId", "sourceDocumentId", "sourceSignalId", "category", "status", "confidenceScore", "owner", "dueDate", "autoGenerated"]) {
    assert.match(raidTypes, new RegExp(`${field}:`));
  }
  assert.match(raidEngine, /export function extractRaidItems/);
  assert.match(raidEngine, /export function canonicalRaidFingerprint/);
  assert.match(raidEngine, /export function detectRaidOwner/);
  assert.match(raidEngine, /export function detectRaidDueDate/);
  assert.match(raidEngine, /export function calculateProjectRaidHealth/);
});

test("risk, issue, dependency and assumption creation work at runtime", () => {
  for (const category of ["risk", "issue", "dependency", "assumption"]) assert.ok(runtime.categories.includes(category));
});

test("owner detection, due date detection and confidence scoring are deterministic", () => {
  assert.equal(runtime.owner, "Juan");
  assert.equal(runtime.dueDate, "2026-07-15");
  assert.ok(runtime.first.confidenceScore >= 70);
});

test("duplicate prevention updates occurrences instead of creating duplicates", () => {
  assert.ok(runtime.first.raidItemsCreated > 0);
  assert.ok(runtime.second.raidItemsUpdated > 0);
});

test("project health and RAID overview are calculated", () => {
  assert.ok(runtime.health.riskCount >= 1);
  assert.ok(runtime.health.issueCount >= 1);
  assert.ok(runtime.health.dependencyCount >= 1);
  assert.ok(runtime.health.assumptionCount >= 1);
  assert.ok(runtime.health.healthScore < 100);
  assert.ok(runtime.overview.topRisks.length >= 1);
});

test("vault integration and executive synthesis feed include RAID items", () => {
  assert.match(vaultPipeline, /extractRaidItems/);
  assert.match(vaultStorage, /operational_memory_records/);
  assert.ok(runtime.synthesisRaidCount > 0);
  assert.equal(runtime.first.executiveSynthesisUpdated, true);
});

test("first insight and command center expose Detected RAID Overview and RAID Snapshot", () => {
  assert.match(briefTypes, /DetectedRaidOverview/);
  assert.match(commandCenter, /RAID Snapshot/);
  assert.match(commandCenter, /raidSnapshot/);
});
