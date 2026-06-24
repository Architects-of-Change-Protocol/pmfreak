// ─── PMO Governance Compliance — Operating Discipline Snapshot Service ─────────
//
// Derives a PMO operating-discipline compliance assessment from existing read
// aggregations: the PMO Command Center view and per-PM Operating Dossiers.
//
// This module READS from existing domain services. It does not recalculate
// capacity or performance, and it does not mutate any record. The only write it
// performs is emitting a platform event recording that a snapshot was generated.
// ─────────────────────────────────────────────────────────────────────────────

import { getPMOCommandCenter } from "@/lib/pmo-command-center";
import { listProjectManagers } from "@/lib/pm-registry";
import { getPMOperatingDossier } from "@/lib/pm-detail-intelligence";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import type { PMOCommandCenterView } from "@/lib/pmo-command-center";
import type { PMOperatingDossier } from "@/lib/pm-detail-intelligence";

import {
  CAPACITY_SNAPSHOT_FRESHNESS_DAYS,
  PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS,
  GOVERNANCE_COMPLIANCE_DOMAIN_WEIGHTS,
} from "./operating-discipline-types";
import type {
  AssessmentDomain,
  DomainAssessment,
  GeneratePMOGovernanceComplianceSnapshotInput,
  GovernanceComplianceRisk,
  GovernanceComplianceStatus,
  GovernanceEvidence,
  GovernanceRecommendation,
  GovernanceViolation,
  PMOGovernanceComplianceResult,
  PMOGovernanceComplianceSnapshot,
  ViolationSeverity,
  ViolationType,
} from "./operating-discipline-types";

// ─── Status / risk classification ─────────────────────────────────────────────

export function classifyComplianceStatus(score: number): GovernanceComplianceStatus {
  if (score >= 90) return "excellent";
  if (score >= 75) return "compliant";
  if (score >= 60) return "watch";
  if (score >= 40) return "non_compliant";
  return "critical";
}

export function classifyDomainStatus(score: number): GovernanceComplianceStatus {
  if (score >= 90) return "excellent";
  if (score >= 75) return "compliant";
  if (score >= 60) return "watch";
  if (score >= 40) return "non_compliant";
  return "critical";
}

export function classifyDomainRisk(score: number): GovernanceComplianceRisk {
  if (score >= 80) return "low";
  if (score >= 65) return "medium";
  if (score >= 45) return "high";
  return "critical";
}

