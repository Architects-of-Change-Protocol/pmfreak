import { NextResponse } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { ensurePmfreakAocAdaptersRegistered } from "@/lib/aoc/bootstrap";
import {
  retrieveRuntimeHealth,
  evaluateLaunchReadiness,
  classifyDegradedMode,
  generateRuntimeDiagnostics,
  generateRuntimeNarratives,
  evaluateStartupAssertions,
  evaluateRuntimeInvariants,
  evaluateReplayIntegrity,
} from "@/lib/runtime-hardening";

// Founder/internal-only: unlike build-info/health/route-debug (which are
// deliberately minimal, documented-public deploy/health surfaces), this
// route exposes detailed internal system state — degraded-mode
// classification, invariant/assertion pass-fail detail, replay-integrity
// results — that aids reconnaissance of failure modes. It was never
// consciously scoped as public.
export async function GET() {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return NextResponse.json({ error: "Founder access is required." }, { status: 403 });
  }
  try {
    ensurePmfreakAocAdaptersRegistered();

    const health = retrieveRuntimeHealth();
    const launchReadiness = evaluateLaunchReadiness();
    const degradedMode = classifyDegradedMode();
    const assertions = evaluateStartupAssertions();
    const invariants = evaluateRuntimeInvariants();
    const replayResults = evaluateReplayIntegrity();
    const diagnostics = generateRuntimeDiagnostics(assertions, invariants, degradedMode);
    const narratives = generateRuntimeNarratives(launchReadiness, degradedMode, replayResults);

    return NextResponse.json({
      status: "ok",
      runtimeHealth: health,
      launchReadiness,
      degradedMode,
      diagnostics,
      narratives,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "runtime_hardening_check_failed",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
