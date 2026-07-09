// PMFreak AOC Read-Only Integration Surface v1 — surface client
//
// readSnapshot() calls every read-only source method, applies redaction,
// and builds a surface snapshot. It never mutates source data, never
// calls a governance resolver or scenario runner, never builds Control
// Plane views or Narrative Exports, and never accepts writeback from AOC —
// there is no such call anywhere in this module to make.
//
// Failure mode is fail-closed: any source method rejecting causes
// readSnapshot() to reject with a safe PMFreakAocSurfaceError instead of
// returning a partial snapshot.

import { createPMFreakAocSurfaceError } from "./pmfreak-aoc-surface-errors";
import { createPMFreakAocSurfaceHealth } from "./pmfreak-aoc-surface-health";
import { createPMFreakAocSurfaceSnapshot, type PMFreakAocSurfaceSnapshot } from "./pmfreak-aoc-surface-snapshot";
import { createPMFreakAocReadOnlySurfaceConfig } from "./pmfreak-aoc-read-only-surface-config";
import { createPMFreakAocReadOnlySurfaceDescriptor } from "./pmfreak-aoc-read-only-surface-descriptor";
import type { PMFreakAocReadOnlySurfaceConfig, PMFreakAocSurfaceError, PMFreakAocSurfaceHealth } from "./pmfreak-aoc-read-only-surface-types";
import { redactPMFreakAocSurfaceSnapshot } from "./pmfreak-aoc-redaction";
import type { PMFreakAocReadOnlySurfaceDescriptor } from "./pmfreak-aoc-read-only-surface-types";
import type { PMFreakAocReadOnlySource } from "./pmfreak-aoc-read-only-source";

export type PMFreakAocReadOnlySurfaceClient = {
  descriptor: PMFreakAocReadOnlySurfaceDescriptor;
  config: PMFreakAocReadOnlySurfaceConfig;

  getHealth(): Promise<PMFreakAocSurfaceHealth>;

  readSnapshot(): Promise<PMFreakAocSurfaceSnapshot>;
};

export type CreatePMFreakAocReadOnlySurfaceClientInput = {
  config?: Partial<PMFreakAocReadOnlySurfaceConfig>;
  source: PMFreakAocReadOnlySource;
};

function isPMFreakAocSurfaceError(value: unknown): value is PMFreakAocSurfaceError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { safe?: unknown }).safe === true &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export function createPMFreakAocReadOnlySurfaceClient(
  input: CreatePMFreakAocReadOnlySurfaceClientInput
): PMFreakAocReadOnlySurfaceClient {
  const descriptor = createPMFreakAocReadOnlySurfaceDescriptor();
  const config = createPMFreakAocReadOnlySurfaceConfig(input.config);
  const source = input.source;

  return {
    descriptor,
    config,

    async getHealth() {
      try {
        await source.listProjects(config);
        return createPMFreakAocSurfaceHealth({ config });
      } catch (error) {
        const message = isPMFreakAocSurfaceError(error)
          ? error.message
          : "PMFreak read-only source health check failed.";
        return createPMFreakAocSurfaceHealth({ config, errors: [message] });
      }
    },

    async readSnapshot() {
      let projects, agents, milestones, tasks, risks, evidenceReferences, approvalReferences, actionProposals;

      try {
        [projects, agents, milestones, tasks, risks, evidenceReferences, approvalReferences, actionProposals] = await Promise.all([
          source.listProjects(config),
          source.listAgents(config),
          source.listMilestones(config),
          source.listTasks(config),
          source.listRisks(config),
          source.listEvidenceReferences(config),
          source.listApprovalReferences(config),
          source.listActionProposals(config),
        ]);
      } catch (error) {
        if (isPMFreakAocSurfaceError(error)) {
          throw error;
        }
        throw createPMFreakAocSurfaceError(
          "read_failed",
          "PMFreak read-only source failed to read data.",
          { sourceKind: config.sourceKind }
        );
      }

      const snapshot = createPMFreakAocSurfaceSnapshot({
        config,
        projects,
        agents,
        milestones,
        tasks,
        risks,
        evidenceReferences,
        approvalReferences,
        actionProposals,
        warnings: config.warnings,
      });

      if (config.redactionMode === "none") {
        return snapshot;
      }

      return redactPMFreakAocSurfaceSnapshot(snapshot, config.redactionMode);
    },
  };
}