export function deriveComplianceRisk(
  score: number,
  hasCriticalViolations: boolean,
  criticalOverride: boolean,
): GovernanceComplianceRisk {
  if (criticalOverride) return "critical";
  if (score < 45) return "critical";
  if (score >= 80 && !hasCriticalViolations) return "low";
  if (score >= 65) return "medium";
  if (score >= 45) return "high";
  return "critical";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<ViolationSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

const COUNTED_ASSIGNMENT_TYPES = new Set(["primary", "secondary", "program", "observer"]);

function isStale(generatedAt: string | null | undefined, freshnessDays: number, now: number): boolean {
  if (!generatedAt) return false;
  const t = new Date(generatedAt).getTime();
  if (Number.isNaN(t)) return false;
  const ageDays = (now - t) / (1000 * 60 * 60 * 24);
  return ageDays > freshnessDays;
}

function scoreFromViolations(violations: GovernanceViolation[]): number {
  let penalty = 0;
  for (const v of violations) penalty += SEVERITY_WEIGHT[v.severity];
  return Math.max(0, Math.min(100, 100 - penalty));
}

// ─── Violation detection ──────────────────────────────────────────────────────
//
// Each detector returns a list of violations for one domain across all dossiers.
// `view` is the PMO Command Center view (already aggregated); `dossiers` are the
// per-PM Operating Dossiers; `now` is the snapshot timestamp in ms.

export type DetectionContext = {
  dossiers: PMOperatingDossier[];
  view: PMOCommandCenterView | null;
  now: number;
  detectedAt: string;
};

let violationSeq = 0;
function nextViolationId(type: ViolationType): string {
  violationSeq += 1;
  return `viol_${type.toLowerCase()}_${violationSeq}`;
}

function makeViolation(
  type: ViolationType,
  severity: ViolationSeverity,
  domain: AssessmentDomain,
  message: string,
  recommendation: string,
  detectedAt: string,
  extra: Partial<GovernanceViolation> = {},
): GovernanceViolation {
  return {
    violation_id: nextViolationId(type),
    violation_type: type,
    severity,
    domain,
    message,
    recommendation,
    evidence: extra.evidence ?? {},
    detected_at: detectedAt,
    pm_id: extra.pm_id,
    pm_name: extra.pm_name,
    project_id: extra.project_id,
    project_name: extra.project_name,
  };
}

// ── PM profile completeness ──────────────────────────────────────────────────

export function detectProfileViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "pm_profile_completeness";
  for (const d of ctx.dossiers) {
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };
    if (!d.profile.present) {
      out.push(makeViolation("PM_PROFILE_MISSING", "high", D,
        `PM ${d.pm.display_name} has no governance profile.`,
        "Create a PM governance profile in the PM Registry.", ctx.detectedAt, { ...base, evidence: { pm_status: d.pm.status } }));
      continue;
    }
    if (!d.profile.role || String(d.profile.role).trim() === "") {
      out.push(makeViolation("PM_ROLE_MISSING", "medium", D,
        `PM ${d.pm.display_name} has no role defined.`,
        "Set the PM role in the governance profile.", ctx.detectedAt, base));
    }
    if (!d.profile.experience_level || String(d.profile.experience_level).trim() === "") {
      out.push(makeViolation("PM_EXPERIENCE_LEVEL_MISSING", "low", D,
        `PM ${d.pm.display_name} has no experience level.`,
        "Set the PM experience level in the governance profile.", ctx.detectedAt, base));
    }
    if (d.profile.active_projects_limit === null || d.profile.active_projects_limit === undefined) {
      out.push(makeViolation("PM_ACTIVE_PROJECTS_LIMIT_MISSING", "medium", D,
        `PM ${d.pm.display_name} has no active projects limit.`,
        "Set an active projects limit so capacity governance can apply.", ctx.detectedAt, base));
    }
  }
  return out;
}

// ── Assignment hygiene ───────────────────────────────────────────────────────

export function detectAssignmentViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "assignment_hygiene";
  const projectPrimaryCount = new Map<string, { name: string | null; count: number }>();

  for (const d of ctx.dossiers) {
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };
    const active = d.assignments.active;

    if (d.pm.status === "inactive" && active.length > 0) {
      out.push(makeViolation("INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS", "high", D,
        `Inactive PM ${d.pm.display_name} still holds ${active.length} active assignment(s).`,
        "Remove or reassign active assignments for inactive PMs.", ctx.detectedAt,
        { ...base, evidence: { active_assignment_count: active.length } }));
    }
    if (d.pm.status === "suspended" && active.length > 0) {
      out.push(makeViolation("SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS", "critical", D,
        `Suspended PM ${d.pm.display_name} still holds ${active.length} active assignment(s).`,
        "Immediately reassign work held by suspended PMs.", ctx.detectedAt,
        { ...base, evidence: { active_assignment_count: active.length } }));
    }
    if (d.pm.status === "active" && active.length === 0) {
      out.push(makeViolation("ACTIVE_PM_WITH_NO_ASSIGNMENTS", "low", D,
        `Active PM ${d.pm.display_name} has no assignments.`,
        "Assign work or move the PM to inactive if not staffed.", ctx.detectedAt, base));
    }

    for (const a of active) {
      if (!COUNTED_ASSIGNMENT_TYPES.has(a.assignment_type)) {
        out.push(makeViolation("INVALID_ASSIGNMENT_TYPE", "medium", D,
          `PM ${d.pm.display_name} has an assignment with invalid type "${a.assignment_type}".`,
          "Correct the assignment type to a recognized value.", ctx.detectedAt,
          { ...base, project_id: a.project_id, project_name: a.project_name ?? undefined,
            evidence: { assignment_type: a.assignment_type } }));
      }
      if (a.assignment_type === "observer" && a.capacity_counted) {
        out.push(makeViolation("OBSERVER_COUNTED_AS_CAPACITY", "medium", D,
          `Observer assignment for ${d.pm.display_name} is incorrectly counted toward capacity.`,
          "Observer assignments must not count toward capacity.", ctx.detectedAt,
          { ...base, project_id: a.project_id, project_name: a.project_name ?? undefined }));
      }
      if (a.assignment_type === "primary") {
        const entry = projectPrimaryCount.get(a.project_id) ?? { name: a.project_name, count: 0 };
        entry.count += 1;
        projectPrimaryCount.set(a.project_id, entry);
      }
    }

    for (const h of d.assignments.historical) {
      if (!h.removed_at) {
        out.push(makeViolation("HISTORICAL_ASSIGNMENT_MISSING_REMOVED_AT", "low", D,
          `Historical assignment for ${d.pm.display_name} is missing a removed_at timestamp.`,
          "Backfill removed_at on historical assignments for auditability.", ctx.detectedAt,
          { ...base, project_id: h.project_id, project_name: h.project_name ?? undefined }));
      }
    }
  }

  for (const [projectId, info] of projectPrimaryCount.entries()) {
    if (info.count > 1) {
      out.push(makeViolation("PROJECT_WITH_MULTIPLE_PRIMARY_PMS", "high", D,
        `Project ${info.name ?? projectId} has ${info.count} primary PMs.`,
        "A project must have exactly one primary PM.", ctx.detectedAt,
        { project_id: projectId, project_name: info.name ?? undefined,
          evidence: { primary_pm_count: info.count } }));
    }
  }

  return out;
}

