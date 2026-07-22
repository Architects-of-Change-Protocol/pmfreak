// Project Brain Sprint 0 — behavioral contract tests for the constitution,
// epistemic types, provenance adapters, and fabrication guardrails.
//
// Two flavors, matching repo convention: dynamic tests that actually execute
// the guardrail/adapter/language functions against constructed statements,
// and a static-analysis pass over the UI card to confirm the mandatory
// disclosure order is present in source.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EPISTEMIC_TYPES,
} from "../src/lib/project-brain/types.ts";
import {
  PROJECT_BRAIN_CONSTITUTION,
  PROJECT_BRAIN_CONSTITUTION_VERSION,
  EPISTEMIC_TYPE_DEFINITIONS,
  NON_NEGOTIABLE_PRINCIPLES,
  NEVER_FABRICATE,
} from "../src/lib/project-brain/constitution.ts";
import {
  sourceReferenceFromEvidenceItem,
  sourceReferenceFromProjectEvidence,
} from "../src/lib/project-brain/source-reference.ts";
import { validateStatement, validateResponse } from "../src/lib/project-brain/guardrails.ts";
import { formatConfidenceCaption, labelForEpistemicType } from "../src/lib/project-brain/language.ts";

const SCOPE = { workspaceId: "ws-1", projectId: "proj-1" };
const OTHER_SCOPE = { workspaceId: "ws-2", projectId: "proj-2" };

function baseStatement(overrides = {}) {
  return {
    id: "stmt-1",
    scope: SCOPE,
    epistemicType: "FACT",
    text: "The contract was signed on July 10.",
    confidence: { kind: "qualitative", level: "high" },
    sources: [],
    generatedAt: "2026-07-10T00:00:00.000Z",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    ...overrides,
  };
}

function primarySource(overrides = {}) {
  return {
    evidenceId: "ev-1",
    sourceSystem: "project_evidence",
    title: "Signed Contract.pdf",
    evidenceType: "pdf",
    recordedAt: "2026-07-10T00:00:00.000Z",
    authorityLevel: "primary",
    isPrimary: true,
    workspaceId: SCOPE.workspaceId,
    projectId: SCOPE.projectId,
    ...overrides,
  };
}

