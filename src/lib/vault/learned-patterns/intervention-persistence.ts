import crypto from "node:crypto";
import type { VaultIntervention, InterventionFatigueLevel, InterventionOutcome, InterventionType } from "./intervention-learning";
import type { PatternLearningContext } from "./types";

export type InterventionPersistenceResult = {
  interventionsPersisted: number;
  evidencePersisted: number;
  outcomesPersisted: number;
  method: "supabase" | "none";
  error?: string;
};

export type InterventionHistoryOptions = {
  projectId?: string | null;
  targetPatternId?: string;
  interventionTypes?: InterventionType[];
  outcomes?: InterventionOutcome[];
  fatigueLevel?: InterventionFatigueLevel;
  limit?: number;
  since?: string;
  includeEvidence?: boolean;
  includeOutcomes?: boolean;
};

export async function persistInterventions(context: PatternLearningContext, interventions: VaultIntervention[]): Promise<InterventionPersistenceResult> {
  if (!context.workspaceId || interventions.length === 0) return { interventionsPersisted: 0, evidencePersisted: 0, outcomesPersisted: 0, method: "none" };
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { error: iErr } = await supabase.from("vault_interventions").upsert(interventions.map((it) => ({
      id: it.id, workspace_id: it.workspaceId, project_id: it.projectId ?? null, target_pattern_id: it.targetPatternId ?? null,
      intervention_type: it.interventionType, title: it.title, summary: it.summary, attempted_at: it.attemptedAt, actor_user_id: it.actorUserId ?? null,
      outcome: it.outcome, efficacy_score: it.efficacyScore, confidence: it.confidence, fatigue_level: it.fatigueProfile.fatigueLevel,
      repeated_attempt_count: it.fatigueProfile.repeatedAttemptCount, failed_attempt_count: it.fatigueProfile.failedAttemptCount, recommended_next_escalation: it.fatigueProfile.recommendedNextEscalation,
      metadata: { targetSignals: it.targetSignals, outcomeReasons: it.outcomeReasons, timeToEffectDays: it.timeToEffectDays, recurrenceAfterAttempt: it.recurrenceAfterAttempt, severityDelta: it.severityDelta, confidenceDelta: it.confidenceDelta, fatigueProfile: it.fatigueProfile, detectionMethod: "rule_based" },
      created_at: it.createdAt, updated_at: it.updatedAt,
    })), { onConflict: "id" });
    if (iErr) return { interventionsPersisted: 0, evidencePersisted: 0, outcomesPersisted: 0, method: "none", error: iErr.message };

    const evidence = interventions.flatMap((it) => it.evidenceReferences.map((e) => ({ id: crypto.randomUUID(), intervention_id: it.id, workspace_id: it.workspaceId, nutrient_id: e.nutrientId, source_artifact_id: e.sourceArtifactId ?? null, excerpt: e.excerpt, evidence_timestamp: e.timestamp })));
    let evidencePersisted = 0;
    if (evidence.length) {
      const { error } = await supabase.from("vault_intervention_evidence").insert(evidence);
      if (!error) evidencePersisted = evidence.length;
    }
    const outcomes = interventions.map((it) => ({ id: crypto.randomUUID(), intervention_id: it.id, workspace_id: it.workspaceId, outcome: it.outcome, efficacy_score: it.efficacyScore, confidence: it.confidence, outcome_reasons: it.outcomeReasons, time_to_effect_days: it.timeToEffectDays, recurrence_after_attempt: it.recurrenceAfterAttempt, severity_delta: it.severityDelta, confidence_delta: it.confidenceDelta, fatigue_profile: it.fatigueProfile, metadata: { targetSignals: it.targetSignals } }));
    let outcomesPersisted = 0;
    const { error: oErr } = await supabase.from("vault_intervention_outcomes").insert(outcomes);
    if (!oErr) outcomesPersisted = outcomes.length;
    return { interventionsPersisted: interventions.length, evidencePersisted, outcomesPersisted, method: "supabase" };
  } catch (err) {
    return { interventionsPersisted: 0, evidencePersisted: 0, outcomesPersisted: 0, method: "none", error: err instanceof Error ? err.message : "unknown" };
  }
}

