import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { runAIModule } from "@/lib/ai/gateway";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";

export async function GET() {
  const user = await requireAuthUser();

  // See docs/security/abuse-protection-boundary.md ("ai.module_output.political_risk").
  const abuseDecision = await enforceAbuseLimit({ scope: "ai.module_output", action: "political_risk", identifier: user.id, limit: 60, windowSeconds: 3600 });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  const response = await runAIModule({
    moduleId: "political-risk",
    input: {},
    context: {},
  });

  return NextResponse.json(response);
}
