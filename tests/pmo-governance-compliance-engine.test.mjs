import assert from "node:assert/strict";
import { test, describe } from "node:test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function isoNow(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ─── Constants (mirrors src/lib/pmo-governance-compliance/types.ts) ──────────

const GOVERNANCE_COMPLIANCE_WEIGHTS = {
  constitution:  0.15,
  authority:     0.20,
  ratification:  0.15,
  decision:      0.20,
  execution:     0.20,
  learning:      0.10,
};

const GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS = {
  compliant: 80,
  warning:   60,
};

// ─── Pure engine implementations (mirrors src/lib/pmo-governance-compliance/engines/) ──

function calculateConstitutionCompliance({ constitutionCount, constitutionsWithValidLifecycle, constitutionsWithAmendments, completeConstitutionCount }) {
  if (constitutionCount === 0) return 75;
  const lifecycleRate    = constitutionsWithValidLifecycle / constitutionCount;
  const amendmentRate    = constitutionsWithAmendments    / constitutionCount;
  const completenessRate = completeConstitutionCount      / constitutionCount;
  return Math.max(0, Math.min(100, Math.round(
    lifecycleRate    * 0.30 * 100 +
    amendmentRate    * 0.20 * 100 +
    completenessRate * 0.50 * 100
  )));
}

function calculateAuthorityCompliance({ totalAuthorities, expiredAuthorities, revokedAuthorities, invalidDelegations, unauthorizedActionCount }) {
  if (totalAuthorities === 0) return 75;
  const expiredPenalty      = Math.min(expiredAuthorities    * 5,  30);
  const revokedPenalty      = Math.min(revokedAuthorities    * 3,  20);
  const delegationPenalty   = Math.min(invalidDelegations    * 8,  30);
  const unauthorizedPenalty = Math.min(unauthorizedActionCount * 10, 40);
  return Math.max(0, Math.min(100, Math.round(100 - expiredPenalty - revokedPenalty - delegationPenalty - unauthorizedPenalty)));
}

function calculateRatificationCompliance({ totalRatifications, pendingRatifications, expiredRatifications, missingRatificationCount }) {
  if (totalRatifications === 0 && missingRatificationCount === 0) return 75;
  const pendingPenalty  = Math.min(pendingRatifications    * 4,  30);
  const expiredPenalty  = Math.min(expiredRatifications    * 8,  35);
  const missingPenalty  = Math.min(missingRatificationCount * 10, 40);
  return Math.max(0, Math.min(100, Math.round(100 - pendingPenalty - expiredPenalty - missingPenalty)));
}

function calculateDecisionCompliance({ totalDecisions, decisionsWithLineage, decisionsWithAuthority, decisionsWithOutcome, decisionsWithAccountability }) {
  if (totalDecisions === 0) return 75;
  const lineageRate        = decisionsWithLineage        / totalDecisions;
  const authorityRate      = decisionsWithAuthority      / totalDecisions;
  const outcomeRate        = decisionsWithOutcome        / totalDecisions;
  const accountabilityRate = decisionsWithAccountability / totalDecisions;
  return Math.max(0, Math.min(100, Math.round(
    lineageRate        * 0.25 * 100 +
    authorityRate      * 0.30 * 100 +
    outcomeRate        * 0.25 * 100 +
    accountabilityRate * 0.20 * 100
  )));
}

function calculateExecutionCompliance({ totalCommitments, completedCommitments, driftCount, validatedRealities, totalRealities, integrityViolations }) {
  const hasCommitments = totalCommitments > 0;
  const hasRealities   = totalRealities   > 0;
  if (!hasCommitments && !hasRealities) return 75;
  const completionRate  = hasCommitments ? completedCommitments / totalCommitments : 0.75;
  const realityRate     = hasRealities   ? validatedRealities   / totalRealities   : 0.75;
  const driftPenalty     = Math.min(driftCount          * 5,  30);
  const integrityPenalty = Math.min(integrityViolations * 10, 40);
  const base = completionRate * 0.35 * 100 + realityRate * 0.35 * 100 + (1 - 0.35 - 0.35) * 100;
  return Math.max(0, Math.min(100, Math.round(base - driftPenalty - integrityPenalty)));
}

function calculateLearningCompliance({ totalMemories, digestCount, learningCount, recommendationsWithTrace, totalRecommendations }) {
  if (totalMemories === 0 && totalRecommendations === 0) return 75;
  const memoryPresence = totalMemories        > 0 ? 1.0 : 0.0;
  const digestRate     = totalMemories        > 0 ? Math.min(digestCount   / totalMemories, 1.0) : 0.75;
  const learningRate   = totalMemories        > 0 ? Math.min(learningCount / totalMemories, 1.0) : 0.75;
  const traceRate      = totalRecommendations > 0 ? recommendationsWithTrace / totalRecommendations : 0.75;
  return Math.max(0, Math.min(100, Math.round(
    memoryPresence * 0.30 * 100 +
    digestRate     * 0.30 * 100 +
    learningRate   * 0.20 * 100 +
    traceRate      * 0.20 * 100
  )));
}

function calculateOverallCompliance(scores) {
  const w = GOVERNANCE_COMPLIANCE_WEIGHTS;
  return Math.max(0, Math.min(100, Math.round(
    scores.constitution  * w.constitution  +
    scores.authority     * w.authority     +
    scores.ratification  * w.ratification  +
    scores.decision      * w.decision      +
    scores.execution     * w.execution     +
    scores.learning      * w.learning
  )));
}

