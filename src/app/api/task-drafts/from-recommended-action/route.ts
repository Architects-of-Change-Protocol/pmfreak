import { materializeTaskDraftForRecommendedAction } from "@/lib/task-drafts/materialize-task-draft";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "Request body required." }, { status: 400 });
  }

  const { recommendedActionId, metadata } = body as Record<string, unknown>;

  if (!recommendedActionId || typeof recommendedActionId !== "string" || !recommendedActionId.trim()) {
    return Response.json({ ok: false, error: "recommendedActionId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  const safeMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : undefined;

  const result = await materializeTaskDraftForRecommendedAction({
    recommendedActionId: recommendedActionId.trim(),
    metadata: safeMetadata,
  });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      validation_failed: 400,
      unauthenticated: 401,
      unauthorized: 403,
      not_found: 404,
      invalid_transition: 409,
      generation_failed: 500,
      persistence_failed: 500,
    };
    const httpStatus = statusMap[result.failureClass] ?? 500;
    return Response.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: httpStatus });
  }

  return Response.json({
    ok: true,
    draft: result.draft,
    created: result.created,
    preserved: result.preserved,
  });
}
