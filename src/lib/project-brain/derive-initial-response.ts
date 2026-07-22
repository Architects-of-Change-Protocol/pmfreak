// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Initial Response Derivation
// Sprint 0.5: Foundation Integration
//
// Deterministic — no LLM call. Turns real, already-persisted project setup
// data and evidence counts into a constitution-compliant ProjectBrainResponse.
// Every statement here must be traceable to a field that was actually
// supplied at project creation or a real evidence-table count; nothing is
// invented to fill out the shape. Guardrails (guardrails.ts) validate the
// result before a caller renders it — see validate-response-pipeline.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { PROJECT_BRAIN_CONSTITUTION_VERSION } from "./constitution";
import { sourceReferenceFromProjectConfiguration } from "./source-reference";
import type {
  ProjectBrainConfidence,
  ProjectBrainKnowledgeGap,
  ProjectBrainResponse,
  ProjectBrainSourceReference,
  ProjectBrainStatement,
  ProjectContextScope,
} from "./types";

// A structural subset of ProjectOnboardingPayload (src/lib/projects/project-onboarding-types.ts) —
// duplicated narrowly here rather than imported so this module has no
// dependency on the projects domain; the caller adapts the real payload
// (persisted verbatim on `projects.onboarding_payload`) into this shape.
export type ProjectOnboardingSnapshot = {
  identity: {
    technicalLead: string;
    targetDeliveryDate: string;
    pmAssigned: string;
  };
  deliveryContext: {
    problemStatement: string;
    mainDeliverable: string;
    externalDependencies: string;
    contractualMilestones: string;
  };
  discovery: {
    unknowns: string;
    requirementsDefined: boolean | null;
    pendingClientDependencies: string;
    pendingAccesses: string;
    vendorDependencies: string;
    financialBlockers: string;
  };
};

export type ProjectSetupSnapshot = {
  projectId: string;
  workspaceId: string;
  projectName: string;
  createdAt: string;
  onboarding: ProjectOnboardingSnapshot | null;
};

export type EvidenceSummary = {
  /** Rows that exist in project_evidence, regardless of processing status. */
  totalCount: number;
  /** project_evidence.status === "processed" — content extraction completed. */
  processedCount: number;
  /** project_evidence.status === "failed". */
  failedCount: number;
};

const QUALITATIVE = (level: ProjectBrainConfidence["level"]): ProjectBrainConfidence => ({ kind: "qualitative", level });

// Content-addressed, not counter-based: the same project + field always
// derives the same statement id, so this module has no mutable state and is
// safe to call concurrently across requests.
function statementId(projectId: string, kind: string, slug: string): string {
  return `${kind}:${projectId}:${slug}`;
}

function configSource(
  project: ProjectSetupSnapshot,
  fieldKey: string,
  fieldLabel: string,
  authorityLevel: "primary" | "secondary",
): ProjectBrainSourceReference {
  return sourceReferenceFromProjectConfiguration(
    {
      projectId: project.projectId,
      workspaceId: project.workspaceId,
      fieldKey,
      fieldLabel,
      recordedAt: project.createdAt,
      author: project.onboarding?.identity.pmAssigned || null,
    },
    { authorityLevel },
  );
}