function classifyGovernanceComplianceStatus(score) {
  if (score >= GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.compliant) return "compliant";
  if (score >= GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}

function detectGovernanceGaps({ constitution, authority, ratification, decision, execution, learning }) {
  const gaps = [];

  // Constitution
  if (constitution.constitutionCount === 0) {
    gaps.push({ domain: "constitution", gapType: "missing_constitution", severity: "critical", description: "No project constitutions found.", evidenceCount: 0 });
  } else {
    const incomplete = constitution.constitutionCount - constitution.completeConstitutionCount;
    if (incomplete > 0) {
      gaps.push({ domain: "constitution", gapType: "incomplete_constitution", severity: incomplete >= constitution.constitutionCount * 0.5 ? "high" : "medium", description: `${incomplete} constitution(s) are incomplete.`, evidenceCount: incomplete });
    }
    const invalidLifecycle = constitution.constitutionCount - constitution.constitutionsWithValidLifecycle;
    if (invalidLifecycle > 0) {
      gaps.push({ domain: "constitution", gapType: "invalid_lifecycle", severity: "medium", description: `${invalidLifecycle} constitution(s) have invalid lifecycle.`, evidenceCount: invalidLifecycle });
    }
  }

  // Authority
  if (authority.totalAuthorities === 0) {
    gaps.push({ domain: "authority", gapType: "missing_authority", severity: "high", description: "No authority assignments found.", evidenceCount: 0 });
  } else {
    if (authority.expiredAuthorities > 0)
      gaps.push({ domain: "authority", gapType: "expired_authority", severity: authority.expiredAuthorities >= 3 ? "high" : "medium", description: `${authority.expiredAuthorities} authority assignment(s) expired.`, evidenceCount: authority.expiredAuthorities });
    if (authority.revokedAuthorities > 0)
      gaps.push({ domain: "authority", gapType: "revoked_authority", severity: "low", description: `${authority.revokedAuthorities} authority assignment(s) revoked.`, evidenceCount: authority.revokedAuthorities });
    if (authority.invalidDelegations > 0)
      gaps.push({ domain: "authority", gapType: "invalid_delegation", severity: "high", description: `${authority.invalidDelegations} invalid delegation(s).`, evidenceCount: authority.invalidDelegations });
    if (authority.unauthorizedActionCount > 0)
      gaps.push({ domain: "authority", gapType: "unauthorized_action", severity: "critical", description: `${authority.unauthorizedActionCount} unauthorized action(s).`, evidenceCount: authority.unauthorizedActionCount });
  }

  // Ratification
  if (ratification.missingRatificationCount > 0)
    gaps.push({ domain: "ratification", gapType: "missing_ratification", severity: ratification.missingRatificationCount >= 3 ? "critical" : "high", description: `${ratification.missingRatificationCount} missing ratification(s).`, evidenceCount: ratification.missingRatificationCount });
  if (ratification.pendingRatifications > 0)
    gaps.push({ domain: "ratification", gapType: "pending_ratification", severity: ratification.pendingRatifications >= 5 ? "high" : "medium", description: `${ratification.pendingRatifications} pending ratification(s).`, evidenceCount: ratification.pendingRatifications });
  if (ratification.expiredRatifications > 0)
    gaps.push({ domain: "ratification", gapType: "expired_ratification", severity: "high", description: `${ratification.expiredRatifications} expired ratification(s).`, evidenceCount: ratification.expiredRatifications });

  // Decision
  if (decision.totalDecisions > 0) {
    const noAuthority      = decision.totalDecisions - decision.decisionsWithAuthority;
    const noLineage        = decision.totalDecisions - decision.decisionsWithLineage;
    const noAccountability = decision.totalDecisions - decision.decisionsWithAccountability;
    if (noAuthority > 0)
      gaps.push({ domain: "decision", gapType: "decision_without_authority", severity: noAuthority >= 3 ? "critical" : "high", description: `${noAuthority} decision(s) lack authority.`, evidenceCount: noAuthority });
    if (noLineage > 0)
      gaps.push({ domain: "decision", gapType: "decision_without_lineage", severity: "medium", description: `${noLineage} decision(s) lack lineage.`, evidenceCount: noLineage });
    if (noAccountability > 0)
      gaps.push({ domain: "decision", gapType: "decision_without_accountability", severity: "medium", description: `${noAccountability} decision(s) lack accountability.`, evidenceCount: noAccountability });
  }

  // Execution
  if (execution.driftCount > 0)
    gaps.push({ domain: "execution", gapType: "execution_drift", severity: execution.driftCount >= 5 ? "high" : execution.driftCount >= 2 ? "medium" : "low", description: `${execution.driftCount} commitment(s) drifted.`, evidenceCount: execution.driftCount });
  if (execution.integrityViolations > 0)
    gaps.push({ domain: "execution", gapType: "projection_integrity_violation", severity: "high", description: `${execution.integrityViolations} integrity violation(s).`, evidenceCount: execution.integrityViolations });
  if (execution.totalRealities > 0 && execution.validatedRealities < execution.totalRealities) {
    const unvalidated = execution.totalRealities - execution.validatedRealities;
    gaps.push({ domain: "execution", gapType: "unvalidated_reality", severity: "medium", description: `${unvalidated} unvalidated realit(ies).`, evidenceCount: unvalidated });
  }

  // Learning
  if (learning.totalMemories === 0) {
    gaps.push({ domain: "learning", gapType: "missing_memory", severity: "medium", description: "No operational memory found.", evidenceCount: 0 });
  } else {
    if (learning.digestCount === 0)
      gaps.push({ domain: "learning", gapType: "missing_digest", severity: "medium", description: "No digests generated.", evidenceCount: learning.totalMemories });
    if (learning.learningCount === 0)
      gaps.push({ domain: "learning", gapType: "missing_learning", severity: "medium", description: "No learning records.", evidenceCount: learning.digestCount });
  }
  if (learning.totalRecommendations > 0 && learning.recommendationsWithTrace < learning.totalRecommendations) {
    const untraced = learning.totalRecommendations - learning.recommendationsWithTrace;
    gaps.push({ domain: "learning", gapType: "untraced_recommendation", severity: "low", description: `${untraced} untraced recommendation(s).`, evidenceCount: untraced });
  }

  return gaps;
}

function calculateGovernanceDebt(gaps) {
  const debt = { low: 0, medium: 0, high: 0, critical: 0, total: 0 };
  for (const gap of gaps) {
    debt[gap.severity]++;
    debt.total++;
  }
  return debt;
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function identifyGovernanceHotspots(gaps) {
  const byDomain = new Map();
  for (const gap of gaps) {
    const existing = byDomain.get(gap.domain) ?? [];
    existing.push(gap);
    byDomain.set(gap.domain, existing);
  }
  const hotspots = [];
  for (const [domain, domainGaps] of byDomain) {
    const dominantSeverity = SEVERITY_ORDER.find((s) => domainGaps.some((g) => g.severity === s)) ?? "low";
    hotspots.push({ domain, gapCount: domainGaps.length, dominantSeverity });
  }
  return hotspots.sort((a, b) => {
    const aSev = SEVERITY_ORDER.indexOf(a.dominantSeverity);
    const bSev = SEVERITY_ORDER.indexOf(b.dominantSeverity);
    if (aSev !== bSev) return aSev - bSev;
    return b.gapCount - a.gapCount;
  });
}

// ─── In-memory compliance store ───────────────────────────────────────────────

function createComplianceStore() {
  const pms         = new Map();
  const assignments = new Map();
  const snapshots   = new Map();
  const gaps        = new Map();
  const evidence    = new Map();
  const auditLog    = [];

  function validation(error)        { return { ok: false, error, failureClass: "validation" }; }
  function notFound(r = "Resource") { return { ok: false, error: `${r} not found.`, failureClass: "not_found" }; }

  function emitEvent(type, payload) {
    auditLog.push({ type, payload, occurred_at: isoNow() });
  }

  function registerPM(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId required.");
    if (!input.displayName?.trim())    return validation("displayName required.");
    if (!input.email?.trim())          return validation("email required.");
    const id  = uuid();
    const now = isoNow();
    const pm  = { id, workspace_id: input.workspaceId, display_name: input.displayName, email: input.email, status: "active", created_at: now, updated_at: now };
    pms.set(id, pm);
    return { ok: true, data: pm };
  }

  function assignProject(input) {
    if (!validUuid(input.pmId) || !validUuid(input.projectId)) return validation("ids required.");
    const id     = uuid();
    const record = { id, workspace_id: input.workspaceId, pm_id: input.pmId, project_id: input.projectId, assigned_at: isoNow(), removed_at: null };
    assignments.set(id, record);
    return { ok: true, data: record };
  }

  function generateSnapshot(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const activeAssignments = [...assignments.values()].filter(
      (a) => a.workspace_id === input.workspaceId && a.pm_id === input.pmId && a.removed_at === null
    );
    if (activeAssignments.length === 0) {
      return validation("Cannot generate a compliance snapshot for a PM with no active assignments.");
    }

    const constitutionInput = input._constitution ?? { constitutionCount: 0, constitutionsWithValidLifecycle: 0, constitutionsWithAmendments: 0, completeConstitutionCount: 0 };
    const authorityInput    = input._authority    ?? { totalAuthorities: 0, expiredAuthorities: 0, revokedAuthorities: 0, invalidDelegations: 0, unauthorizedActionCount: 0 };
    const ratificationInput = input._ratification ?? { totalRatifications: 0, pendingRatifications: 0, expiredRatifications: 0, missingRatificationCount: 0 };
    const decisionInput     = input._decision     ?? { totalDecisions: 0, decisionsWithLineage: 0, decisionsWithAuthority: 0, decisionsWithOutcome: 0, decisionsWithAccountability: 0 };
    const executionInput    = input._execution    ?? { totalCommitments: 0, completedCommitments: 0, driftCount: 0, validatedRealities: 0, totalRealities: 0, integrityViolations: 0 };
    const learningInput     = input._learning     ?? { totalMemories: 0, digestCount: 0, learningCount: 0, recommendationsWithTrace: 0, totalRecommendations: 0 };

    const constitutionScore  = calculateConstitutionCompliance(constitutionInput);
    const authorityScore     = calculateAuthorityCompliance(authorityInput);
    const ratificationScore  = calculateRatificationCompliance(ratificationInput);
    const decisionScore      = calculateDecisionCompliance(decisionInput);
    const executionScore     = calculateExecutionCompliance(executionInput);
    const learningScore      = calculateLearningCompliance(learningInput);
    const overallScore       = calculateOverallCompliance({ constitution: constitutionScore, authority: authorityScore, ratification: ratificationScore, decision: decisionScore, execution: executionScore, learning: learningScore });
    const complianceStatus   = classifyGovernanceComplianceStatus(overallScore);

    const detectedGaps = detectGovernanceGaps({ constitution: constitutionInput, authority: authorityInput, ratification: ratificationInput, decision: decisionInput, execution: executionInput, learning: learningInput });

    const snapshotId = uuid();
    const snap = {
      id: snapshotId, workspace_id: input.workspaceId, pm_id: input.pmId,
      constitution_score: constitutionScore, authority_score: authorityScore,
      ratification_score: ratificationScore, decision_score: decisionScore,
      execution_score: executionScore, learning_score: learningScore,
      overall_score: overallScore, compliance_status: complianceStatus,
      snapshot_payload: {}, generated_at: isoNow(), created_at: isoNow(), updated_at: isoNow(),
    };
    snapshots.set(snapshotId, snap);

    const snapGaps = detectedGaps.map((g) => ({ id: uuid(), workspace_id: input.workspaceId, snapshot_id: snapshotId, ...g, gap_type: g.gapType, evidence_count: g.evidenceCount, detected_at: isoNow(), created_at: isoNow() }));
    gaps.set(snapshotId, snapGaps);

    emitEvent("GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED", { pm_id: input.pmId, snapshot_id: snapshotId, overall_score: overallScore, status: complianceStatus });
    emitEvent("GOVERNANCE_CONSTITUTION_SCORE_CALCULATED",  { pm_id: input.pmId, domain: "constitution", score: constitutionScore });
    emitEvent("GOVERNANCE_AUTHORITY_SCORE_CALCULATED",     { pm_id: input.pmId, domain: "authority",    score: authorityScore });
    emitEvent("GOVERNANCE_RATIFICATION_SCORE_CALCULATED",  { pm_id: input.pmId, domain: "ratification", score: ratificationScore });
    emitEvent("GOVERNANCE_DECISION_SCORE_CALCULATED",      { pm_id: input.pmId, domain: "decision",     score: decisionScore });
    emitEvent("GOVERNANCE_EXECUTION_SCORE_CALCULATED",     { pm_id: input.pmId, domain: "execution",    score: executionScore });
    emitEvent("GOVERNANCE_LEARNING_SCORE_CALCULATED",      { pm_id: input.pmId, domain: "learning",     score: learningScore });
    if (detectedGaps.length > 0) emitEvent("GOVERNANCE_GAP_DETECTED", { pm_id: input.pmId, gap_count: detectedGaps.length });
    emitEvent("GOVERNANCE_DEBT_CALCULATED", { debt: calculateGovernanceDebt(detectedGaps) });

    return { ok: true, data: snap };
  }

  function getSnapshot(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");
    const snap = snapshots.get(input.snapshotId);
    if (!snap || snap.workspace_id !== input.workspaceId) return notFound("Compliance snapshot");
    return { ok: true, data: snap };
  }

  function listSnapshots(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    let results = [...snapshots.values()].filter((s) => s.workspace_id === input.workspaceId);
    if (input.pmId)     results = results.filter((s) => s.pm_id === input.pmId);
    if (input.status)   results = results.filter((s) => s.compliance_status === input.status);
    if (typeof input.minScore === "number") results = results.filter((s) => s.overall_score >= input.minScore);
    if (typeof input.maxScore === "number") results = results.filter((s) => s.overall_score <= input.maxScore);
    if (input.limit)    results = results.slice(0, input.limit);
    return { ok: true, data: results };
  }

  function generatePMOSummary(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    const workspacePMs = [...pms.values()].filter((p) => p.workspace_id === input.workspaceId && p.status === "active");
    if (workspacePMs.length === 0) {
      return { ok: true, data: { pmo: { pms: 0, compliant: 0, warning: 0, critical: 0 }, overall: 0, hotspots: [], totalDebt: { low: 0, medium: 0, high: 0, critical: 0, total: 0 } } };
    }
    const workspaceSnapshots = [...snapshots.values()].filter((s) => s.workspace_id === input.workspaceId);
    const latestByPM = new Map();
    for (const snap of workspaceSnapshots) {
      const existing = latestByPM.get(snap.pm_id);
      if (!existing || snap.generated_at > existing.generated_at) latestByPM.set(snap.pm_id, snap);
    }
    let compliant = 0, warning = 0, critical = 0, scoreSum = 0;
    for (const snap of latestByPM.values()) {
      if (snap.compliance_status === "compliant")    compliant++;
      else if (snap.compliance_status === "warning") warning++;
      else                                           critical++;
      scoreSum += snap.overall_score;
    }
    const overall = latestByPM.size > 0 ? Math.round(scoreSum / latestByPM.size) : 0;
    const allGaps = [...latestByPM.keys()].flatMap((pmId) => {
      const snap = latestByPM.get(pmId);
      return (gaps.get(snap.id) ?? []).map((g) => ({ domain: g.domain, gapType: g.gap_type, severity: g.severity, description: g.description, evidenceCount: g.evidence_count }));
    });
    return {
      ok: true,
      data: {
        pmo: { pms: workspacePMs.length, compliant, warning, critical },
        overall,
        hotspots:  identifyGovernanceHotspots(allGaps),
        totalDebt: calculateGovernanceDebt(allGaps),
      },
    };
  }

  function generateLineage(input) {
    if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
    if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");
    const pm = pms.get(input.pmId);
    if (!pm || pm.workspace_id !== input.workspaceId) return notFound("Project Manager");

    const activeAssignments = [...assignments.values()].filter(
      (a) => a.workspace_id === input.workspaceId && a.pm_id === input.pmId && a.removed_at === null
    );

    const pmSnapshots = [...snapshots.values()]
      .filter((s) => s.workspace_id === input.workspaceId && s.pm_id === input.pmId)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at));

    const latestSnap = pmSnapshots[0] ?? null;

    emitEvent("GOVERNANCE_LINEAGE_GENERATED", { pm_id: input.pmId });

    return {
      ok: true,
      data: {
        pm: { id: pm.id, name: pm.display_name, email: pm.email },
        constitutions:  input._constitutions  ?? [],
        authorities:    input._authorities    ?? [],
        decisions:      input._decisions      ?? [],
        ratifications:  input._ratifications  ?? [],
        commitments:    input._commitments    ?? [],
        memories:       input._memories       ?? [],
        complianceSnapshot: latestSnap
          ? { id: latestSnap.id, overallScore: latestSnap.overall_score, status: latestSnap.compliance_status, generatedAt: latestSnap.generated_at }
          : null,
      },
    };
  }

  return { registerPM, assignProject, generateSnapshot, getSnapshot, listSnapshots, generatePMOSummary, generateLineage, auditLog };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Constitution Compliance Engine", () => {
  test("complete constitution — high score", () => {
    const score = calculateConstitutionCompliance({
      constitutionCount:               4,
      constitutionsWithValidLifecycle: 4,
      constitutionsWithAmendments:     4,
      completeConstitutionCount:       4,
    });
    assert.equal(score, 100);
  });

  test("incomplete constitution — reduced score", () => {
    const score = calculateConstitutionCompliance({
      constitutionCount:               4,
      constitutionsWithValidLifecycle: 2,
      constitutionsWithAmendments:     1,
      completeConstitutionCount:       2,
    });
    assert.ok(score < 100, `expected < 100, got ${score}`);
    assert.ok(score >= 0);
  });

  test("absent constitution — default 75", () => {
    const score = calculateConstitutionCompliance({
      constitutionCount:               0,
      constitutionsWithValidLifecycle: 0,
      constitutionsWithAmendments:     0,
      completeConstitutionCount:       0,
    });
    assert.equal(score, 75);
  });
});

