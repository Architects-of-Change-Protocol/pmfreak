// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Episodic Memory — Deterministic Derivation
// Sprint 1: Episodic Memory
//
// Pure, deterministic, no LLM call — the same "Option B: deterministic
// virtual episodes" strategy Sprint 0.5 used for the initial brief. Episodes
// are derived at read time from real, already-persisted, immutable records
// (the `projects` row, `project_evidence` rows, `evidence_items` manual-note
// rows) plus the already-validated ProjectBrainResponse from Sprint 0.5's
// derive-initial-response.ts. Nothing is persisted by this module — see
// docs/product/project-brain/01-episodic-memory.md §9 for why, and for the
// backfill implications (there is nothing to backfill: every existing
// project's history is recovered by simply calling this function).
//
// Every episode id is content-addressed from the real record it came from
// (see docs §10, Idempotency) — calling this twice with the same input
// always returns the same episodes, so there is nothing to deduplicate.
// ─────────────────────────────────────────────────────────────────────────────

import { PROJECT_BRAIN_CONSTITUTION_VERSION } from "../constitution";
import { sourceReferenceFromEvidenceItem, sourceReferenceFromProjectConfiguration, sourceReferenceFromProjectEvidence } from "../source-reference";
import type { EvidenceItemSourceType } from "../source-reference";
import type { ProjectSetupSnapshot } from "../derive-initial-response";
import type { ProjectBrainResponse } from "../types";
import { validateProjectEpisodes, type GuardrailFailure } from "./episode-guards";
import type { ProjectEpisode, ProjectEpisodeActor } from "./types";

export type ProjectEvidenceEpisodeRow = {
  id: string;
  file_name: string;
  file_type: string;
  uploaded_by?: string | null;
  uploaded_at: string;
  status: "uploaded" | "processing" | "processed" | "failed";
};

export type ContextEvidenceItemRow = {
  id: string;
  source_type: EvidenceItemSourceType;
  title: string;
  content?: string | null;
  created_by?: string | null;
  created_at: string;
};

