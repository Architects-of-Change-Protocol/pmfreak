import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import { requireAuthenticatedUser, requireProjectAccess, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { contextIdFor, parseContextScope, type ContextScope } from "@/lib/context/context-scope";
import { appendMessage, getOrCreateConversation, listMessages } from "@/lib/chat/context-chat-service";
import { buildContextReply } from "@/lib/chat/context-chat-responder";
import { getPmoById } from "@/lib/pmos/pmo-service";

const ROUTE_ID = "/api/context-chat";
const MAX_MESSAGE_LENGTH = 8000;

function handleAccessError(error: unknown) {
  if (error instanceof AccessDeniedError) {
    if (String(error.metadata.reason) === "unauthorized") {
      return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
    }
    return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Forbidden" });
  }
  return null;
}

/**
 * Verifies the caller may use the requested scope. Beyond workspace
 * membership this pins each level to a real row in that workspace so a
 * scope can never be forged across tenants.
 */
async function authorizeScope(scope: ContextScope) {
  await requireWorkspaceMember(scope.workspaceId);
  if (scope.type === "pmo") {
    const pmo = await getPmoById(scope.workspaceId, scope.pmoId);
    if (!pmo) return NextResponse.json({ error: "PMO not found in this workspace." }, { status: 404 });
  }
  if (scope.type === "project") {
    await requireProjectAccess(scope.projectId, "read");
  }
  return null;
}

async function resolveScope(input: { contextType?: unknown; pmoId?: unknown; projectId?: unknown }, userId: string) {
  const resolution = await resolvePreferredWorkspace(userId);
  if (!resolution.workspaceId) return { error: "workspace_missing" } as const;

  const scope = parseContextScope({
    workspaceId: resolution.workspaceId,
    contextType: typeof input.contextType === "string" ? input.contextType : null,
    pmoId: typeof input.pmoId === "string" ? input.pmoId : null,
    projectId: typeof input.projectId === "string" ? input.projectId : null,
  });
  if (!scope) return { error: "invalid_scope" } as const;
  return { scope } as const;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const resolved = await resolveScope(
      {
        contextType: url.searchParams.get("contextType"),
        pmoId: url.searchParams.get("pmoId"),
        projectId: url.searchParams.get("projectId"),
      },
      user.id
    );
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error === "workspace_missing" ? "Workspace context required." : "Invalid context scope." }, { status: 400 });
    }

    const deniedScope = await authorizeScope(resolved.scope);
    if (deniedScope) return deniedScope;

    const conversation = await getOrCreateConversation(resolved.scope, user.id);
    const messages = await listMessages(conversation.id, resolved.scope.workspaceId);
    return NextResponse.json({
      contextId: contextIdFor(resolved.scope),
      conversation,
      messages,
    });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const content = typeof body.message === "string" ? body.message.trim() : "";
    if (!content) return NextResponse.json({ error: "Message is required." }, { status: 400 });
    if (content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 });
    }

    const resolved = await resolveScope(body, user.id);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error === "workspace_missing" ? "Workspace context required." : "Invalid context scope." }, { status: 400 });
    }

    const deniedScope = await authorizeScope(resolved.scope);
    if (deniedScope) return deniedScope;

    const conversation = await getOrCreateConversation(resolved.scope, user.id);

    const userMessage = await appendMessage({
      conversationId: conversation.id,
      workspaceId: resolved.scope.workspaceId,
      role: "user",
      content,
      userId: user.id,
    });

    const reply = await buildContextReply(resolved.scope, content);
    const assistantMessage = await appendMessage({
      conversationId: conversation.id,
      workspaceId: resolved.scope.workspaceId,
      role: "assistant",
      content: reply.content,
      metadata: reply.metadata,
    });

    return NextResponse.json({
      contextId: contextIdFor(resolved.scope),
      conversation,
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to send message.");
  }
}
