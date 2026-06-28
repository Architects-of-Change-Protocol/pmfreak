import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Load source files ────────────────────────────────────────────────────────

const types = fs.readFileSync("src/lib/agents/agent-tool-types.ts", "utf8");
const defaults = fs.readFileSync("src/lib/agents/agent-tool-defaults.ts", "utf8");
const registry = fs.readFileSync("src/lib/agents/agent-tool-registry.ts", "utf8");
const service = fs.readFileSync("src/lib/agents/agent-tool-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260726000000_agent_tool_registry.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// ─── Import pure logic inline (no DB required) ───────────────────────────────

// We test the pure validation functions by evaluating the module in a safe way.
// Since this runs with Node test runner and tsx, we can do dynamic imports.
const {
  validateAgentToolKey,
  validateAgentToolCategory,
  validateAgentToolRiskLevel,
  validateAgentToolExecutionMode,
  normalizeRegisterAgentToolInput,
} = await import("../src/lib/agents/agent-tool-types.ts");

const { DEFAULT_AGENT_TOOLS } = await import("../src/lib/agents/agent-tool-defaults.ts");

// ─── Type definitions ─────────────────────────────────────────────────────────

test("AgentToolCategory type contains all required categories", () => {
  const required = [
    "project_read","portfolio_read","pm_read","analysis","drafting",
    "recommendation","task_generation","communication","governance",
    "reporting","administration",
  ];
  for (const cat of required) {
    assert.ok(types.includes(`"${cat}"`), `Missing category: ${cat}`);
  }
});

test("AgentToolRiskLevel type contains all levels", () => {
  assert.match(types, /"low"/);
  assert.match(types, /"medium"/);
  assert.match(types, /"high"/);
  assert.match(types, /"critical"/);
});

test("AgentToolStatus type contains all statuses", () => {
  assert.match(types, /"active"/);
  assert.match(types, /"disabled"/);
  assert.match(types, /"deprecated"/);
});

test("AgentToolExecutionMode type contains all modes", () => {
  assert.match(types, /"read_only"/);
  assert.match(types, /"draft_only"/);
  assert.match(types, /"requires_approval"/);
  assert.match(types, /"automatic"/);
});

test("AgentToolRecord has all required fields", () => {
  const fields = [
    "id","workspaceId","toolKey","displayName","description","category",
    "riskLevel","executionMode","status","inputSchema","outputSchema",
    "requiredPermissions","compatibleAgentTypes","createsEvidence",
    "mutatesState","requiresHumanApproval","createdAt","updatedAt",
  ];
  for (const f of fields) {
    assert.ok(types.includes(f), `Missing field: ${f}`);
  }
});

test("AgentToolEligibilityResult has all reason codes", () => {
  const codes = [
    "eligible","tool_not_found","tool_disabled","tool_deprecated",
    "agent_type_not_compatible","missing_permission","human_approval_required",
    "execution_mode_not_allowed",
  ];
  for (const c of codes) {
    assert.ok(types.includes(`"${c}"`), `Missing reason code: ${c}`);
  }
});

// ─── Validation ───────────────────────────────────────────────────────────────

test("validateAgentToolKey: valid key passes", () => {
  assert.equal(validateAgentToolKey("read_project_summary"), null);
  assert.equal(validateAgentToolKey("analyze_meeting_notes"), null);
  assert.equal(validateAgentToolKey("x"), null);
});

test("validateAgentToolKey: empty key is rejected", () => {
  assert.notEqual(validateAgentToolKey(""), null);
});

test("validateAgentToolKey: key with uppercase is rejected", () => {
  assert.notEqual(validateAgentToolKey("ReadProject"), null);
});

test("validateAgentToolKey: key with spaces is rejected", () => {
  assert.notEqual(validateAgentToolKey("read project"), null);
});

test("validateAgentToolKey: key over 120 chars is rejected", () => {
  assert.notEqual(validateAgentToolKey("a".repeat(121)), null);
});

test("validateAgentToolCategory: valid categories pass", () => {
  assert.equal(validateAgentToolCategory("project_read"), true);
  assert.equal(validateAgentToolCategory("drafting"), true);
  assert.equal(validateAgentToolCategory("reporting"), true);
});

test("validateAgentToolCategory: invalid category fails", () => {
  assert.equal(validateAgentToolCategory("unknown_category"), false);
});

test("validateAgentToolRiskLevel: valid levels pass", () => {
  assert.equal(validateAgentToolRiskLevel("low"), true);
  assert.equal(validateAgentToolRiskLevel("critical"), true);
});

test("validateAgentToolRiskLevel: invalid level fails", () => {
  assert.equal(validateAgentToolRiskLevel("extreme"), false);
});

test("validateAgentToolExecutionMode: valid modes pass", () => {
  assert.equal(validateAgentToolExecutionMode("read_only"), true);
  assert.equal(validateAgentToolExecutionMode("automatic"), true);
});

test("validateAgentToolExecutionMode: invalid mode fails", () => {
  assert.equal(validateAgentToolExecutionMode("fire_and_forget"), false);
});

test("normalizeRegisterAgentToolInput: valid input passes", () => {
  const result = normalizeRegisterAgentToolInput({
    workspaceId: "ws-1",
    toolKey: "read_project_summary",
    displayName: "Read Project Summary",
    description: "Reads the project summary.",
    category: "project_read",
    riskLevel: "low",
    executionMode: "read_only",
  });
  assert.equal(result.error, null);
});

test("normalizeRegisterAgentToolInput: missing displayName is rejected", () => {
  const result = normalizeRegisterAgentToolInput({
    workspaceId: "ws-1",
    toolKey: "read_project_summary",
    displayName: "",
    description: "desc",
    category: "project_read",
    riskLevel: "low",
    executionMode: "read_only",
  });
  assert.notEqual(result.error, null);
});

test("normalizeRegisterAgentToolInput: bad category is rejected", () => {
  const result = normalizeRegisterAgentToolInput({
    workspaceId: "ws-1",
    toolKey: "read_project_summary",
    displayName: "Name",
    description: "desc",
    category: "bad_cat",
    riskLevel: "low",
    executionMode: "read_only",
  });
  assert.notEqual(result.error, null);
});

// ─── Default tools ────────────────────────────────────────────────────────────

test("DEFAULT_AGENT_TOOLS has at least 10 entries", () => {
  assert.ok(DEFAULT_AGENT_TOOLS.length >= 10, `Only ${DEFAULT_AGENT_TOOLS.length} default tools`);
});

test("DEFAULT_AGENT_TOOLS includes required tool keys", () => {
  const keys = new Set(DEFAULT_AGENT_TOOLS.map((t) => t.toolKey));
  const required = [
    "read_project_summary","read_project_risks","read_pm_capacity_snapshot",
    "draft_project_update","draft_client_email","create_task_draft",
    "suggest_intervention","generate_executive_summary","classify_project_status",
    "recommend_next_action",
  ];
  for (const k of required) {
    assert.ok(keys.has(k), `Missing default tool: ${k}`);
  }
});

test("DEFAULT_AGENT_TOOLS: draft_client_email requires human approval", () => {
  const tool = DEFAULT_AGENT_TOOLS.find((t) => t.toolKey === "draft_client_email");
  assert.ok(tool, "draft_client_email not found");
  assert.equal(tool.requiresHumanApproval, true);
});

test("DEFAULT_AGENT_TOOLS: read-only tools do not mutate state", () => {
  const readOnly = DEFAULT_AGENT_TOOLS.filter((t) => t.executionMode === "read_only");
  for (const t of readOnly) {
    assert.equal(t.mutatesState, false, `${t.toolKey} is read_only but mutates_state=true`);
  }
});

test("DEFAULT_AGENT_TOOLS: all tools have valid risk levels", () => {
  const valid = new Set(["low","medium","high","critical"]);
  for (const t of DEFAULT_AGENT_TOOLS) {
    assert.ok(valid.has(t.riskLevel), `${t.toolKey} has invalid risk level: ${t.riskLevel}`);
  }
});

test("DEFAULT_AGENT_TOOLS: all tool keys are unique", () => {
  const keys = DEFAULT_AGENT_TOOLS.map((t) => t.toolKey);
  const unique = new Set(keys);
  assert.equal(unique.size, keys.length, "Duplicate tool keys in defaults");
});

test("DEFAULT_AGENT_TOOLS: all tools have displayName and description", () => {
  for (const t of DEFAULT_AGENT_TOOLS) {
    assert.ok(t.displayName?.trim(), `${t.toolKey} missing displayName`);
    assert.ok(t.description?.trim(), `${t.toolKey} missing description`);
  }
});

// ─── Registry source checks ───────────────────────────────────────────────────

test("registry exports registerAgentTool", () => {
  assert.match(registry, /export async function registerAgentTool/);
});

test("registry exports upsertAgentTool", () => {
  assert.match(registry, /export async function upsertAgentTool/);
});

test("registry exports getAgentToolByKey", () => {
  assert.match(registry, /export async function getAgentToolByKey/);
});

test("registry exports listAgentTools", () => {
  assert.match(registry, /export async function listAgentTools/);
});

test("registry exports updateAgentToolStatus", () => {
  assert.match(registry, /export async function updateAgentToolStatus/);
});

test("registry exports deleteOrDeprecateAgentTool", () => {
  assert.match(registry, /export async function deleteOrDeprecateAgentTool/);
});

// ─── Service source checks ────────────────────────────────────────────────────

test("service exports ensureDefaultAgentTools", () => {
  assert.match(service, /export async function ensureDefaultAgentTools/);
});

test("service exports listAvailableToolsForAgent", () => {
  assert.match(service, /export async function listAvailableToolsForAgent/);
});

test("service exports checkAgentToolEligibility", () => {
  assert.match(service, /export async function checkAgentToolEligibility/);
});

// ─── Eligibility logic (pure simulation) ────────────────────────────────────

// Simulate checkAgentToolEligibility with a mock tool store

function makeEligibilityChecker(toolStore) {
  return async function checkEligibility(input) {
    const tool = toolStore[`${input.workspaceId}:${input.toolKey}`];
    if (!tool) return { eligible: false, reasonCode: "tool_not_found", message: "not found", requiredApproval: false };
    if (tool.status === "disabled") return { eligible: false, reasonCode: "tool_disabled", message: "disabled", requiredApproval: false, riskLevel: tool.riskLevel };
    if (tool.status === "deprecated") return { eligible: false, reasonCode: "tool_deprecated", message: "deprecated", requiredApproval: false, riskLevel: tool.riskLevel };
    if (tool.compatibleAgentTypes.length > 0 && !tool.compatibleAgentTypes.includes(input.agentType)) {
      return { eligible: false, reasonCode: "agent_type_not_compatible", message: "incompatible", requiredApproval: false, riskLevel: tool.riskLevel };
    }
    if (tool.requiredPermissions.length > 0) {
      const granted = new Set(input.grantedPermissions ?? []);
      const missing = tool.requiredPermissions.filter((p) => !granted.has(p));
      if (missing.length > 0) return { eligible: false, reasonCode: "missing_permission", message: `missing: ${missing}`, requiredApproval: false, riskLevel: tool.riskLevel };
    }
    if (tool.requiresHumanApproval && !input.allowApprovalRequiredTools) {
      return { eligible: false, reasonCode: "human_approval_required", message: "approval required", requiredApproval: true, riskLevel: tool.riskLevel };
    }
    return { eligible: true, reasonCode: "eligible", message: "ok", requiredApproval: tool.requiresHumanApproval, riskLevel: tool.riskLevel };
  };
}

const toolStore = {
  "ws1:read_project_summary": {
    toolKey: "read_project_summary", status: "active", riskLevel: "low",
    executionMode: "read_only", compatibleAgentTypes: ["copilot","analyzer"],
    requiredPermissions: [], requiresHumanApproval: false,
  },
  "ws1:draft_client_email": {
    toolKey: "draft_client_email", status: "active", riskLevel: "medium",
    executionMode: "draft_only", compatibleAgentTypes: ["copilot"],
    requiredPermissions: [], requiresHumanApproval: true,
  },
  "ws1:protected_tool": {
    toolKey: "protected_tool", status: "active", riskLevel: "high",
    executionMode: "requires_approval", compatibleAgentTypes: [],
    requiredPermissions: ["pmo:write"], requiresHumanApproval: false,
  },
  "ws1:disabled_tool": {
    toolKey: "disabled_tool", status: "disabled", riskLevel: "low",
    executionMode: "read_only", compatibleAgentTypes: [],
    requiredPermissions: [], requiresHumanApproval: false,
  },
  "ws1:deprecated_tool": {
    toolKey: "deprecated_tool", status: "deprecated", riskLevel: "low",
    executionMode: "read_only", compatibleAgentTypes: [],
    requiredPermissions: [], requiresHumanApproval: false,
  },
};

const checkEligibility = makeEligibilityChecker(toolStore);

test("eligibility: eligible when active and compatible", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "read_project_summary" });
  assert.equal(r.eligible, true);
  assert.equal(r.reasonCode, "eligible");
});