// ── Capacity governance ──────────────────────────────────────────────────────

export function detectCapacityViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "capacity_governance";
  const attentionIds = new Set(
    (ctx.view?.attention_queues.capacity_attention ?? []).map((i) => i.pm_id),
  );

  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };

    if (!d.capacity.present) {
      out.push(makeViolation("CAPACITY_SNAPSHOT_MISSING", "high", D,
        `PM ${d.pm.display_name} has no capacity snapshot.`,
        "Generate a PM capacity snapshot.", ctx.detectedAt, base));
      continue;
    }

    if (isStale(d.capacity.generated_at, CAPACITY_SNAPSHOT_FRESHNESS_DAYS, ctx.now)) {
      out.push(makeViolation("CAPACITY_SNAPSHOT_STALE", "medium", D,
        `PM ${d.pm.display_name} has a stale capacity snapshot.`,
        `Regenerate capacity snapshot (older than ${CAPACITY_SNAPSHOT_FRESHNESS_DAYS} days).`, ctx.detectedAt,
        { ...base, evidence: { generated_at: d.capacity.generated_at } }));
    }

    const status = d.capacity.capacity_status;
    const hasRec = d.capacity.recommendations.length > 0;

    if (status === "near_capacity" && !hasRec) {
      out.push(makeViolation("NEAR_CAPACITY_WITHOUT_RECOMMENDATION", "low", D,
        `Near-capacity PM ${d.pm.display_name} has no capacity recommendation.`,
        "Provide a capacity recommendation for near-capacity PMs.", ctx.detectedAt, base));
    }
    if (status === "at_capacity" && !hasRec) {
      out.push(makeViolation("AT_CAPACITY_WITHOUT_RECOMMENDATION", "medium", D,
        `At-capacity PM ${d.pm.display_name} has no capacity recommendation.`,
        "Provide a capacity recommendation for at-capacity PMs.", ctx.detectedAt, base));
    }
    if ((status === "overloaded" || status === "critical") && !hasRec) {
      out.push(makeViolation("OVERLOADED_WITHOUT_RECOMMENDATION", "high", D,
        `Overloaded PM ${d.pm.display_name} has no capacity recommendation.`,
        "Overloaded PMs require a documented capacity recommendation.", ctx.detectedAt, base));
    }
    if ((status === "overloaded" || status === "critical") && !attentionIds.has(d.pm.pm_id)) {
      out.push(makeViolation("OVERLOADED_NOT_IN_ATTENTION_QUEUE", "high", D,
        `Overloaded PM ${d.pm.display_name} is not in the capacity attention queue.`,
        "Overloaded PMs must surface in the PMO attention queue.", ctx.detectedAt, base));
    }
  }

  return out;
}

// ── Performance governance ───────────────────────────────────────────────────

