import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONTEXT_CONVERSATION_SELECTABLE_COLUMNS,
  CONTEXT_MESSAGE_SELECTABLE_COLUMNS,
  type ContextConversationRow,
  type ContextMessageRow,
} from "@/lib/db/database-contract";
import { contextIdFor, type ContextScope } from "@/lib/context/context-scope";

const CONVERSATION_COLUMNS = CONTEXT_CONVERSATION_SELECTABLE_COLUMNS.join(", ");
const MESSAGE_COLUMNS = CONTEXT_MESSAGE_SELECTABLE_COLUMNS.join(", ");

/**
 * Conversation persistence for the Workspace → PMO → Project hierarchy.
 *
 * Every scope owns exactly one active conversation (enforced by a partial
 * unique index). Queries always filter on the full scope shape — never on
 * workspace_id alone — so history can never bleed across contexts.
 */

function scopeFilter(scope: ContextScope) {
  return {
    contextType: scope.type,
    pmoId: scope.type === "pmo" ? scope.pmoId : null,
    projectId: scope.type === "project" ? scope.projectId : null,
  };
}

export async function getOrCreateConversation(scope: ContextScope, userId: string): Promise<ContextConversationRow> {
  const supabase = await createSupabaseServerClient();
  const { contextType, pmoId, projectId } = scopeFilter(scope);

  let query = supabase
    .from("context_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("workspace_id", scope.workspaceId)
    .eq("context_type", contextType)
    .eq("status", "active");
  query = pmoId ? query.eq("pmo_id", pmoId) : query.is("pmo_id", null);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing as unknown as ContextConversationRow;

  const { data: created, error } = await supabase
    .from("context_conversations")
    .insert({
      workspace_id: scope.workspaceId,
      context_type: contextType,
      pmo_id: pmoId,
      project_id: projectId,
      title: `${contextType} conversation`,
      created_by_user_id: userId,
    })
    .select(CONVERSATION_COLUMNS)
    .single();

  if (error || !created) {
    // A concurrent request may have created the conversation first (unique
    // index on the scope) — re-read before giving up.
    const { data: raced } = await query.maybeSingle();
    if (raced) return raced as unknown as ContextConversationRow;
    throw new Error(`Unable to create conversation for ${contextIdFor(scope)}: ${error?.message ?? "unknown"}`);
  }
  return created as unknown as ContextConversationRow;
}

export async function listMessages(conversationId: string, workspaceId: string, limit = 200): Promise<ContextMessageRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("context_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Unable to load messages: ${error.message}`);
  return (data ?? []) as unknown as ContextMessageRow[];
}

export async function appendMessage(input: {
  conversationId: string;
  workspaceId: string;
  role: ContextMessageRow["role"];
  content: string;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<ContextMessageRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("context_messages")
    .insert({
      conversation_id: input.conversationId,
      workspace_id: input.workspaceId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? null,
      created_by_user_id: input.userId ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Unable to append message: ${error?.message ?? "unknown"}`);
  return data as unknown as ContextMessageRow;
}
