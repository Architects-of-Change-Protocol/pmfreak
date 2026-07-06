export { classifyConversationIntent } from "./classifier/intentClassifier";
export { INTENT_PATTERNS, normalizeConversationText, detectConversationLanguage } from "./classifier/intentClassifier.rules";
export type { IntentPattern } from "./classifier/intentClassifier.rules";

export { resolveConversationContext } from "./context/contextResolver";
export { computeMissingContext } from "./context/missingContext";
export type { MissingContextParams } from "./context/missingContext";

export { routeConversation } from "./router/brainRouter";

export { composeConversationalResponse } from "./composer/responseComposer";
export {
  MISSING_CONTEXT_LABELS,
  formatMissingContextNote,
  APPROVAL_REQUIRED_NOTE,
  UNSUPPORTED_REDIRECT,
  NO_EVIDENCE_DISCLAIMER,
} from "./composer/responseTemplates";

export { handleGeneralPmAdvice } from "./handlers/generalPmAdvisor";
export { handleProjectStatusQuestion } from "./handlers/projectStatusHandler";
export { handleRecommendationRequest } from "./handlers/recommendationHandler";
export { handleRiskAnalysis } from "./handlers/riskHandler";
export { handleCommunicationDraftRequest } from "./handlers/communicationsHandler";
export { handleClosureBillingQuestion } from "./handlers/closureBillingHandler";
export { handleGovernanceQuestion } from "./handlers/governanceHandler";
export { handleAuditQuestion } from "./handlers/auditHandler";
export { handleTaskOrActionRequest } from "./handlers/taskActionHandler";
export { handleUnsupportedRequest } from "./handlers/unsupportedHandler";

export { runConversationalBrainGateway } from "./gateway/conversationalBrainGateway";

export {
  CONVERSATIONAL_DEMO_SCENARIOS,
  runConversationalDemoScenario,
} from "./demo/conversationalDemoScenarios";
export type { ConversationalDemoScenario, ConversationalDemoScenarioId } from "./demo/conversationalDemoScenarios";

export type {
  BrainRoute,
  BrainRoutingDecision,
  ContextResolution,
  ConversationIntent,
  ConversationLanguage,
  ConversationMetadata,
  ConversationTurn,
  ConversationTurnRole,
  ConversationalGatewayDiagnostics,
  ConversationalGatewayInput,
  ConversationalGatewayResult,
  HandlerResult,
  IntentClassification,
  IntentSignal,
  MissingContextItem,
  ResolvedProjectContext,
  ResponseMode,
} from "./types";
