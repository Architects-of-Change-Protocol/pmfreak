import type { CascadeEffect, CascadeNode } from "./types";

// ─── CascadeChainDefinition ───────────────────────────────────────────────────

type ChainStep = {
  entityType: string;
  label: string;
  entityId: string;
};

// ─── analyzeCascadeEffects ────────────────────────────────────────────────────
// Rebuilds the cascade chain for a given focus type.
// Returns a structured tree representing how the impact propagates.

export function analyzeCascadeEffects(input: {
  focusType: string;
  focusItemId: string;
  entityCounts: Partial<Record<string, number>>;
}): CascadeEffect {
  const chains: Record<string, ChainStep[]> = {
    authority: [
      { entityType: "operational_focus_items", label: "Authority Gap",        entityId: input.focusItemId },
      { entityType: "ratifications",           label: "Ratification Blocked", entityId: "cascade" },
      { entityType: "commitments",             label: "Commitments Delayed",  entityId: "cascade" },
      { entityType: "projections",             label: "Execution Drift",      entityId: "cascade" },
      { entityType: "health",                  label: "Health Reduction",     entityId: "cascade" },
    ],
    governance: [
      { entityType: "operational_focus_items", label: "Governance Violation", entityId: input.focusItemId },
      { entityType: "decisions",               label: "Decisions Blocked",    entityId: "cascade" },
      { entityType: "commitments",             label: "Commitments Affected", entityId: "cascade" },
      { entityType: "projections",             label: "Projection Drift",     entityId: "cascade" },
    ],
    ratification: [
      { entityType: "operational_focus_items", label: "Ratification Stall",   entityId: input.focusItemId },
      { entityType: "commitments",             label: "Commitments Blocked",  entityId: "cascade" },
      { entityType: "projections",             label: "Execution Delayed",    entityId: "cascade" },
    ],
    commitment: [
      { entityType: "operational_focus_items", label: "Overdue Commitment",   entityId: input.focusItemId },
      { entityType: "projections",             label: "Projections Affected", entityId: "cascade" },
      { entityType: "realities",               label: "Realities Impacted",   entityId: "cascade" },
      { entityType: "health",                  label: "Health Reduction",     entityId: "cascade" },
    ],
    execution: [
      { entityType: "operational_focus_items", label: "Execution Drift",      entityId: input.focusItemId },
      { entityType: "projections",             label: "Projections Missed",   entityId: "cascade" },
      { entityType: "realities",               label: "Reality Gap",          entityId: "cascade" },
    ],
    projection: [
      { entityType: "operational_focus_items", label: "Projection Variance",  entityId: input.focusItemId },
      { entityType: "realities",               label: "Reality Misaligned",   entityId: "cascade" },
      { entityType: "health",                  label: "Health Degraded",      entityId: "cascade" },
    ],
  };

  const steps = chains[input.focusType] ?? [
    { entityType: "operational_focus_items", label: "Focus Item", entityId: input.focusItemId },
    { entityType: "health",                  label: "Health Risk", entityId: "cascade" },
  ];

  const nodes: CascadeNode[] = steps.map((step, depth) => ({
    entityType: step.entityType,
    entityId:   step.entityId,
    label:      step.label,
    depth,
    children:   [],
  }));

  // Build linked tree (linear chain)
  for (let i = nodes.length - 2; i >= 0; i--) {
    nodes[i].children = [nodes[i + 1]];
  }

  const totalAffectedEntities = steps.reduce((sum, step) => {
    return sum + (input.entityCounts[step.entityType] ?? 0);
  }, 0);

  return {
    chain:                nodes,
    maxDepth:             nodes.length - 1,
    totalAffectedEntities,
  };
}