export function detectPerformanceViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "performance_governance";
  const attentionIds = new Set(
    (ctx.view?.attention_queues.performance_attention ?? []).map((i) => i.pm_id),
  );

  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };

    if (!d.performance.present) {
      out.push(makeViolation("PERFORMANCE_SNAPSHOT_MISSING", "high", D,
        `PM ${d.pm.display_name} has no performance snapshot.`,
        "Generate a PM performance snapshot.", ctx.detectedAt, base));
      continue;
    }

    if (isStale(d.performance.generated_at, PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS, ctx.now)) {
      out.push(makeViolation("PERFORMANCE_SNAPSHOT_STALE", "medium", D,
        `PM ${d.pm.display_name} has a stale performance snapshot.`,
        `Regenerate performance snapshot (older than ${PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS} days).`, ctx.detectedAt,
        { ...base, evidence: { generated_at: d.performance.generated_at } }));
    }

    const status = d.performance.performance_status;
    const risk = d.performance.performance_risk;
    const hasRec = d.performance.recommendations.length > 0;

    if (status === "warning" && !hasRec) {
      out.push(makeViolation("WARNING_PM_WITHOUT_RECOMMENDATION", "medium", D,
        `Warning-level PM ${d.pm.display_name} has no performance recommendation.`,
        "Provide a performance recommendation for warning-level PMs.", ctx.detectedAt, base));
    }
    if (status === "critical" && !hasRec) {
      out.push(makeViolation("CRITICAL_PM_WITHOUT_RECOMMENDATION", "high", D,
        `Critical-performance PM ${d.pm.display_name} has no performance recommendation.`,
        "Critical PMs require a documented performance recommendation.", ctx.detectedAt, base));
    }
    if ((risk === "high" || risk === "critical") && !attentionIds.has(d.pm.pm_id)) {
      out.push(makeViolation("HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE", "high", D,
        `High-risk PM ${d.pm.display_name} is not in the performance attention queue.`,
        "High-risk PMs must surface in the PMO attention queue.", ctx.detectedAt, base));
    }
    if (!risk || String(risk).trim() === "") {
      out.push(makeViolation("PERFORMANCE_RISK_MISSING", "low", D,
        `PM ${d.pm.display_name} performance snapshot has no risk classification.`,
        "Performance snapshots must record a risk classification.", ctx.detectedAt, base));
    }
  }

  return out;
}

// ── Evidence readiness ───────────────────────────────────────────────────────

export function detectEvidenceViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "evidence_readiness";

  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };
    const ev = d.evidence_confidence;

    if (!ev.present) {
      out.push(makeViolation("EVIDENCE_CONFIDENCE_MISSING", "medium", D,
        `PM ${d.pm.display_name} has no evidence confidence assessment.`,
        "Generate evidence confidence so performance scores can be trusted.", ctx.detectedAt, base));
      continue;
    }

    if (ev.evidence_completeness === null || ev.evidence_completeness === undefined) {
      out.push(makeViolation("EVIDENCE_COMPLETENESS_MISSING", "low", D,
        `PM ${d.pm.display_name} evidence confidence has no completeness score.`,
        "Record an evidence completeness score.", ctx.detectedAt, base));
    }
    if (!ev.confidence_level || String(ev.confidence_level).trim() === "") {
      out.push(makeViolation("CONFIDENCE_LEVEL_MISSING", "low", D,
        `PM ${d.pm.display_name} evidence confidence has no confidence level.`,
        "Record a confidence level (high / medium / low / very_low).", ctx.detectedAt, base));
    }
    if (!ev.score_interpretation || String(ev.score_interpretation).trim() === "") {
      out.push(makeViolation("SCORE_INTERPRETATION_MISSING", "low", D,
        `PM ${d.pm.display_name} evidence confidence has no score interpretation.`,
        "Record a score interpretation narrative.", ctx.detectedAt, base));
    }
    const lowConf = ev.confidence_level === "low" || ev.confidence_level === "very_low";
    if (lowConf && ev.confidence_recommendations.length === 0) {
      out.push(makeViolation("LOW_CONFIDENCE_WITHOUT_RECOMMENDATION", "medium", D,
        `Low-confidence PM ${d.pm.display_name} has no evidence recommendation.`,
        "Provide an evidence recommendation when confidence is low.", ctx.detectedAt, base));
    }
    if (ev.missing_source_count > 0 && (!ev.missing_sources || ev.missing_sources.length === 0)) {
      out.push(makeViolation("MISSING_SOURCES_NOT_RECORDED", "low", D,
        `PM ${d.pm.display_name} reports missing sources but does not enumerate them.`,
        "Enumerate the specific missing sources.", ctx.detectedAt, base));
    }
  }

  return out;
}