const SYSTEM_ACTOR: ProjectEpisodeActor = { type: "system", sourceSystem: "projects" };
const BRAIN_ACTOR: ProjectEpisodeActor = { type: "project_brain", sourceSystem: "project-brain/derive-initial-response" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// A fixed, locale-independent formatter — this text is embedded directly in
// episode summaries (see the sprint's own "Project created" example), and
// must be identical across environments/timezone settings for deterministic
// tests, not dependent on the runtime's Intl locale data.
function formatEpisodeDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function userActor(userId?: string | null): ProjectEpisodeActor {
  return { type: "user", id: userId ?? undefined };
}

export function deriveProjectEpisodes(input: {
  project: ProjectSetupSnapshot;
  projectEvidenceRows: ProjectEvidenceEpisodeRow[];
  contextEvidenceItemRows: ContextEvidenceItemRow[];
  /** The already-validated Sprint 0.5 response, or null if that pipeline rejected it — in which case no knowledge/question/gap episodes are produced, matching the same fail-safe the brief itself uses. */
  knowledgeResponse: ProjectBrainResponse | null;
}): ProjectEpisode[] {
  const { project, projectEvidenceRows, contextEvidenceItemRows, knowledgeResponse } = input;
  const scope = { workspaceId: project.workspaceId, projectId: project.projectId };
  const episodes: ProjectEpisode[] = [];

  const configSource = (fieldKey: string, fieldLabel: string) =>
    sourceReferenceFromProjectConfiguration(
      { projectId: project.projectId, workspaceId: project.workspaceId, fieldKey, fieldLabel, recordedAt: project.createdAt },
      { authorityLevel: "primary" },
    );

  // 1. project_created — always, the moment the project row exists.
  episodes.push({
    id: `project-created:${project.projectId}`,
    scope,
    type: "project_created",
    occurredAt: project.createdAt,
    recordedAt: project.createdAt,
    title: "Project created",
    summary: `This project was created on ${formatEpisodeDate(project.createdAt)}.`,
    actor: SYSTEM_ACTOR,
    sourceReferences: [configSource("project.created_at", "Project configuration")],
    statements: [],
    knowledgeTransitions: [],
    openQuestions: [],
    relatedEpisodeIds: [],
    status: "recorded",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  });

  // 2. brain_activated — this architecture has no separate persisted
  // activation gate; the Brain is available the moment the project exists,
  // so that is the only honest, deterministic timestamp available for it.
  // See docs §3 for why this is a documented architectural fact, not a
  // fabricated one.
  episodes.push({
    id: `brain-activated:${project.projectId}`,
    scope,
    type: "brain_activated",
    occurredAt: project.createdAt,
    recordedAt: project.createdAt,
    title: "Project Brain activated",
    summary: "The Project Brain became available for this project. No operational analysis was performed at activation.",
    actor: SYSTEM_ACTOR,
    sourceReferences: [configSource("project.created_at", "Project configuration")],
    statements: [],
    knowledgeTransitions: [],
    openQuestions: [],
    relatedEpisodeIds: [],
    status: "recorded",
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  });

  // 3. context_recorded — one per manual-note evidence_items row (Capture
  // Context / Take a Note). Onboarding fields themselves are covered by
  // knowledge_recorded/gap_identified below, sourced from the same setup
  // data project_created already cites.
  for (const row of contextEvidenceItemRows) {
    const source = sourceReferenceFromEvidenceItem({ ...row, workspace_id: project.workspaceId, project_id: project.projectId });
    episodes.push({
      id: `context-recorded:${row.id}`,
      scope,
      type: "context_recorded",
      occurredAt: row.created_at,
      recordedAt: row.created_at,
      title: "Project context recorded",
      summary: row.title.trim() ? `"${row.title.trim()}" was added to Project Memory.` : "Context was added to Project Memory.",
      actor: userActor(row.created_by),
      sourceReferences: [source],
      statements: [],
      knowledgeTransitions: [],
      openQuestions: [],
      relatedEpisodeIds: [],
      status: "recorded",
      constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    });
  }

  // 4/5. evidence_stored (+ evidence_processing_failed) — one per
  // project_evidence row, regardless of processing status: storage
  // succeeding is the real, complete event. A separate failure episode is
  // added only when the row's status actually reached "failed".
  for (const row of projectEvidenceRows) {
    const source = sourceReferenceFromProjectEvidence({
      id: row.id,
      workspace_id: project.workspaceId,
      project_id: project.projectId,
      file_name: row.file_name,
      file_type: row.file_type,
      uploaded_by: row.uploaded_by,
      uploaded_at: row.uploaded_at,
      status: row.status,
    });
    episodes.push({
      id: `evidence-stored:${row.id}`,
      scope,
      type: "evidence_stored",
      occurredAt: row.uploaded_at,
      recordedAt: row.uploaded_at,
      title: "Evidence stored",
      summary: `${row.file_name} was added to Project Memory. Operational analysis is not yet available.`,
      actor: userActor(row.uploaded_by),
      sourceReferences: [source],
      statements: [],
      knowledgeTransitions: [],
      openQuestions: [],
      relatedEpisodeIds: [],
      status: "recorded",
      constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    });

    if (row.status === "failed") {
      episodes.push({
        id: `evidence-processing-failed:${row.id}`,
        scope,
        type: "evidence_processing_failed",
        occurredAt: row.uploaded_at,
        recordedAt: row.uploaded_at,
        title: "Evidence processing failed",
        summary: `${row.file_name} was stored, but its contents could not be read.`,
        actor: SYSTEM_ACTOR,
        sourceReferences: [source],
        statements: [],
        knowledgeTransitions: [],
        openQuestions: [],
        relatedEpisodeIds: [`evidence-stored:${row.id}`],
        status: "recorded",
        constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
      });
    }
  }

  // 6/7/8. knowledge_recorded / question_opened / gap_identified — reuse
  // Sprint 0.5's already-guardrail-validated response verbatim; this module
  // never re-derives or reclassifies a statement.
  if (knowledgeResponse) {
    for (const statement of knowledgeResponse.statements) {
      if (statement.epistemicType === "FACT" || statement.epistemicType === "REPORTED") {
        episodes.push({
          id: `knowledge-recorded:${statement.id}`,
          scope,
          type: "knowledge_recorded",
          occurredAt: statement.generatedAt,
          recordedAt: statement.generatedAt,
          title: "Knowledge recorded",
          summary: statement.text,
          actor: BRAIN_ACTOR,
          sourceReferences: statement.sources,
          statements: [statement],
          knowledgeTransitions: [],
          openQuestions: [],
          relatedEpisodeIds: [],
          status: "recorded",
          constitutionVersion: statement.constitutionVersion,
        });
      } else if (statement.epistemicType === "OPEN_QUESTION") {
        episodes.push({
          id: `question-opened:${statement.id}`,
          scope,
          type: "question_opened",
          occurredAt: statement.generatedAt,
          recordedAt: statement.generatedAt,
          title: "Open question recorded",
          summary: statement.text,
          actor: BRAIN_ACTOR,
          sourceReferences: statement.sources,
          statements: [statement],
          knowledgeTransitions: [],
          openQuestions: [],
          relatedEpisodeIds: [],
          status: "recorded",
          constitutionVersion: statement.constitutionVersion,
        });
      }
    }

    for (const gap of knowledgeResponse.knowledgeGaps) {
      if (gap.epistemicStatus !== "UNKNOWN") continue;
      episodes.push({
        id: `gap-identified:${gap.id}`,
        scope,
        type: "gap_identified",
        occurredAt: gap.identifiedAt,
        recordedAt: gap.identifiedAt,
        title: "Knowledge gap identified",
        summary: gap.question,
        actor: BRAIN_ACTOR,
        sourceReferences: [],
        statements: [],
        knowledgeTransitions: [],
        openQuestions: [gap],
        relatedEpisodeIds: [],
        status: "recorded",
        constitutionVersion: knowledgeResponse.constitutionVersion,
      });
    }
  }

  return episodes;
}

export type ProjectEpisodesPipelineResult =
  | { ok: true; episodes: ProjectEpisode[] }
  | { ok: false; failures: GuardrailFailure[] };

/** Derives, then validates before ever handing episodes to a renderer — the same shape as validate-response-pipeline.ts's buildInitialProjectBrainResponse. */
export function buildProjectEpisodes(input: Parameters<typeof deriveProjectEpisodes>[0]): ProjectEpisodesPipelineResult {
  const episodes = deriveProjectEpisodes(input);
  const validation = validateProjectEpisodes(episodes);
  if (!validation.ok) {
    console.error(
      JSON.stringify({
        event: "project_brain.episodes_validation_failed",
        projectId: input.project.projectId,
        failureCodes: validation.failures.map((f) => f.code),
      }),
    );
    return { ok: false, failures: validation.failures };
  }
  return { ok: true, episodes };
}
