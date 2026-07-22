// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Episodic Memory — Relations
// Sprint 1: Episodic Memory
//
// Small pure builders for ProjectEpisodeRelation. Sprint 1's derivation
// (derive-episodes.ts) does not call these — there is no real
// change-detection mechanism yet that would produce a genuine "supersedes"
// or "confirms" relation (see docs, "Deferred Capabilities"). They exist so
// the relation model is exercised by tests now (Sprint 1 spec's "Scenario 6
// — Supersession fixture" is explicitly deterministic test data, not a
// live-derived case) and so a future sprint has a ready-made, guardrail-
// compatible way to record one once real corrections/confirmations exist.
// ─────────────────────────────────────────────────────────────────────────────

import type { EpisodeRelationType, ProjectEpisodeRelation } from "./types";

export function buildEpisodeRelation(
  fromEpisodeId: string,
  toEpisodeId: string,
  type: EpisodeRelationType,
  reason?: string,
): ProjectEpisodeRelation {
  return { fromEpisodeId, toEpisodeId, type, reason };
}

export const supersedes = (newEpisodeId: string, priorEpisodeId: string, reason?: string): ProjectEpisodeRelation =>
  buildEpisodeRelation(newEpisodeId, priorEpisodeId, "supersedes", reason);

export const confirms = (confirmingEpisodeId: string, priorEpisodeId: string, reason?: string): ProjectEpisodeRelation =>
  buildEpisodeRelation(confirmingEpisodeId, priorEpisodeId, "confirms", reason);

export const resolves = (resolvingEpisodeId: string, questionEpisodeId: string, reason?: string): ProjectEpisodeRelation =>
  buildEpisodeRelation(resolvingEpisodeId, questionEpisodeId, "resolves", reason);