describe("Authority Compliance Engine", () => {
  test("valid authority — no penalties", () => {
    const score = calculateAuthorityCompliance({
      totalAuthorities:       3,
      expiredAuthorities:     0,
      revokedAuthorities:     0,
      invalidDelegations:     0,
      unauthorizedActionCount: 0,
    });
    assert.equal(score, 100);
  });

  test("expired authority — penalized", () => {
    const score = calculateAuthorityCompliance({
      totalAuthorities:       3,
      expiredAuthorities:     2,
      revokedAuthorities:     0,
      invalidDelegations:     0,
      unauthorizedActionCount: 0,
    });
    assert.ok(score < 100, `expected < 100, got ${score}`);
    assert.ok(score >= 0);
  });

  test("revoked authority — small penalty", () => {
    const score = calculateAuthorityCompliance({
      totalAuthorities:       3,
      expiredAuthorities:     0,
      revokedAuthorities:     1,
      invalidDelegations:     0,
      unauthorizedActionCount: 0,
    });
    assert.equal(score, 97);
  });

  test("unauthorized action — critical penalty", () => {
    const score = calculateAuthorityCompliance({
      totalAuthorities:        3,
      expiredAuthorities:      0,
      revokedAuthorities:      0,
      invalidDelegations:      0,
      unauthorizedActionCount: 2,
    });
    assert.ok(score <= 80, `expected <= 80, got ${score}`);
  });

  test("no authorities — default 75", () => {
    const score = calculateAuthorityCompliance({
      totalAuthorities:        0,
      expiredAuthorities:      0,
      revokedAuthorities:      0,
      invalidDelegations:      0,
      unauthorizedActionCount: 0,
    });
    assert.equal(score, 75);
  });
});

