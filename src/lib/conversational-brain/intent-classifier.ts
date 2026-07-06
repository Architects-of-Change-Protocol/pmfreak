import type {
  ClassifyIntentOptions,
  ConversationIntent,
  ConversationIntentFamily,
  ConversationIntentType,
  IntentClassificationResult,
  IntentConfidence,
  IntentSignal,
  MissingClarification,
  NormalizedConversationInput,
} from "./intent-classifier-types";
import { INTENT_FAMILY_PATTERNS, normalizeIntentText } from "./intent-patterns";
import type { CandidateRoute } from "./intent-classifier-types";

/**
 * Sprint 9 — deterministic, rule-based Intent Classifier. Takes the normalized turn produced by
 * the Conversation Gateway (Sprint 8) and returns a structured `ConversationIntent`. Never calls
 * an LLM, never resolves project context, never decides a final route, and never executes or
 * persists anything — it only classifies text.
 */

/** Tie-break order applied only when two or more families are genuinely tied at the top score. */
const FAMILY_TIE_BREAK_ORDER: ConversationIntentFamily[] = [
  "task_action",
  "communication_draft",
  "closure_billing",
  "playbook_analysis",
  "project_status",
];

const FAMILY_CANDIDATE_ROUTES: Record<ConversationIntentFamily, CandidateRoute[]> = {
  general_pm_advice: ["general_pm_advisor"],
  project_status: ["project_brain"],
  playbook_analysis: ["playbook_engine"],
  communication_draft: ["communications_engine"],
  closure_billing: ["closure_billing_engine"],
  governance_audit: ["governance_engine"],
  risk_issue_dependency: ["project_brain"],
  decision_support: ["playbook_engine", "governance_engine"],
  task_action: ["task_action_engine"],
  needs_clarification: ["clarification"],
  unknown: ["unsupported"],
};

const FAMILY_REQUIRES_PROJECT_CONTEXT: Record<ConversationIntentFamily, boolean> = {
  general_pm_advice: false,
  project_status: true,
  playbook_analysis: true,
  communication_draft: true,
  closure_billing: true,
  governance_audit: true,
  risk_issue_dependency: true,
  decision_support: true,
  task_action: true,
  needs_clarification: false,
  unknown: false,
};

const FAMILY_REQUIRES_EVIDENCE: Record<ConversationIntentFamily, boolean> = {
  general_pm_advice: false,
  project_status: true,
  playbook_analysis: true,
  communication_draft: false,
  closure_billing: true,
  governance_audit: true,
  risk_issue_dependency: true,
  decision_support: true,
  task_action: false,
  needs_clarification: false,
  unknown: false,
};

/** Sensitive-action families that should surface an approval gate downstream, before anything
 * is sent, billed, or executed on behalf of the user. */
const FAMILY_MAY_REQUIRE_APPROVAL: Record<ConversationIntentFamily, boolean> = {
  general_pm_advice: false,
  project_status: false,
  playbook_analysis: false,
  communication_draft: true,
  closure_billing: true,
  governance_audit: false,
  risk_issue_dependency: false,
  decision_support: false,
  task_action: true,
  needs_clarification: false,
  unknown: false,
};

const AMBIGUOUS_WORD_COUNT_THRESHOLD = 3;

function confidenceFromScore(score: number): IntentConfidence {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score >= 1) return "low";
  return "unknown";
}

type FamilyScores = Partial<Record<ConversationIntentFamily, number>>;

function scoreFamilies(normalizedMessage: string): { familyScores: FamilyScores; allSignals: IntentSignal[] } {
  const familyScores: FamilyScores = {};
  const allSignals: IntentSignal[] = [];

  for (const [family, rules] of Object.entries(INTENT_FAMILY_PATTERNS) as [
    Exclude<ConversationIntentFamily, "unknown" | "needs_clarification">,
    (typeof INTENT_FAMILY_PATTERNS)[keyof typeof INTENT_FAMILY_PATTERNS],
  ][]) {
    let total = 0;
    for (const rule of rules) {
      if (rule.pattern.test(normalizedMessage)) {
        total += rule.weight;
        allSignals.push({ family, intentType: rule.intentType, label: rule.label, weight: rule.weight });
      }
    }
    if (total > 0) familyScores[family] = total;
  }

  return { familyScores, allSignals };
}

type WinningFamily = { family: ConversationIntentFamily; score: number; ambiguous: boolean };