test("eligibility: not eligible when tool not found", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "no_such_tool" });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "tool_not_found");
});

test("eligibility: not eligible when tool disabled", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "disabled_tool" });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "tool_disabled");
});

test("eligibility: not eligible when tool deprecated", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "deprecated_tool" });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "tool_deprecated");
});

test("eligibility: not eligible when agent type incompatible", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "external_agent", toolKey: "read_project_summary" });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "agent_type_not_compatible");
});

test("eligibility: not eligible when required permission missing", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "any", toolKey: "protected_tool", grantedPermissions: [] });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "missing_permission");
});

test("eligibility: eligible when required permission granted", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "any", toolKey: "protected_tool", grantedPermissions: ["pmo:write"] });
  assert.equal(r.eligible, true);
});

test("eligibility: approval-required tool returns requiredApproval true when not allowed", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "draft_client_email", allowApprovalRequiredTools: false });
  assert.equal(r.eligible, false);
  assert.equal(r.reasonCode, "human_approval_required");
  assert.equal(r.requiredApproval, true);
});

test("eligibility: approval-required tool is eligible when allowApprovalRequiredTools=true", async () => {
  const r = await checkEligibility({ workspaceId: "ws1", agentType: "copilot", toolKey: "draft_client_email", allowApprovalRequiredTools: true });
  assert.equal(r.eligible, true);
  assert.equal(r.requiredApproval, true);
});

