import { decideRecommendedAction } from "@/lib/recommended-actions/decision-workflow";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Request body required." }, { status: 400 });
  }

  const { actionId, decision, reason, deferredUntil, convertedTaskId, metadata } = body as Record<string, unknown>;

  if (!actionId || typeof actionId !== "string") {
    return Response.json({ error: "actionId is required." }, { status: 400 });
  }

  const validDecisions = ["accepted", "rejected", "deferred", "converted_to_task"];
  if (!decision || typeof decision !== "string" || !validDecisions.includes(decision)) {
    return Response.json(
      { error: `decision must be one of: ${validDecisions.join(", ")}.` },
      { status: 400 }
    );
  }

  const result = await decideRecommendedAction({
    actionId,
    decision: decision as "accepted" | "rejected" | "deferred" | "converted_to_task",
    reason: typeof reason === "string" ? reason : undefined,
    deferredUntil: typeof deferredUntil === "string" ? deferredUntil : undefined,
    convertedTaskId: typeof convertedTaskId === "string" ? convertedTaskId : undefined,
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : undefined,
  });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      unauthenticated: 401,
      not_found: 404,
      unauthorized: 403,
      invalid_transition: 400,
      validation_failed: 400,
      persistence_failed: 500,
      governed_flow_required: 409,
    };
    const httpStatus = statusMap[result.failureClass] ?? 500;
    return Response.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: httpStatus });
  }

  return Response.json({ ok: true, action: result.action, decisionId: result.decisionId });
}
