import { evaluateCapability } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { Permission } from "@/lib/security/rbac";

/**
 * Named capabilities a Screen/Feature can check without ever writing
 * `if (user.role === "admin")` inline (Fase 11). Each maps to the existing
 * RBAC permission underneath `evaluateCapability` already enforces
 * server-side on every real Command/Query — this is a naming layer, not a
 * second authorization system.
 */
export const CAPABILITIES = {
  VIEW_PROJECT: "read",
  APPROVE_DECISION: "write",
  VIEW_EVIDENCE: "read",
  MANAGE_AGENT: "execute_ai_action",
} as const satisfies Record<string, Permission>;

export type Capability = keyof typeof CAPABILITIES;

export type CapabilityResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Never throws — callers render permission-aware UI (08-accessibility-guidelines.md §6)
 * rather than branching on a caught error.
 */
export async function can(
  capability: Capability,
  scope: { projectId?: string; workspaceId?: string },
): Promise<CapabilityResult> {
  try {
    await evaluateCapability({ permission: CAPABILITIES[capability], ...scope });
    return { allowed: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { allowed: false, reason: String(error.metadata.reason ?? "access_denied") };
    }
    throw error;
  }
}

/** Copy required by 08-accessibility-guidelines.md §6 — never a silent disable. */
export const CAPABILITY_DENIAL_COPY: Record<Capability, string> = {
  VIEW_PROJECT: "You do not have access to this project.",
  APPROVE_DECISION: "You can view this project but cannot approve decisions.",
  VIEW_EVIDENCE: "You do not have permission to view evidence for this project.",
  MANAGE_AGENT: "You can view agents but cannot manage agent configuration.",
};