// ── Intervention readiness ───────────────────────────────────────────────────

export function detectInterventionViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "intervention_readiness";
  const criticalAttentionIds = new Set(
    (ctx.view?.attention_queues.critical_attention ?? []).map((i) => i.pm_id),
  );

  for (const d of ctx.dossiers) {
    if (d.pm.status !== "active") continue;
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };
    const es = d.executive_summary;
    const opStatus = es.operational_status;
    const hasTopRec = !!es.top_recommendation && String(es.top_recommendation).trim() !== "";

    if (opStatus === "critical" && !hasTopRec) {
      out.push(makeViolation("CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION", "critical", D,
        `Critical PM ${d.pm.display_name} has no top recommendation.`,
        "Every critical PM must carry a documented top recommendation.", ctx.detectedAt, base));
    }
    if (opStatus === "capacity_risk" && !hasTopRec) {
      out.push(makeViolation("CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION", "high", D,
        `Capacity-risk PM ${d.pm.display_name} has no top recommendation.`,
        "Capacity-risk PMs need a top recommendation for intervention.", ctx.detectedAt, base));
    }
    if (opStatus === "performance_risk" && !hasTopRec) {
      out.push(makeViolation("PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION", "high", D,
        `Performance-risk PM ${d.pm.display_name} has no top recommendation.`,
        "Performance-risk PMs need a top recommendation for intervention.", ctx.detectedAt, base));
    }
    if (opStatus === "insufficient_evidence" && !hasTopRec) {
      out.push(makeViolation("INSUFFICIENT_EVIDENCE_WITHOUT_RECOMMENDATION", "medium", D,
        `Insufficient-evidence PM ${d.pm.display_name} has no top recommendation.`,
        "Insufficient-evidence PMs need a remediation recommendation.", ctx.detectedAt, base));
    }

    const risky = opStatus === "critical" || opStatus === "capacity_risk" || opStatus === "performance_risk";
    if (risky && !criticalAttentionIds.has(d.pm.pm_id) && opStatus === "critical") {
      out.push(makeViolation("RISKY_PM_NOT_IN_ATTENTION_QUEUE", "high", D,
        `Critical PM ${d.pm.display_name} is not in the critical attention queue.`,
        "Critical PMs must surface in the critical attention queue.", ctx.detectedAt, base));
    }

    for (const rec of d.recommendations) {
      if (!rec.severity) {
        out.push(makeViolation("RECOMMENDATION_MISSING_SEVERITY", "low", D,
          `PM ${d.pm.display_name} has a recommendation with no severity.`,
          "Every recommendation must carry a severity.", ctx.detectedAt, base));
      }
      if (!rec.source) {
        out.push(makeViolation("RECOMMENDATION_MISSING_SOURCE", "low", D,
          `PM ${d.pm.display_name} has a recommendation with no source.`,
          "Every recommendation must declare its source.", ctx.detectedAt, base));
      }
    }
  }

  return out;
}

// ── Dossier completeness ─────────────────────────────────────────────────────

