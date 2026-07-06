import type { ConversationIntent, IntentClassification, IntentSignal } from "../types";
import { detectConversationLanguage, INTENT_PATTERNS, normalizeConversationText } from "./intentClassifier.rules";

/**
 * Tie-break order when two intents score identically — earlier entries win. Mirrors the order
 * intents are declared in the sprint spec; `unsupported` sits last since it is only ever a
 * fallback classification, never something a genuinely PM-shaped message should out-score.
 */
const INTENT_PRIORITY: Exclude<ConversationIntent, "clarification" | "unknown">[] = [
  "general_pm_advice",
  "project_status_question",
  "recommendation_request",
  "risk_analysis",
  "communication_draft",
  "closure_question",
  "billing_question",
  "governance_question",
  "audit_question",
  "task_or_action_request",
  "unsupported",
];

const MIN_WORDS_FOR_CONFIDENT_CLASSIFICATION = 3;

function scoreIntents(normalizedMessage: string): { scores: Map<ConversationIntent, number>; signals: IntentSignal[] } {
  const scores = new Map<ConversationIntent, number>();
  const signals: IntentSignal[] = [];

  for (const intent of INTENT_PRIORITY) {
    const patterns = INTENT_PATTERNS[intent];
    let total = 0;
    for (const { pattern, weight, label } of patterns) {
      if (pattern.test(normalizedMessage)) {
        total += weight;
        signals.push({ intent, matchedPattern: label, weight });
      }
    }
    if (total > 0) scores.set(intent, total);
  }

  return { scores, signals };
}

/**
 * Rule-based, deterministic intent classification. Never calls an LLM/external service — every
 * pattern lives in `intentClassifier.rules.ts`. Supports informal Spanish phrasing (accents are
 * stripped before matching) as well as English equivalents. Messages that don't match anything
 * PM-shaped come back as `"unknown"` rather than being forced into a bucket; clearly off-domain
 * trivia (matching the `unsupported` pattern list) comes back as `"unsupported"` directly.
 */
export function classifyConversationIntent(message: string): IntentClassification {
  const normalized = normalizeConversationText(message);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const { scores, signals } = scoreIntents(normalized);

  if (scores.size === 0) {
    const language = detectConversationLanguage(normalized);
    if (wordCount > 0 && wordCount < MIN_WORDS_FOR_CONFIDENT_CLASSIFICATION) {
      return { intent: "clarification", confidence: 20, signals: [], language };
    }
    return { intent: "unknown", confidence: 0, signals: [], language };
  }

  let winningIntent: ConversationIntent = "unknown";
  let winningScore = -1;
  for (const intent of INTENT_PRIORITY) {
    const score = scores.get(intent);
    if (score !== undefined && score > winningScore) {
      winningScore = score;
      winningIntent = intent;
    }
  }

  const winningSignals = signals.filter((signal) => signal.intent === winningIntent);
  const confidence = Math.max(0, Math.min(100, winningScore));
  const language = detectConversationLanguage(normalized);

  return { intent: winningIntent, confidence, signals: winningSignals, language };
}
