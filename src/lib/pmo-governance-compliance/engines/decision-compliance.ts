import type { DecisionComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA = 75;
const LINEAGE_WEIGHT        = 0.25;
const AUTHORITY_WEIGHT      = 0.30;
const OUTCOME_WEIGHT        = 0.25;
const ACCOUNTABILITY_WEIGHT = 0.20;

export function calculateDecisionCompliance(input: DecisionComplianceInput): number {
  const { totalDecisions, decisionsWithLineage, decisionsWithAuthority, decisionsWithOutcome, decisionsWithAccountability } = input;

  if (totalDecisions === 0) return DEFAULT_WHEN_NO_DATA;

  const lineageRate        = decisionsWithLineage        / totalDecisions;
  const authorityRate      = decisionsWithAuthority      / totalDecisions;
  const outcomeRate        = decisionsWithOutcome        / totalDecisions;
  const accountabilityRate = decisionsWithAccountability / totalDecisions;

  const score =
    lineageRate        * LINEAGE_WEIGHT        * 100 +
    authorityRate      * AUTHORITY_WEIGHT      * 100 +
    outcomeRate        * OUTCOME_WEIGHT        * 100 +
    accountabilityRate * ACCOUNTABILITY_WEIGHT * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}
