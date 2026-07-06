import type { HandlerResult } from "../types";
import { UNSUPPORTED_REDIRECT } from "../composer/responseTemplates";

/**
 * Politely redirects questions outside PMFreak's domain (general trivia, unrelated topics) back
 * toward what the Conversational Brain Gateway can actually help with.
 */
export function handleUnsupportedRequest(): HandlerResult {
  return {
    mode: "unsupported",
    headline: UNSUPPORTED_REDIRECT,
    body: [],
    recommendedNextSteps: [],
    missingContext: [],
    requiresApproval: false,
    auditRelevant: false,
    confidence: 90,
    sourced: false,
  };
}
