// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Episodic Memory — Language & Ordering
// Sprint 1: Episodic Memory
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectEpisode, ProjectEpisodeActor, ProjectEpisodeType } from "./types";

const ACTOR_TYPE_LABEL: Record<ProjectEpisodeActor["type"], string> = {
  user: "User",
  project_brain: "Project Brain",
  system: "System",
  external_source: "External source",
  unknown: "Unknown",
};

export function labelForEpisodeActor(actor: ProjectEpisodeActor): string {
  return actor.displayName ?? ACTOR_TYPE_LABEL[actor.type] ?? "Unknown";
}

const EPISODE_TYPE_LABEL: Record<ProjectEpisodeType, string> = {
  project_created: "Project created",
  brain_activated: "Project Brain activated",
  context_recorded: "Project context recorded",
  evidence_received: "Evidence received",
  evidence_stored: "Evidence stored",
  evidence_processing_failed: "Evidence processing failed",
  knowledge_recorded: "Knowledge recorded",
  knowledge_updated: "Knowledge updated",
  knowledge_confirmed: "Knowledge confirmed",
  knowledge_superseded: "Knowledge superseded",
  knowledge_retracted: "Knowledge retracted",
  question_opened: "Open question recorded",
  question_resolved: "Open question resolved",
  gap_identified: "Knowledge gap identified",
  gap_resolved: "Knowledge gap resolved",
  status_changed: "Status changed",
};

export function labelForEpisodeType(type: ProjectEpisodeType): string {
  return EPISODE_TYPE_LABEL[type] ?? type;
}

/** occurredAt, then recordedAt, then id — a stable, fully deterministic order (Sprint 1 spec, "Ordering"). Newest first. */
export function sortEpisodes(episodes: ProjectEpisode[]): ProjectEpisode[] {
  return [...episodes].sort((a, b) => {
    const occurred = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
    if (occurred !== 0) return occurred;
    const recorded = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
    if (recorded !== 0) return recorded;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });
}

export type EpisodeRecencyGroup = "Today" | "Yesterday" | "This Week" | "Earlier";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Groups already-sorted episodes for the timeline. `asOf` must be supplied by the caller — this module never calls Date.now() itself, keeping grouping deterministic and testable. */
export function groupEpisodesByRecency(episodes: ProjectEpisode[], asOf: string): Array<{ group: EpisodeRecencyGroup; episodes: ProjectEpisode[] }> {
  const asOfMs = Date.parse(asOf);
  const startOfToday = new Date(asOfMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const startOfYesterdayMs = startOfTodayMs - DAY_MS;
  const startOfWeekMs = startOfTodayMs - 7 * DAY_MS;

  const buckets: Record<EpisodeRecencyGroup, ProjectEpisode[]> = { Today: [], Yesterday: [], "This Week": [], Earlier: [] };
  for (const episode of episodes) {
    const occurredMs = Date.parse(episode.occurredAt);
    if (occurredMs >= startOfTodayMs) buckets.Today.push(episode);
    else if (occurredMs >= startOfYesterdayMs) buckets.Yesterday.push(episode);
    else if (occurredMs >= startOfWeekMs) buckets["This Week"].push(episode);
    else buckets.Earlier.push(episode);
  }

  return (["Today", "Yesterday", "This Week", "Earlier"] as const)
    .map((group) => ({ group, episodes: buckets[group] }))
    .filter((bucket) => bucket.episodes.length > 0);
}
