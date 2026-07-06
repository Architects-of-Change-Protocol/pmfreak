// ─── Conversational Brain — Intent Classifier (Sprint 9) ───────────────────────
export { classifyConversationIntent } from "./intent-classifier";
export { explainIntentClassifierCapability } from "./explain";
export { INTENT_FAMILY_PATTERNS, normalizeIntentText } from "./intent-patterns";
export type { IntentPatternRule, RealIntentFamily } from "./intent-patterns";
export type { IntentClassifierCapabilityExplain } from "./explain";
export type {
  CandidateRoute,
  ClassifyIntentOptions,
  ConversationIntent,
  ConversationIntentFamily,
  ConversationIntentType,
  IntentClassificationResult,
  IntentConfidence,
  IntentSignal,
  MissingClarification,
  MissingClarificationType,
  NormalizedConversationInput,
} from "./intent-classifier-types";
