// AOC PMFreak Read-Only Connector v1 — connector client
//
// readSnapshot() calls every read-only source method, applies redaction,
// and builds a connector snapshot. It never mutates source data, never
// calls a governance resolver or scenario runner, never builds Control
// Plane views or Narrative Exports, and never writes back to PMFreak —
// there is no such call anywhere in this module to make.
//
// Failure mode is fail-closed: any source method rejecting causes
// readSnapshot() to reject with a safe AocPMFreakConnectorError instead of
// returning a partial snapshot.

import { createAocPMFreakConnectorError } from "./pmfreak-connector-errors";
import { createAocPMFreakConnectorHealth } from "./pmfreak-connector-health";
import { createAocPMFreakConnectorSnapshot, type AocPMFreakConnectorSnapshot } from "./pmfreak-connector-snapshot";
import { createAocPMFreakReadOnlyConnectorConfig } from "./pmfreak-read-only-connector-config";
import { createAocPMFreakReadOnlyConnectorDescriptor } from "./pmfreak-read-only-connector-descriptor";
import type { AocPMFreakReadOnlyConnectorConfig, AocPMFreakConnectorError, AocPMFreakConnectorHealth } from "./pmfreak-read-only-connector-types";
import { redactAocPMFreakConnectorSnapshot } from "./pmfreak-redaction";
import type { AocPMFreakReadOnlyConnectorDescriptor } from "./pmfreak-read-only-connector-types";
import type { AocPMFreakReadOnlySource } from "./pmfreak-read-only-source";

export type AocPMFreakReadOnlyConnectorClient = {
  descriptor: AocPMFreakReadOnlyConnectorDescriptor;
  config: AocPMFreakReadOnlyConnectorConfig;

  getHealth(): Promise<AocPMFreakConnectorHealth>;

  readSnapshot(): Promise<AocPMFreakConnectorSnapshot>;
};

export type CreateAocPMFreakReadOnlyConnectorClientInput = {
  config?: Partial<AocPMFreakReadOnlyConnectorConfig>;
  source: AocPMFreakReadOnlySource;
};

function isAocPMFreakConnectorError(value: unknown): value is AocPMFreakConnectorError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { safe?: unknown }).safe === true &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export function createAocPMFreakReadOnlyConnectorClient(
  input: CreateAocPMFreakReadOnlyConnectorClientInput
): AocPMFreakReadOnlyConnectorClient {
  const descriptor = createAocPMFreakReadOnlyConnectorDescriptor();
  const config = createAocPMFreakReadOnlyConnectorConfig(input.config);
  const source = input.source;

  return {
    descriptor,
    config,

    async getHealth() {
      try {
        await source.listProjects(config);
        return createAocPMFreakConnectorHealth({ config });
      } catch (error) {
        const message = isAocPMFreakConnectorError(error)
          ? error.message
          : "PMFreak read-only source health check failed.";
        return createAocPMFreakConnectorHealth({ config, errors: [message] });
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
        if (isAocPMFreakConnectorError(error)) {
          throw error;
        }
        throw createAocPMFreakConnectorError(
          "read_failed",
          "PMFreak read-only source failed to read data.",
          { sourceKind: config.sourceKind }
        );
      }

      const snapshot = createAocPMFreakConnectorSnapshot({
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

      return redactAocPMFreakConnectorSnapshot(snapshot, config.redactionMode);
    },
  };
}
