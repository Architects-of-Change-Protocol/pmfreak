import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { runAIModule } from "@/lib/ai/gateway";

export async function GET() {
  await requireAuthUser();
  const response = await runAIModule({
    moduleId: "project-memory",
    input: {},
    context: {},
  });

  return NextResponse.json(response);
}
