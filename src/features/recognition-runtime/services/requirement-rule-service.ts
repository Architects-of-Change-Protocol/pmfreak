import type { RecognitionRequirementRule, RecognitionRiskLevel, EvidenceArtifactType, RecognitionRuntimeContext } from "../domain";
import { matchesPattern } from "./pattern-matching";

export type RegisterRequirementRuleInput = {
  id?: string;
  trustDomainId: string;
  actionPattern: string;
  resourceScopePattern?: string;
  riskLevel: RecognitionRiskLevel;
  requiredEvidenceTypes?: EvidenceArtifactType[];
  requiresHumanApproval?: boolean;
  metadata?: Record<string, unknown>;
};

export type RequirementRuleService = {
  registerRule(input: RegisterRequirementRuleInput): RecognitionRequirementRule;
  listRules(trustDomainId: string): RecognitionRequirementRule[];
  matchRule(trustDomainId: string, action: string, resourceScope: string): RecognitionRequirementRule | undefined;
};

const specificity = (rule: RecognitionRequirementRule): number =>
  rule.actionPattern.replace(/\*$/, "").length + (rule.resourceScopePattern?.replace(/\*$/, "").length ?? 0);

export function createRequirementRuleService(context: RecognitionRuntimeContext): RequirementRuleService {
  const rules = new Map<string, RecognitionRequirementRule>();

  return {
    registerRule(input) {
      const id = input.id ?? context.ids.nextId("requirement-rule");
      const rule: RecognitionRequirementRule = {
        id,
        trustDomainId: input.trustDomainId,
        actionPattern: input.actionPattern,
        resourceScopePattern: input.resourceScopePattern,
        riskLevel: input.riskLevel,
        requiredEvidenceTypes: input.requiredEvidenceTypes ?? [],
        requiresHumanApproval: input.requiresHumanApproval ?? false,
        metadata: input.metadata,
      };
      rules.set(id, rule);
      return rule;
    },

    listRules(trustDomainId) {
      return [...rules.values()].filter((rule) => rule.trustDomainId === trustDomainId);
    },

    matchRule(trustDomainId, action, resourceScope) {
      const candidates = [...rules.values()].filter(
        (rule) =>
          rule.trustDomainId === trustDomainId &&
          matchesPattern(rule.actionPattern, action) &&
          (rule.resourceScopePattern === undefined || matchesPattern(rule.resourceScopePattern, resourceScope))
      );
      if (candidates.length === 0) return undefined;
      return candidates.reduce((best, candidate) => (specificity(candidate) > specificity(best) ? candidate : best));
    },
  };
}
