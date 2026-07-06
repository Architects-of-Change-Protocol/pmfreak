import type { BrainRoute, BrainRoutingDecision, ConversationIntent, IntentClassification } from "../types";

const DIRECT_ROUTES: Partial<Record<ConversationIntent, BrainRoute>> = {
  general_pm_advice: "general_pm_advisor",
  project_status_question: "project_status_handler",
  recommendation_request: "recommendation_handler",
  risk_analysis: "risk_handler",
  communication_draft: "communications_handler",
  closure_question: "closure_billing_handler",
  billing_question: "closure_billing_handler",
  governance_question: "governance_handler",
  audit_question: "audit_handler",
  task_or_action_request: "task_action_handler",
  // `clarification` has no dedicated handler — general PM advice already knows how to ask a
  // clarifying question when it can't tell what's being asked, so routing it there is safer
  // than a flat "unsupported" bounce.
  clarification: "general_pm_advisor",
};

/** Generic PM-domain words that, even on an otherwise unmatched message, suggest the user is
 * still asking about their project rather than something wholly unrelated — routing those to
 * general PM advice is a safer fallback than the polite "that's outside PMFreak" redirect. */
const WEAK_PM_SIGNAL = /\b(proyecto|project|cliente|client|equipo|team|tarea|task|entregable|deliverable)\b/;

/**
 * Routes a classified intent to the internal handler responsible for it. `unsupported` always
 * goes to `unsupported_handler`. `unknown` normally does too, unless the message still carries a
 * weak PM-domain signal — in which case falling back to general PM advice is the safer answer
 * than telling a genuine (if unclear) PM question that it's out of scope.
 */
export function routeConversation(classification: IntentClassification, rawMessage: string): BrainRoutingDecision {
  const { intent } = classification;

  const direct = DIRECT_ROUTES[intent];
  if (direct) {
    return { intent, route: direct, reason: `Direct route for intent '${intent}'.` };
  }

  if (intent === "unsupported") {
    return { intent, route: "unsupported_handler", reason: "Classified as unsupported (off-domain trivia)." };
  }

  // intent === "unknown"
  if (WEAK_PM_SIGNAL.test(rawMessage.toLowerCase())) {
    return {
      intent,
      route: "general_pm_advisor",
      reason: "Intent unknown but message still carries PM-domain vocabulary — general fallback is safer than an unsupported bounce.",
    };
  }

  return { intent, route: "unsupported_handler", reason: "Intent unknown and no PM-domain signal detected." };
}
