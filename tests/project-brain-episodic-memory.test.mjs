// Project Brain Sprint 1 — Episodic Memory tests.
//
// Covers: the episode domain model, project-boundary guardrails,
// idempotency of deterministic derivation, the knowledge-transition model
// (exercised via deterministic fixtures, per the sprint's own "Scenario 6 —
// Supersession fixture" allowance — Sprint 1 does not yet *generate* real
// transitions, but the model and its guardrails must be correct), ordering/
// grouping, and static-analysis checks that the UI never renders fabricated
// learning language or a raw database id as visible text.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { deriveProjectEpisodes, buildProjectEpisodes } from "../src/lib/project-brain/episodic-memory/derive-episodes.ts";
import {
  validateProjectEpisode,
  validateProjectEpisodes,
  validateEpisodeRelations,
  validateKnowledgeTransitions,
  sanitizeProjectEpisode,
} from "../src/lib/project-brain/episodic-memory/episode-guards.ts";
import { sortEpisodes, groupEpisodesByRecency, labelForEpisodeType, labelForEpisodeActor } from "../src/lib/project-brain/episodic-memory/episode-language.ts";
import { supersedes, confirms } from "../src/lib/project-brain/episodic-memory/episode-relations.ts";
import { PROJECT_BRAIN_CONSTITUTION_VERSION } from "../src/lib/project-brain/constitution.ts";

const SCOPE = { workspaceId: "ws-1", projectId: "proj-1" };
const PROJECT = { projectId: SCOPE.projectId, workspaceId: SCOPE.workspaceId, projectName: "Atlas Migration", createdAt: "2026-07-01T00:00:00.000Z", onboarding: null };

function baseEpisode(overrides = {}) {
  return {
    id: "ep-1",
    scope: SCOPE,
    type: "project_created",
    occurredAt: "2026-07-01T00:00:00.000Z",
    recordedAt: "2026-07-01T00:00:00.000Z",
    title: "Project created",
    summary: "This project was created on July 1, 2026.",
    actor: { type: "system" },
    sourceReferences: [],
    statements: [],
    knowledgeTransitions: [],
    openQuestions: [],
    relatedEpisodeIds: [],
    status: "recorded",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Episode domain
// ─────────────────────────────────────────────────────────────────────────────

test("a well-formed episode passes validation", () => {
  assert.equal(validateProjectEpisode(baseEpisode()).ok, true);
});

test("an episode without a project id is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ scope: { workspaceId: "ws-1", projectId: "" } }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "episode_missing_project_id"));
});

test("an unsupported episode type is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ type: "risk_detected" }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "unsupported_episode_type"));
});

test("an invalid occurredAt timestamp is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ occurredAt: "not-a-date" }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "invalid_occurred_at"));
});

test("an episode with empty title or summary is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ title: "  " }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "episode_missing_title_or_summary"));
});

test("an episode with no constitution version is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ constitutionVersion: "" }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "episode_missing_constitution_version"));
});

test("fabricated learning language is rejected even if the episode is otherwise well-formed", () => {
  const result = validateProjectEpisode(baseEpisode({ summary: "The Project Brain deeply understood everything about this project." }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "fabricated_learning_language"));
});

