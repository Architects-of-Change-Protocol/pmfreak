export type DataSensitivity = "public" | "internal" | "confidential" | "restricted";
export type ProviderTrustTier = "sovereign" | "trusted" | "conditional" | "local" | "restricted";
export type EgressDecision = "allow" | "deny" | "conditional";

export interface AIEgressActor {
  actorId: string;
  actorType: "user" | "agent" | "system";
}

export interface AIEgressProviderMetadata {
  id: string;
  trustTier: ProviderTrustTier;
  allowedSensitivityLevels: DataSensitivity[];
}

export interface AIEgressRequest {
  actor: AIEgressActor;
  provider: string;
  model?: string;
  workspaceId?: string;
  projectId?: string;
  moduleId?: string;
  estimatedSensitivity?: DataSensitivity;
  dataClasses?: string[];
  messageCount?: number;
  tokenEstimate?: number;
  purpose?: string;
}

export interface AIEgressDecision {
  decision: EgressDecision;
  reason: string;
  policyId?: string;
  enforcementLevel: "hard" | "soft";
  auditRequired: boolean;
}
