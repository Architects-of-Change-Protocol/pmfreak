import type {
  DeliveryPlaybook,
  PlaybookEvidenceUsed,
  PlaybookFactCheck,
  PlaybookFactKey,
  PlaybookRule,
  PlaybookRuleEvaluation,
  ProjectContextFacts,
} from "./types";

function readFact(context: ProjectContextFacts, fact: PlaybookFactKey): boolean | number | null {
  const value = context[fact];
  return value === undefined ? null : value;
}

function checkCondition(check: PlaybookFactCheck, value: boolean | number): boolean {
  switch (check.operator) {
    case "is_true":
      return value === true;
    case "is_false":
      return value === false;
    case "equals":
      return value === check.value;
    case "not_equals":
      return value !== check.value;
    case "greater_than":
      return typeof value === "number" && typeof check.value === "number" && value > check.value;
    case "greater_than_or_equal":
      return typeof value === "number" && typeof check.value === "number" && value >= check.value;
    case "less_than":
      return typeof value === "number" && typeof check.value === "number" && value < check.value;
    default:
      return false;
  }
}

/**
 * Evaluates a single rule against known facts. A rule can never "fire" or "not fire"
 * on evidence that is missing — it is reported as indeterminate instead, so recommendations
 * downstream never claim more than the evidence supports.
 */
export function evaluatePlaybookRule(rule: PlaybookRule, context: ProjectContextFacts): PlaybookRuleEvaluation {
  const evidenceUsed: PlaybookEvidenceUsed[] = [];
  const evidenceMissing: PlaybookFactKey[] = [];

  for (const fact of rule.evidenceFacts) {
    const value = readFact(context, fact);
    if (value === null) {
      evidenceMissing.push(fact);
    } else {
      evidenceUsed.push({ fact, value });
    }
  }

  const conditionFacts = new Set(rule.conditions.map((condition) => condition.fact));
  const missingConditionFacts = rule.conditions.filter((condition) => readFact(context, condition.fact) === null);

  if (rule.conditions.length === 0 || missingConditionFacts.length > 0) {
    return {
      ruleId: rule.id,
      scope: rule.scope,
      title: rule.title,
      description: rule.description,
      severity: rule.severity,
      status: "indeterminate",
      evidenceUsed,
      evidenceMissing: Array.from(new Set([...evidenceMissing, ...missingConditionFacts.map((c) => c.fact)])),
      recommendationTemplate: null,
      suggestedActions: null,
    };
  }

  const allConditionsMet = rule.conditions.every((condition) => {
    const value = readFact(context, condition.fact);
    return value !== null && checkCondition(condition, value);
  });

  return {
    ruleId: rule.id,
    scope: rule.scope,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    status: allConditionsMet ? "fired" : "not_fired",
    evidenceUsed: evidenceUsed.filter((e) => conditionFacts.has(e.fact) || rule.evidenceFacts.includes(e.fact)),
    evidenceMissing,
    recommendationTemplate: allConditionsMet ? rule.recommendationTemplate : null,
    suggestedActions: allConditionsMet ? rule.suggestedActions ?? [] : null,
  };
}

/**
 * Evaluates every rule in the playbook that is scoped to the context's current phase
 * (or scoped to "any"). Rules are never skipped silently — every applicable rule
 * produces an evaluation, even when indeterminate.
 */
export function evaluatePlaybookRules(playbook: DeliveryPlaybook, context: ProjectContextFacts): PlaybookRuleEvaluation[] {
  return playbook.rules
    .filter((rule) => rule.scope === "any" || rule.scope === context.phase)
    .map((rule) => evaluatePlaybookRule(rule, context));
}