describe("Ratification Compliance Engine", () => {
  test("all ratified — high score", () => {
    const score = calculateRatificationCompliance({
      totalRatifications:      5,
      pendingRatifications:    0,
      expiredRatifications:    0,
      missingRatificationCount: 0,
    });
    assert.equal(score, 100);
  });

  test("pending ratifications — penalized", () => {
    const score = calculateRatificationCompliance({
      totalRatifications:      5,
      pendingRatifications:    3,
      expiredRatifications:    0,
      missingRatificationCount: 0,
    });
    assert.ok(score < 100, `expected < 100, got ${score}`);
  });

  test("missing ratifications — penalized", () => {
    const score = calculateRatificationCompliance({
      totalRatifications:      0,
      pendingRatifications:    0,
      expiredRatifications:    0,
      missingRatificationCount: 4,
    });
    assert.ok(score <= 60, `expected <= 60, got ${score}`);
  });

  test("no ratifications and no missing — default 75", () => {
    const score = calculateRatificationCompliance({
      totalRatifications:      0,
      pendingRatifications:    0,
      expiredRatifications:    0,
      missingRatificationCount: 0,
    });
    assert.equal(score, 75);
  });
});

describe("Decision Compliance Engine", () => {
  test("fully compliant decisions", () => {
    const score = calculateDecisionCompliance({
      totalDecisions:              5,
      decisionsWithLineage:        5,
      decisionsWithAuthority:      5,
      decisionsWithOutcome:        5,
      decisionsWithAccountability: 5,
    });
    assert.equal(score, 100);
  });

  test("decisions without authority — penalized", () => {
    const score = calculateDecisionCompliance({
      totalDecisions:              5,
      decisionsWithLineage:        5,
      decisionsWithAuthority:      2,
      decisionsWithOutcome:        5,
      decisionsWithAccountability: 5,
    });
    assert.ok(score < 100);
  });

  test("decisions without accountability — penalized", () => {
    const score = calculateDecisionCompliance({
      totalDecisions:              5,
      decisionsWithLineage:        5,
      decisionsWithAuthority:      5,
      decisionsWithOutcome:        5,
      decisionsWithAccountability: 0,
    });
    assert.ok(score < 100);
  });

  test("no decisions — default 75", () => {
    const score = calculateDecisionCompliance({
      totalDecisions:              0,
      decisionsWithLineage:        0,
      decisionsWithAuthority:      0,
      decisionsWithOutcome:        0,
      decisionsWithAccountability: 0,
    });
    assert.equal(score, 75);
  });
});