function secondarySource(overrides = {}) {
  return primarySource({
    evidenceId: "ev-2",
    authorityLevel: "secondary",
    isPrimary: false,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Constitution content
// ─────────────────────────────────────────────────────────────────────────────

test("constitution declares exactly the eight required epistemic types", () => {
  assert.deepEqual(
    [...EPISTEMIC_TYPES].sort(),
    ["ASSUMPTION", "CONTRADICTION", "FACT", "INFERENCE", "OPEN_QUESTION", "RECOMMENDATION", "REPORTED", "UNKNOWN"].sort(),
  );
  assert.equal(EPISTEMIC_TYPE_DEFINITIONS.length, EPISTEMIC_TYPES.length);
  for (const type of EPISTEMIC_TYPES) {
    const def = EPISTEMIC_TYPE_DEFINITIONS.find((d) => d.type === type);
    assert.ok(def, `missing epistemic type definition for ${type}`);
    assert.ok(def.description.trim().length > 0);
    assert.ok(def.example.trim().length > 0);
  }
});

test("constitution carries a version and every statement factory references it", () => {
  assert.equal(PROJECT_BRAIN_CONSTITUTION.version, PROJECT_BRAIN_CONSTITUTION_VERSION);
  assert.match(PROJECT_BRAIN_CONSTITUTION_VERSION, /^\d+\.\d+\.\d+$/);
});

test("constitution declares the five non-negotiable principles from the sprint spec", () => {
  const ids = NON_NEGOTIABLE_PRINCIPLES.map((p) => p.id);
  assert.deepEqual(ids, [
    "evidence_before_assertion",
    "never_fabricate",
    "express_uncertainty",
    "separate_knowledge_types",
    "preserve_provenance",
  ]);
});

test("constitution's never-fabricate list covers the categories the spec enumerates", () => {
  for (const category of ["stakeholders", "dates", "decisions", "risks", "owners", "approvals", "confidence values", "evidence references"]) {
    assert.ok(NEVER_FABRICATE.includes(category), `missing "${category}" from NEVER_FABRICATE`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails — evidence before assertion / never fabricate
// ─────────────────────────────────────────────────────────────────────────────

test("FACT without any source is rejected", () => {
  const result = validateStatement(baseStatement({ sources: [] }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "insufficient_sources"));
});

test("FACT backed only by a secondary source is rejected", () => {
  const result = validateStatement(baseStatement({ sources: [secondarySource()] }));
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "fact_without_primary_source"));
});

test("FACT backed by a primary source passes", () => {
  const result = validateStatement(baseStatement({ sources: [primarySource()] }));
  assert.equal(result.ok, true);
});

test("REPORTED requires naming who reported it", () => {
  const withoutReporter = validateStatement(
    baseStatement({ epistemicType: "REPORTED", sources: [secondarySource()], confidence: { kind: "qualitative", level: "medium" } }),
  );
  assert.equal(withoutReporter.ok, false);
  assert.ok(withoutReporter.failures.some((f) => f.code === "reported_without_reporter"));

  const withReporter = validateStatement(
    baseStatement({
      epistemicType: "REPORTED",
      sources: [secondarySource()],
      confidence: { kind: "qualitative", level: "medium" },
      reportedBy: "Technical Lead",
    }),
  );
  assert.equal(withReporter.ok, true);
});

test("INFERENCE requires an explicit reasoning basis", () => {
  const result = validateStatement(
    baseStatement({ epistemicType: "INFERENCE", sources: [primarySource()], confidence: { kind: "qualitative", level: "low" } }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "inference_without_basis"));
});

test("CONTRADICTION requires two claims traceable to sources", () => {
  const tooFew = validateStatement(
    baseStatement({
      epistemicType: "CONTRADICTION",
      sources: [primarySource(), secondarySource()],
      confidence: { kind: "qualitative", level: "medium" },
      contradictingClaims: [{ sourceEvidenceId: "ev-1", claim: "August 1" }],
    }),
  );
  assert.equal(tooFew.ok, false);
  assert.ok(tooFew.failures.some((f) => f.code === "contradiction_needs_two_claims"));

  const valid = validateStatement(
    baseStatement({
      epistemicType: "CONTRADICTION",
      sources: [primarySource(), secondarySource()],
      confidence: { kind: "qualitative", level: "medium" },
      contradictingClaims: [
        { sourceEvidenceId: "ev-1", claim: "The contract states August 1." },
        { sourceEvidenceId: "ev-2", claim: "The meeting notes state August 8." },
      ],
    }),
  );
  assert.equal(valid.ok, true);
});

test("RECOMMENDATION must always require human approval", () => {
  const withoutGate = validateStatement(
    baseStatement({
      epistemicType: "RECOMMENDATION",
      sources: [],
      confidence: { kind: "qualitative", level: "low" },
      text: "Consider confirming the deployment owner before scheduling go-live.",
    }),
  );
  assert.equal(withoutGate.ok, false);
  assert.ok(withoutGate.failures.some((f) => f.code === "recommendation_without_approval_gate"));

  const withGate = validateStatement(
    baseStatement({
      epistemicType: "RECOMMENDATION",
      sources: [],
      confidence: { kind: "qualitative", level: "low" },
      text: "Consider confirming the deployment owner before scheduling go-live.",
      requiresHumanApproval: true,
    }),
  );
  assert.equal(withGate.ok, true);
});

test("UNKNOWN cannot carry sources or non-unknown confidence", () => {
  const result = validateStatement(
    baseStatement({
      epistemicType: "UNKNOWN",
      sources: [primarySource()],
      confidence: { kind: "qualitative", level: "low" },
      text: "No approved budget has been identified.",
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "unknown_with_sources"));
  assert.ok(result.failures.some((f) => f.code === "unknown_with_non_unknown_confidence"));

  const honest = validateStatement(
    baseStatement({
      epistemicType: "UNKNOWN",
      sources: [],
      confidence: { kind: "qualitative", level: "unknown" },
      text: "No approved budget has been identified.",
    }),
  );
  assert.equal(honest.ok, true);
});

test("OPEN_QUESTION cannot claim high confidence", () => {
  const result = validateStatement(
    baseStatement({
      epistemicType: "OPEN_QUESTION",
      sources: [],
      confidence: { kind: "qualitative", level: "high" },
      text: "Who approves the production deployment?",
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "open_question_with_high_confidence"));
});

test("ASSUMPTION needs no sources or reporter — only text and valid confidence", () => {
  const result = validateStatement(
    baseStatement({
      epistemicType: "ASSUMPTION",
      sources: [],
      confidence: { kind: "qualitative", level: "medium" },
      text: "The project currently assumes that the existing authentication service can be reused.",
    }),
  );
  assert.equal(result.ok, true);
});

test("scored confidence without a documented method/actor is rejected — no fabricated precision", () => {
  const result = validateStatement(
    baseStatement({
      sources: [primarySource()],
      confidence: { kind: "scored", level: "high", score: 73, method: "", scoredBy: "" },
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "scored_confidence_missing_method"));
});

test("scored confidence with a documented method passes", () => {
  const result = validateStatement(
    baseStatement({
      sources: [primarySource()],
      confidence: { kind: "scored", level: "high", score: 92, method: "governance_signal_detector_v1", scoredBy: "system" },
    }),
  );
  assert.equal(result.ok, true);
});

test("a source from a different project is rejected — project-context boundary", () => {
  const result = validateStatement(
    baseStatement({ sources: [primarySource({ workspaceId: OTHER_SCOPE.workspaceId, projectId: OTHER_SCOPE.projectId })] }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "source_crosses_project_boundary"));
});

test("high confidence without a primary source is rejected even for INFERENCE", () => {
  const result = validateStatement(
    baseStatement({
      epistemicType: "INFERENCE",
      sources: [secondarySource()],
      confidence: { kind: "qualitative", level: "high" },
      inferenceBasis: "Two prerequisite approvals remain open.",
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "high_confidence_without_primary_source"));
});

test("validateResponse rejects a statement scoped outside the response's project", () => {
  const response = {
    scope: SCOPE,
    generatedAt: "2026-07-10T00:00:00.000Z",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    statements: [baseStatement({ scope: OTHER_SCOPE, sources: [primarySource({ workspaceId: OTHER_SCOPE.workspaceId, projectId: OTHER_SCOPE.projectId })] })],
    knowledgeGaps: [],
  };
  const result = validateResponse(response);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "statement_crosses_response_boundary"));
});

test("validateResponse rejects duplicate statement ids", () => {
  const response = {
    scope: SCOPE,
    generatedAt: "2026-07-10T00:00:00.000Z",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    statements: [baseStatement({ sources: [primarySource()] }), baseStatement({ sources: [primarySource()] })],
    knowledgeGaps: [],
  };
  const result = validateResponse(response);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "duplicate_statement_id"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Source reference adapters — reuse existing evidence rows, no new storage
// ─────────────────────────────────────────────────────────────────────────────

test("evidence_items adapter marks direct records (document_reference/email/meeting_minutes) as primary", () => {
  for (const sourceType of ["document_reference", "email", "meeting_minutes"]) {
    const ref = sourceReferenceFromEvidenceItem({
      id: "ev-1",
      workspace_id: SCOPE.workspaceId,
      project_id: SCOPE.projectId,
      source_type: sourceType,
      title: "Some evidence",
      content: "content",
      created_at: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(ref.isPrimary, true, `${sourceType} should be primary`);
    assert.equal(ref.authorityLevel, "primary");
    assert.equal(ref.sourceSystem, "evidence_items");
  }
});

test("evidence_items adapter marks paraphrased human accounts (manual_note/conversation/ticket) as secondary", () => {
  for (const sourceType of ["manual_note", "conversation", "ticket"]) {
    const ref = sourceReferenceFromEvidenceItem({
      id: "ev-2",
      workspace_id: SCOPE.workspaceId,
      project_id: SCOPE.projectId,
      source_type: sourceType,
      title: "Some note",
      content: "content",
      created_at: "2026-07-10T00:00:00.000Z",
    });
    assert.equal(ref.isPrimary, false, `${sourceType} should be secondary`);
    assert.equal(ref.authorityLevel, "secondary");
  }
});

test("project_evidence adapter treats uploaded originals as primary source of record", () => {
  const ref = sourceReferenceFromProjectEvidence({
    id: "pe-1",
    workspace_id: SCOPE.workspaceId,
    project_id: SCOPE.projectId,
    file_name: "MSA.pdf",
    file_type: "pdf",
    uploaded_at: "2026-07-10T00:00:00.000Z",
    status: "processed",
  });
  assert.equal(ref.isPrimary, true);
  assert.equal(ref.sourceSystem, "project_evidence");
  assert.equal(ref.title, "MSA.pdf");
});

// ─────────────────────────────────────────────────────────────────────────────
// Language — confidence is never a bare number
// ─────────────────────────────────────────────────────────────────────────────

test("qualitative confidence renders as plain language, no number", () => {
  const caption = formatConfidenceCaption({ kind: "qualitative", level: "medium" });
  assert.equal(caption, "Medium confidence");
  assert.ok(!/\d/.test(caption));
});

test("scored confidence always shows the method/actor alongside the number", () => {
  const caption = formatConfidenceCaption({ kind: "scored", level: "high", score: 92, method: "governance_signal_detector_v1", scoredBy: "system" });
  assert.match(caption, /92\/100/);
  assert.match(caption, /governance_signal_detector_v1/);
});

test("labelForEpistemicType renders human-readable labels for all eight types", () => {
  assert.equal(labelForEpistemicType("OPEN_QUESTION"), "Open Question");
  assert.equal(labelForEpistemicType("FACT"), "Fact");
});

// ─────────────────────────────────────────────────────────────────────────────
// UI card — mandatory disclosure order (constitution voice + provenance)
// ─────────────────────────────────────────────────────────────────────────────

test("ProjectBrainStatementCard shows the epistemic badge before the statement text", () => {
  const src = readFileSync("src/components/pmfreak/project-brain/project-brain-statement-card.tsx", "utf8");
  const badgeIdx = src.indexOf("labelForEpistemicType(statement.epistemicType)");
  const textIdx = src.indexOf("{statement.text}");
  assert.ok(badgeIdx > 0 && textIdx > 0);
  assert.ok(badgeIdx < textIdx, "epistemic type badge must render before the statement text");
});

test("ProjectBrainStatementCard never renders a fabricated placeholder for missing sources", () => {
  const src = readFileSync("src/components/pmfreak/project-brain/project-brain-statement-card.tsx", "utf8");
  assert.match(src, /No sources yet\./);
});

test("ProjectBrainStatementCard always shows an approval gate for RECOMMENDATION", () => {
  const src = readFileSync("src/components/pmfreak/project-brain/project-brain-statement-card.tsx", "utf8");
  assert.match(src, /Human approval required/);
});