export function detectDossierViolations(ctx: DetectionContext): GovernanceViolation[] {
  const out: GovernanceViolation[] = [];
  const D: AssessmentDomain = "dossier_completeness";

  for (const d of ctx.dossiers) {
    const base = { pm_id: d.pm.pm_id, pm_name: d.pm.display_name };
    if (!d.pm || !d.pm.pm_id) {
      out.push(makeViolation("DOSSIER_IDENTITY_MISSING", "high", D,
        `A PM dossier is missing identity information.`,
        "Dossiers must carry identity.", ctx.detectedAt, base));
    }
    if (!d.profile) {
      out.push(makeViolation("DOSSIER_PROFILE_SECTION_MISSING", "medium", D,
        `Dossier for ${d.pm.display_name} is missing its profile section.`,
        "Dossiers must include a profile section.", ctx.detectedAt, base));
    }
    if (!d.assignments) {
      out.push(makeViolation("DOSSIER_ASSIGNMENTS_MISSING", "medium", D,
        `Dossier for ${d.pm.display_name} is missing its assignments section.`,
        "Dossiers must include an assignments section.", ctx.detectedAt, base));
    }
    if (!d.capacity) {
      out.push(makeViolation("DOSSIER_CAPACITY_SECTION_MISSING", "medium", D,
        `Dossier for ${d.pm.display_name} is missing its capacity section.`,
        "Dossiers must include a capacity section.", ctx.detectedAt, base));
    }
    if (!d.performance) {
      out.push(makeViolation("DOSSIER_PERFORMANCE_SECTION_MISSING", "medium", D,
        `Dossier for ${d.pm.display_name} is missing its performance section.`,
        "Dossiers must include a performance section.", ctx.detectedAt, base));
    }
    if (!d.evidence_confidence) {
      out.push(makeViolation("DOSSIER_EVIDENCE_SECTION_MISSING", "medium", D,
        `Dossier for ${d.pm.display_name} is missing its evidence section.`,
        "Dossiers must include an evidence section.", ctx.detectedAt, base));
    }
    if (!d.recommendations) {
      out.push(makeViolation("DOSSIER_RECOMMENDATIONS_MISSING", "low", D,
        `Dossier for ${d.pm.display_name} is missing its recommendations section.`,
        "Dossiers must include a recommendations section.", ctx.detectedAt, base));
    }
    if (!d.event_timeline) {
      out.push(makeViolation("DOSSIER_EVENT_TIMELINE_MISSING", "low", D,
        `Dossier for ${d.pm.display_name} is missing its event timeline.`,
        "Dossiers must include an event timeline.", ctx.detectedAt, base));
    }
  }

  return out;
}

// ─── Recommendation builder ───────────────────────────────────────────────────