describe("Execution Compliance Engine", () => {
  test("full commitment completion, all validated", () => {
    const score = calculateExecutionCompliance({
      totalCommitments:    10,
      completedCommitments: 10,
      driftCount:          0,
      validatedRealities:  5,
      totalRealities:      5,
      integrityViolations: 0,
    });
    assert.ok(score >= 90, `expected >= 90, got ${score}`);
  });

  test("drift detected — penalized", () => {
    const score = calculateExecutionCompliance({
      totalCommitments:    10,
      completedCommitments: 8,
      driftCount:          5,
      validatedRealities:  5,
      totalRealities:      5,
      integrityViolations: 0,
    });
    assert.ok(score < 80, `expected < 80, got ${score}`);
  });

  test("unvalidated realities — penalized", () => {
    const noValidation = calculateExecutionCompliance({
      totalCommitments:    5,
      completedCommitments: 5,
      driftCount:          0,
      validatedRealities:  1,
      totalRealities:      5,
      integrityViolations: 0,
    });
    const allValidated = calculateExecutionCompliance({
      totalCommitments:    5,
      completedCommitments: 5,
      driftCount:          0,
      validatedRealities:  5,
      totalRealities:      5,
      integrityViolations: 0,
    });
    assert.ok(noValidation < allValidated, `partial validation ${noValidation} should be < full ${allValidated}`);
  });

  test("no data — default 75", () => {
    const score = calculateExecutionCompliance({
      totalCommitments: 0, completedCommitments: 0, driftCount: 0,
      validatedRealities: 0, totalRealities: 0, integrityViolations: 0,
    });
    assert.equal(score, 75);
  });
});

describe("Learning Compliance Engine", () => {
  test("complete learning — high score", () => {
    const score = calculateLearningCompliance({
      totalMemories:            5,
      digestCount:              5,
      learningCount:            5,
      recommendationsWithTrace: 4,
      totalRecommendations:     4,
    });
    assert.equal(score, 100);
  });

  test("missing digest — penalized", () => {
    const score = calculateLearningCompliance({
      totalMemories:            5,
      digestCount:              0,
      learningCount:            0,
      recommendationsWithTrace: 0,
      totalRecommendations:     0,
    });
    assert.ok(score < 80, `expected < 80, got ${score}`);
  });

  test("missing recommendations — penalized", () => {
    const full    = calculateLearningCompliance({ totalMemories: 5, digestCount: 5, learningCount: 5, recommendationsWithTrace: 4, totalRecommendations: 4 });
    const partial = calculateLearningCompliance({ totalMemories: 5, digestCount: 5, learningCount: 5, recommendationsWithTrace: 0, totalRecommendations: 4 });
    assert.ok(partial < full);
  });

  test("no data — default 75", () => {
    const score = calculateLearningCompliance({ totalMemories: 0, digestCount: 0, learningCount: 0, recommendationsWithTrace: 0, totalRecommendations: 0 });
    assert.equal(score, 75);
  });
});

