import type {
  GovernanceGap,
  ConstitutionComplianceInput,
  AuthorityComplianceInput,
  RatificationComplianceInput,
  DecisionComplianceInput,
  ExecutionComplianceInput,
  LearningComplianceInput,
} from "../types";

export type GapDetectionInput = {
  constitution:  ConstitutionComplianceInput;
  authority:     AuthorityComplianceInput;
  ratification:  RatificationComplianceInput;
  decision:      DecisionComplianceInput;
  execution:     ExecutionComplianceInput;
  learning:      LearningComplianceInput;
};

export function detectGovernanceGaps(input: GapDetectionInput): GovernanceGap[] {
  const gaps: GovernanceGap[] = [];

  // ─── Constitution Gaps ───────────────────────────────────────────────────
  const { constitutionCount, constitutionsWithValidLifecycle, completeConstitutionCount } = input.constitution;

  if (constitutionCount === 0) {
    gaps.push({
      domain:        "constitution",
      gapType:       "missing_constitution",
      severity:      "critical",
      description:   "No project constitutions found. Projects operate without a constitutional framework.",
      evidenceCount: 0,
    });
  } else {
    const incompleteCount = constitutionCount - completeConstitutionCount;
    if (incompleteCount > 0) {
      gaps.push({
        domain:        "constitution",
        gapType:       "incomplete_constitution",
        severity:      incompleteCount >= constitutionCount * 0.5 ? "high" : "medium",
        description:   `${incompleteCount} constitution(s) are incomplete and lack required fields.`,
        evidenceCount: incompleteCount,
      });
    }
    const invalidLifecycleCount = constitutionCount - constitutionsWithValidLifecycle;
    if (invalidLifecycleCount > 0) {
      gaps.push({
        domain:        "constitution",
        gapType:       "invalid_lifecycle",
        severity:      "medium",
        description:   `${invalidLifecycleCount} constitution(s) have invalid lifecycle status.`,
        evidenceCount: invalidLifecycleCount,
      });
    }
  }

  // ─── Authority Gaps ───────────────────────────────────────────────────────
  const { totalAuthorities, expiredAuthorities, revokedAuthorities, invalidDelegations, unauthorizedActionCount } = input.authority;

  if (totalAuthorities === 0) {
    gaps.push({
      domain:        "authority",
      gapType:       "missing_authority",
      severity:      "high",
      description:   "No authority assignments found. Decisions operate without formal authority.",
      evidenceCount: 0,
    });
  } else {
    if (expiredAuthorities > 0) {
      gaps.push({
        domain:        "authority",
        gapType:       "expired_authority",
        severity:      expiredAuthorities >= 3 ? "high" : "medium",
        description:   `${expiredAuthorities} authority assignment(s) have expired and require renewal.`,
        evidenceCount: expiredAuthorities,
      });
    }
    if (revokedAuthorities > 0) {
      gaps.push({
        domain:        "authority",
        gapType:       "revoked_authority",
        severity:      "low",
        description:   `${revokedAuthorities} authority assignment(s) have been revoked.`,
        evidenceCount: revokedAuthorities,
      });
    }
    if (invalidDelegations > 0) {
      gaps.push({
        domain:        "authority",
        gapType:       "invalid_delegation",
        severity:      "high",
        description:   `${invalidDelegations} authority delegation(s) are invalid or exceed scope.`,
        evidenceCount: invalidDelegations,
      });
    }
    if (unauthorizedActionCount > 0) {
      gaps.push({
        domain:        "authority",
        gapType:       "unauthorized_action",
        severity:      "critical",
        description:   `${unauthorizedActionCount} action(s) were taken without valid authority.`,
        evidenceCount: unauthorizedActionCount,
      });
    }
  }

  // ─── Ratification Gaps ────────────────────────────────────────────────────
  const { pendingRatifications, expiredRatifications, missingRatificationCount } = input.ratification;

  if (missingRatificationCount > 0) {
    gaps.push({
      domain:        "ratification",
      gapType:       "missing_ratification",
      severity:      missingRatificationCount >= 3 ? "critical" : "high",
      description:   `${missingRatificationCount} decision(s) requiring ratification have none recorded.`,
      evidenceCount: missingRatificationCount,
    });
  }
  if (pendingRatifications > 0) {
    gaps.push({
      domain:        "ratification",
      gapType:       "pending_ratification",
      severity:      pendingRatifications >= 5 ? "high" : "medium",
      description:   `${pendingRatifications} ratification(s) are still pending approval.`,
      evidenceCount: pendingRatifications,
    });
  }
  if (expiredRatifications > 0) {
    gaps.push({
      domain:        "ratification",
      gapType:       "expired_ratification",
      severity:      "high",
      description:   `${expiredRatifications} ratification(s) have expired without completion.`,
      evidenceCount: expiredRatifications,
    });
  }

  // ─── Decision Gaps ────────────────────────────────────────────────────────
  const { totalDecisions, decisionsWithLineage, decisionsWithAuthority, decisionsWithAccountability } = input.decision;

  if (totalDecisions > 0) {
    const noLineageCount       = totalDecisions - decisionsWithLineage;
    const noAuthorityCount     = totalDecisions - decisionsWithAuthority;
    const noAccountabilityCount = totalDecisions - decisionsWithAccountability;

    if (noAuthorityCount > 0) {
      gaps.push({
        domain:        "decision",
        gapType:       "decision_without_authority",
        severity:      noAuthorityCount >= 3 ? "critical" : "high",
        description:   `${noAuthorityCount} decision(s) lack a valid authority assignment.`,
        evidenceCount: noAuthorityCount,
      });
    }
    if (noLineageCount > 0) {
      gaps.push({
        domain:        "decision",
        gapType:       "decision_without_lineage",
        severity:      "medium",
        description:   `${noLineageCount} decision(s) have incomplete traceability lineage.`,
        evidenceCount: noLineageCount,
      });
    }
    if (noAccountabilityCount > 0) {
      gaps.push({
        domain:        "decision",
        gapType:       "decision_without_accountability",
        severity:      "medium",
        description:   `${noAccountabilityCount} decision(s) have no accountability assignment.`,
        evidenceCount: noAccountabilityCount,
      });
    }
  }

  // ─── Execution Gaps ───────────────────────────────────────────────────────
  const { driftCount, integrityViolations, totalRealities, validatedRealities } = input.execution;

  if (driftCount > 0) {
    gaps.push({
      domain:        "execution",
      gapType:       "execution_drift",
      severity:      driftCount >= 5 ? "high" : driftCount >= 2 ? "medium" : "low",
      description:   `${driftCount} commitment(s) have drifted from planned execution.`,
      evidenceCount: driftCount,
    });
  }
  if (integrityViolations > 0) {
    gaps.push({
      domain:        "execution",
      gapType:       "projection_integrity_violation",
      severity:      "high",
      description:   `${integrityViolations} projection(s) have integrity violations.`,
      evidenceCount: integrityViolations,
    });
  }
  if (totalRealities > 0 && validatedRealities < totalRealities) {
    const unvalidatedCount = totalRealities - validatedRealities;
    gaps.push({
      domain:        "execution",
      gapType:       "unvalidated_reality",
      severity:      "medium",
      description:   `${unvalidatedCount} execution realit(ies) have not been validated.`,
      evidenceCount: unvalidatedCount,
    });
  }

  // ─── Learning Gaps ────────────────────────────────────────────────────────
  const { totalMemories, digestCount, learningCount, totalRecommendations, recommendationsWithTrace } = input.learning;

  if (totalMemories === 0) {
    gaps.push({
      domain:        "learning",
      gapType:       "missing_memory",
      severity:      "medium",
      description:   "No operational memory records found. Learning capture is absent.",
      evidenceCount: 0,
    });
  } else {
    if (digestCount === 0) {
      gaps.push({
        domain:        "learning",
        gapType:       "missing_digest",
        severity:      "medium",
        description:   "No digests have been generated from operational memory.",
        evidenceCount: totalMemories,
      });
    }
    if (learningCount === 0) {
      gaps.push({
        domain:        "learning",
        gapType:       "missing_learning",
        severity:      "medium",
        description:   "No learning records derived from digests.",
        evidenceCount: digestCount,
      });
    }
  }
  if (totalRecommendations > 0 && recommendationsWithTrace < totalRecommendations) {
    const untracedCount = totalRecommendations - recommendationsWithTrace;
    gaps.push({
      domain:        "learning",
      gapType:       "untraced_recommendation",
      severity:      "low",
      description:   `${untracedCount} recommendation(s) lack traceability to learning records.`,
      evidenceCount: untracedCount,
    });
  }

  return gaps;
}