function fact(
  scope: ProjectContextScope,
  slug: string,
  text: string,
  sources: ProjectBrainSourceReference[],
  generatedAt: string,
): ProjectBrainStatement {
  return {
    id: statementId(scope.projectId, "fact", slug),
    scope,
    epistemicType: "FACT",
    text,
    confidence: QUALITATIVE("high"),
    sources,
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
}

function reported(
  scope: ProjectContextScope,
  slug: string,
  text: string,
  sources: ProjectBrainSourceReference[],
  reportedBy: string,
  generatedAt: string,
): ProjectBrainStatement {
  return {
    id: statementId(scope.projectId, "reported", slug),
    scope,
    epistemicType: "REPORTED",
    text,
    confidence: QUALITATIVE("medium"),
    sources,
    reportedBy,
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
}

function openQuestion(
  scope: ProjectContextScope,
  slug: string,
  text: string,
  sources: ProjectBrainSourceReference[],
  generatedAt: string,
): ProjectBrainStatement {
  return {
    id: statementId(scope.projectId, "open-question", slug),
    scope,
    epistemicType: "OPEN_QUESTION",
    text,
    confidence: QUALITATIVE("low"),
    sources,
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
}

function unknown(scope: ProjectContextScope, slug: string, text: string, generatedAt: string): ProjectBrainStatement {
  return {
    id: statementId(scope.projectId, "unknown", slug),
    scope,
    epistemicType: "UNKNOWN",
    text,
    confidence: QUALITATIVE("unknown"),
    sources: [],
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
}

function recommendation(
  scope: ProjectContextScope,
  slug: string,
  text: string,
  generatedAt: string,
): ProjectBrainStatement {
  return {
    id: statementId(scope.projectId, "recommendation", slug),
    scope,
    epistemicType: "RECOMMENDATION",
    text,
    confidence: QUALITATIVE("low"),
    sources: [],
    requiresHumanApproval: true,
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
  };
}

type GapDraft = {
  id: string;
  epistemicStatus: "UNKNOWN" | "OPEN_QUESTION";
  title: string;
  question: string;
  reason: string;
  priority: ProjectBrainKnowledgeGap["priority"];
  suggestedEvidenceTypes: string[];
};

const GENERIC_STARTING_GAPS: GapDraft[] = [
  {
    id: "gap-no-evidence",
    epistemicStatus: "UNKNOWN",
    title: "Project evidence",
    question: "I have not received any evidence for this project yet.",
    reason: "Without evidence, I can only see what was entered during project setup.",
    priority: "high",
    suggestedEvidenceTypes: ["Contract or SOW", "Kickoff notes", "Approved project plan"],
  },
];

export function deriveInitialProjectBrainResponse(input: {
  project: ProjectSetupSnapshot;
  evidence: EvidenceSummary;
  generatedAt: string;
}): ProjectBrainResponse {
  const { project, evidence, generatedAt } = input;
  const scope: ProjectContextScope = { workspaceId: project.workspaceId, projectId: project.projectId };
  const onboarding = project.onboarding;

  const statements: ProjectBrainStatement[] = [];
  const gaps: GapDraft[] = [];

  // ─── FACT — real system-of-record state ──────────────────────────────
  statements.push(
    fact(
      scope,
      "project-created",
      `The project "${project.projectName}" has been created.`,
      [configSource(project, "project.name", "Project setup — Project record", "primary")],
      generatedAt,
    ),
  );

  if (onboarding?.deliveryContext.problemStatement.trim()) {
    statements.push(
      fact(
        scope,
        "problem-statement-defined",
        "The project's problem statement has been defined.",
        [configSource(project, "deliveryContext.problemStatement", "Project setup — Problem statement", "primary")],
        generatedAt,
      ),
    );
  }

  if (onboarding?.deliveryContext.mainDeliverable.trim()) {
    statements.push(
      fact(
        scope,
        "main-deliverable-defined",
        "The project's main deliverable has been defined.",
        [configSource(project, "deliveryContext.mainDeliverable", "Project setup — Main deliverable", "primary")],
        generatedAt,
      ),
    );
  }

  if (evidence.totalCount > 0) {
    statements.push(
      fact(
        scope,
        "evidence-count",
        `${evidence.totalCount} evidence item${evidence.totalCount === 1 ? " is" : "s are"} stored in Project Memory.`,
        [configSource(project, "project_evidence.count", "Project Memory — Evidence store", "primary")],
        generatedAt,
      ),
    );
  } else {
    gaps.push(GENERIC_STARTING_GAPS[0]);
  }

  // ─── REPORTED — self-reported during setup, not independently verified ─
  const reportedByLine = onboarding?.identity.pmAssigned?.trim() || "the project setup form";

  if (onboarding?.discovery.pendingClientDependencies.trim()) {
    statements.push(
      reported(
        scope,
        "pending-client-dependencies",
        "Client dependencies were marked as unresolved during setup.",
        [configSource(project, "discovery.pendingClientDependencies", "Project setup — Pending client dependencies", "secondary")],
        reportedByLine,
        generatedAt,
      ),
    );
  }

  if (onboarding?.discovery.vendorDependencies.trim()) {
    statements.push(
      reported(
        scope,
        "vendor-dependencies",
        "Vendor dependencies were noted during setup.",
        [configSource(project, "discovery.vendorDependencies", "Project setup — Vendor dependencies", "secondary")],
        reportedByLine,
        generatedAt,
      ),
    );
  }

  if (onboarding?.discovery.financialBlockers.trim()) {
    statements.push(
      reported(
        scope,
        "financial-blockers",
        "Financial blockers were noted during setup.",
        [configSource(project, "discovery.financialBlockers", "Project setup — Financial blockers", "secondary")],
        reportedByLine,
        generatedAt,
      ),
    );
  }

  if (onboarding?.deliveryContext.externalDependencies.trim()) {
    statements.push(
      reported(
        scope,
        "external-dependencies",
        "External dependencies were noted during setup.",
        [configSource(project, "deliveryContext.externalDependencies", "Project setup — External dependencies", "secondary")],
        reportedByLine,
        generatedAt,
      ),
    );
  }

  // ─── OPEN_QUESTION — the user's own recorded unknowns ─────────────────
  if (onboarding?.discovery.unknowns.trim()) {
    statements.push(
      openQuestion(
        scope,
        "setup-unknowns",
        "The project setup identified open unknowns that have not yet been resolved.",
        [configSource(project, "discovery.unknowns", "Project setup — Known unknowns", "secondary")],
        generatedAt,
      ),
    );
  }

  if (onboarding?.discovery.requirementsDefined === false || onboarding?.discovery.requirementsDefined === null) {
    gaps.push({
      id: "gap-requirements-defined",
      epistemicStatus: "OPEN_QUESTION",
      title: "Requirements status",
      question: "I do not know whether requirements have been finalized.",
      reason: "Delivery risk cannot be assessed while scope is still being defined.",
      priority: "high",
      suggestedEvidenceTypes: ["Requirements document", "Signed-off scope", "Product brief"],
    });
  }

  // ─── UNKNOWN — fields never supplied at all ────────────────────────────
  if (!onboarding?.identity.targetDeliveryDate.trim()) {
    gaps.push({
      id: "gap-delivery-timeline",
      epistemicStatus: "UNKNOWN",
      title: "Approved delivery timeline",
      question: "I have not identified an approved delivery timeline.",
      reason: "I cannot assess schedule health without an authoritative delivery baseline.",
      priority: "high",
      suggestedEvidenceTypes: ["Approved project plan", "Client acceptance email", "SOW", "Milestone schedule"],
    });
  }

  if (!onboarding?.deliveryContext.contractualMilestones.trim()) {
    gaps.push({
      id: "gap-contractual-milestones",
      epistemicStatus: "UNKNOWN",
      title: "Contractual milestones",
      question: "I have not identified confirmed contractual milestones.",
      reason: "Without milestones I cannot flag when the project is falling behind an agreed schedule.",
      priority: "medium",
      suggestedEvidenceTypes: ["Contract", "SOW", "Milestone schedule"],
    });
  }

  if (!onboarding?.identity.technicalLead.trim()) {
    gaps.push({
      id: "gap-technical-lead",
      epistemicStatus: "UNKNOWN",
      title: "Technical lead",
      question: "I have not identified a technical lead for this project.",
      reason: "I cannot route technical questions or escalations without a named owner.",
      priority: "low",
      suggestedEvidenceTypes: ["Team roster", "Kickoff notes"],
    });
  }

  if (evidence.totalCount === 0) {
    gaps.push({
      id: "gap-delivery-status",
      epistemicStatus: "UNKNOWN",
      title: "Current delivery status",
      question: "I cannot determine current delivery status from the available evidence.",
      reason: "No evidence has been added yet, so there is nothing to assess delivery health against.",
      priority: "medium",
      suggestedEvidenceTypes: ["Status report", "Meeting notes"],
    });
  }

  const knowledgeGaps: ProjectBrainKnowledgeGap[] = dedupeGapsById(gaps).map((gap) => ({
    id: gap.id,
    scope,
    epistemicStatus: gap.epistemicStatus,
    title: gap.title,
    question: gap.question,
    reason: gap.reason,
    priority: gap.priority,
    suggestedEvidenceTypes: gap.suggestedEvidenceTypes,
    sourceIds: [],
    identifiedAt: generatedAt,
  }));

  for (const gap of knowledgeGaps) {
    statements.push(
      gap.epistemicStatus === "UNKNOWN"
        ? unknown(scope, gap.id, gap.question, generatedAt)
        : openQuestion(scope, gap.id, gap.question, [], generatedAt),
    );
  }

  // ─── RECOMMENDATION — top priority gaps only, always human-approved ────
  const topGaps = [...knowledgeGaps].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]).slice(0, 2);
  for (const gap of topGaps) {
    statements.push(recommendation(scope, gap.id, `Consider adding evidence for: ${gap.title.toLowerCase()}.`, generatedAt));
  }

  return {
    scope,
    generatedAt,
    constitutionVersion: PROJECT_BRAIN_CONSTITUTION_VERSION,
    statements,
    knowledgeGaps,
  };
}

const PRIORITY_WEIGHT: Record<ProjectBrainKnowledgeGap["priority"], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

function dedupeGapsById(gaps: GapDraft[]): GapDraft[] {
  const seen = new Set<string>();
  const result: GapDraft[] = [];
  for (const gap of gaps) {
    if (seen.has(gap.id)) continue;
    seen.add(gap.id);
    result.push(gap);
  }
  return result;
}
