import type {
  GenerateOperationalGovernanceBriefInput,
  GovernanceRiskDomain,
  OperationalGovernanceBrief,
  OperationalGovernanceRisk,
} from "./operational-governance-brief-types";

type AnyRecord = Record<string, unknown>;

const DOMAIN_LABELS: Record<GovernanceRiskDomain, string> = {
  scope: "Scope Governance Agent",
  timeline: "Timeline Governance Agent",
  cost: "Cost Governance Agent",
  quality: "Quality Governance Agent",
  resource: "Resource Governance Agent",
  risk: "Risk Intelligence Agent",
  stakeholder: "Stakeholder Intelligence Agent",
  governance: "PMO Governance Agent",
};

function readRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function readString(source: AnyRecord | null, key: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(source: AnyRecord | null, key: string): boolean | null {
  const value = source?.[key];
  return typeof value === "boolean" ? value : null;
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasEnabledAgent(pmoGovernance: AnyRecord | null, agentId: string): boolean {
  const agents = pmoGovernance?.agents;
  return Array.isArray(agents) && agents.some((agent) => {
    const record = readRecord(agent);
    return record?.agentId === agentId && record.enabled === true;
  });
}

function addRisk(risks: OperationalGovernanceRisk[], risk: OperationalGovernanceRisk) {
  if (!risks.some((existing) => existing.title === risk.title)) risks.push(risk);
}

function calculateConfidence(input: {
  pmoGovernance: AnyRecord | null;
  projectOnboardingPayload: AnyRecord | null;
  workspaceRuntimeState: AnyRecord | null;
  gaps: string[];
  risks: OperationalGovernanceRisk[];
}) {
  let score = 42;
  if (input.pmoGovernance) score += 16;
  if (input.projectOnboardingPayload) score += 22;
  if (input.workspaceRuntimeState) score += 6;
  score -= Math.min(30, input.gaps.length * 4);
  score -= Math.min(16, input.risks.filter((risk) => risk.severity === "critical" || risk.severity === "high").length * 3);
  return Math.max(25, Math.min(92, score));
}

function rankRisk(risk: OperationalGovernanceRisk): number {
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 }[risk.severity];
  const domainRank: Record<GovernanceRiskDomain, number> = {
    governance: 8,
    stakeholder: 7,
    timeline: 6,
    scope: 5,
    cost: 4,
    resource: 3,
    risk: 2,
    quality: 1,
  };
  return severityRank * 10 + domainRank[risk.relatedDomain];
}

export function generateOperationalGovernanceBrief({
  workspaceId,
  projectId,
  pmoGovernance = null,
  projectOnboardingPayload = null,
  workspaceRuntimeState = null,
  detectedRaidOverview = null,
  generatedAt,
  briefId,
}: GenerateOperationalGovernanceBriefInput): OperationalGovernanceBrief {
  const pmo = readRecord(pmoGovernance);
  const payload = readRecord(projectOnboardingPayload);
  const identity = readRecord(payload?.identity);
  const delivery = readRecord(payload?.deliveryContext);
  const governance = readRecord(payload?.governance);
  const discovery = readRecord(payload?.discovery);
  const pmoGovernanceModel = readRecord(pmo?.governance ?? pmo?.governanceModel);
  const pmoContextSeed = readRecord(pmo?.contextSeed);

  const risks: OperationalGovernanceRisk[] = [];
  const gaps: string[] = [];
  const signalsEvaluated: string[] = [];

  const problemStatement = readString(delivery, "problemStatement");
  const mainDeliverable = readString(delivery, "mainDeliverable");
  const scopeType = readString(delivery, "scopeType");
  const targetDeliveryDate = readString(identity, "targetDeliveryDate");
  const contractualMilestones = readString(delivery, "contractualMilestones");
  const externalDependencies = readString(delivery, "externalDependencies");
  const pmAssigned = readString(identity, "pmAssigned");
  const technicalLead = readString(identity, "technicalLead");
  const requirementsDefined = readBoolean(discovery, "requirementsDefined");
  const unknowns = readString(discovery, "unknowns");
  const financialBlockers = readString(discovery, "financialBlockers");
  const pendingClientDependencies = readString(discovery, "pendingClientDependencies");
  const pendingAccesses = readString(discovery, "pendingAccesses");
  const vendorDependencies = readString(discovery, "vendorDependencies");

  signalsEvaluated.push("project identity", "delivery context", "governance skeleton", "intelligence discovery");
  if (pmo) signalsEvaluated.push("PMO governance profile");
  if (workspaceRuntimeState) signalsEvaluated.push("workspace runtime state");

  if (!problemStatement || !mainDeliverable || scopeType === "open" || scopeType === "discovery" || requirementsDefined === false) {
    gaps.push("Scope baseline needs sharper boundaries and acceptance language.");
    addRisk(risks, {
      title: "Scope baseline is not execution-ready",
      severity: scopeType === "discovery" || requirementsDefined === false ? "high" : "medium",
      rationale: "The onboarding payload does not yet provide enough scope certainty to anchor change control, acceptance criteria, and delivery decisions.",
      recommendedMitigation: "Convert the problem statement and main deliverable into explicit in-scope, out-of-scope, and acceptance criteria bullets before the first governance checkpoint.",
      relatedDomain: "scope",
    });
  }

  if (!targetDeliveryDate && !contractualMilestones) {
    gaps.push("Timeline baseline is missing target dates or contractual milestones.");
    addRisk(risks, {
      title: "Timeline control has no anchor date",
      severity: "high",
      rationale: "No target delivery date or milestone gate is available, so schedule drift cannot be measured against a committed baseline.",
      recommendedMitigation: "Define a target delivery date plus the next three milestone gates and assign an owner for schedule variance review.",
      relatedDomain: "timeline",
    });
  }

  if (!financialBlockers && !readString(pmoContextSeed, "successDefinition")) {
    gaps.push("Budget and value-success criteria are not explicit.");
    addRisk(risks, {
      title: "Commercial controls are under-specified",
      severity: "medium",
      rationale: "The project does not expose budget, approval, or value-realization constraints, limiting early cost-governance detection.",
      recommendedMitigation: "Capture budget owner, funding status, approval gates, and commercial success criteria in the next setup pass.",
      relatedDomain: "cost",
    });
  }

  if (!pmAssigned || !technicalLead) {
    gaps.push("Resource ownership is incomplete across PM and technical leadership lanes.");
    addRisk(risks, {
      title: "Execution ownership has unfilled lanes",
      severity: !pmAssigned ? "high" : "medium",
      rationale: "A project can be created with partial owner coverage, but missing delivery or technical leadership creates ambiguity during escalation and dependency triage.",
      recommendedMitigation: "Confirm PM, technical lead, and backup decision owner before the first delivery cadence starts.",
      relatedDomain: "resource",
    });
  }

  if (!nonEmptyArray(pmo?.roles) && !readString(identity, "clientOrganization")) {
    gaps.push("Stakeholder map and sponsor chain are not established.");
    addRisk(risks, {
      title: "Stakeholder governance is not mapped",
      severity: "high",
      rationale: "No PMO role map or client/sponsor signal is available, so escalation paths and influence risks are opaque.",
      recommendedMitigation: "Create the sponsor, decision-maker, approver, and impacted-team map with escalation authority for each role.",
      relatedDomain: "stakeholder",
    });
  }

  if (!readBoolean(governance, "raidInitialized") || (!unknowns && !externalDependencies && !vendorDependencies && !pendingClientDependencies)) {
    gaps.push("Risk register needs declared assumptions, dependencies, and known unknowns.");
    addRisk(risks, {
      title: "RAID baseline has insufficient declared risks",
      severity: "medium",
      rationale: "The initial brief cannot see declared risks, dependencies, assumptions, or known unknowns beyond the setup skeleton.",
      recommendedMitigation: "Seed the RAID register with known unknowns, external dependencies, client dependencies, and first decisions required.",
      relatedDomain: "risk",
    });
  }

  const governanceIncomplete =
    !pmo ||
    !readString(pmoGovernanceModel, "methodology") ||
    !readString(pmoGovernanceModel, "reportingCadence") ||
    !readString(pmoGovernanceModel, "approvalGovernance") ||
    !hasEnabledAgent(pmo, "executive-synthesis");

  if (governanceIncomplete) {
    gaps.push("PMO governance profile is incomplete for approvals, cadence, or executive synthesis.");
    addRisk(risks, {
      title: "Governance operating model is not fully calibrated",
      severity: pmo ? "medium" : "high",
      rationale: "The PMO governance contract is missing or incomplete, reducing confidence in approval routes, reporting cadence, and intervention thresholds.",
      recommendedMitigation: "Complete PMO methodology, reporting cadence, approval governance, and enabled agent assignments before scaling execution.",
      relatedDomain: "governance",
    });
  }

  if (requirementsDefined === false || pendingAccesses || pendingClientDependencies) {
    gaps.push("Quality gates and readiness criteria require evidence before execution accelerates.");
    addRisk(risks, {
      title: "Execution readiness criteria are not proven",
      severity: pendingAccesses || pendingClientDependencies ? "medium" : "low",
      rationale: "Pending access, client dependencies, or undefined requirements can break acceptance quality and delivery readiness.",
      recommendedMitigation: "Define entry criteria, acceptance evidence, and dependency unblock owners for the next checkpoint.",
      relatedDomain: "quality",
    });
  }

  const rankedRisks = risks.sort((a, b) => rankRisk(b) - rankRisk(a));
  const topDomains = [...new Set(rankedRisks.slice(0, 4).map((risk) => risk.relatedDomain))];
  const raidOverview = detectedRaidOverview ?? { topRisks: [], topIssues: [], keyDependencies: [], keyAssumptions: [], snapshot: { risks: 0, issues: 0, dependencies: 0, assumptions: 0 }, healthScore: 100 };
  const confidenceScore = Math.min(96, calculateConfidence({ pmoGovernance: pmo, projectOnboardingPayload: payload, workspaceRuntimeState: readRecord(workspaceRuntimeState), gaps, risks: rankedRisks }) + (raidOverview.snapshot.risks + raidOverview.snapshot.issues + raidOverview.snapshot.dependencies + raidOverview.snapshot.assumptions > 0 ? 4 : 0));
  const primaryDomain = topDomains[0] ?? "governance";

  return {
    briefId: briefId ?? `ogb_${projectId}_${Date.parse(generatedAt ?? new Date().toISOString()) || Date.now()}`,
    workspaceId,
    projectId,
    generatedAt: generatedAt ?? new Date().toISOString(),
    confidenceScore,
    topExecutionRisks: rankedRisks,
    detectedRaidOverview: raidOverview,
    governanceGaps: gaps,
    recommendedNextAction: gaps.length
      ? `Stabilize ${primaryDomain} first: ${rankedRisks[0]?.recommendedMitigation ?? "complete the missing governance baseline."}`
      : "Baseline is strong enough to begin live operational monitoring; ingest the first meeting notes or status update to raise confidence.",
    agentAssignments: topDomains.map((domain, index) => ({
      agentId: domain,
      label: DOMAIN_LABELS[domain],
      priority: index === 0 ? "primary" : "supporting",
      reason: rankedRisks.find((risk) => risk.relatedDomain === domain)?.title ?? "Domain needs active monitoring.",
    })),
    firstInterventionSuggestion: rankedRisks[0]
      ? `Run a 30-minute ${primaryDomain} calibration checkpoint and leave with one owner, one date, and one evidence artifact for: ${rankedRisks[0].title}.`
      : "Ingest the first operational artifact so PMFreak can compare execution reality against this governance baseline.",
    sourceSummary: {
      pmoGovernanceAvailable: Boolean(pmo),
      projectOnboardingPayloadAvailable: Boolean(payload),
      workspaceRuntimeStateAvailable: Boolean(readRecord(workspaceRuntimeState)),
      signalsEvaluated: [...signalsEvaluated, ...(raidOverview.snapshot.risks + raidOverview.snapshot.issues + raidOverview.snapshot.dependencies + raidOverview.snapshot.assumptions > 0 ? ["detected_raid_overview"] : [])],
    },
  };
}