describe("Overall Compliance Engine", () => {
  test("all 100 → overall 100", () => {
    const score = calculateOverallCompliance({ constitution: 100, authority: 100, ratification: 100, decision: 100, execution: 100, learning: 100 });
    assert.equal(score, 100);
  });

  test("all 0 → overall 0", () => {
    const score = calculateOverallCompliance({ constitution: 0, authority: 0, ratification: 0, decision: 0, execution: 0, learning: 0 });
    assert.equal(score, 0);
  });

  test("weighted calculation is correct", () => {
    const score = calculateOverallCompliance({ constitution: 100, authority: 0, ratification: 0, decision: 0, execution: 0, learning: 0 });
    assert.equal(score, 15, `constitution 15% weight: expected 15, got ${score}`);
  });
});

describe("Status Classification", () => {
  test("score >= 80 → compliant", () => { assert.equal(classifyGovernanceComplianceStatus(80),  "compliant"); });
  test("score >= 60 → warning",   () => { assert.equal(classifyGovernanceComplianceStatus(60),  "warning"); });
  test("score < 60 → critical",   () => { assert.equal(classifyGovernanceComplianceStatus(59),  "critical"); });
  test("score 100 → compliant",   () => { assert.equal(classifyGovernanceComplianceStatus(100), "compliant"); });
  test("score 0 → critical",      () => { assert.equal(classifyGovernanceComplianceStatus(0),   "critical"); });
});

describe("Governance Gap Detection", () => {
  const empty = {
    constitution:  { constitutionCount: 0, constitutionsWithValidLifecycle: 0, constitutionsWithAmendments: 0, completeConstitutionCount: 0 },
    authority:     { totalAuthorities: 0, expiredAuthorities: 0, revokedAuthorities: 0, invalidDelegations: 0, unauthorizedActionCount: 0 },
    ratification:  { totalRatifications: 0, pendingRatifications: 0, expiredRatifications: 0, missingRatificationCount: 0 },
    decision:      { totalDecisions: 0, decisionsWithLineage: 0, decisionsWithAuthority: 0, decisionsWithOutcome: 0, decisionsWithAccountability: 0 },
    execution:     { totalCommitments: 0, completedCommitments: 0, driftCount: 0, validatedRealities: 0, totalRealities: 0, integrityViolations: 0 },
    learning:      { totalMemories: 0, digestCount: 0, learningCount: 0, recommendationsWithTrace: 0, totalRecommendations: 0 },
  };

  test("missing constitution detected as critical", () => {
    const gaps = detectGovernanceGaps(empty);
    const constitutionGap = gaps.find((g) => g.gapType === "missing_constitution");
    assert.ok(constitutionGap, "missing_constitution gap expected");
    assert.equal(constitutionGap.severity, "critical");
    assert.equal(constitutionGap.domain, "constitution");
  });

  test("missing authority detected as high", () => {
    const gaps = detectGovernanceGaps(empty);
    const authGap = gaps.find((g) => g.gapType === "missing_authority");
    assert.ok(authGap, "missing_authority gap expected");
    assert.equal(authGap.severity, "high");
    assert.equal(authGap.domain, "authority");
  });

  test("missing memory detected as medium", () => {
    const gaps = detectGovernanceGaps(empty);
    const learningGap = gaps.find((g) => g.gapType === "missing_memory");
    assert.ok(learningGap, "missing_memory gap expected");
    assert.equal(learningGap.severity, "medium");
    assert.equal(learningGap.domain, "learning");
  });

  test("unauthorized action detected as critical", () => {
    const input = { ...empty, authority: { totalAuthorities: 3, expiredAuthorities: 0, revokedAuthorities: 0, invalidDelegations: 0, unauthorizedActionCount: 2 } };
    const gaps  = detectGovernanceGaps(input);
    const gap   = gaps.find((g) => g.gapType === "unauthorized_action");
    assert.ok(gap, "unauthorized_action gap expected");
    assert.equal(gap.severity, "critical");
  });

  test("execution drift detected with correct severity", () => {
    const input = { ...empty,
      constitution: { ...empty.constitution, constitutionCount: 1, constitutionsWithValidLifecycle: 1, completeConstitutionCount: 1, constitutionsWithAmendments: 1 },
      authority:    { totalAuthorities: 1, expiredAuthorities: 0, revokedAuthorities: 0, invalidDelegations: 0, unauthorizedActionCount: 0 },
      execution:    { totalCommitments: 10, completedCommitments: 10, driftCount: 6, validatedRealities: 5, totalRealities: 5, integrityViolations: 0 },
    };
    const gaps  = detectGovernanceGaps(input);
    const drift = gaps.find((g) => g.gapType === "execution_drift");
    assert.ok(drift, "execution_drift gap expected");
    assert.equal(drift.severity, "high");
  });

  test("missing ratification: 3+ items → critical severity", () => {
    const input = { ...empty, ratification: { totalRatifications: 0, pendingRatifications: 0, expiredRatifications: 0, missingRatificationCount: 3 } };
    const gaps  = detectGovernanceGaps(input);
    const gap   = gaps.find((g) => g.gapType === "missing_ratification");
    assert.ok(gap);
    assert.equal(gap.severity, "critical");
  });
});

describe("Governance Debt Engine", () => {
  test("correct accumulation", () => {
    const gaps = [
      { domain: "authority",    gapType: "unauthorized_action",   severity: "critical", description: "", evidenceCount: 1 },
      { domain: "ratification", gapType: "missing_ratification",  severity: "high",     description: "", evidenceCount: 2 },
      { domain: "execution",    gapType: "execution_drift",       severity: "medium",   description: "", evidenceCount: 3 },
      { domain: "learning",     gapType: "untraced_recommendation", severity: "low",    description: "", evidenceCount: 1 },
      { domain: "constitution", gapType: "missing_constitution",  severity: "critical", description: "", evidenceCount: 0 },
    ];
    const debt = calculateGovernanceDebt(gaps);
    assert.equal(debt.critical, 2);
    assert.equal(debt.high,     1);
    assert.equal(debt.medium,   1);
    assert.equal(debt.low,      1);
    assert.equal(debt.total,    5);
  });

  test("empty gaps → zero debt", () => {
    const debt = calculateGovernanceDebt([]);
    assert.equal(debt.total, 0);
    assert.equal(debt.critical, 0);
  });
});

