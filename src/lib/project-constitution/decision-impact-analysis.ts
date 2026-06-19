import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DecisionImpactAnalysis,
  DecisionLinkRecord,
  DecisionResult,
} from "./decision-types";

const linkColumns =
  "id,workspace_id,decision_id,link_type,linked_entity_id,created_at";

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

export async function generateDecisionImpactAnalysis(input: {
  decisionId: string;
  workspaceId: string;
}): Promise<DecisionResult<DecisionImpactAnalysis>> {
  if (!validUuid(input.decisionId))
    return { ok: false, error: "decisionId must be a UUID.", failureClass: "validation_failed" };
  if (!validUuid(input.workspaceId))
    return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("constitutional_decision_links")
    .select(linkColumns)
    .eq("decision_id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: true });

  if (error)
    return { ok: false, error: "Unable to retrieve decision links.", failureClass: "persistence_failed" };

  const links = (data ?? []) as DecisionLinkRecord[];

  const affectedObjectives = links.filter((l) => l.link_type === "objective");
  const affectedConstraints = links.filter((l) => l.link_type === "constraint");
  const relatedRisks = links.filter((l) => l.link_type === "risk");
  const relatedAmendments = links.filter((l) => l.link_type === "amendment");
  const relatedDeliverables = links.filter((l) => l.link_type === "deliverable");
  const relatedMilestones = links.filter((l) => l.link_type === "milestone");

  return {
    ok: true,
    data: {
      decisionId: input.decisionId,
      affectedObjectives,
      affectedConstraints,
      relatedRisks,
      relatedAmendments,
      relatedDeliverables,
      relatedMilestones,
      totalImpactedEntities: links.length,
    },
  };
}