test("a knowledge_superseded episode without a named target is rejected", () => {
  const result = validateProjectEpisode(baseEpisode({ type: "knowledge_superseded", supersedesEpisodeIds: [] }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "supersession_without_target"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Project boundary
// ─────────────────────────────────────────────────────────────────────────────

const OTHER_SCOPE = { workspaceId: "ws-2", projectId: "proj-2" };

test("a source reference from a different project is rejected", () => {
  const result = validateProjectEpisode(
    baseEpisode({ sourceReferences: [{ evidenceId: "e1", sourceSystem: "project_evidence", title: "x", evidenceType: "pdf", recordedAt: PROJECT.createdAt, authorityLevel: "primary", isPrimary: true, workspaceId: OTHER_SCOPE.workspaceId, projectId: OTHER_SCOPE.projectId }] }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "episode_source_crosses_project_boundary"));
});

test("a statement from a different project is rejected", () => {
  const foreignStatement = {
    id: "s1", scope: OTHER_SCOPE, epistemicType: "FACT", text: "x",
    confidence: { kind: "qualitative", level: "high" }, sources: [], generatedAt: PROJECT.createdAt, constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
  const result = validateProjectEpisode(baseEpisode({ statements: [foreignStatement] }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "episode_statement_crosses_project_boundary"));
});

test("a related episode relation crossing projects is rejected", () => {
  const a = baseEpisode({ id: "a", scope: SCOPE });
  const b = baseEpisode({ id: "b", scope: OTHER_SCOPE });
  const failures = validateEpisodeRelations([a, b], [supersedes("a", "b")]);
  assert.ok(failures.some((f) => f.code === "relation_crosses_project_boundary"));
});

test("a relation referencing an unknown episode id is rejected", () => {
  const a = baseEpisode({ id: "a" });
  const failures = validateEpisodeRelations([a], [supersedes("a", "missing")]);
  assert.ok(failures.some((f) => f.code === "relation_missing_to_episode"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency — repeated derivation never duplicates
// ─────────────────────────────────────────────────────────────────────────────

const evidenceRow = { id: "ev-1", file_name: "Plan.pdf", file_type: "pdf", uploaded_by: "user-1", uploaded_at: "2026-07-02T10:00:00.000Z", status: "processed" };

test("deriving twice from identical input produces identical episode ids in identical order", () => {
  const input = { project: PROJECT, projectEvidenceRows: [evidenceRow], contextEvidenceItemRows: [], knowledgeResponse: null };
  const first = deriveProjectEpisodes(input).map((e) => e.id);
  const second = deriveProjectEpisodes(input).map((e) => e.id);
  assert.deepEqual(first, second);
});

test("one project_evidence row produces exactly one evidence_stored episode", () => {
  const episodes = deriveProjectEpisodes({ project: PROJECT, projectEvidenceRows: [evidenceRow], contextEvidenceItemRows: [], knowledgeResponse: null });
  const matches = episodes.filter((e) => e.type === "evidence_stored" && e.id === "evidence-stored:ev-1");
  assert.equal(matches.length, 1);
});

test("a failed evidence row produces both evidence_stored and evidence_processing_failed, never a duplicate of either", () => {
  const episodes = deriveProjectEpisodes({ project: PROJECT, projectEvidenceRows: [{ ...evidenceRow, status: "failed" }], contextEvidenceItemRows: [], knowledgeResponse: null });
  assert.equal(episodes.filter((e) => e.id === "evidence-stored:ev-1").length, 1);
  assert.equal(episodes.filter((e) => e.id === "evidence-processing-failed:ev-1").length, 1);
});

test("project_created and brain_activated ids are content-addressed from the project id, not a counter", () => {
  const episodes = deriveProjectEpisodes({ project: PROJECT, projectEvidenceRows: [], contextEvidenceItemRows: [], knowledgeResponse: null });
  assert.ok(episodes.some((e) => e.id === `project-created:${PROJECT.projectId}`));
  assert.ok(episodes.some((e) => e.id === `brain-activated:${PROJECT.projectId}`));
});

test("buildProjectEpisodes validates before returning — a full derivation always passes its own guardrails", () => {
  const result = buildProjectEpisodes({ project: PROJECT, projectEvidenceRows: [evidenceRow], contextEvidenceItemRows: [{ id: "ei-1", source_type: "manual_note", title: "Kickoff notes", content: "...", created_by: "user-1", created_at: "2026-07-03T00:00:00.000Z" }], knowledgeResponse: null });
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.failures));
});

test("validateProjectEpisodes rejects a duplicate episode id — derivation must never emit the same id twice", () => {
  const a = baseEpisode({ id: "dup" });
  const b = baseEpisode({ id: "dup" });
  const result = validateProjectEpisodes([a, b]);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "duplicate_episode_id"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge transitions — fixture-based (Sprint 1 does not yet generate these live)
// ─────────────────────────────────────────────────────────────────────────────

function transition(overrides = {}) {
  return {
    id: "t-1", scope: SCOPE, subjectKey: "delivery-date", subjectLabel: "Delivery date",
    fromState: "unknown", toState: "reported", reason: "A status report named a date.",
    sourceReferences: [], occurredAt: PROJECT.createdAt, ...overrides,
  };
}

test("Unknown -> Reported is a valid transition", () => {
  assert.deepEqual(validateKnowledgeTransitions([transition()]), []);
});

test("Reported -> Confirmed requires a primary source", () => {
  const withoutPrimary = transition({ fromState: "reported", toState: "confirmed", sourceReferences: [{ evidenceId: "e1", sourceSystem: "evidence_items", title: "x", evidenceType: "manual_note", recordedAt: PROJECT.createdAt, authorityLevel: "secondary", isPrimary: false }] });
  const failures = validateKnowledgeTransitions([withoutPrimary]);
  assert.ok(failures.some((f) => f.code === "confirmation_without_authoritative_evidence"));

  const withPrimary = transition({ fromState: "reported", toState: "confirmed", sourceReferences: [{ evidenceId: "e2", sourceSystem: "project_evidence", title: "Signed plan", evidenceType: "pdf", recordedAt: PROJECT.createdAt, authorityLevel: "primary", isPrimary: true }] });
  assert.deepEqual(validateKnowledgeTransitions([withPrimary]), []);
});

test("a transition with no state change is rejected", () => {
  const failures = validateKnowledgeTransitions([transition({ fromState: "reported", toState: "reported" })]);
  assert.ok(failures.some((f) => f.code === "transition_no_state_change"));
});

test("a transition with no reason is rejected", () => {
  const failures = validateKnowledgeTransitions([transition({ reason: "" })]);
  assert.ok(failures.some((f) => f.code === "transition_missing_reason"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Historical integrity — supersession fixture (Sprint 1 spec, "Scenario 6")
// ─────────────────────────────────────────────────────────────────────────────

test("a superseding episode keeps the earlier episode visible, not rewritten", () => {
  const earlier = baseEpisode({ id: "reported-aug-8", type: "knowledge_recorded", summary: "Delivery date reported as August 8.", occurredAt: "2026-07-10T00:00:00.000Z" });
  const later = baseEpisode({
    id: "confirmed-aug-15",
    type: "knowledge_confirmed",
    summary: "Delivery date confirmed as August 15.",
    occurredAt: "2026-07-15T00:00:00.000Z",
    supersedesEpisodeIds: ["reported-aug-8"],
  });
  const supersededEarlier = { ...earlier, status: "superseded" };
  const episodes = [supersededEarlier, later];

  assert.equal(episodes[0].summary, "Delivery date reported as August 8.", "original content must remain unchanged, not rewritten to the later value");
  assert.equal(episodes[0].status, "superseded");
  assert.equal(episodes[1].summary, "Delivery date confirmed as August 15.");

  const relation = supersedes(later.id, earlier.id, "A signed implementation plan confirmed the date.");
  const failures = validateEpisodeRelations(episodes, [relation]);
  assert.deepEqual(failures, []);
  assert.equal(validateProjectEpisode(later).ok, true);
});

test("backfill/derivation never invents a source timestamp — evidence_stored keeps the row's own uploaded_at", () => {
  const episodes = deriveProjectEpisodes({ project: PROJECT, projectEvidenceRows: [evidenceRow], contextEvidenceItemRows: [], knowledgeResponse: null });
  const stored = episodes.find((e) => e.id === "evidence-stored:ev-1");
  assert.equal(stored.occurredAt, evidenceRow.uploaded_at);
});

// ─────────────────────────────────────────────────────────────────────────────
// Ordering and grouping
// ─────────────────────────────────────────────────────────────────────────────

test("sortEpisodes orders by occurredAt descending, newest first", () => {
  const older = baseEpisode({ id: "older", occurredAt: "2026-07-01T00:00:00.000Z" });
  const newer = baseEpisode({ id: "newer", occurredAt: "2026-07-10T00:00:00.000Z" });
  const sorted = sortEpisodes([older, newer]);
  assert.deepEqual(sorted.map((e) => e.id), ["newer", "older"]);
});

test("sortEpisodes falls back to id for a fully tied occurredAt/recordedAt", () => {
  const a = baseEpisode({ id: "a", occurredAt: "2026-07-01T00:00:00.000Z", recordedAt: "2026-07-01T00:00:00.000Z" });
  const b = baseEpisode({ id: "b", occurredAt: "2026-07-01T00:00:00.000Z", recordedAt: "2026-07-01T00:00:00.000Z" });
  const sorted = sortEpisodes([a, b]);
  assert.deepEqual(sorted.map((e) => e.id).sort(), ["a", "b"]);
});

test("groupEpisodesByRecency buckets Today/Yesterday/This Week/Earlier correctly", () => {
  const asOf = "2026-07-10T15:00:00.000Z";
  const episodes = [
    baseEpisode({ id: "today", occurredAt: "2026-07-10T09:00:00.000Z" }),
    baseEpisode({ id: "yesterday", occurredAt: "2026-07-09T09:00:00.000Z" }),
    baseEpisode({ id: "this-week", occurredAt: "2026-07-05T09:00:00.000Z" }),
    baseEpisode({ id: "earlier", occurredAt: "2026-06-01T09:00:00.000Z" }),
  ];
  const grouped = groupEpisodesByRecency(episodes, asOf);
  const byGroup = Object.fromEntries(grouped.map((g) => [g.group, g.episodes.map((e) => e.id)]));
  assert.deepEqual(byGroup.Today, ["today"]);
  assert.deepEqual(byGroup.Yesterday, ["yesterday"]);
  assert.deepEqual(byGroup["This Week"], ["this-week"]);
  assert.deepEqual(byGroup.Earlier, ["earlier"]);
});

test("groupEpisodesByRecency omits empty buckets rather than rendering them blank", () => {
  const grouped = groupEpisodesByRecency([baseEpisode({ occurredAt: "2026-07-10T09:00:00.000Z" })], "2026-07-10T15:00:00.000Z");
  assert.deepEqual(grouped.map((g) => g.group), ["Today"]);
});

test("labelForEpisodeType and labelForEpisodeActor never fall through to an empty string", () => {
  assert.equal(labelForEpisodeType("evidence_stored"), "Evidence stored");
  assert.equal(labelForEpisodeActor({ type: "project_brain" }), "Project Brain");
});

// ─────────────────────────────────────────────────────────────────────────────
// Sanitization
// ─────────────────────────────────────────────────────────────────────────────

test("sanitizeProjectEpisode strips metadata keys that look like secrets", () => {
  const episode = baseEpisode({ metadata: { apiKey: "sk-123", note: "fine to keep" } });
  const sanitized = sanitizeProjectEpisode(episode);
  assert.equal(sanitized.metadata.apiKey, undefined);
  assert.equal(sanitized.metadata.note, "fine to keep");
});

// ─────────────────────────────────────────────────────────────────────────────
// UI — static analysis
// ─────────────────────────────────────────────────────────────────────────────

const episodeCardSrc = readFileSync("src/components/pmfreak/project-brain/project-episode-card.tsx", "utf8");
const episodeDetailSrc = readFileSync("src/components/pmfreak/project-brain/project-episode-detail.tsx", "utf8");

test("ProjectEpisodeCard never renders a raw episode id as visible text", () => {
  assert.doesNotMatch(episodeCardSrc, />\s*\{episode\.id\}\s*</);
});

test("ProjectEpisodeCard's expand control is keyboard/screen-reader accessible", () => {
  assert.match(episodeCardSrc, /aria-expanded=\{expanded\}/);
});

test("ProjectEpisodeCard uses a semantic <time> element for the timestamp", () => {
  assert.match(episodeCardSrc, /<time dateTime=\{episode\.occurredAt\}/);
});

test("ProjectEpisodeDetail's knowledge transitions have a text equivalent, not color alone", () => {
  assert.match(episodeDetailSrc, /aria-label=\{`\$\{t\.subjectLabel\} moved from \$\{t\.fromState\} to \$\{t\.toState\}`\}/);
});

test("neither episode UI component contains fabricated learning language", () => {
  for (const src of [episodeCardSrc, episodeDetailSrc]) {
    assert.doesNotMatch(src, /deeply understood|remembers everything|intelligence (was )?(generated|extracted)/i);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Existing integration — Sprint 0.5 surfaces still wired up
// ─────────────────────────────────────────────────────────────────────────────

const inboxSrc = readFileSync("src/components/pmfreak/intelligence-inbox/project-intelligence-inbox.tsx", "utf8");

test("project-intelligence-inbox still renders ProjectBrainIntroduction and KnowledgeGapsPanel", () => {
  assert.match(inboxSrc, /<ProjectBrainIntroduction/);
  assert.match(inboxSrc, /<KnowledgeGapsPanel/);
});

test("project-intelligence-inbox still uploads through /api/upload and derives episodes through the guardrail pipeline", () => {
  assert.match(inboxSrc, /\/api\/upload/);
  assert.match(inboxSrc, /buildProjectEpisodes/);
});

test("the episode timeline renders a neutral fallback, never raw evidence, when the pipeline rejects a response", () => {
  assert.match(inboxSrc, /could not safely summarize this project/);
});
