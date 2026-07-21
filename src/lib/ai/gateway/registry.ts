import type { AIResponseEnvelope } from "@/lib/ai/types";
import type { AIModuleConfig, AIModuleId } from "@/lib/ai/gateway/types";

// Pre-production modules report an explicit empty state: no fixture cards, no
// invented owners, severities, or confidence scores. Real cards appear only
// once a module has a live inference path over real workspace data.
const createEmptyStateHandler = (moduleId: AIModuleId): AIModuleConfig["handler"] => async () => {
  const envelope: AIResponseEnvelope<unknown[]> = {
    module: moduleId,
    generatedAt: new Date().toISOString(),
    confidence: "low",
    summary: "",
    data: [],
    isSimulated: false,
  };
  return envelope;
};

const moduleConfigs: AIModuleConfig[] = [
  { id: "stakeholder-intel", route: "/api/ai/stakeholder-intel", promptVersion: "v1", mode: "mock", productionReady: false, handler: createEmptyStateHandler("stakeholder-intel") },
  { id: "meetings", route: "/api/ai/meetings", promptVersion: "v1", mode: "mock", productionReady: false, handler: createEmptyStateHandler("meetings") },
  { id: "political-risk", route: "/api/ai/political-risk", promptVersion: "v1", mode: "mock", productionReady: false, handler: createEmptyStateHandler("political-risk") },
  { id: "escalation-guide", route: "/api/ai/escalation-guide", promptVersion: "v1", mode: "mock", productionReady: false, handler: createEmptyStateHandler("escalation-guide") },
  { id: "message-nudges", route: "/api/ai/message-nudges", promptVersion: "v1", mode: "openai", productionReady: true, handler: createEmptyStateHandler("message-nudges") },
  { id: "project-memory", route: "/api/ai/project-memory", promptVersion: "v1", mode: "mock", productionReady: false, handler: createEmptyStateHandler("project-memory") },
];

export const aiModuleRegistry = new Map<AIModuleId, AIModuleConfig>(
  moduleConfigs.map((config) => [config.id, config]),
);
