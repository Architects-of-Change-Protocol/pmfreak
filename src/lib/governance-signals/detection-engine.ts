// ─────────────────────────────────────────────────────────────────────────────
// Governance Signal Detection Engine
//
// Observes current workspace state and emits detection candidates.
// Detection rules are deterministic — no ML or LLM required.
//
// Detection pipeline:
//   1. Query current workspace state per entity type
//   2. Apply threshold rules to identify signal conditions
//   3. Return DetectedSignalCandidate[] for the signal registry to persist
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConstitutionalDecisionRow, ConstitutionAmendmentRow, GovernanceSignalRow } from "@/lib/db/database-contract";
import {
  CONSTITUTIONAL_DECISION_SELECTABLE_COLUMNS,
  CONSTITUTION_AMENDMENT_SELECTABLE_COLUMNS,
  GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  GovernanceSignalType,
  GovernanceSignalSource,
  GovernanceSignalSeverity,
  GovernanceSignalEvidenceType,
} from "./types";
import {
  calculateSignalConfidence,
  deriveEvidenceStrength,
  deriveHistoricalFrequency,
  deriveContextAdjustment,
} from "./confidence-engine";
import { calculateSignalSeverity, durationDaysSince } from "./severity-engine";

// ─── Thresholds ───────────────────────────────────────────────────────────────

const APPROVAL_DELAY_THRESHOLD_DAYS    = 3;
const RATIFICATION_STALL_THRESHOLD_DAYS = 7;
const AMENDMENT_BACKLOG_THRESHOLD      = 3;

// ─── Candidate Type ───────────────────────────────────────────────────────────

export type DetectedSignalCandidate = {
  signalType: GovernanceSignalType;
  signalSource: GovernanceSignalSource;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  severity: GovernanceSignalSeverity;
  confidenceScore: number;
  evidence: Array<{
    evidenceType: GovernanceSignalEvidenceType;
    referenceEntityType: string;
    referenceEntityId: string;
    contributionWeight: number;
  }>;
};

// ─── Inline Row Shapes for uncontracted tables ────────────────────────────────

type AuthorityRow = {
  id: string;
  workspace_id: string;
  authority_type: string | null;
  authority_scope: string | null;
  status: string;
  valid_until: string | null;
  revoked_at: string | null;
  created_at: string;
};

type SignatureRequestRow = {
  id: string;
  workspace_id: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  created_at: string;
};

type ViolationRow = {
  id: string;
  workspace_id: string;
  violation_type: string | null;
  severity: string;
  created_at: string;
};

