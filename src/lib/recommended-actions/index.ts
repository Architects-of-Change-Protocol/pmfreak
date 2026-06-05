export { generateRecommendedActions } from "@/lib/recommended-actions/generate-recommended-actions";
export type { GeneratedRecommendedAction, RecommendedActionType, RecommendedActionStatus, ImpactLevel } from "@/lib/recommended-actions/generate-recommended-actions";
export { materializeRecommendedActions } from "@/lib/recommended-actions/materialize-recommended-actions";
export type { RecommendedActionsMaterializationResult } from "@/lib/recommended-actions/materialize-recommended-actions";
// decideRecommendedAction is server-only; import directly from decision-workflow.ts in server contexts
export type { DecisionInput, RecommendedActionDecisionResult } from "@/lib/recommended-actions/decision-workflow";