type InterventionDbRow = { id: string; workspace_id: string; project_id: string | null; target_pattern_id: string | null; intervention_type: InterventionType; title: string; summary: string; attempted_at: string; actor_user_id: string | null; outcome: InterventionOutcome; efficacy_score: number; confidence: number; fatigue_level: InterventionFatigueLevel; repeated_attempt_count: number; failed_attempt_count: number; recommended_next_escalation: string | null; created_at: string; updated_at: string; metadata: { targetSignals?: string[]; outcomeReasons?: string[]; timeToEffectDays?: number | null; recurrenceAfterAttempt?: number; severityDelta?: number; confidenceDelta?: number } | null };
export async function loadInterventionHistory(context: PatternLearningContext, options: InterventionHistoryOptions = {}): Promise<VaultIntervention[]> { try { const { createSupabaseServerClient } = await import("@/lib/supabase/server"); const supabase = await createSupabaseServerClient(); let q = supabase.from("vault_interventions").select("*").eq("workspace_id", context.workspaceId).order("attempted_at", { ascending: false }).limit(options.limit ?? 50); if (options.projectId !== undefined) q = q.eq("project_id", options.projectId); if (options.targetPatternId) q = q.eq("target_pattern_id", options.targetPatternId); if (options.interventionTypes?.length) q = q.in("intervention_type", options.interventionTypes); if (options.outcomes?.length) q = q.in("outcome", options.outcomes); if (options.fatigueLevel) q = q.eq("fatigue_level", options.fatigueLevel); if (options.since) q = q.gte("attempted_at", options.since); const { data, error } = await q; if (error || !data) return []; return (data as InterventionDbRow[]).map((r)=>({ id:r.id, workspaceId:r.workspace_id, projectId:r.project_id, targetPatternId:r.target_pattern_id, interventionType:r.intervention_type, title:r.title, summary:r.summary, attemptedAt:r.attempted_at, actorUserId:r.actor_user_id, evidenceReferences:[], targetSignals:r.metadata?.targetSignals??[], outcome:r.outcome, efficacyScore:r.efficacy_score, confidence:Number(r.confidence), fatigueProfile:{ repeatedAttemptCount:r.repeated_attempt_count, failedAttemptCount:r.failed_attempt_count, lastAttemptAt:r.attempted_at, fatigueLevel:r.fatigue_level, fatigueReason:r.fatigue_level==="none"?"":"intervention fatigue detected", recommendedNextEscalation:r.recommended_next_escalation }, createdAt:r.created_at, updatedAt:r.updated_at, outcomeReasons:r.metadata?.outcomeReasons??[], timeToEffectDays:r.metadata?.timeToEffectDays??null, recurrenceAfterAttempt:r.metadata?.recurrenceAfterAttempt??0, severityDelta:r.metadata?.severityDelta??0, confidenceDelta:r.metadata?.confidenceDelta??0 })); } catch { return []; } }

export async function loadInterventionsForPattern(context: PatternLearningContext, patternId: string) { return loadInterventionHistory(context, { targetPatternId: patternId }); }
export async function loadFatiguedInterventions(context: PatternLearningContext, options: Omit<InterventionHistoryOptions, "fatigueLevel"> = {}) { return loadInterventionHistory(context, { ...options, fatigueLevel: "high" }); }
export async function getInterventionMemoryContext(context: PatternLearningContext, options: InterventionHistoryOptions = {}) { const interventions = await loadInterventionHistory(context, options); const interventionsByType: Record<string, number> = {}; const outcomesDistribution: Record<string, number> = {}; const averageEfficacyByType: Record<string, number> = {}; const evidenceSummaries = interventions.map((x)=>({ interventionId:x.id, topExcerpts:x.evidenceReferences.slice(0,2).map((e)=>e.excerpt) })); for (const i of interventions) { interventionsByType[i.interventionType]=(interventionsByType[i.interventionType]??0)+1; outcomesDistribution[i.outcome]=(outcomesDistribution[i.outcome]??0)+1; averageEfficacyByType[i.interventionType]=((averageEfficacyByType[i.interventionType]??0)+i.efficacyScore); } for (const k of Object.keys(averageEfficacyByType)) averageEfficacyByType[k]=Math.round((averageEfficacyByType[k]/interventionsByType[k])*100)/100; return { totalInterventions: interventions.length, interventionsByType, outcomesDistribution, averageEfficacyByType, fatiguedInterventions: interventions.filter((x)=>x.fatigueProfile.fatigueLevel!=="none").length, repeatedFailedLoops: interventions.filter((x)=>x.fatigueProfile.failedAttemptCount>=2).length, recoveredAfterIntervention: interventions.filter((x)=>x.outcome==="recovered").length, patternsWithRepeatedInterventions: [...new Set(interventions.filter((x)=>x.targetPatternId&&x.fatigueProfile.repeatedAttemptCount>=2).map((x)=>x.targetPatternId))].length, recommendedEscalationShifts: interventions.filter((x)=>x.fatigueProfile.recommendedNextEscalation).length, evidenceSummaries }; }