// ─── Migration checks ─────────────────────────────────────────────────────────

test("migration creates agent_tools table", () => {
  assert.match(migration, /create table if not exists public\.agent_tools/);
});

test("migration creates agent_tool_assignments table", () => {
  assert.match(migration, /create table if not exists public\.agent_tool_assignments/);
});

test("migration has correct category check constraint", () => {
  assert.match(migration, /project_read.*portfolio_read.*pm_read.*analysis/s);
});

test("migration has risk_level check constraint", () => {
  assert.match(migration, /risk_level.*check.*low.*medium.*high.*critical/s);
});

test("migration has execution_mode check constraint", () => {
  assert.match(migration, /execution_mode.*check.*read_only.*draft_only.*requires_approval.*automatic/s);
});

test("migration enables RLS", () => {
  assert.match(migration, /enable row level security/);
});

test("migration wraps in transaction", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;/);
});

// ─── Database contract checks ─────────────────────────────────────────────────

test("database contract includes AgentToolRow", () => {
  assert.match(contract, /AgentToolRow/);
});

test("database contract includes AGENT_TOOL_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /AGENT_TOOL_SELECTABLE_COLUMNS/);
});

test("database contract version includes agent-tool-registry", () => {
  assert.match(contract, /agent-tool-registry/);
});

// ─── Index / barrel exports ───────────────────────────────────────────────────

test("index exports all core symbols", () => {
  const expected = [
    "registerAgentTool","upsertAgentTool","getAgentToolByKey","listAgentTools",
    "updateAgentToolStatus","deleteOrDeprecateAgentTool","ensureDefaultAgentTools",
    "listAvailableToolsForAgent","checkAgentToolEligibility","DEFAULT_AGENT_TOOLS",
    "validateAgentToolKey","normalizeRegisterAgentToolInput",
  ];
  for (const sym of expected) {
    assert.ok(indexFile.includes(sym), `index.ts missing export: ${sym}`);
  }
});
