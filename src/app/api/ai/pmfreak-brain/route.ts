import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";

type BrainRequest = {
  userInput?: string;
};

type MetaResponse = {
  activatedEngines?: {
    perceptionLayer?: boolean;
    actionEngine?: boolean;
    messageNudgesEngine?: boolean;
  };
  engineInputs?: {
    messageNudgesEngine?: {
      rawMessage?: string;
      audience?: "exec" | "client" | "internal" | "unknown";
    };
  };
};

type ActionResponse = {
  answer?: string;
  error?: string;
};

type MessageNudgeResponse = {
  improvedVersion?: string;
  error?: string;
};

const getOrigin = (request: Request) => new URL(request.url).origin;

export async function POST(request: Request) {
  const user = await requireAuthUser();

  // Fans out to 3 downstream AI calls per request — throttled lower than a
  // single-module route. See docs/security/abuse-protection-boundary.md
  // ("ai.pmfreak_brain").
  const abuseDecision = await enforceAbuseLimit({ scope: "ai.pmfreak_brain", identifier: user.id, limit: 30, windowSeconds: 3600 });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  let payload: BrainRequest;

  try {
    payload = (await request.json()) as BrainRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const userInput = payload.userInput?.trim();

  if (!userInput) {
    return NextResponse.json({ error: "Missing required field: userInput." }, { status: 400 });
  }

  const origin = getOrigin(request);
  const cookie = request.headers.get("cookie") ?? "";

  try {
    const metaResponse = await fetch(`${origin}/api/ai/meta-intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({ userInput }),
    });

    const meta = (await metaResponse.json()) as MetaResponse;

    let actionResult: ActionResponse | null = null;
    let messageResult: MessageNudgeResponse | null = null;

    if (meta.activatedEngines?.actionEngine) {
      const actionResponse = await fetch(`${origin}/api/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ message: userInput }),
      });

      actionResult = (await actionResponse.json()) as ActionResponse;
    }

    if (meta.activatedEngines?.messageNudgesEngine) {
      const messageResponse = await fetch(`${origin}/api/ai/message-nudges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          rawMessage: meta.engineInputs?.messageNudgesEngine?.rawMessage || userInput,
          audience: meta.engineInputs?.messageNudgesEngine?.audience || "unknown",
        }),
      });

      messageResult = (await messageResponse.json()) as MessageNudgeResponse;
    }

    const sections: string[] = [];

    if (actionResult?.answer) {
      sections.push(`Execution brief\n${actionResult.answer}`);
    }

    if (messageResult?.improvedVersion) {
      sections.push(`Stakeholder message\n${messageResult.improvedVersion}`);
    }

    return NextResponse.json({
      meta,
      action: actionResult,
      message: messageResult,
      final: sections.length ? sections.join("\n\n") : "PMFreak could not generate a unified response. Try again.",
    });
  } catch {
    return NextResponse.json({ error: "Orchestration failed." }, { status: 500 });
  }
}
