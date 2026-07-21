"use client";

import type { ConversationTurn, ConversationalGatewayResult } from "@/lib/playbook-engine";
import type { ChatMessage } from "./types";

export type PostConversationMessageParams = {
  message: string;
  workspaceId?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  conversationHistory?: ConversationTurn[];
};

/** Posts a user message to the Conversational Brain Gateway (via `/api/command-center/chat`) and
 * returns its full structured result — the single call site the Command Center chat uses instead
 * of any mocked/rigid reply. */
export async function postConversationMessage(params: PostConversationMessageParams): Promise<ConversationalGatewayResult> {
  const response = await fetch("/api/command-center/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to process message.");
  return result as ConversationalGatewayResult;
}

/** Converts prior `ChatMessage`s into the `ConversationTurn[]` shape the gateway expects,
 * bounded to the most recent turns to keep request payloads small. */
export function chatMessagesToConversationTurns(messages: ChatMessage[], limit = 12): ConversationTurn[] {
  return messages.slice(-limit).map((message) => ({ role: message.role, message: message.content }));
}

/** Maps a gateway result into the assistant `ChatMessage` the feed renders — `content` is the
 * gateway's already-composed response text (headline, body, next steps, missing-context note
 * all included), and the rest of the result is preserved as `gatewayMeta` for the dev debug panel
 * and the always-visible approval badge. */
export function conversationResultToAssistantMessage(id: string, result: ConversationalGatewayResult): ChatMessage {
  return {
    id,
    role: "assistant",
    content: result.response,
    gatewayMeta: {
      intent: result.intent,
      route: result.route,
      mode: result.mode,
      confidence: result.confidence,
      requiresApproval: result.requiresApproval,
      auditRelevant: result.auditRelevant,
      missingContext: result.missingContext,
      recommendedNextSteps: result.recommendedNextSteps,
    },
  };
}
