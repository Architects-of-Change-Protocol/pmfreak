import type { AIEgressDecision, AIEgressRequest, DataSensitivity } from "@/lib/governance/authority/runtime/ai-egress/types";

export interface AIEgressAuditEvent {
  eventType: "ai_egress_decision";
  timestamp: string;
  actorType?: string;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  provider: string;
  moduleId?: string;
  workspaceId?: string;
  projectId?: string;
  sensitivity?: DataSensitivity;
  decision: AIEgressDecision["decision"];
  reason: string;
  auditRequired: boolean;
}

export function recordAIEgressDecision(request: AIEgressRequest, decision: AIEgressDecision): AIEgressAuditEvent {
  const event: AIEgressAuditEvent = {
    eventType: "ai_egress_decision",
    timestamp: new Date().toISOString(),
    actorType: request.actor?.actorType,
    actorUserId: request.actor?.actorType === 'user' ? request.actor.actorId : null,
    actorAgentId: request.actor?.actorType === 'agent' ? request.actor.actorId : null,
    provider: request.provider,
    moduleId: request.moduleId,
    workspaceId: request.workspaceId,
    projectId: request.projectId,
    sensitivity: request.estimatedSensitivity,
    decision: decision.decision,
    reason: decision.reason,
    auditRequired: decision.auditRequired,
  };

  console.info("[ai-egress-audit]", JSON.stringify(event));
  return event;
}
