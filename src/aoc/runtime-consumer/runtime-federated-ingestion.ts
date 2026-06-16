export type RuntimeFederatedOperationalEvent = {
  workspaceId?: string;
  connectorId?: string;
  sourceSystem: string;
  eventType: string;
  timestamp?: string;
  payloadHash?: string;
  lineage: {
    ingressId: string;
    replayKey?: string;
    rawEventId?: string;
    normalizedAt?: string;
  };
  severity: "low" | "medium" | "high" | "critical";
  freshness: "fresh" | "warming" | "stale";
  signalVector: string[];
  payload?: Record<string, unknown>;
};

export type RuntimeIngestionProjection = {
  eventMemory: string[];
  cognitionSynthesisInputs: string[];
  executiveRuntimeSignals: string[];
  telemetrySurfaces: string[];
};

export function projectIngressToRuntime(
  event: RuntimeFederatedOperationalEvent
): RuntimeIngestionProjection {
  const id = event.lineage.ingressId;

  return {
    eventMemory: [id],
    cognitionSynthesisInputs: [event.eventType, event.severity],
    executiveRuntimeSignals: [event.sourceSystem, event.freshness],
    telemetrySurfaces: event.signalVector,
  };
}