function pickWinningFamily(familyScores: FamilyScores, wordCount: number): WinningFamily {
  const entries = Object.entries(familyScores) as [ConversationIntentFamily, number][];

  if (entries.length === 0) {
    if (wordCount > 0 && wordCount <= AMBIGUOUS_WORD_COUNT_THRESHOLD) {
      return { family: "needs_clarification", score: 0, ambiguous: true };
    }
    return { family: "unknown", score: 0, ambiguous: false };
  }

  const maxScore = Math.max(...entries.map(([, score]) => score));
  const tied = entries.filter(([, score]) => score === maxScore).map(([family]) => family);

  if (tied.length === 1) {
    return { family: tied[0], score: maxScore, ambiguous: false };
  }

  for (const candidate of FAMILY_TIE_BREAK_ORDER) {
    if (tied.includes(candidate)) {
      return { family: candidate, score: maxScore, ambiguous: false };
    }
  }

  return { family: "needs_clarification", score: maxScore, ambiguous: true };
}

function pickIntentType(family: ConversationIntentFamily, familySignals: IntentSignal[]): ConversationIntentType {
  if (familySignals.length === 0) {
    return family === "needs_clarification" ? "clarification_needed" : "unrecognized_intent";
  }
  const strongest = [...familySignals].sort((a, b) => b.weight - a.weight)[0];
  return strongest.intentType;
}

function buildRationale(
  family: ConversationIntentFamily,
  score: number,
  confidence: IntentConfidence,
  signals: IntentSignal[],
  ambiguous: boolean,
): string {
  if (signals.length === 0) {
    return ambiguous
      ? "El mensaje es demasiado corto o ambiguo para identificar señales claras; se requiere aclaración antes de clasificar."
      : "No se detectó ningún patrón conocido en el mensaje; no coincide con ninguna familia de intención soportada.";
  }
  const signalList = signals.map((s) => `"${s.label}" (peso ${s.weight})`).join(", ");
  return `Familia "${family}" seleccionada con score ${score} (confianza ${confidence}) a partir de las señales: ${signalList}.`;
}

/**
 * Classifies a single normalized conversational turn. Deterministic and pure: no LLM calls, no
 * DB reads, no Context Resolver, no route decision, no side effects of any kind.
 */
export function classifyConversationIntent(
  normalizedInput: NormalizedConversationInput,
  options: ClassifyIntentOptions = {},
): IntentClassificationResult {
  const normalizedMessage = normalizeIntentText(normalizedInput.message ?? "");
  const wordCount = normalizedMessage.split(/\s+/).filter(Boolean).length;

  const { familyScores, allSignals } = scoreFamilies(normalizedMessage);
  const winner = pickWinningFamily(familyScores, wordCount);
  const detectedSignals = allSignals.filter((signal) => signal.family === winner.family);
  const intentType = pickIntentType(winner.family, detectedSignals);
  const confidence: IntentConfidence = winner.ambiguous
    ? winner.score > 0
      ? "low"
      : "unknown"
    : confidenceFromScore(winner.score);

  const requiresProjectContext = FAMILY_REQUIRES_PROJECT_CONTEXT[winner.family];
  const requiresEvidence = FAMILY_REQUIRES_EVIDENCE[winner.family];
  const mayRequireApproval = FAMILY_MAY_REQUIRE_APPROVAL[winner.family];
  const isActionRequest = winner.family === "task_action";
  const isExternalCommunicationRequest = winner.family === "communication_draft";
  const isReadOnly = !isActionRequest;
  const candidateRoutes = FAMILY_CANDIDATE_ROUTES[winner.family];

  const missingClarifications: MissingClarification[] = [];
  if (requiresProjectContext && !normalizedInput.projectId) {
    missingClarifications.push({
      type: "missing_project",
      message: "Necesito saber de qué proyecto estás hablando para continuar.",
    });
  }

  const rationale = buildRationale(winner.family, winner.score, confidence, detectedSignals, winner.ambiguous);
  const createdAt = options.now ? options.now() : new Date().toISOString();

  const intent: ConversationIntent = {
    intentFamily: winner.family,
    intentType,
    confidence,
    score: winner.score,
    rationale,
    requiresProjectContext,
    requiresEvidence,
    mayRequireApproval,
    isActionRequest,
    isExternalCommunicationRequest,
    isReadOnly,
    candidateRoutes,
    detectedSignals,
    missingClarifications,
    createdAt,
  };

  return { intent, normalizedMessage, familyScores };
}
