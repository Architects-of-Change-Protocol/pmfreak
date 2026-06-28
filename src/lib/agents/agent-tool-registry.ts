import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import type {
  AgentToolRecord,
  AgentToolStatus,
  AgentToolAssignmentRecord,
  RegisterAgentToolInput,
  ListAgentToolsFilter,
} from "./agent-tool-types";

// ─── Row → Domain mapping ─────────────────────────────────────────────────────

type AgentToolRow = {
  id: string;
  workspace_id: string;
  tool_key: string;
  display_name: string;
  description: string;
  category: string;
  risk_level: string;
  execution_mode: string;
  status: string;
  input_schema_json: string | null;
  output_schema_json: string | null;
  required_permissions_json: string;
  compatible_agent_types_json: string;
  creates_evidence: boolean;
  mutates_state: boolean;
  requires_human_approval: boolean;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: AgentToolRow): AgentToolRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    toolKey: row.tool_key,
    displayName: row.display_name,
    description: row.description,
    category: row.category as AgentToolRecord["category"],
    riskLevel: row.risk_level as AgentToolRecord["riskLevel"],
    executionMode: row.execution_mode as AgentToolRecord["executionMode"],
    status: row.status as AgentToolRecord["status"],
    inputSchema: row.input_schema_json ? JSON.parse(row.input_schema_json) : null,
    outputSchema: row.output_schema_json ? JSON.parse(row.output_schema_json) : null,
    requiredPermissions: JSON.parse(row.required_permissions_json ?? "[]"),
    compatibleAgentTypes: JSON.parse(row.compatible_agent_types_json ?? "[]"),
    createsEvidence: row.creates_evidence,
    mutatesState: row.mutates_state,
    requiresHumanApproval: row.requires_human_approval,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const AGENT_TOOL_COLUMNS = [
  "id",
  "workspace_id",
  "tool_key",
  "display_name",
  "description",
  "category",
  "risk_level",
  "execution_mode",
  "status",
  "input_schema_json",
  "output_schema_json",
  "required_permissions_json",
  "compatible_agent_types_json",
  "creates_evidence",
  "mutates_state",
  "requires_human_approval",
  "created_at",
  "updated_at",
] as const;

const COLS = AGENT_TOOL_COLUMNS.join(",");

// ─── Repository functions ─────────────────────────────────────────────────────

export async function registerAgentTool(
  input: RegisterAgentToolInput
): Promise<AgentToolRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();
  const { data, error } = await supabase
    .from("agent_tools")
    .insert({
      id,
      workspace_id: input.workspaceId,
      tool_key: input.toolKey,
      display_name: input.displayName,
      description: input.description,
      category: input.category,
      risk_level: input.riskLevel,
      execution_mode: input.executionMode,
      status: "active",
      input_schema_json: input.inputSchema ? JSON.stringify(input.inputSchema) : null,
      output_schema_json: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
      required_permissions_json: JSON.stringify(input.requiredPermissions ?? []),
      compatible_agent_types_json: JSON.stringify(input.compatibleAgentTypes ?? []),
      creates_evidence: input.createsEvidence ?? false,
      mutates_state: input.mutatesState ?? false,
      requires_human_approval: input.requiresHumanApproval ?? false,
      created_at: now,
      updated_at: now,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(`registerAgentTool failed: ${error.message}`);
  return rowToRecord(data as unknown as AgentToolRow);
}

export async function upsertAgentTool(
  input: RegisterAgentToolInput
): Promise<AgentToolRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_tools")
    .upsert(
      {
        workspace_id: input.workspaceId,
        tool_key: input.toolKey,
        display_name: input.displayName,
        description: input.description,
        category: input.category,
        risk_level: input.riskLevel,
        execution_mode: input.executionMode,
        status: "active",
        input_schema_json: input.inputSchema ? JSON.stringify(input.inputSchema) : null,
        output_schema_json: input.outputSchema ? JSON.stringify(input.outputSchema) : null,
        required_permissions_json: JSON.stringify(input.requiredPermissions ?? []),
        compatible_agent_types_json: JSON.stringify(input.compatibleAgentTypes ?? []),
        creates_evidence: input.createsEvidence ?? false,
        mutates_state: input.mutatesState ?? false,
        requires_human_approval: input.requiresHumanApproval ?? false,
        updated_at: now,
      },
      { onConflict: "workspace_id,tool_key" }
    )
    .select(COLS)
    .single();
  if (error) throw new Error(`upsertAgentTool failed: ${error.message}`);
  return rowToRecord(data as unknown as AgentToolRow);
}

