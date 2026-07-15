import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { analyzeProjectState } from "@/lib/ai/pil";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { abuseDenyResponse, buildAbuseKey, enforceAbuseLimit, getClientIp } from "@/lib/security/abuse-protection";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() || "demo-project";

  try {
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  // AI-adjacent compute cost throttle, separate from the access check above
  // — see docs/security/abuse-protection-boundary.md ("ai.suggestions").
  const abuseDecision = await enforceAbuseLimit({
    scope: "ai.suggestions",
    identifier: buildAbuseKey([getClientIp(request), projectId]),
    limit: 120,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  try {
    await analyzeProjectState(projectId);

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("project_suggestions")
      .select("id, project_id, type, message, priority, created_at, dismissed")
      .eq("project_id", projectId)
      .eq("dismissed", false)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const suggestions = data ?? [];

    if (!suggestions.length) {
      return NextResponse.json({
        projectId,
        suggestions: [
          {
            type: "clarity",
            message: "No actionable signals yet. Continue analyzing messages to enable proactive guidance.",
            priority: "low",
          },
        ],
        fallback: true,
      });
    }

    return NextResponse.json({ projectId, suggestions, fallback: false });
  } catch (error) {
    return safeLegacyErrorResponse("/api/ai/suggestions", error, "Unable to fetch project suggestions. Please retry.");
  }
}
