// ─────────────────────────────────────────────────────────────────────────────
// Execution Augmentation — Builder
//
// Builds ExecutionAugmentation objects for each supported artifact type.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// No recommendations. No autonomous reasoning. No invented relationships.
//
// Every augmentation exposes only constitutional knowledge that is explicitly
// linked or constitutionally relevant. ReasonIncluded must be traceable.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { resolveArtifacts, resolveLineage } from "./augmentation-resolver";
import type {
  ExecutionAugmentation,
  ExecutionArtifactType,
  AvailableArtifacts,
  AugmentationArtifact,
  AugmentationHealth,
  AugmentationResult,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function augmentationId(
  workspaceId: string,
  artifactType: string,
  artifactId: string,
  generatedAt: string
): string {
  return `augmentation:${workspaceId}:${artifactType}:${artifactId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitAugmentationEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  augId: string,
  correlationId: string | null,
  causationId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? augId,
    causationId,
    rawReferenceTable: "execution_augmentation",
    rawReferenceId: augId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── allArtifacts ─────────────────────────────────────────────────────────────
// Flattens all artifact lists into a single array for health/export.

function allArtifacts(aug: ExecutionAugmentation): AugmentationArtifact[] {
  return [
    ...aug.contextArtifacts,
    ...aug.evidenceArtifacts,
    ...aug.memoryArtifacts,
    ...aug.patternArtifacts,
    ...aug.effectivenessArtifacts,
    ...aug.briefArtifacts,
    ...aug.dashboardArtifacts,
  ];
}

// ─── buildTaskAugmentation ────────────────────────────────────────────────────
// May include: linked evidence, linked memories, linked patterns, linked
// effectiveness records, linked briefs, linked contradictions.
// Only if explicitly related. No recommendations. No task generation.

export function buildTaskAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "task", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const memoryArtifacts = resolveArtifacts(
    available.memories ?? [],
    "memory",
    "Linked by constitutional memory"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );
  const briefArtifacts = resolveArtifacts(
    available.briefs ?? [],
    "brief",
    "Linked by constitutional brief"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...memoryArtifacts,
    ...patternArtifacts,
    ...effectivenessArtifacts,
    ...briefArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "task",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts,
    patternArtifacts,
    effectivenessArtifacts,
    briefArtifacts,
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildDecisionAugmentation ────────────────────────────────────────────────
// May include: linked evidence, linked historical decisions, linked memories,
// linked patterns, linked effectiveness records, linked governance artifacts.
// Only explicit relationships.

export function buildDecisionAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "decision", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const memoryArtifacts = resolveArtifacts(
    available.memories ?? [],
    "memory",
    "Linked by constitutional memory"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );
  const briefArtifacts = resolveArtifacts(
    available.briefs ?? [],
    "brief",
    "Linked by decision lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...memoryArtifacts,
    ...patternArtifacts,
    ...effectivenessArtifacts,
    ...briefArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "decision",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts,
    patternArtifacts,
    effectivenessArtifacts,
    briefArtifacts,
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildDependencyAugmentation ──────────────────────────────────────────────
// May include: dependency evidence, dependency patterns, dependency
// contradictions, dependency effectiveness records.
// Only explicit relationships.

export function buildDependencyAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "dependency", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...patternArtifacts,
    ...effectivenessArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "dependency",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts: [],
    patternArtifacts,
    effectivenessArtifacts,
    briefArtifacts: [],
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildRiskAugmentation ────────────────────────────────────────────────────
// May include: risk evidence, risk memories, risk patterns, risk effectiveness
// records, risk contradictions. Only explicit relationships.
// Does not score risk. Does not predict impact.

export function buildRiskAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "risk", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const memoryArtifacts = resolveArtifacts(
    available.memories ?? [],
    "memory",
    "Linked by constitutional memory"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...memoryArtifacts,
    ...patternArtifacts,
    ...effectivenessArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "risk",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts,
    patternArtifacts,
    effectivenessArtifacts,
    briefArtifacts: [],
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildMilestoneAugmentation ───────────────────────────────────────────────
// May include: milestone evidence, milestone history, milestone effectiveness,
// milestone contradictions. Only explicit relationships.

export function buildMilestoneAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "milestone", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...effectivenessArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "milestone",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts: [],
    patternArtifacts: [],
    effectivenessArtifacts,
    briefArtifacts: [],
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildBlockerAugmentation ─────────────────────────────────────────────────
// May include: blocker evidence, blocker patterns, blocker contradictions.
// Only explicit relationships.

export function buildBlockerAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "blocker", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...patternArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "blocker",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts: [],
    patternArtifacts,
    effectivenessArtifacts: [],
    briefArtifacts: [],
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildEscalationAugmentation ──────────────────────────────────────────────
// May include: escalation evidence, escalation history, escalation governance
// artifacts. Only explicit relationships.

export function buildEscalationAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "escalation", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const briefArtifacts = resolveArtifacts(
    available.briefs ?? [],
    "brief",
    "Linked by decision lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...briefArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "escalation",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts: [],
    patternArtifacts: [],
    effectivenessArtifacts: [],
    briefArtifacts,
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildStakeholderAugmentation ─────────────────────────────────────────────
// May include: linked evidence, linked memories, linked effectiveness records.
// Only explicit relationships.

export function buildStakeholderAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "stakeholder", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const memoryArtifacts = resolveArtifacts(
    available.memories ?? [],
    "memory",
    "Linked by constitutional memory"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...memoryArtifacts,
    ...effectivenessArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "stakeholder",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts,
    patternArtifacts: [],
    effectivenessArtifacts,
    briefArtifacts: [],
    dashboardArtifacts: [],
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: resolveLineage(allResolved),
    metadata: available.metadata ?? {},
  };
}

// ─── buildProjectAugmentation ─────────────────────────────────────────────────
// May include: briefs, dashboards, patterns, effectiveness, contradictions,
// workspace lineage. Only explicit relationships.

export function buildProjectAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "project", artifactId, generatedAt);

  const evidenceArtifacts = resolveArtifacts(
    available.evidence ?? [],
    "evidence",
    "Linked by evidence"
  );
  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const effectivenessArtifacts = resolveArtifacts(
    available.effectivenessRecords ?? [],
    "effectiveness",
    "Linked by effectiveness lineage"
  );
  const briefArtifacts = resolveArtifacts(
    available.briefs ?? [],
    "brief",
    "Linked by constitutional brief"
  );
  const dashboardArtifacts = resolveArtifacts(
    available.dashboards ?? [],
    "dashboard",
    "Linked by workspace lineage"
  );

  const allResolved = [
    ...evidenceArtifacts,
    ...patternArtifacts,
    ...effectivenessArtifacts,
    ...briefArtifacts,
    ...dashboardArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "project",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts,
    memoryArtifacts: [],
    patternArtifacts,
    effectivenessArtifacts,
    briefArtifacts,
    dashboardArtifacts,
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: [
      ...resolveLineage(allResolved),
      ...(available.lineage ?? []),
    ],
    metadata: available.metadata ?? {},
  };
}

// ─── buildPortfolioAugmentation ───────────────────────────────────────────────
// May include: portfolio briefs, portfolio dashboards, cross-project patterns,
// cross-project contradictions. Only explicit relationships.

export function buildPortfolioAugmentation(
  workspaceId: string,
  artifactId: string,
  available: AvailableArtifacts
): ExecutionAugmentation {
  const generatedAt = new Date().toISOString();
  const id = augmentationId(workspaceId, "portfolio", artifactId, generatedAt);

  const patternArtifacts = resolveArtifacts(
    available.patterns ?? [],
    "pattern",
    "Linked by pattern source"
  );
  const briefArtifacts = resolveArtifacts(
    available.briefs ?? [],
    "brief",
    "Linked by constitutional brief"
  );
  const dashboardArtifacts = resolveArtifacts(
    available.dashboards ?? [],
    "dashboard",
    "Linked by workspace lineage"
  );

  const allResolved = [
    ...patternArtifacts,
    ...briefArtifacts,
    ...dashboardArtifacts,
  ];

  return {
    id,
    workspaceId,
    artifactType: "portfolio",
    artifactId,
    generatedAt,
    contextArtifacts: [],
    evidenceArtifacts: [],
    memoryArtifacts: [],
    patternArtifacts,
    effectivenessArtifacts: [],
    briefArtifacts,
    dashboardArtifacts,
    contradictions: available.contradictions ?? [],
    unknowns: available.unknowns ?? [],
    lineage: [
      ...resolveLineage(allResolved),
      ...(available.lineage ?? []),
    ],
    metadata: available.metadata ?? {},
  };
}

// ─── buildExecutionAugmentation ───────────────────────────────────────────────
// Dispatches to the correct type-specific builder and emits the governance
// audit event.

export async function buildExecutionAugmentation(
  workspaceId: string,
  artifactType: ExecutionArtifactType,
  artifactId: string,
  availableArtifacts: AvailableArtifacts,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<AugmentationResult<ExecutionAugmentation>> {
  let augmentation: ExecutionAugmentation;

  switch (artifactType) {
    case "task":
      augmentation = buildTaskAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "decision":
      augmentation = buildDecisionAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "milestone":
      augmentation = buildMilestoneAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "dependency":
      augmentation = buildDependencyAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "risk":
      augmentation = buildRiskAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "blocker":
      augmentation = buildBlockerAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "escalation":
      augmentation = buildEscalationAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "stakeholder":
      augmentation = buildStakeholderAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "project":
      augmentation = buildProjectAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    case "portfolio":
      augmentation = buildPortfolioAugmentation(workspaceId, artifactId, availableArtifacts);
      break;
    default:
      return {
        ok: false,
        error: `Unsupported artifactType: ${artifactType}`,
        failureClass: "unsupported_artifact_type",
      };
  }

  const all = allArtifacts(augmentation);

  await emitAugmentationEvent(
    workspaceId,
    actorId,
    "EXECUTION_AUGMENTATION_GENERATED",
    augmentation.id,
    correlationId,
    causationId,
    {
      artifactType,
      artifactId,
      totalArtifacts: all.length,
      evidenceCount: augmentation.evidenceArtifacts.length,
      memoryCount: augmentation.memoryArtifacts.length,
      patternCount: augmentation.patternArtifacts.length,
      effectivenessCount: augmentation.effectivenessArtifacts.length,
      briefCount: augmentation.briefArtifacts.length,
      dashboardCount: augmentation.dashboardArtifacts.length,
      contradictionCount: augmentation.contradictions.length,
      unknownCount: augmentation.unknowns.length,
    }
  );

  return { ok: true, data: augmentation };
}

// ─── getAugmentationHealth ────────────────────────────────────────────────────

export function getAugmentationHealth(
  augmentation: ExecutionAugmentation
): AugmentationHealth {
  const all = allArtifacts(augmentation);
  return {
    artifactCount: all.length,
    evidenceCount: augmentation.evidenceArtifacts.length,
    memoryCount: augmentation.memoryArtifacts.length,
    patternCount: augmentation.patternArtifacts.length,
    effectivenessCount: augmentation.effectivenessArtifacts.length,
    briefCount: augmentation.briefArtifacts.length,
    dashboardCount: augmentation.dashboardArtifacts.length,
    contradictionCount: augmentation.contradictions.length,
    unknownCount: augmentation.unknowns.length,
  };
}
