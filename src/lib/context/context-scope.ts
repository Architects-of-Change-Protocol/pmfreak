/**
 * Context scoping for the Workspace → PMO → Project hierarchy.
 *
 * Every level owns an isolated context: its own chat, its own memory, its
 * own AI grounding. A ContextScope is the canonical way to express "which
 * level am I talking to", and contextIdFor() derives the stable Context ID
 * used to partition conversational memory. The AI layer must never mix
 * material across two different Context IDs.
 */

export type ContextScope =
  | { type: "workspace"; workspaceId: string }
  | { type: "pmo"; workspaceId: string; pmoId: string }
  | { type: "project"; workspaceId: string; projectId: string; pmoId?: string | null };

export function contextIdFor(scope: ContextScope): string {
  switch (scope.type) {
    case "workspace":
      return `workspace:${scope.workspaceId}`;
    case "pmo":
      return `pmo:${scope.pmoId}`;
    case "project":
      return `project:${scope.projectId}`;
  }
}

export type ParsedContextScopeInput = {
  workspaceId: string;
  contextType: string | null | undefined;
  pmoId?: string | null;
  projectId?: string | null;
};

/**
 * Validates raw request input into a well-formed ContextScope, or returns
 * null when the shape is inconsistent (e.g. pmo scope without a pmoId).
 */
export function parseContextScope(input: ParsedContextScopeInput): ContextScope | null {
  if (!input.workspaceId) return null;

  switch (input.contextType) {
    case "workspace":
      return { type: "workspace", workspaceId: input.workspaceId };
    case "pmo":
      if (!input.pmoId) return null;
      return { type: "pmo", workspaceId: input.workspaceId, pmoId: input.pmoId };
    case "project":
      if (!input.projectId) return null;
      return {
        type: "project",
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        pmoId: input.pmoId ?? null,
      };
    default:
      return null;
  }
}
