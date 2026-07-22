// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Episodic Memory — Type Definitions
// Sprint 1: Episodic Memory
//
// A Project Episode is a recorded event in a project's operational history.
// This module defines the episode shape only — it reuses, never duplicates,
// Sprint 0's ProjectBrainStatement/ProjectBrainSourceReference/ProjectContextScope
// and Sprint 0.5's ProjectBrainKnowledgeGap. See derive-episodes.ts for how
// real project/evidence records become episodes, and
// docs/product/project-brain/01-episodic-memory.md for the relationship
// between episode type, epistemic type, confidence, and episode status —
// four distinct axes that are deliberately kept from overlapping.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectBrainSourceReference, ProjectBrainStatement, ProjectContextScope } from "../types";
import type { ProjectBrainKnowledgeGap } from "../types";

// ─── Episode type ───────────────────────────────────────────────────────────

// Sprint 1 only ever *generates* project_created, brain_activated,
// context_recorded, evidence_stored, evidence_processing_failed,
// knowledge_recorded, question_opened, and gap_identified (see
// derive-episodes.ts). The remaining types exist so the union is complete
// per the sprint's domain model and so guardrails/UI can handle them —
// generating them requires a real change-detection or user-correction
// mechanism that does not exist yet (see docs, "Deferred Capabilities").
export const PROJECT_EPISODE_TYPES = [
  "project_created",
  "brain_activated",
  "context_recorded",
  "evidence_received",
  "evidence_stored",
  "evidence_processing_failed",
  "knowledge_recorded",
  "knowledge_updated",
  "knowledge_confirmed",
  "knowledge_superseded",
  "knowledge_retracted",
  "question_opened",
  "question_resolved",
  "gap_identified",
  "gap_resolved",
  "status_changed",
] as const;

export type ProjectEpisodeType = (typeof PROJECT_EPISODE_TYPES)[number];

// ─── Actor ──────────────────────────────────────────────────────────────────

export type ProjectEpisodeActorType = "user" | "project_brain" | "system" | "external_source" | "unknown";

export type ProjectEpisodeActor = {
  type: ProjectEpisodeActorType;
  id?: string;
  displayName?: string;
  sourceSystem?: string;
};

// ─── Knowledge transitions ──────────────────────────────────────────────────
//
// A KnowledgeTransition is distinct from all three of: epistemic type (what
// kind of claim a statement is), confidence (how sure the Brain is), and
// episode status (recorded/superseded/retracted/invalid — whether *this
// episode* still stands). A transition instead describes a *subject*
// (e.g. "delivery date") moving between KnowledgeStates over time, and is
// the thing that would justify one episode's status becoming "superseded"
// by a later one. See docs §6 for the full mapping.

export const KNOWLEDGE_STATES = ["unknown", "reported", "assumed", "inferred", "confirmed", "superseded", "retracted"] as const;
export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number];

export type QualitativeConfidenceLevel = "high" | "medium" | "low" | "unknown";

export type KnowledgeTransition = {
  id: string;
  scope: ProjectContextScope;
  /** Stable key identifying what this transition is about, e.g. "delivery-date". */
  subjectKey: string;
  subjectLabel: string;
  fromState: KnowledgeState;
  toState: KnowledgeState;
  previousStatementId?: string;
  newStatementId?: string;
  reason: string;
  sourceReferences: ProjectBrainSourceReference[];
  confidenceBefore?: QualitativeConfidenceLevel;
  confidenceAfter?: QualitativeConfidenceLevel;
  occurredAt: string;
};

// ─── Episode relations ──────────────────────────────────────────────────────

export const EPISODE_RELATION_TYPES = ["related_to", "caused_by", "confirms", "supersedes", "retracts", "resolves", "derived_from"] as const;
export type EpisodeRelationType = (typeof EPISODE_RELATION_TYPES)[number];

export type ProjectEpisodeRelation = {
  fromEpisodeId: string;
  toEpisodeId: string;
  type: EpisodeRelationType;
  reason?: string;
};

// ─── Episode ────────────────────────────────────────────────────────────────

export const PROJECT_EPISODE_STATUSES = ["recorded", "superseded", "retracted", "invalid"] as const;
export type ProjectEpisodeStatus = (typeof PROJECT_EPISODE_STATUSES)[number];

export type ProjectEpisode = {
  id: string;
  scope: ProjectContextScope;
  type: ProjectEpisodeType;

  /** When the underlying event actually happened (e.g. a row's created_at) — never the moment this episode was derived. */
  occurredAt: string;
  /** When this episode was recorded into memory. Equal to occurredAt for every Sprint 1 episode: all are derived virtually from immutable source records at read time, not ingested through a separate recording step (Option B — see docs §9). */
  recordedAt: string;

  title: string;
  summary: string;

  actor: ProjectEpisodeActor;

  sourceReferences: ProjectBrainSourceReference[];
  statements: ProjectBrainStatement[];
  knowledgeTransitions: KnowledgeTransition[];
  openQuestions: ProjectBrainKnowledgeGap[];

  relatedEpisodeIds: string[];
  supersedesEpisodeIds?: string[];
  confirmsEpisodeIds?: string[];

  status: ProjectEpisodeStatus;

  constitutionVersion: string;

  metadata?: Record<string, unknown>;
};
