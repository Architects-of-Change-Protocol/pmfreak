import { NextRequest, NextResponse } from "next/server";
import { requireFounderProgramOperator } from "@/lib/founder-program/authz";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import {
  FOUNDER_ACCESS_STATES,
  FOUNDER_APPROVED_CAPACITY_STATES,
  isFounderLifecycleState,
} from "@/lib/founder-program/lifecycle";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

const ROUTE_ID = "/api/founder-program/operator/participants";

// Operator review queue: lifecycle-filterable, paginated, and always
// accompanied by the live capacity snapshot so approval decisions are made
// against real numbers (docs/founder-program/06). Founder/internal
// authorization is enforced before any data access.
export async function GET(request: NextRequest) {
  try {
    const gate = await requireFounderProgramOperator(ROUTE_ID);
    if (!gate.ok) return gate.response;

    const url = new URL(request.url);
    const stateFilter = url.searchParams.get("state");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50));

    const client = createFounderProgramDbClient({ operation: "list_participants", actorUserId: gate.user.id });

    let query = client
      .from("founder_participants")
      .select(
        "id, email, full_name, archetype, lifecycle_state, state_reason, cohort, internal_owner_user_id, workspace_id, agreement_version_accepted, activated_at, paused_at, revoked_at, completed_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (stateFilter && isFounderLifecycleState(stateFilter)) {
      query = query.eq("lifecycle_state", stateFilter);
    }
    const { data: participants, error } = await query;
    if (error) {
      logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
      return NextResponse.json({ error: "Unable to list participants." }, { status: 500 });
    }

    const { data: allStates } = await client.from("founder_participants").select("lifecycle_state");
    const states = (allStates ?? []).map((row: { lifecycle_state: string }) => row.lifecycle_state);
    const capacity = {
      approvedUsed: states.filter((s) => (FOUNDER_APPROVED_CAPACITY_STATES as readonly string[]).includes(s)).length,
      approvedLimit: gate.config.settings.maxApprovedParticipants,
      activeUsed: states.filter((s) => (FOUNDER_ACCESS_STATES as readonly string[]).includes(s)).length,
      activeLimit: gate.config.settings.maxActiveParticipants,
    };

    return NextResponse.json({ page, pageSize, capacity, participants: participants ?? [] });
  } catch (error) {
    logger.error("route_internal_error", { route: ROUTE_ID, error_detail: safeErrorMessage(error) });
    return NextResponse.json({ error: "Unable to list participants." }, { status: 500 });
  }
}