describe("Governance Hotspot Engine", () => {
  test("identifies domain with most critical gaps first", () => {
    const gaps = [
      { domain: "authority",    gapType: "x", severity: "critical", description: "", evidenceCount: 1 },
      { domain: "authority",    gapType: "y", severity: "high",     description: "", evidenceCount: 1 },
      { domain: "ratification", gapType: "z", severity: "medium",   description: "", evidenceCount: 1 },
    ];
    const hotspots = identifyGovernanceHotspots(gaps);
    assert.equal(hotspots[0].domain, "authority");
    assert.equal(hotspots[0].dominantSeverity, "critical");
    assert.equal(hotspots[0].gapCount, 2);
  });

  test("empty gaps → no hotspots", () => {
    const hotspots = identifyGovernanceHotspots([]);
    assert.equal(hotspots.length, 0);
  });
});

describe("Compliance Registry — In-Memory Store", () => {
  test("validation: missing workspaceId", () => {
    const store  = createComplianceStore();
    const result = store.generateSnapshot({ workspaceId: "bad-id", pmId: uuid() });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation");
  });

  test("not found: unknown PM", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const result = store.generateSnapshot({ workspaceId: wsId, pmId: uuid() });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("validation: PM with no active assignments", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "Ana", email: "ana@pmo.com" }).data;
    const result = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    assert.equal(result.ok, false);
    assert.match(result.error, /no active assignments/i);
  });

  test("successful snapshot generation", () => {
    const store   = createComplianceStore();
    const wsId    = uuid();
    const pm      = store.registerPM({ workspaceId: wsId, displayName: "Victor", email: "victor@pmo.com" }).data;
    const projId  = uuid();
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: projId });

    const result = store.generateSnapshot({
      workspaceId: wsId, pmId: pm.id,
      _constitution: { constitutionCount: 2, constitutionsWithValidLifecycle: 2, constitutionsWithAmendments: 2, completeConstitutionCount: 2 },
      _authority:    { totalAuthorities: 3, expiredAuthorities: 0, revokedAuthorities: 0, invalidDelegations: 0, unauthorizedActionCount: 0 },
      _ratification: { totalRatifications: 2, pendingRatifications: 0, expiredRatifications: 0, missingRatificationCount: 0 },
      _decision:     { totalDecisions: 5, decisionsWithLineage: 5, decisionsWithAuthority: 5, decisionsWithOutcome: 4, decisionsWithAccountability: 5 },
      _execution:    { totalCommitments: 8, completedCommitments: 8, driftCount: 0, validatedRealities: 3, totalRealities: 3, integrityViolations: 0 },
      _learning:     { totalMemories: 4, digestCount: 4, learningCount: 3, recommendationsWithTrace: 2, totalRecommendations: 2 },
    });

    assert.equal(result.ok, true);
    assert.ok(validUuid(result.data.id));
    assert.equal(result.data.workspace_id, wsId);
    assert.equal(result.data.pm_id, pm.id);
    assert.ok(result.data.overall_score > 0);
    assert.ok(["compliant", "warning", "critical"].includes(result.data.compliance_status));
  });

  test("getSnapshot: found", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "B", email: "b@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const snap   = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id }).data;
    const result = store.getSnapshot({ workspaceId: wsId, snapshotId: snap.id });
    assert.equal(result.ok, true);
    assert.equal(result.data.id, snap.id);
  });

  test("getSnapshot: wrong workspace → not found", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "C", email: "c@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const snap   = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id }).data;
    const result = store.getSnapshot({ workspaceId: uuid(), snapshotId: snap.id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("listSnapshots: filter by pmId", () => {
    const store = createComplianceStore();
    const wsId  = uuid();
    const pmA   = store.registerPM({ workspaceId: wsId, displayName: "PM-A", email: "a@pmo.com" }).data;
    const pmB   = store.registerPM({ workspaceId: wsId, displayName: "PM-B", email: "b@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pmB.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmA.id });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmB.id });

    const result = store.listSnapshots({ workspaceId: wsId, pmId: pmA.id });
    assert.equal(result.ok, true);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].pm_id, pmA.id);
  });

  test("listSnapshots: filter by status", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "D", email: "d@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const snap = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id }).data;

    const statusResult = store.listSnapshots({ workspaceId: wsId, status: snap.compliance_status });
    assert.equal(statusResult.ok, true);
    assert.ok(statusResult.data.every((s) => s.compliance_status === snap.compliance_status));
  });
});

describe("PMO Compliance Summary", () => {
  test("empty workspace → zero summary", () => {
    const store  = createComplianceStore();
    const result = store.generatePMOSummary({ workspaceId: uuid() });
    assert.equal(result.ok, true);
    assert.equal(result.data.pmo.pms,       0);
    assert.equal(result.data.pmo.compliant,  0);
    assert.equal(result.data.overall,        0);
  });

  test("correct PM count in summary", () => {
    const store = createComplianceStore();
    const wsId  = uuid();
    const pmA   = store.registerPM({ workspaceId: wsId, displayName: "X", email: "x@pmo.com" }).data;
    const pmB   = store.registerPM({ workspaceId: wsId, displayName: "Y", email: "y@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsId, pmId: pmB.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmA.id });
    store.generateSnapshot({ workspaceId: wsId, pmId: pmB.id });

    const result = store.generatePMOSummary({ workspaceId: wsId });
    assert.equal(result.ok, true);
    assert.equal(result.data.pmo.pms, 2);
    assert.ok(result.data.overall >= 0 && result.data.overall <= 100);
  });

  test("status counts sum to PM count with snapshots", () => {
    const store = createComplianceStore();
    const wsId  = uuid();
    const pms   = ["P1","P2","P3"].map((n) => store.registerPM({ workspaceId: wsId, displayName: n, email: `${n}@pmo.com` }).data);
    for (const pm of pms) {
      store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
      store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });
    }
    const summary = store.generatePMOSummary({ workspaceId: wsId }).data;
    const statusTotal = summary.pmo.compliant + summary.pmo.warning + summary.pmo.critical;
    assert.equal(statusTotal, 3, `compliant+warning+critical should equal 3, got ${statusTotal}`);
  });
});

