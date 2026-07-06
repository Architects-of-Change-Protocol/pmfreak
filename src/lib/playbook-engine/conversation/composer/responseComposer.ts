import type {
  BrainRoutingDecision,
  ContextResolution,
  ConversationalGatewayResult,
  HandlerResult,
  IntentClassification,
} from "../types";
import { formatMissingContextNote } from "./responseTemplates";

function buildResponseText(handlerResult: HandlerResult): string {
  const sections: string[] = [handlerResult.headline, ...handlerResult.body];

  if (handlerResult.recommendedNextSteps.length > 0) {
    sections.push(["Próximos pasos sugeridos:", ...handlerResult.recommendedNextSteps.map((step) => `- ${step}`)].join("\n"));
  }

  const missingContextNote = formatMissingContextNote(handlerResult.missingContext);
  if (missingContextNote) sections.push(missingContextNote);

  return sections.filter((section) => section.trim().length > 0).join("\n\n");
}

function buildSummary(handlerResult: HandlerResult): string {
  return handlerResult.headline;
}

/**
 * Turns a handler's structured intermediate result into the final, user-facing
 * `ConversationalGatewayResult` — the single seam where classifier/router/handler internals get
 * flattened into the response text, summary, and diagnostics the gateway returns. Pure
 * composition: no new judgment calls about approval/audit relevance happen here, they're passed
 * straight through from the handler that made them.
 */
export function composeConversationalResponse(
  classification: IntentClassification,
  resolution: ContextResolution,
  routing: BrainRoutingDecision,
  handlerResult: HandlerResult,
): ConversationalGatewayResult {
  const confidence = Math.round((classification.confidence + resolution.confidence + handlerResult.confidence) / 3);

  return {
    intent: routing.intent,
    route: routing.route,
    mode: handlerResult.mode,
    response: buildResponseText(handlerResult),
    summary: buildSummary(handlerResult),
    recommendedNextSteps: handlerResult.recommendedNextSteps,
    missingContext: handlerResult.missingContext,
    confidence: Math.max(0, Math.min(100, confidence)),
    requiresApproval: handlerResult.requiresApproval,
    auditRelevant: handlerResult.auditRelevant,
    diagnostics: {
      intentSignals: classification.signals,
      routingReason: routing.reason,
      contextConfidence: resolution.confidence,
    },
  };
}
