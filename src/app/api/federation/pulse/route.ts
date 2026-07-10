import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listIngressEvents } from "@/lib/live-federation/ingestion/live-ingestion-runtime";
import { computeOperationalPulse, detectPulseAnomalies, evaluatePulseHealth } from "@/lib/live-federation/ingestion/operational-pulse";
import { evaluateEventSurvivability } from "@/lib/live-federation/ingestion/event-survivability";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  try {
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  const events = listIngressEvents(workspaceId);
  const pulse = computeOperationalPulse(events);
  return NextResponse.json({
    workspaceId,
    connectorHealth: pulse.connectorLiveness,
    pulseStatus: evaluatePulseHealth(pulse),
    freshness: pulse.freshness,
    ingestionSurvivability: evaluateEventSurvivability(events),
    federationDrift: pulse.signalDrift,
    anomalies: detectPulseAnomalies(pulse),
  });
}