const SEVERITY_ORDER: Record<ViolationSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function buildRecommendations(violations: GovernanceViolation[]): GovernanceRecommendation[] {
  // Group by domain + violation_type → one recommendation per group.
  const groups = new Map<string, { domain: AssessmentDomain; severity: ViolationSeverity; types: Set<ViolationType>; sample: GovernanceViolation; count: number }>();
  for (const v of violations) {
    const key = `${v.domain}::${v.violation_type}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.types.add(v.violation_type);
      if (SEVERITY_ORDER[v.severity] < SEVERITY_ORDER[existing.severity]) existing.severity = v.severity;
    } else {
      groups.set(key, { domain: v.domain, severity: v.severity, types: new Set([v.violation_type]), sample: v, count: 1 });
    }
  }

  const recs: GovernanceRecommendation[] = [];
  for (const g of groups.values()) {
    const plural = g.count > 1 ? `${g.count} occurrences` : "1 occurrence";
    recs.push({
      type: g.sample.violation_type,
      severity: g.severity,
      domain: g.domain,
      message: `${g.sample.recommendation} (${plural})`,
      source: "pmo_governance_compliance",
      related_violation_types: Array.from(g.types),
    });
  }

  recs.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return recs;
}

// ─── Domain assessment builder ────────────────────────────────────────────────

export function buildDomainAssessment(
  violations: GovernanceViolation[],
  evidence: Record<string, unknown>,
): DomainAssessment {
  const score = scoreFromViolations(violations);
  return {
    score,
    status: classifyDomainStatus(score),
    risk: classifyDomainRisk(score),
    violations_count: violations.length,
    evidence,
    recommendations: buildRecommendations(violations),
  };
}

// ─── Critical override ────────────────────────────────────────────────────────

export function evaluateCriticalOverride(
  dossiers: PMOperatingDossier[],
  view: PMOCommandCenterView | null,
): { triggered: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const active = dossiers.filter((d) => d.pm.status === "active");
  const activeCount = active.length;

  // 1+ overloaded active PMs with no governance recommendation
  const overloadedNoRec = active.filter(
    (d) => d.capacity.present &&
      (d.capacity.capacity_status === "overloaded" || d.capacity.capacity_status === "critical") &&
      d.capacity.recommendations.length === 0,
  );
  if (overloadedNoRec.length > 0) {
    reasons.push(`${overloadedNoRec.length} overloaded active PM(s) have no governance recommendation.`);
  }

  // 1+ critical PMs with no performance snapshot
  const criticalNoPerf = active.filter(
    (d) => d.executive_summary.operational_status === "critical" && !d.performance.present,
  );
  if (criticalNoPerf.length > 0) {
    reasons.push(`${criticalNoPerf.length} critical PM(s) have no performance snapshot.`);
  }

  if (activeCount > 0) {
    const missingCap = active.filter((d) => !d.capacity.present).length;
    if (missingCap / activeCount > 0.4) {
      reasons.push(`More than 40% of active PMs (${missingCap}/${activeCount}) are missing capacity snapshots.`);
    }
    const missingPerf = active.filter((d) => !d.performance.present).length;
    if (missingPerf / activeCount > 0.4) {
      reasons.push(`More than 40% of active PMs (${missingPerf}/${activeCount}) are missing performance snapshots.`);
    }
    const lowConf = active.filter(
      (d) => d.evidence_confidence.present &&
        (d.evidence_confidence.confidence_level === "low" || d.evidence_confidence.confidence_level === "very_low"),
    ).length;
    if (lowConf / activeCount > 0.5) {
      reasons.push(`More than 50% of active PMs (${lowConf}/${activeCount}) have low or very low evidence confidence.`);
    }
  }

  return { triggered: reasons.length > 0, reasons };
}

// ─── Snapshot assembly (pure) ─────────────────────────────────────────────────

export function assembleSnapshot(
  workspaceId: string,
  dossiers: PMOperatingDossier[],
  view: PMOCommandCenterView | null,
  generatedAt: string,
): PMOGovernanceComplianceSnapshot {
  violationSeq = 0;
  const now = new Date(generatedAt).getTime();
  const ctx: DetectionContext = { dossiers, view, now, detectedAt: generatedAt };

  const profileV = detectProfileViolations(ctx);
  const assignmentV = detectAssignmentViolations(ctx);
  const capacityV = detectCapacityViolations(ctx);
  const performanceV = detectPerformanceViolations(ctx);
  const evidenceV = detectEvidenceViolations(ctx);
  const interventionV = detectInterventionViolations(ctx);
  const dossierV = detectDossierViolations(ctx);

  const active = dossiers.filter((d) => d.pm.status === "active");
  const capPresent = dossiers.filter((d) => d.capacity.present).length;
  const perfPresent = dossiers.filter((d) => d.performance.present).length;
  const evPresent = dossiers.filter((d) => d.evidence_confidence.present).length;

  const assessments = {
    pm_profile_completeness: buildDomainAssessment(profileV, { evaluated: dossiers.length }),
    assignment_hygiene: buildDomainAssessment(assignmentV, { evaluated: dossiers.length }),
    capacity_governance: buildDomainAssessment(capacityV, { active_evaluated: active.length, snapshots_present: capPresent }),
    performance_governance: buildDomainAssessment(performanceV, { active_evaluated: active.length, snapshots_present: perfPresent }),
    evidence_readiness: buildDomainAssessment(evidenceV, { active_evaluated: active.length, confidence_present: evPresent }),
    intervention_readiness: buildDomainAssessment(interventionV, { active_evaluated: active.length }),
    dossier_completeness: buildDomainAssessment(dossierV, { evaluated: dossiers.length }),
  };

  // Weighted compliance score (dossier_completeness is unweighted/diagnostic).
  const W = GOVERNANCE_COMPLIANCE_DOMAIN_WEIGHTS;
  const weightedScore =
    assessments.pm_profile_completeness.score * W.pm_profile_completeness +
    assessments.assignment_hygiene.score * W.assignment_hygiene +
    assessments.capacity_governance.score * W.capacity_governance +
    assessments.performance_governance.score * W.performance_governance +
    assessments.evidence_readiness.score * W.evidence_readiness +
    assessments.intervention_readiness.score * W.intervention_readiness;

  const allViolations = [
    ...profileV, ...assignmentV, ...capacityV, ...performanceV, ...evidenceV, ...interventionV, ...dossierV,
  ];

  const override = evaluateCriticalOverride(dossiers, view);

  const baseScore = Math.round(weightedScore * 10) / 10;
  const complianceScore = override.triggered ? Math.min(baseScore, 39) : baseScore;

  const hasCritical = allViolations.some((v) => v.severity === "critical");
  const complianceStatus = override.triggered ? "critical" : classifyComplianceStatus(complianceScore);
  const complianceRisk = deriveComplianceRisk(complianceScore, hasCritical, override.triggered);

  const summary = {
    total_violations: allViolations.length,
    critical_violations: allViolations.filter((v) => v.severity === "critical").length,
    high_violations: allViolations.filter((v) => v.severity === "high").length,
    medium_violations: allViolations.filter((v) => v.severity === "medium").length,
    low_violations: allViolations.filter((v) => v.severity === "low").length,
    active_pms_evaluated: active.length,
    critical_override_triggered: override.triggered,
    critical_override_reasons: override.reasons,
  };

  const evidence: GovernanceEvidence = {
    source: "pmo_governance_compliance",
    generated_from: {
      pmo_command_center: view !== null,
      pm_operating_dossiers: dossiers.length > 0,
      pm_registry: true,
      pm_capacity: capPresent > 0,
      pm_performance: perfPresent > 0,
      platform_events: view !== null,
    },
    counts: {
      total_pms: dossiers.length,
      active_pms: active.length,
      pm_dossiers_evaluated: dossiers.length,
      capacity_snapshots_present: capPresent,
      performance_snapshots_present: perfPresent,
      evidence_confidence_present: evPresent,
      violations_detected: allViolations.length,
    },
    freshness: {
      capacity_snapshot_freshness_days: CAPACITY_SNAPSHOT_FRESHNESS_DAYS,
      performance_snapshot_freshness_days: PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS,
    },
  };

  const recommendations = buildRecommendations(allViolations);

  return {
    workspace_id: workspaceId,
    snapshot_id: `pmo_gov_compliance_${now}`,
    generated_at: generatedAt,
    compliance_score: complianceScore,
    compliance_status: complianceStatus,
    compliance_risk: complianceRisk,
    summary,
    assessments,
    violations: allViolations,
    recommendations,
    evidence,
    source: "pmo_governance_compliance",
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function listWorkspaceDossiers(workspaceId: string, actorId?: string): Promise<PMOperatingDossier[]> {
  const listResult = await listProjectManagers(workspaceId);
  if (!listResult.ok) return [];

  const settled = await Promise.allSettled(
    listResult.data.map((pm) => getPMOperatingDossier({ workspaceId, pmId: pm.id, actorId })),
  );

  const dossiers: PMOperatingDossier[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.ok) dossiers.push(r.value.data);
  }
  return dossiers;
}

// ─── Main service function ────────────────────────────────────────────────────

export async function generatePMOGovernanceComplianceSnapshot(
  input: GeneratePMOGovernanceComplianceSnapshotInput,
): Promise<PMOGovernanceComplianceResult<PMOGovernanceComplianceSnapshot>> {
  const { workspaceId, actorId } = input;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_GOVERNANCE_COMPLIANCE_WORKSPACE_REQUIRED" };
  }

  try {
    const generatedAt = input.generatedAt ?? new Date().toISOString();

    const dossiers = await listWorkspaceDossiers(workspaceId, actorId);

    let view: PMOCommandCenterView | null = null;
    const viewResult = await getPMOCommandCenter({ workspaceId, actorId });
    if (viewResult.ok) view = viewResult.data;

    const snapshot = assembleSnapshot(workspaceId, dossiers, view, generatedAt);

    try {
      await createPlatformEvent({
        workspaceId,
        projectId: null,
        actorId: actorId ?? null,
        actorType: actorId ? "user" : "system",
        eventType: "PMO_GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED",
        eventCategory: "governance",
        source: actorId ? "user_action" : "system",
        correlationId: snapshot.snapshot_id,
        eventPayload: {
          snapshot_id: snapshot.snapshot_id,
          compliance_score: snapshot.compliance_score,
          compliance_status: snapshot.compliance_status,
          compliance_risk: snapshot.compliance_risk,
          total_violations: snapshot.summary.total_violations,
          critical_violations: snapshot.summary.critical_violations,
          active_pms_evaluated: snapshot.summary.active_pms_evaluated,
          critical_override_triggered: snapshot.summary.critical_override_triggered,
          generated_at: snapshot.generated_at,
          source: "pmo_governance_compliance",
        },
      });
    } catch (eventError) {
      const msg = eventError instanceof Error ? eventError.message : String(eventError);
      console.error("pmo_governance_compliance.event.failed", { workspaceId, error: msg });
    }

    return { ok: true, data: snapshot };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pmo_governance_compliance.failed", { workspaceId, error: msg });
    return { ok: false, error: "Failed to build PMO Governance Compliance snapshot.", failureClass: "PMO_GOVERNANCE_COMPLIANCE_FAILED" };
  }
}
