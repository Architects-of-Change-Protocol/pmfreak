import {
  registerAgentTool,
  upsertAgentTool,
  getAgentToolByKey,
  listAgentTools,
} from "./agent-tool-registry";
import { DEFAULT_AGENT_TOOLS } from "./agent-tool-defaults";
import type {
  AgentToolRecord,
  AgentToolEligibilityResult,
  CheckAgentToolEligibilityInput,
  ListAgentToolsFilter,
} from "./agent-tool-types";

// ─── Default tool seeding ─────────────────────────────────────────────────────

export async function ensureDefaultAgentTools(
  workspaceId: string
): Promise<AgentToolRecord[]> {
  const results: AgentToolRecord[] = [];
  for (const toolDef of DEFAULT_AGENT_TOOLS) {
    const record = await upsertAgentTool({ ...toolDef, workspaceId });
    results.push(record);
  }
  return results;
}

// ─── Listing ──────────────────────────────────────────────────────────────────

export async function listAvailableToolsForAgent(input: {
  workspaceId: string;
  agentType: string;
  filter?: ListAgentToolsFilter;
}): Promise<AgentToolRecord[]> {
  const tools = await listAgentTools(input.workspaceId, {
    ...input.filter,
    includeDisabled: false,
  });
  return tools.filter((t) => {
    if (t.status !== "active") return false;
    if (t.compatibleAgentTypes.length > 0) {
      return t.compatibleAgentTypes.includes(input.agentType);
    }
    return true;
  });
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

export async function checkAgentToolEligibility(
  input: CheckAgentToolEligibilityInput
): Promise<AgentToolEligibilityResult> {
  const tool = await getAgentToolByKey(input.workspaceId, input.toolKey);

  if (!tool) {
    return {
      eligible: false,
      reasonCode: "tool_not_found",
      message: `Tool '${input.toolKey}' is not registered in this workspace.`,
      requiredApproval: false,
    };
  }

  if (tool.status === "disabled") {
    return {
      eligible: false,
      reasonCode: "tool_disabled",
      message: `Tool '${input.toolKey}' is currently disabled.`,
      requiredApproval: false,
      riskLevel: tool.riskLevel,
    };
  }

  if (tool.status === "deprecated") {
    return {
      eligible: false,
      reasonCode: "tool_deprecated",
      message: `Tool '${input.toolKey}' has been deprecated and is no longer available.`,
      requiredApproval: false,
      riskLevel: tool.riskLevel,
    };
  }

  if (
    tool.compatibleAgentTypes.length > 0 &&
    !tool.compatibleAgentTypes.includes(input.agentType)
  ) {
    return {
      eligible: false,
      reasonCode: "agent_type_not_compatible",
      message: `Agent type '${input.agentType}' is not permitted to use tool '${input.toolKey}'.`,
      requiredApproval: false,
      riskLevel: tool.riskLevel,
    };
  }

  if (tool.requiredPermissions.length > 0) {
    const granted = new Set(input.grantedPermissions ?? []);
    const missing = tool.requiredPermissions.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      return {
        eligible: false,
        reasonCode: "missing_permission",
        message: `Missing required permissions: ${missing.join(", ")}.`,
        requiredApproval: false,
        riskLevel: tool.riskLevel,
      };
    }
  }

  if (tool.requiresHumanApproval && !input.allowApprovalRequiredTools) {
    return {
      eligible: false,
      reasonCode: "human_approval_required",
      message: `Tool '${input.toolKey}' requires human approval before use.`,
      requiredApproval: true,
      riskLevel: tool.riskLevel,
    };
  }

  return {
    eligible: true,
    reasonCode: "eligible",
    message: `Tool '${input.toolKey}' is available for use.`,
    requiredApproval: tool.requiresHumanApproval,
    riskLevel: tool.riskLevel,
  };
}

// ─── Re-export registry functions for convenience ─────────────────────────────

export {
  registerAgentTool,
  upsertAgentTool,
  getAgentToolByKey,
  listAgentTools,
} from "./agent-tool-registry";
export { updateAgentToolStatus, deleteOrDeprecateAgentTool, getAgentToolById, assignToolToAgent } from "./agent-tool-registry";
