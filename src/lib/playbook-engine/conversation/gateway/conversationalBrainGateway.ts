import { classifyConversationIntent } from "../classifier/intentClassifier";
import { resolveConversationContext } from "../context/contextResolver";
import { routeConversation } from "../router/brainRouter";
import { composeConversationalResponse } from "../composer/responseComposer";
import { handleGeneralPmAdvice } from "../handlers/generalPmAdvisor";
import { handleProjectStatusQuestion } from "../handlers/projectStatusHandler";
import { handleRecommendationRequest } from "../handlers/recommendationHandler";
import { handleRiskAnalysis } from "../handlers/riskHandler";
import { handleCommunicationDraftRequest } from "../handlers/communicationsHandler";
import { handleClosureBillingQuestion } from "../handlers/closureBillingHandler";
import { handleGovernanceQuestion } from "../handlers/governanceHandler";
import { handleAuditQuestion } from "../handlers/auditHandler";
import { handleTaskOrActionRequest } from "../handlers/taskActionHandler";
import { handleUnsupportedRequest } from "../handlers/unsupportedHandler";
import type { BrainRoute, ContextResolution, ConversationalGatewayInput, ConversationalGatewayResult, HandlerResult } from "../types";

function dispatchToHandler(
  route: BrainRoute,
  input: ConversationalGatewayInput,
  resolution: ContextResolution,
): HandlerResult {
  switch (route) {
    case "general_pm_advisor":
      return handleGeneralPmAdvice(input);
    case "project_status_handler":
      return handleProjectStatusQuestion(resolution);
    case "recommendation_handler":
      return handleRecommendationRequest(resolution);
    case "risk_handler":
      return handleRiskAnalysis(resolution);
    case "communications_handler":
      return handleCommunicationDraftRequest(input, resolution);
    case "closure_billing_handler":
      return handleClosureBillingQuestion(resolution.intent, resolution);
    case "governance_handler":
      return handleGovernanceQuestion(resolution);
    case "audit_handler":
      return handleAuditQuestion(input, resolution);
    case "task_action_handler":
      return handleTaskOrActionRequest(resolution);
    case "unsupported_handler":
      return handleUnsupportedRequest();
    default: {
      const exhaustiveCheck: never = route;
      throw new Error(`Unhandled brain route: ${exhaustiveCheck}`);
    }
  }
}

/**
 * The Conversational Brain Gateway's single entry point: classifies intent, resolves whatever
 * project context is actually available, routes to the right internal handler, and composes a
 * governed, PMFreak-style response. Deterministic end to end — no external LLM calls, no
 * persistence, no autonomous execution. Every internal engine call this pipeline makes (via the
 * handlers) is one that already exists from Sprints 1-7; nothing here reimplements them.
 */
export function runConversationalBrainGateway(input: ConversationalGatewayInput): ConversationalGatewayResult {
  const classification = classifyConversationIntent(input.message);
  const resolution = resolveConversationContext(classification.intent, input);
  const routing = routeConversation(classification, input.message);
  const handlerResult = dispatchToHandler(routing.route, input, resolution);

  return composeConversationalResponse(classification, resolution, routing, handlerResult);
}
