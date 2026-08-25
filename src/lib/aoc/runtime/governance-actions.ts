/**
 * Canonical governance action mappings for PMFreak.
 *
 * Single source of truth for:
 *   - Permission → GovernanceAction mapping (replaces local copies in access-guards, agent-access, server-authorization)
 *   - CapabilityPermission → GovernanceAction mapping (used by capability-flow)
 *   - SDK route → GovernanceAction constants (used by SDK API routes)
 *
 * Routes must import from here instead of defining semantics locally.
 * Adding a mapping here does NOT register a new runtime action — GovernanceAction is
 * defined by @aoc-enterprise/runtime and must already exist in GOVERNANCE_POLICY_REGISTRY.
 */
import type { GovernanceAction } from "@/lib/governance/authority/runtime";
import type { Permission } from "@/lib/security/rbac";

// Permission → GovernanceAction.
// Canonical mapping consumed by access-guards, agent-access, server-authorization, capability-flow.
export const PERMISSION_TO_GOVERNANCE_ACTION: Record<Permission, GovernanceAction> = {
  read: "project.read",
  write: "project.write",
  delete: "project.write",
  write_memory: "memory.write",
  delete_memory: "memory.write",
  manage_members: "members.manage",
  manage_projects: "workspace.manage",
  manage_workspace: "workspace.manage",
  manage_ai: "workspace.manage",
  manage_billing: "billing.manage",
  execute_ai_action: "ai.execute",
  view_executive: "executive.view",
  upload_documents: "document.upload",
} as const;

// CapabilityPermission → GovernanceAction.
// Used by createCapabilityRequest to map capability request types to runtime actions.
export const CAPABILITY_PERMISSION_TO_GOVERNANCE_ACTION = {
  read: "project.read",
  write: "project.write",
  execute: "ai.execute",
  manage: "workspace.manage",
  approve: "workspace.manage",
  delegate: "workspace.manage",
} as const satisfies Record<string, GovernanceAction>;

/**
 * SDK governance route actions.
 *
 * Maps semantic SDK operations to existing AOC GovernanceActions.
 * All values must exist in GOVERNANCE_POLICY_REGISTRY in the enterprise runtime.
 *
 * Read operations use "executive.view" (owner, admin, PM, executive_viewer).
 * Management operations use "ai.manage" (owner, admin).
 * Critical capability-grant operations use "workspace.manage" (owner).
 */
export const SDK_GOVERNANCE_ACTIONS = {
  // AI agent read/management — requires manage_ai (owner, admin)
  AGENTS_READ: "ai.manage",
  AGENTS_MANAGE: "ai.manage",

  // Governance audit reads — requires view_executive (owner, admin, PM, executive_viewer)
  AUDIT_READ: "executive.view",

  // Capability governance reads — requires view_executive
  CAPABILITIES_READ: "executive.view",

  // Capability grant issuance and revocation — workspace.manage (owner only)
  // These are the highest-privilege operations in the capability system.
  CAPABILITIES_MANAGE: "workspace.manage",

  // Policy reads — requires view_executive (owner, admin, PM, executive_viewer)
  POLICIES_READ: "executive.view",

  // Policy mutations — requires manage_ai (owner, admin)
  POLICIES_MANAGE: "ai.manage",
} as const satisfies Record<string, GovernanceAction>;
