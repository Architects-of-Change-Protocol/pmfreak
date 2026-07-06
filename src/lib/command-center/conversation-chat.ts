import { runConversationalBrainGateway } from "@/lib/playbook-engine";
import type { ConversationTurn, ConversationalGatewayResult } from "@/lib/playbook-engine";

/** Bounds how much prior chat history is forwarded to the gateway — recent turns are enough for
 * intent/context resolution and this keeps request payloads small. */
const MAX_HISTORY_TURNS = 12;

export type ConversationChatRequest = {
  message: string;
  workspaceId?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  conversationHistory?: ConversationTurn[];
};

/**
 * The Command Center chat's single seam into the Sprint 8 Conversational Brain Gateway — every
 * user message typed into the chat UI is expected to flow through this function (via the
 * `/api/command-center/chat` route) rather than any rigid/mocked response path. Framework-free on
 * purpose so it can be unit tested directly without mocking Next.js request/response objects.
 */
export function runConversationChat(request: ConversationChatRequest): ConversationalGatewayResult {
  return runConversationalBrainGateway({
    message: request.message,
    workspaceId: request.workspaceId,
    activeProjectId: request.activeProjectId,
    activeProjectName: request.activeProjectName,
    conversationHistory: request.conversationHistory?.slice(-MAX_HISTORY_TURNS),
  });
}
