// PMFreak adapter: PrivilegedDbPort implementation.
// Delegates to PMFreak's createPrivilegedSupabaseClient with the required audit context.
import { createPrivilegedSupabaseClient, type PrivilegedAccessContext } from "@/lib/security/privileged-access";
import type { PrivilegedDbPort, PrivilegedDbContext } from "@/lib/governance/authority/ports/privileged-db";

export class PmfreakPrivilegedDbAdapter implements PrivilegedDbPort {
  createClient(context: PrivilegedDbContext) {
    const pmCtx: PrivilegedAccessContext = {
      routeId: context.routeId,
      operation: context.operation,
      reason: context.reason,
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      systemActor: (context.systemActor as PrivilegedAccessContext["systemActor"]) ?? "system",
    };
    return createPrivilegedSupabaseClient(pmCtx);
  }
}
