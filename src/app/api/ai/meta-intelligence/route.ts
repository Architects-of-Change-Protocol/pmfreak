import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { canUseAdvancedAi } from "@/lib/feature-gates";
import { denyResponse } from "@/lib/security/deny-response";
import { metaIntelligencePromptV1 } from "@/lib/ai/prompts/meta-intelligence.v1";
import { runInference } from "@/lib/ai/providers/router";
import { InferenceError } from "@/lib/ai/inference/types";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";

type MetaIntelligenceRequest = {
  userInput?: string;
};

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with { userInput }." },
    { status: 405 },
  );
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return denyResponse({
      status: 401,
      routeId: "/api/ai/meta-intelligence",
      message: "Unauthorized",
      reason: "unauthorized",
    });
  }

  const advancedAiAccess = await canUseAdvancedAi(user.id);
  if (!advancedAiAccess.ok) {
    return NextResponse.json(
      {
        error: advancedAiAccess.error,
        feature: advancedAiAccess.feature,
        requiredPlan: advancedAiAccess.requiredPlan,
      },
      { status: 402 },
    );
  }

  // See docs/security/abuse-protection-boundary.md ("ai.module_output.meta_intelligence").
  const abuseDecision = await enforceAbuseLimit({ scope: "ai.module_output", action: "meta_intelligence", identifier: user.id, limit: 60, windowSeconds: 3600 });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  let payload: MetaIntelligenceRequest;
  try {
    payload = (await request.json()) as MetaIntelligenceRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userInput = payload.userInput?.trim();
  if (!userInput) {
    return NextResponse.json(
      { error: "Missing required field: userInput." },
      { status: 400 },
    );
  }

  try {
    const inferenceResult = await runInference({
      moduleId: "meta-intelligence",
      actorId: user.id,
      actorType: "user",
      messages: [
        { role: "system", content: metaIntelligencePromptV1.systemPrompt },
        { role: "user", content: userInput },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.1,
      timeoutMs: 15000,
      maxAttempts: 2,
      retryDelayMs: 800,
      operationName: "meta-intelligence",
      idempotencyKey: randomUUID(),
      metadata: { companyId: user.companyId },
    });

    const parsed = inferenceResult.parsedJson ?? JSON.parse(inferenceResult.content);
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof InferenceError) {
      return NextResponse.json(
        { error: "Meta intelligence temporarily unavailable.", code: error.errorClass },
        { status: error.errorClass === "rate_limited" ? 429 : 502 },
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
