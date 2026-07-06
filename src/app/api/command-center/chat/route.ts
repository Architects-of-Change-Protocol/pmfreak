import { getAuthUser } from "@/lib/auth";
import { denyResponse } from "@/lib/security/deny-response";
import { runConversationChat } from "@/lib/command-center/conversation-chat";
import type { ConversationTurn } from "@/lib/playbook-engine";

const ROUTE_ID = "/api/command-center/chat";

function isConversationTurn(value: unknown): value is ConversationTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (turn.role === "user" || turn.role === "assistant") && typeof turn.message === "string";
}

/**
 * The Command Center chat's only server endpoint: takes a natural-language message and routes it
 * through the Sprint 8 Conversational Brain Gateway (`runConversationChat`). Deliberately thin —
 * no LLM calls, no persistence, no RAG — the gateway itself is a deterministic, rule-based
 * domain function; this route's only job is auth plus request/response shaping.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "message is required." }, { status: 400 });

  const conversationHistory = Array.isArray(body.conversationHistory)
    ? body.conversationHistory.filter(isConversationTurn)
    : undefined;

  const result = runConversationChat({
    message,
    workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : undefined,
    activeProjectId: typeof body.activeProjectId === "string" ? body.activeProjectId : undefined,
    activeProjectName: typeof body.activeProjectName === "string" ? body.activeProjectName : undefined,
    conversationHistory,
  });

  return Response.json(result);
}
