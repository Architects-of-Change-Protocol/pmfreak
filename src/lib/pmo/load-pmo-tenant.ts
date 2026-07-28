import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { PmoTenant } from "./pmo-tenant-types";

export type PmoTenantLoadResult =
  | { found: true; tenant: PmoTenant; schemaVersion: number }
  | { found: false; schemaVersion?: never; tenant?: never };

type PmoTenantQueryClient = Pick<ReturnType<typeof createSupabaseServiceRoleClient>, "from">;

export async function loadPmoTenant(
  workspaceId: string,
  opts?: { getClient?: () => PmoTenantQueryClient }
): Promise<PmoTenantLoadResult> {
  try {
    const supabase =
      opts?.getClient?.() ??
      createSupabaseServiceRoleClient({
        routeId: "pmo/load-pmo-tenant",
        operation: "select",
        reason: "pmo_tenant_load",
        workspaceId,
        systemActor: "system",
      });

    const { data, error } = await supabase
      .from("workspace_governance")
      .select("governance_jsonb, schema_version")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) return { found: false };
    if (data.schema_version !== 2 || !data.governance_jsonb) return { found: false };

    return {
      found: true,
      tenant: data.governance_jsonb as unknown as PmoTenant,
      schemaVersion: data.schema_version as number,
    };
  } catch {
    return { found: false };
  }
}
