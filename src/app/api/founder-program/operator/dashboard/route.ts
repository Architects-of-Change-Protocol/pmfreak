import { NextResponse } from "next/server";
import { requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { computeFounderProgramDashboard } from "@/lib/founder-program/dashboard";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/dashboard";

// Operations dashboard: every metric derived from real founder_* records;
// metrics without evidence are returned as available:false with a reason —
// no demo data, no fabricated cohorts (docs/founder-program/11).
export async function GET() {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;
    const dashboard = await computeFounderProgramDashboard(gate.config.settings, { operatorUserId: gate.user.id });
    return NextResponse.json({ dashboard });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to compute the program dashboard." }, { status: 500 });
  }
}
