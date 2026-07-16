import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Founder Circle Program — the single service-role entry point for the
 * whole founder-program domain.
 *
 * Every founder_* table is locked down to service-role (no authenticated
 * write grants anywhere; reads only via narrow column-scoped self-select
 * policies), so all mutations flow through validated route handlers that
 * obtain their client here. Centralizing the factory keeps the privileged
 * surface auditable as ONE registry entry.
 */
// PRIVILEGED_ACCESS: Founder Program tables are deliberately service-role-only (operator surfaces aggregate cross-workspace program data; participant writes are validated in route handlers against tables with no client write grants).
// AUDIT_REF: service-role-risk-register.md
export function createFounderProgramDbClient(input: { operation: string; actorUserId?: string | null }) {
  return createSupabaseServiceRoleClient({
    routeId: "lib.founder-program",
    operation: input.operation,
    reason: "founder_program_service_surface",
    systemActor: "system",
    ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
  });
}
