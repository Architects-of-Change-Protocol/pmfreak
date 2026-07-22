// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Episodic Memory — Guardrails
// Sprint 1: Episodic Memory
//
// Runtime enforcement, mirroring guardrails.ts from Sprint 0 but for the
// episode shape: nothing here trusts a caller to have built an episode
// correctly, because a future capability (or a bug) could hand this code an
// episode with a made-up project boundary, a fabricated "learned" summary,
// or a supersession relation pointing at nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { validateStatement } from "../guardrails";
import { PROJECT_EPISODE_STATUSES, PROJECT_EPISODE_TYPES, KNOWLEDGE_STATES } from "./types";
import type { KnowledgeTransition, ProjectEpisode, ProjectEpisodeRelation } from "./types";

export type GuardrailFailure = { code: string; message: string };
export type GuardrailResult = { ok: true } | { ok: false; failures: GuardrailFailure[] };

function fail(failures: GuardrailFailure[]): GuardrailResult {
  return { ok: false, failures };
}

// Language the constitution's "no fake learning events" rule specifically
// forbids (Sprint 1 spec, "Language Policy") — checked against title +
// summary. Structural checks above this list are what actually keep
// episodes honest; this catches the specific fabricated phrasing the sprint
// calls out by name.
const FORBIDDEN_EPISODE_PHRASES = [
  /the (brain|project brain) (deeply )?(understood|remembers everything|learned)/i,
  /intelligence (was )?(generated|extracted)/i,
  /the system discovered/i,
  /fully understood/i,
];

export function validateEpisodeSourceReferences(episode: ProjectEpisode): GuardrailFailure[] {
  const failures: GuardrailFailure[] = [];
  for (const source of episode.sourceReferences) {
    if (
      (source.workspaceId && source.workspaceId !== episode.scope.workspaceId) ||
      (source.projectId && source.projectId !== episode.scope.projectId)
    ) {
      failures.push({
        code: "episode_source_crosses_project_boundary",
        message: `Episode "${episode.id}" cites a source scoped to a different project.`,
      });
    }
  }
  return failures;
}

export function validateEpisodeProjectBoundary(episode: ProjectEpisode): GuardrailFailure[] {
  const failures: GuardrailFailure[] = [...validateEpisodeSourceReferences(episode)];

  for (const statement of episode.statements) {
    if (statement.scope.workspaceId !== episode.scope.workspaceId || statement.scope.projectId !== episode.scope.projectId) {
      failures.push({
        code: "episode_statement_crosses_project_boundary",
        message: `Episode "${episode.id}" contains a statement scoped to a different project.`,
      });
    }
  }
  for (const gap of episode.openQuestions) {
    if (gap.scope.workspaceId !== episode.scope.workspaceId || gap.scope.projectId !== episode.scope.projectId) {
      failures.push({
        code: "episode_gap_crosses_project_boundary",
        message: `Episode "${episode.id}" contains an open question scoped to a different project.`,
      });
    }
  }
  for (const transition of episode.knowledgeTransitions) {
    if (transition.scope.workspaceId !== episode.scope.workspaceId || transition.scope.projectId !== episode.scope.projectId) {
      failures.push({
        code: "episode_transition_crosses_project_boundary",
        message: `Episode "${episode.id}" contains a knowledge transition scoped to a different project.`,
      });
    }
  }
  return failures;
}

export function validateKnowledgeTransitions(transitions: KnowledgeTransition[]): GuardrailFailure[] {
  const failures: GuardrailFailure[] = [];
  for (const transition of transitions) {
    if (!transition.subjectKey.trim() || !transition.subjectLabel.trim()) {
      failures.push({ code: "transition_missing_subject", message: `Transition "${transition.id}" must name what it is about.` });
    }
    if (!KNOWLEDGE_STATES.includes(transition.fromState) || !KNOWLEDGE_STATES.includes(transition.toState)) {
      failures.push({ code: "transition_invalid_state", message: `Transition "${transition.id}" has an unrecognized from/to state.` });
    }
    if (transition.fromState === transition.toState) {
      failures.push({ code: "transition_no_state_change", message: `Transition "${transition.id}" must move between two different states.` });
    }
    if (!transition.reason.trim()) {
      failures.push({ code: "transition_missing_reason", message: `Transition "${transition.id}" must explain why the state changed.` });
    }
    if (transition.toState === "confirmed" && !transition.sourceReferences.some((s) => s.isPrimary)) {
      failures.push({
        code: "confirmation_without_authoritative_evidence",
        message: `Transition "${transition.id}" claims confirmation but has no primary source.`,
      });
    }
  }
  return failures;
}