type EscalationRow = {
  id: string;
  workspace_id: string;
  violation_id: string | null;
  status: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// ─── Detection Rules ──────────────────────────────────────────────────────────

async function detectApprovalDelays(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const cols = CONSTITUTIONAL_DECISION_SELECTABLE_COLUMNS.join(",");
  const { data } = await supabase
    .from("constitutional_decisions")
    .select(cols)
    .eq("workspace_id", workspaceId)
    .in("status", ["proposed", "submitted"])
    .is("deleted_at", null);

  const decisions = (data ?? []) as unknown as ConstitutionalDecisionRow[];
  const candidates: DetectedSignalCandidate[] = [];

  for (const decision of decisions) {
    const days = durationDaysSince(decision.created_at);
    if (days < APPROVAL_DELAY_THRESHOLD_DAYS) continue;

    const dedupeKey = `approval_delay:${decision.id}`;
    if (existingSignalTypes.has(dedupeKey)) continue;

    const evidence = [
      {
        evidenceType: "decision_observation" as GovernanceSignalEvidenceType,
        referenceEntityType: "constitutional_decisions",
        referenceEntityId: decision.id,
        contributionWeight: 1.0,
      },
    ];

    const { score: confidenceScore } = calculateSignalConfidence({
      patternMatch: 0.90,
      evidenceStrength: deriveEvidenceStrength(evidence),
      historicalFrequency: deriveHistoricalFrequency(0),
      currentContext: deriveContextAdjustment({
        durationDays: days,
        isCriticalEntity: false,
        hasRelatedActiveSignals: false,
      }),
    });

    const severity = calculateSignalSeverity({
      signalType: "approval_delay",
      durationDays: days,
      hasHistoricalNegativeOutcome: false,
    });

    candidates.push({
      signalType: "approval_delay",
      signalSource: "decision",
      sourceEntityType: "constitutional_decisions",
      sourceEntityId: decision.id,
      title: `Approval delay: ${decision.title}`,
      description: `Decision "${decision.title}" has been awaiting approval for ${days} day(s) (threshold: ${APPROVAL_DELAY_THRESHOLD_DAYS} days). Status: ${decision.status}.`,
      severity,
      confidenceScore: round3(confidenceScore),
      evidence,
    });
  }

  return candidates;
}

async function detectAmendmentBacklog(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const cols = CONSTITUTION_AMENDMENT_SELECTABLE_COLUMNS.join(",");
  const { data } = await supabase
    .from("constitution_amendments")
    .select(cols)
    .eq("workspace_id", workspaceId)
    .in("status", ["proposed", "draft"])
    .is("deleted_at", null);

  const amendments = (data ?? []) as unknown as ConstitutionAmendmentRow[];
  if (amendments.length < AMENDMENT_BACKLOG_THRESHOLD) return [];

  if (existingSignalTypes.has("amendment_backlog:workspace")) return [];

  const evidence = amendments.map((a) => ({
    evidenceType: "amendment_observation" as GovernanceSignalEvidenceType,
    referenceEntityType: "constitution_amendments",
    referenceEntityId: a.id,
    contributionWeight: round3(1.0 / amendments.length),
  }));

  const { score: confidenceScore } = calculateSignalConfidence({
    patternMatch: 0.85,
    evidenceStrength: deriveEvidenceStrength(evidence),
    historicalFrequency: deriveHistoricalFrequency(0),
    currentContext: deriveContextAdjustment({
      durationDays: 0,
      isCriticalEntity: false,
      hasRelatedActiveSignals: false,
    }),
  });

  const severity = calculateSignalSeverity({
    signalType: "amendment_backlog",
    durationDays: 0,
    hasHistoricalNegativeOutcome: false,
    affectedEntityCount: amendments.length,
  });

  const anchorId = amendments[0].id;

  return [
    {
      signalType: "amendment_backlog",
      signalSource: "amendment",
      sourceEntityType: "constitution_amendments",
      sourceEntityId: anchorId,
      title: `Amendment backlog: ${amendments.length} pending amendments`,
      description: `${amendments.length} constitution amendment(s) are waiting for approval (threshold: ${AMENDMENT_BACKLOG_THRESHOLD}). This creates governance risk and may stall ratification downstream.`,
      severity,
      confidenceScore: round3(confidenceScore),
      evidence,
    },
  ];
}

async function detectGovernanceViolations(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const { data } = await supabase
    .from("governance_violations")
    .select("id,workspace_id,violation_type,severity,created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "open");

  const violations = (data ?? []) as unknown as ViolationRow[];
  const candidates: DetectedSignalCandidate[] = [];

  for (const violation of violations) {
    const dedupeKey = `governance_violation:${violation.id}`;
    if (existingSignalTypes.has(dedupeKey)) continue;

    const days = durationDaysSince(violation.created_at);
    const evidence = [
      {
        evidenceType: "violation_observation" as GovernanceSignalEvidenceType,
        referenceEntityType: "governance_violations",
        referenceEntityId: violation.id,
        contributionWeight: 1.0,
      },
    ];

    const { score: confidenceScore } = calculateSignalConfidence({
      patternMatch: 1.0,
      evidenceStrength: deriveEvidenceStrength(evidence),
      historicalFrequency: deriveHistoricalFrequency(1),
      currentContext: deriveContextAdjustment({
        durationDays: days,
        isCriticalEntity: true,
        hasRelatedActiveSignals: false,
      }),
    });

    candidates.push({
      signalType: "governance_violation",
      signalSource: "authority",
      sourceEntityType: "governance_violations",
      sourceEntityId: violation.id,
      title: `Unresolved governance violation: ${violation.violation_type ?? "unknown type"}`,
      description: `A governance violation (type: ${violation.violation_type ?? "unknown"}) has been open for ${days} day(s). Unresolved violations indicate active constitutional non-compliance.`,
      severity: "critical",
      confidenceScore: round3(confidenceScore),
      evidence,
    });
  }

  return candidates;
}

async function detectAuthorityGaps(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const { data } = await supabase
    .from("authority_registrations")
    .select("id,workspace_id,authority_type,authority_scope,status,valid_until,revoked_at,created_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["expired", "revoked"]);

  const authorities = (data ?? []) as unknown as AuthorityRow[];
  const candidates: DetectedSignalCandidate[] = [];

  for (const authority of authorities) {
    const dedupeKey = `authority_gap:${authority.id}`;
    if (existingSignalTypes.has(dedupeKey)) continue;

    const evidence = [
      {
        evidenceType: "authority_observation" as GovernanceSignalEvidenceType,
        referenceEntityType: "authority_registrations",
        referenceEntityId: authority.id,
        contributionWeight: 1.0,
      },
    ];

    const gapStart = authority.status === "revoked"
      ? (authority.revoked_at ?? authority.created_at)
      : (authority.valid_until ?? authority.created_at);
    const days = durationDaysSince(gapStart);
    const { score: confidenceScore } = calculateSignalConfidence({
      patternMatch: 0.88,
      evidenceStrength: deriveEvidenceStrength(evidence),
      historicalFrequency: deriveHistoricalFrequency(0),
      currentContext: deriveContextAdjustment({
        durationDays: days,
        isCriticalEntity: true,
        hasRelatedActiveSignals: false,
      }),
    });

    candidates.push({
      signalType: "authority_gap",
      signalSource: "authority",
      sourceEntityType: "authority_registrations",
      sourceEntityId: authority.id,
      title: `Authority gap: ${authority.authority_type ?? "unknown"} (${authority.status})`,
      description: `An authority registration (type: ${authority.authority_type ?? "unknown"}) has status "${authority.status}". This creates a governance gap where decisions cannot be legitimately authorized.`,
      severity: calculateSignalSeverity({
        signalType: "authority_gap",
        durationDays: days,
        hasHistoricalNegativeOutcome: false,
      }),
      confidenceScore: round3(confidenceScore),
      evidence,
    });
  }

  return candidates;
}

async function detectRatificationStalls(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const { data } = await supabase
    .from("constitutional_signature_requests")
    .select("id,workspace_id,entity_type,entity_id,status,created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending");

  const requests = (data ?? []) as unknown as SignatureRequestRow[];
  const candidates: DetectedSignalCandidate[] = [];

  for (const request of requests) {
    const days = durationDaysSince(request.created_at);
    if (days < RATIFICATION_STALL_THRESHOLD_DAYS) continue;

    const dedupeKey = `ratification_stall:${request.id}`;
    if (existingSignalTypes.has(dedupeKey)) continue;

    const evidence = [
      {
        evidenceType: "ratification_observation" as GovernanceSignalEvidenceType,
        referenceEntityType: "constitutional_signature_requests",
        referenceEntityId: request.id,
        contributionWeight: 1.0,
      },
    ];

    const { score: confidenceScore } = calculateSignalConfidence({
      patternMatch: 0.88,
      evidenceStrength: deriveEvidenceStrength(evidence),
      historicalFrequency: deriveHistoricalFrequency(0),
      currentContext: deriveContextAdjustment({
        durationDays: days,
        isCriticalEntity: false,
        hasRelatedActiveSignals: false,
      }),
    });

    candidates.push({
      signalType: "ratification_stall",
      signalSource: "ratification",
      sourceEntityType: "constitutional_signature_requests",
      sourceEntityId: request.id,
      title: `Ratification stall: signature request pending for ${days} day(s)`,
      description: `A constitutional signature request for "${request.entity_type ?? "entity"}" has been pending for ${days} day(s) (threshold: ${RATIFICATION_STALL_THRESHOLD_DAYS} days). Stalled ratification blocks legitimacy downstream.`,
      severity: calculateSignalSeverity({
        signalType: "ratification_stall",
        durationDays: days,
        hasHistoricalNegativeOutcome: false,
      }),
      confidenceScore: round3(confidenceScore),
      evidence,
    });
  }

  return candidates;
}

async function detectEscalationGaps(
  workspaceId: string,
  supabase: SupabaseClient,
  existingSignalTypes: Set<string>
): Promise<DetectedSignalCandidate[]> {
  const { data: violationData } = await supabase
    .from("governance_violations")
    .select("id,workspace_id,violation_type,severity,created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .in("severity", ["high", "critical"]);

  const { data: escalationData } = await supabase
    .from("authority_escalations")
    .select("id,workspace_id,violation_id,status")
    .eq("workspace_id", workspaceId)
    .not("violation_id", "is", null);

  const violations = (violationData ?? []) as unknown as ViolationRow[];
  const escalations = (escalationData ?? []) as unknown as EscalationRow[];

  const escalatedViolationIds = new Set<string>(
    escalations
      .filter((e) => e.violation_id != null)
      .map((e) => e.violation_id as string)
  );

  const candidates: DetectedSignalCandidate[] = [];

  for (const violation of violations) {
    if (escalatedViolationIds.has(violation.id)) continue;

    const dedupeKey = `escalation_gap:${violation.id}`;
    if (existingSignalTypes.has(dedupeKey)) continue;

    const days = durationDaysSince(violation.created_at);
    const evidence = [
      {
        evidenceType: "violation_observation" as GovernanceSignalEvidenceType,
        referenceEntityType: "governance_violations",
        referenceEntityId: violation.id,
        contributionWeight: 1.0,
      },
    ];

    const { score: confidenceScore } = calculateSignalConfidence({
      patternMatch: 0.85,
      evidenceStrength: deriveEvidenceStrength(evidence),
      historicalFrequency: deriveHistoricalFrequency(0),
      currentContext: deriveContextAdjustment({
        durationDays: days,
        isCriticalEntity: true,
        hasRelatedActiveSignals: false,
      }),
    });

    candidates.push({
      signalType: "escalation_gap",
      signalSource: "authority",
      sourceEntityType: "governance_violations",
      sourceEntityId: violation.id,
      title: `Escalation gap: high-severity violation without escalation`,
      description: `A ${violation.severity}-severity governance violation (type: ${violation.violation_type ?? "unknown"}) has been open for ${days} day(s) with no escalation recorded. Principle 4 requires escalation for critical governance events.`,
      severity: calculateSignalSeverity({
        signalType: "escalation_gap",
        durationDays: days,
        hasHistoricalNegativeOutcome: false,
      }),
      confidenceScore: round3(confidenceScore),
      evidence,
    });
  }

  return candidates;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function detectGovernanceSignals(workspaceId: string): Promise<DetectedSignalCandidate[]> {
  const supabase = await createSupabaseServerClient();

  const { data: existingData } = await supabase
    .from("governance_signals")
    .select(GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "acknowledged"]);

  const existingSignals = (existingData ?? []) as unknown as GovernanceSignalRow[];

  const existingSignalTypes = new Set<string>(
    existingSignals.map((s) => `${s.signal_type}:${s.source_entity_id}`)
  );
  if (existingSignals.some((s) => s.signal_type === "amendment_backlog")) {
    existingSignalTypes.add("amendment_backlog:workspace");
  }

  const [
    approvalDelays,
    amendmentBacklog,
    governanceViolations,
    authorityGaps,
    ratificationStalls,
    escalationGaps,
  ] = await Promise.all([
    detectApprovalDelays(workspaceId, supabase, existingSignalTypes),
    detectAmendmentBacklog(workspaceId, supabase, existingSignalTypes),
    detectGovernanceViolations(workspaceId, supabase, existingSignalTypes),
    detectAuthorityGaps(workspaceId, supabase, existingSignalTypes),
    detectRatificationStalls(workspaceId, supabase, existingSignalTypes),
    detectEscalationGaps(workspaceId, supabase, existingSignalTypes),
  ]);

  return [
    ...approvalDelays,
    ...amendmentBacklog,
    ...governanceViolations,
    ...authorityGaps,
    ...ratificationStalls,
    ...escalationGaps,
  ];
}
