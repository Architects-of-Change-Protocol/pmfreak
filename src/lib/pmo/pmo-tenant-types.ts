import type { CommandCenterType } from "@/lib/command-center/command-center-types";

export type VaultProvider = "pmfreak-cloud" | "dedicated-enterprise" | "local-sovereign";

export type VaultConfig = {
  provider: VaultProvider;
  label: string;
};

// PMO wizard agent keys — a fixed set of PMFreak agent roles, not an agent
// identifier. Deliberately not named AgentId, which in @aoc/protocol is an
// opaque `= string` identifier and means something entirely different.
export type PmoAgentId =
  | "scope"
  | "timeline"
  | "cost"
  | "quality"
  | "resource"
  | "stakeholder"
  | "delivery-intelligence"
  | "executive-synthesis"
  | "portfolio-arbitration";

export type AgentActivationState = {
  agentId: PmoAgentId;
  enabled: boolean;
};

export type DeliveryMethodology = "agile" | "scrum" | "hybrid" | "waterfall" | "custom";

export type ReportingCadence = "daily" | "weekly" | "biweekly" | "monthly";

export type ProjectScale =
  | "small"
  | "mid"
  | "large"
  | "enterprise";

export type ApprovalGovernance = "lightweight" | "structured" | "multi-layer-executive";

export type OperatingModel = "centralized" | "federated" | "hybrid";

export type DeliveryChallenge =
  | "scope-ambiguity"
  | "stakeholder-misalignment"
  | "timeline-drift"
  | "budget-pressure"
  | "resource-overload"
  | "governance-inconsistency"
  | "reporting-fatigue";

export type GovernanceProfile = {
  methodology: DeliveryMethodology | "";
  reportingCadence: ReportingCadence | "";
  projectScale: ProjectScale | "";
  approvalGovernance: ApprovalGovernance | "";
};

export type PmoTenantIdentity = {
  pmoName: string;
  organizationName: string;
  pmoType: CommandCenterType | "";
  operatingModel: OperatingModel | "";
};

export type ContextSeed = {
  strategicObjective: string;
  deliveryChallenges: DeliveryChallenge[];
  successDefinition: string;
};

export type PmoTenant = {
  identity: PmoTenantIdentity;
  vault: VaultConfig;
  governance: GovernanceProfile;
  agents: AgentActivationState[];
  contextSeed: ContextSeed;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_AGENT_STATES: AgentActivationState[] = [
  { agentId: "scope", enabled: true },
  { agentId: "timeline", enabled: true },
  { agentId: "cost", enabled: false },
  { agentId: "quality", enabled: false },
  { agentId: "resource", enabled: false },
  { agentId: "stakeholder", enabled: true },
  { agentId: "delivery-intelligence", enabled: false },
  { agentId: "executive-synthesis", enabled: true },
  { agentId: "portfolio-arbitration", enabled: false },
];

export const AGENT_META: Record<PmoAgentId, { label: string; description: string; tier: "core" | "advanced" }> = {
  scope: { label: "Scope Governance", description: "Monitors scope boundaries and change signals.", tier: "core" },
  timeline: { label: "Timeline Governance", description: "Tracks schedule drift and milestone risk.", tier: "core" },
  stakeholder: { label: "Stakeholder Intelligence", description: "Maps stakeholder alignment and communication gaps.", tier: "core" },
  "executive-synthesis": { label: "Executive Synthesis", description: "Synthesizes cross-agent signals for executive briefing.", tier: "core" },
  cost: { label: "Cost Governance", description: "Monitors budget exposure and variance signals.", tier: "advanced" },
  resource: { label: "Resource Governance", description: "Tracks allocation pressure and overload patterns.", tier: "advanced" },
  quality: { label: "Quality Governance", description: "Enforces acceptance criteria and evidence controls.", tier: "advanced" },
  "delivery-intelligence": { label: "Delivery Intelligence", description: "Pattern-learns from delivery history to improve forecasts.", tier: "advanced" },
  "portfolio-arbitration": { label: "Portfolio Arbitration", description: "Resolves cross-project resource and priority conflicts.", tier: "advanced" },
};