export async function getAgentToolByKey(
  workspaceId: string,
  toolKey: string
): Promise<AgentToolRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tools")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .eq("tool_key", toolKey)
    .maybeSingle();
  if (error) throw new Error(`getAgentToolByKey failed: ${error.message}`);
  return data ? rowToRecord(data as unknown as AgentToolRow) : null;
}

export async function getAgentToolById(
  workspaceId: string,
  toolId: string
): Promise<AgentToolRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tools")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .eq("id", toolId)
    .maybeSingle();
  if (error) throw new Error(`getAgentToolById failed: ${error.message}`);
  return data ? rowToRecord(data as unknown as AgentToolRow) : null;
}

export async function listAgentTools(
  workspaceId: string,
  filter: ListAgentToolsFilter = {}
): Promise<AgentToolRecord[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("agent_tools").select(COLS).eq("workspace_id", workspaceId);

  if (filter.category) q = q.eq("category", filter.category);
  if (filter.riskLevel) q = q.eq("risk_level", filter.riskLevel);
  if (filter.executionMode) q = q.eq("execution_mode", filter.executionMode);

  if (filter.status) {
    q = q.eq("status", filter.status);
  } else if (!filter.includeDisabled) {
    q = q.eq("status", "active");
  }

  q = q.order("category", { ascending: true }).order("tool_key", { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(`listAgentTools failed: ${error.message}`);
  return (data ?? []).map((r: unknown) => rowToRecord(r as AgentToolRow));
}

export async function updateAgentToolStatus(
  workspaceId: string,
  toolKey: string,
  status: AgentToolStatus
): Promise<AgentToolRecord> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tools")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("tool_key", toolKey)
    .select(COLS)
    .single();
  if (error) throw new Error(`updateAgentToolStatus failed: ${error.message}`);
  return rowToRecord(data as unknown as AgentToolRow);
}

export async function deleteOrDeprecateAgentTool(
  workspaceId: string,
  toolKey: string
): Promise<AgentToolRecord> {
  return updateAgentToolStatus(workspaceId, toolKey, "deprecated");
}

// ─── Assignment repository ────────────────────────────────────────────────────

type AgentToolAssignmentRow = {
  id: string;
  workspace_id: string;
  agent_id: string;
  tool_id: string;
  status: string;
  assigned_at: string;
  assigned_by: string | null;
  removed_at: string | null;
};

function assignmentRowToRecord(row: AgentToolAssignmentRow): AgentToolAssignmentRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    toolId: row.tool_id,
    status: row.status as AgentToolAssignmentRecord["status"],
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    removedAt: row.removed_at,
  };
}

export async function assignToolToAgent(input: {
  workspaceId: string;
  agentId: string;
  toolId: string;
  assignedBy?: string;
}): Promise<AgentToolAssignmentRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_tool_assignments")
    .upsert(
      {
        workspace_id: input.workspaceId,
        agent_id: input.agentId,
        tool_id: input.toolId,
        status: "active",
        assigned_at: now,
        assigned_by: input.assignedBy ?? null,
        removed_at: null,
      },
      { onConflict: "workspace_id,agent_id,tool_id" }
    )
    .select("id,workspace_id,agent_id,tool_id,status,assigned_at,assigned_by,removed_at")
    .single();
  if (error) throw new Error(`assignToolToAgent failed: ${error.message}`);
  return assignmentRowToRecord(data as unknown as AgentToolAssignmentRow);
}
