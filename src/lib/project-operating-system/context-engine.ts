import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectOSResult, ProjectOSOperatingContext, DetectedAttentionItem } from "./types";
import { detectProjectAttentionItems } from "./attention-engine";

// ─── composeProjectOperatingContext ───────────────────────────────────────────
//
// Queries all domain entities for a project and assembles a unified
// operating context. Does NOT duplicate domain logic — only reads state.

export async function composeProjectOperatingContext(input: {
  workspaceId: string;
  projectId: string;
  snapshotId: string;
}): Promise<ProjectOSResult<ProjectOSOperatingContext>> {
  const supabase = await createSupabaseServerClient();
  const { workspaceId, projectId } = input;

  // Fetch all domain data in parallel — read-only, no mutations
  const [
    constitutionResult,
    signalsResult,
    actionsResult,
    commitmentsResult,
    projectionsResult,
    realitiesResult,
    recommendationsResult,
    learningResult,
    driftsResult,
    violationsResult,
    variancesResult,
  ] = await Promise.all([
    // Constitution: find active constitution for this project
    supabase
      .from("project_constitutions")
      .select("id,lifecycle_status,version,workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .eq("lifecycle_status", "active")
      .maybeSingle(),

    // Governance signals for the workspace
    supabase
      .from("governance_signals")
      .select("id,signal_type,severity,status,title")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(50),

    // Governance actions
    supabase
      .from("governance_actions")
      .select("id,action_type,status,title")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(50),

    // Commitments for this project
    supabase
      .from("governance_commitments")
      .select("id,status,title,due_date")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(100),

    // Execution projections for this project
    supabase
      .from("execution_projections")
      .select("id,status,projection_accuracy")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),

    // Execution realities for this project
    supabase
      .from("execution_realities")
      .select("id,status,observed_at")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .order("observed_at", { ascending: false })
      .limit(20),

    // Recommendations
    supabase
      .from("recommendations")
      .select("id,recommendation_type,confidence_score,status")
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "published", "validated", "ignored", "dismissed"])
      .order("created_at", { ascending: false })
      .limit(50),

    // Learning patterns
    supabase
      .from("learning_patterns")
      .select("id,pattern_type,confidence")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30),

    // Execution drifts for this project
    supabase
      .from("execution_drifts")
      .select("id,severity,drift_type,description")
      .eq("workspace_id", workspaceId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(30),

    // Authority violations
    supabase
      .from("authority_violations")
      .select("id,status,title,violation_type")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "unresolved"])
      .order("created_at", { ascending: false })
      .limit(30),

    // Execution variances
    supabase
      .from("execution_variances")
      .select("id,severity,variance_type,variance_percentage")
      .eq("workspace_id", workspaceId)
      .in("severity", ["high", "critical"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  // Normalize signals
  const signals: ProjectOSOperatingContext["signals"] =
    (signalsResult.data ?? []).map((s) => ({
      id: s.id as string,
      signalType: s.signal_type as string,
      severity: s.severity as string,
      status: s.status as string,
      title: s.title as string,
    }));

  // Normalize actions
  const actions: ProjectOSOperatingContext["actions"] =
    (actionsResult.data ?? []).map((a) => ({
      id: a.id as string,
      actionType: a.action_type as string,
      status: a.status as string,
      title: a.title as string,
    }));

  // Normalize commitments
  const now = new Date();
  const commitments: ProjectOSOperatingContext["commitments"] =
    (commitmentsResult.data ?? []).map((c) => ({
      id: c.id as string,
      status: c.status as string,
      title: c.title as string,
      dueDate: c.due_date as string | null,
      isOverdue:
        c.due_date != null &&
        c.status !== "completed" &&
        c.status !== "cancelled" &&
        new Date(c.due_date as string) < now,
    }));

  // Normalize projections
  const projections: ProjectOSOperatingContext["projections"] =
    (projectionsResult.data ?? []).map((p) => ({
      id: p.id as string,
      status: p.status as string,
      projectionAccuracy: p.projection_accuracy as number | null,
    }));

  // Normalize realities
  const realities: ProjectOSOperatingContext["realities"] =
    (realitiesResult.data ?? []).map((r) => ({
      id: r.id as string,
      status: r.status as string,
      observedAt: r.observed_at as string,
    }));

  // Normalize recommendations
  const recommendations: ProjectOSOperatingContext["recommendations"] =
    (recommendationsResult.data ?? []).map((r) => ({
      id: r.id as string,
      recommendationType: r.recommendation_type as string,
      confidenceScore: r.confidence_score as number,
      status: r.status as string,
    }));

  // Normalize learning patterns
  const learningPatterns: ProjectOSOperatingContext["learningPatterns"] =
    (learningResult.data ?? []).map((l) => ({
      id: l.id as string,
      patternType: l.pattern_type as string,
      confidence: l.confidence as number,
    }));

  // Compute constitution summary
  let constitution: ProjectOSOperatingContext["constitution"] = null;
  if (constitutionResult.data) {
    const c = constitutionResult.data;
    constitution = {
      status: c.lifecycle_status as string,
      version: c.version as number,
      ratified: true,
    };
  }

  // Detect attention items using pre-fetched domain data
  const attentionItems: DetectedAttentionItem[] = detectProjectAttentionItems({
    signals: signals.map((s) => ({
      id: s.id,
      signal_type: s.signalType,
      severity: s.severity,
      status: s.status,
      title: s.title,
    })),
    commitments: commitments.map((c) => ({
      id: c.id,
      status: c.status,
      title: c.title,
      due_date: c.dueDate,
    })),
    drifts: (driftsResult.data ?? []).map((d) => ({
      id: d.id as string,
      severity: d.severity as string,
      drift_type: d.drift_type as string,
      description: d.description as string,
    })),
    violations: (violationsResult.data ?? []).map((v) => ({
      id: v.id as string,
      status: v.status as string,
      title: v.title as string | undefined,
      violation_type: v.violation_type as string | undefined,
    })),
    recommendations: recommendations.map((r) => ({
      id: r.id,
      recommendation_type: r.recommendationType,
      status: r.status,
      confidence_score: r.confidenceScore,
    })),
    variances: (variancesResult.data ?? []).map((v) => ({
      id: v.id as string,
      severity: v.severity as string,
      variance_type: v.variance_type as string,
      variance_percentage: v.variance_percentage as number,
    })),
    operatingHealthScore: 100,
    snapshotId: input.snapshotId,
  });

  return {
    ok: true,
    data: {
      projectId,
      workspaceId,
      constitution,
      signals,
      actions,
      commitments,
      projections,
      realities,
      recommendations,
      learningPatterns,
      attentionItems,
      composedAt: new Date().toISOString(),
    },
  };
}