/** Requires the full episode set so a relation's endpoints can be resolved and boundary-checked. */
export function validateEpisodeRelations(episodes: ProjectEpisode[], relations: ProjectEpisodeRelation[]): GuardrailFailure[] {
  const byId = new Map(episodes.map((e) => [e.id, e]));
  const failures: GuardrailFailure[] = [];
  for (const relation of relations) {
    const from = byId.get(relation.fromEpisodeId);
    const to = byId.get(relation.toEpisodeId);
    if (!from) failures.push({ code: "relation_missing_from_episode", message: `Relation references unknown episode "${relation.fromEpisodeId}".` });
    if (!to) failures.push({ code: "relation_missing_to_episode", message: `Relation references unknown episode "${relation.toEpisodeId}".` });
    if (from && to && (from.scope.workspaceId !== to.scope.workspaceId || from.scope.projectId !== to.scope.projectId)) {
      failures.push({
        code: "relation_crosses_project_boundary",
        message: `Relation "${relation.type}" connects episodes from different projects — episode relations are never cross-project.`,
      });
    }
    if (from && relation.fromEpisodeId === relation.toEpisodeId) {
      failures.push({ code: "relation_self_reference", message: `Episode "${relation.fromEpisodeId}" cannot relate to itself.` });
    }
  }
  return failures;
}

export function validateProjectEpisode(episode: ProjectEpisode): GuardrailResult {
  const failures: GuardrailFailure[] = [];

  if (!episode.scope.projectId || !episode.scope.workspaceId) {
    failures.push({ code: "episode_missing_project_id", message: "Every episode must carry a workspace and project id." });
  }
  if (!PROJECT_EPISODE_TYPES.includes(episode.type)) {
    failures.push({ code: "unsupported_episode_type", message: `"${episode.type}" is not a recognized episode type.` });
  }
  if (!PROJECT_EPISODE_STATUSES.includes(episode.status)) {
    failures.push({ code: "invalid_episode_status", message: `"${episode.status}" is not a recognized episode status.` });
  }
  if (Number.isNaN(Date.parse(episode.occurredAt))) {
    failures.push({ code: "invalid_occurred_at", message: `Episode "${episode.id}" has an invalid occurredAt timestamp.` });
  }
  if (Number.isNaN(Date.parse(episode.recordedAt))) {
    failures.push({ code: "invalid_recorded_at", message: `Episode "${episode.id}" has an invalid recordedAt timestamp.` });
  }
  if (!episode.title.trim() || !episode.summary.trim()) {
    failures.push({ code: "episode_missing_title_or_summary", message: `Episode "${episode.id}" must have both a title and a summary.` });
  }
  if (!episode.constitutionVersion.trim()) {
    failures.push({ code: "episode_missing_constitution_version", message: `Episode "${episode.id}" must record which constitution version governed it.` });
  }
  if ((episode.type === "knowledge_superseded" || episode.type === "knowledge_confirmed") && !(episode.supersedesEpisodeIds?.length || episode.confirmsEpisodeIds?.length)) {
    failures.push({
      code: "supersession_without_target",
      message: `Episode "${episode.id}" is typed "${episode.type}" but names no prior episode it supersedes/confirms.`,
    });
  }

  const haystack = `${episode.title} ${episode.summary}`;
  for (const pattern of FORBIDDEN_EPISODE_PHRASES) {
    if (pattern.test(haystack)) {
      failures.push({ code: "fabricated_learning_language", message: `Episode "${episode.id}" uses language the constitution forbids: matched ${pattern}.` });
    }
  }

  failures.push(...validateEpisodeProjectBoundary(episode));
  failures.push(...validateKnowledgeTransitions(episode.knowledgeTransitions));

  for (const statement of episode.statements) {
    const result = validateStatement(statement);
    if (!result.ok) {
      for (const f of result.failures) failures.push({ ...f, message: `[episode ${episode.id}, statement ${statement.id}] ${f.message}` });
    }
  }

  return failures.length === 0 ? { ok: true } : fail(failures);
}

export function validateProjectEpisodes(episodes: ProjectEpisode[], relations: ProjectEpisodeRelation[] = []): GuardrailResult {
  const failures: GuardrailFailure[] = [];
  const seenIds = new Set<string>();
  for (const episode of episodes) {
    if (seenIds.has(episode.id)) {
      failures.push({ code: "duplicate_episode_id", message: `Episode id "${episode.id}" appears more than once — episode derivation must be idempotent.` });
    }
    seenIds.add(episode.id);
    const result = validateProjectEpisode(episode);
    if (!result.ok) failures.push(...result.failures);
  }
  failures.push(...validateEpisodeRelations(episodes, relations));
  return failures.length === 0 ? { ok: true } : fail(failures);
}

const SENSITIVE_METADATA_KEY_PATTERN = /token|secret|password|credential|api[_-]?key/i;

/** Strips any metadata key that looks like a secret/credential — episodes must only ever hold user-visible structured memory. */
export function sanitizeProjectEpisode(episode: ProjectEpisode): ProjectEpisode {
  if (!episode.metadata) return episode;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(episode.metadata)) {
    if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) continue;
    sanitized[key] = value;
  }
  return { ...episode, metadata: sanitized };
}