describe("Governance Compliance Lineage", () => {
  test("reconstructs full lineage chain", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "E", email: "e@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    const snap = store.generateSnapshot({ workspaceId: wsId, pmId: pm.id }).data;

    const lineage = store.generateLineage({
      workspaceId:    wsId, pmId: pm.id,
      _constitutions: [{ id: uuid(), projectId: uuid(), lifecycleStatus: "active" }],
      _authorities:   [{ id: uuid(), status: "active", expiresAt: null }],
      _decisions:     [{ id: uuid(), status: "open", hasOutcome: false }],
      _ratifications: [{ id: uuid(), status: "ratified" }],
      _commitments:   [{ id: uuid(), status: "completed" }],
      _memories:      [{ id: uuid() }],
    });

    assert.equal(lineage.ok, true);
    assert.equal(lineage.data.pm.id,           pm.id);
    assert.equal(lineage.data.constitutions.length, 1);
    assert.equal(lineage.data.authorities.length,   1);
    assert.equal(lineage.data.decisions.length,     1);
    assert.equal(lineage.data.ratifications.length, 1);
    assert.equal(lineage.data.commitments.length,   1);
    assert.equal(lineage.data.memories.length,      1);
    assert.ok(lineage.data.complianceSnapshot !== null);
    assert.equal(lineage.data.complianceSnapshot.id, snap.id);
  });

  test("lineage without snapshot returns null complianceSnapshot", () => {
    const store = createComplianceStore();
    const wsId  = uuid();
    const pm    = store.registerPM({ workspaceId: wsId, displayName: "F", email: "f@pmo.com" }).data;

    const lineage = store.generateLineage({ workspaceId: wsId, pmId: pm.id });
    assert.equal(lineage.ok, true);
    assert.equal(lineage.data.complianceSnapshot, null);
  });

  test("lineage: unknown PM → not found", () => {
    const store  = createComplianceStore();
    const result = store.generateLineage({ workspaceId: uuid(), pmId: uuid() });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });
});

describe("Audit Events", () => {
  test("snapshot generation emits expected events", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "G", email: "g@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });

    const expectedEvents = [
      "GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED",
      "GOVERNANCE_CONSTITUTION_SCORE_CALCULATED",
      "GOVERNANCE_AUTHORITY_SCORE_CALCULATED",
      "GOVERNANCE_RATIFICATION_SCORE_CALCULATED",
      "GOVERNANCE_DECISION_SCORE_CALCULATED",
      "GOVERNANCE_EXECUTION_SCORE_CALCULATED",
      "GOVERNANCE_LEARNING_SCORE_CALCULATED",
      "GOVERNANCE_DEBT_CALCULATED",
    ];
    for (const ev of expectedEvents) {
      assert.ok(store.auditLog.some((e) => e.type === ev), `expected audit event: ${ev}`);
    }
  });

  test("audit event includes pm_id in payload", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "H", email: "h@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id });

    const snapEvent = store.auditLog.find((e) => e.type === "GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED");
    assert.ok(snapEvent, "snapshot event not found");
    assert.equal(snapEvent.payload.pm_id, pm.id);
    assert.ok(validUuid(snapEvent.payload.snapshot_id));
  });

  test("gap event emitted when gaps detected", () => {
    const store  = createComplianceStore();
    const wsId   = uuid();
    const pm     = store.registerPM({ workspaceId: wsId, displayName: "I", email: "i@pmo.com" }).data;
    store.assignProject({ workspaceId: wsId, pmId: pm.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsId, pmId: pm.id }); // no data → gaps expected

    assert.ok(store.auditLog.some((e) => e.type === "GOVERNANCE_GAP_DETECTED"), "GOVERNANCE_GAP_DETECTED expected");
  });

  test("lineage event emitted", () => {
    const store = createComplianceStore();
    const wsId  = uuid();
    const pm    = store.registerPM({ workspaceId: wsId, displayName: "J", email: "j@pmo.com" }).data;
    store.generateLineage({ workspaceId: wsId, pmId: pm.id });
    assert.ok(store.auditLog.some((e) => e.type === "GOVERNANCE_LINEAGE_GENERATED"));
  });
});

describe("Workspace Isolation", () => {
  test("cannot read snapshot from different workspace", () => {
    const store   = createComplianceStore();
    const wsA     = uuid();
    const wsB     = uuid();
    const pm      = store.registerPM({ workspaceId: wsA, displayName: "K", email: "k@pmo.com" }).data;
    store.assignProject({ workspaceId: wsA, pmId: pm.id, projectId: uuid() });
    const snap = store.generateSnapshot({ workspaceId: wsA, pmId: pm.id }).data;

    const result = store.getSnapshot({ workspaceId: wsB, snapshotId: snap.id });
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "not_found");
  });

  test("listSnapshots only returns own workspace data", () => {
    const store   = createComplianceStore();
    const wsA     = uuid();
    const wsB     = uuid();
    const pmA     = store.registerPM({ workspaceId: wsA, displayName: "L", email: "l@pmo.com" }).data;
    const pmB     = store.registerPM({ workspaceId: wsB, displayName: "M", email: "m@pmo.com" }).data;
    store.assignProject({ workspaceId: wsA, pmId: pmA.id, projectId: uuid() });
    store.assignProject({ workspaceId: wsB, pmId: pmB.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsA, pmId: pmA.id });
    store.generateSnapshot({ workspaceId: wsB, pmId: pmB.id });

    const resultA = store.listSnapshots({ workspaceId: wsA });
    const resultB = store.listSnapshots({ workspaceId: wsB });
    assert.equal(resultA.ok, true);
    assert.equal(resultB.ok, true);
    assert.ok(resultA.data.every((s) => s.workspace_id === wsA), "wsA should only see its own snapshots");
    assert.ok(resultB.data.every((s) => s.workspace_id === wsB), "wsB should only see its own snapshots");
  });

  test("PMO summary scoped to workspace", () => {
    const store = createComplianceStore();
    const wsA   = uuid();
    const wsB   = uuid();
    const pmA   = store.registerPM({ workspaceId: wsA, displayName: "N", email: "n@pmo.com" }).data;
    store.assignProject({ workspaceId: wsA, pmId: pmA.id, projectId: uuid() });
    store.generateSnapshot({ workspaceId: wsA, pmId: pmA.id });

    const summaryB = store.generatePMOSummary({ workspaceId: wsB });
    assert.equal(summaryB.ok, true);
    assert.equal(summaryB.data.pmo.pms, 0, "wsB should see 0 PMs");
  });
});
