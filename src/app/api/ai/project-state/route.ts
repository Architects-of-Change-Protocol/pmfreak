import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { getProjectState } from "@/lib/ai/project-state";
import { abuseDenyResponse, buildAbuseKey, enforceAbuseLimit, getClientIp } from "@/lib/security/abuse-protection";

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
  // — see docs/security/abuse-protection-boundary.md ("ai.project_state").
  const abuseDecision = await enforceAbuseLimit({
    scope: "ai.project_state",
    identifier: buildAbuseKey([getClientIp(request), projectId]),
    limit: 120,
    windowSeconds: 3600,
  });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  try {
    const state = await getProjectState(projectId);

    return NextResponse.json({
      projectId,
      ...state,
      examples: {
        healthy: {
          healthScore: 82,
          riskLevel: "low",
          stakeholderAlignment: 84,
          executionMomentum: 79,
          topIssues: ["No major issues detected."],
          recommendedActions: ["Maintain concise daily updates with owner + ETA."],
        },
        atRisk: {
          healthScore: 38,
          riskLevel: "high",
          stakeholderAlignment: 46,
          executionMomentum: 35,
          topIssues: [
            "Risk trend is worsening across recent communications.",
            "No project communication in over 72 hours.",
            "Blame-heavy language is elevating stakeholder friction.",
          ],
          recommendedActions: [
            "Send a reset update with explicit owner, decision, and next milestone date.",
            "Post a concise progress checkpoint to restore execution visibility.",
            "Replace blame wording with fact-based impact statements and requests.",
          ],
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to derive project state.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
