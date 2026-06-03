import { createHash } from "node:crypto";

const MAX_INTERVENTION_TEXT = 500;
const MAX_OUTCOME_SUMMARY = 300;
const MAX_STAKEHOLDERS = 8;
const MAX_PATTERNS = 8;
const MAX_NUTRIENTS = 12;
const MAX_SUMMARY_LINES = 4;

export type OperationalInterventionRecord = {
  interventionId: string;
  companyId: string;
  workspaceId: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  source: "copilot" | "runtime" | "governance" | "execution_engine" | "stakeholder_engine";
  interventionType: "escalation" | "mitigation" | "stakeholder_alignment" | "dependency_resolution" | "timeline_recovery" | "governance_action" | "execution_coordination" | "risk_containment";
  operationalDomain: "delivery" | "risk" | "governance" | "stakeholder" | "financial" | "timeline" | "general";
  severity: "low" | "medium" | "high" | "critical";
  interventionText: string;
  targetStakeholders: string[];
  relatedPatterns: string[];
  relatedNutrients: string[];
  runtimeDecisionId?: string | null;
  lineage: { sessionKey?: string | null; correlationId?: string | null; executionTraceId?: string | null };
  outcomeStatus: "pending" | "accepted" | "ignored" | "resolved" | "escalated" | "failed" | "partially_resolved";
  outcomeSummary?: string | null;
  outcomeUpdatedAt?: string | null;
  freshnessScore: number;
};

const normalizeText = (value: string, max: number): string => value.replace(/\s+/g, " ").trim().slice(0, max);
const uniq = (values: string[], max: number) => Array.from(new Set(values.map((v) => normalizeText(v, 80).toLowerCase()).filter(Boolean))).slice(0, max);

const fingerprint = (input: { interventionType: string; interventionText: string; targetStakeholders: string[]; projectId: string | null; runtimeDecisionId?: string | null; lineage: OperationalInterventionRecord["lineage"]; }) =>
  createHash("sha256").update([input.interventionType, normalizeText(input.interventionText, MAX_INTERVENTION_TEXT).toLowerCase(), uniq(input.targetStakeholders, MAX_STAKEHOLDERS).join(","), input.projectId ?? "none", input.runtimeDecisionId ?? "none", input.lineage.sessionKey ?? "none", input.lineage.correlationId ?? "none"].join("|")).digest("hex").slice(0, 40);

export function classifyInterventionOutcome(signal: string): OperationalInterventionRecord["outcomeStatus"] {
  const s = signal.toLowerCase();
  if (/blocker resolved|dependency recovered|recovery succeeded|closed/.test(s)) return "resolved";
  if (/partial|partially|incomplete|only some/.test(s)) return "partially_resolved";
  if (/non-response|no response|ignored|silence/.test(s)) return "ignored";
  if (/repeated escalation|escalation repeated|failed|worsened/.test(s)) return "failed";
  if (/accepted|acknowledged/.test(s)) return "accepted";
  if (/escalat/.test(s)) return "escalated";
  return "pending";
}

export function calculateInterventionFreshness(record: Pick<OperationalInterventionRecord, "createdAt" | "severity" | "outcomeStatus">, now = Date.now()): number {
  const ageDays = Math.max(0, (now - Date.parse(record.createdAt)) / 86_400_000);
  const severityMultiplier = record.severity === "critical" ? 1.3 : record.severity === "high" ? 1.15 : record.severity === "medium" ? 1 : 0.9;
  const outcomeDecay = record.outcomeStatus === "resolved" ? 0.2 : record.outcomeStatus === "failed" ? 0.06 : record.outcomeStatus === "ignored" ? 0.08 : 0.1;
  return Number((Math.max(0, Math.min(1, Math.exp(-ageDays * outcomeDecay) * severityMultiplier)) * 100).toFixed(2));
}

const transitions: Record<OperationalInterventionRecord["outcomeStatus"], OperationalInterventionRecord["outcomeStatus"][]> = {
  pending: ["accepted", "ignored", "escalated"], accepted: ["resolved", "failed", "partially_resolved"], escalated: ["resolved", "failed"], ignored: [], resolved: [], failed: [], partially_resolved: [],
};

type InterventionRow = { intervention_id: string; company_id: string; workspace_id: string; project_id: string | null; created_at: string; updated_at: string; source: OperationalInterventionRecord["source"]; intervention_type: OperationalInterventionRecord["interventionType"]; operational_domain: OperationalInterventionRecord["operationalDomain"]; severity: OperationalInterventionRecord["severity"]; intervention_text: string; target_stakeholders: string[]; related_patterns: string[]; related_nutrients: string[]; runtime_decision_id: string | null; lineage: OperationalInterventionRecord["lineage"]; outcome_status: OperationalInterventionRecord["outcomeStatus"]; outcome_summary: string | null; outcome_updated_at: string | null; freshness_score: number | null };
const mapRow = (row: InterventionRow): OperationalInterventionRecord => ({ interventionId: row.intervention_id, companyId: row.company_id, workspaceId: row.workspace_id, projectId: row.project_id, createdAt: row.created_at, updatedAt: row.updated_at, source: row.source, interventionType: row.intervention_type, operationalDomain: row.operational_domain, severity: row.severity, interventionText: row.intervention_text, targetStakeholders: Array.isArray(row.target_stakeholders) ? row.target_stakeholders : [], relatedPatterns: Array.isArray(row.related_patterns) ? row.related_patterns : [], relatedNutrients: Array.isArray(row.related_nutrients) ? row.related_nutrients : [], runtimeDecisionId: row.runtime_decision_id, lineage: row.lineage ?? {}, outcomeStatus: row.outcome_status, outcomeSummary: row.outcome_summary, outcomeUpdatedAt: row.outcome_updated_at, freshnessScore: Number(row.freshness_score ?? 0) });

export async function persistOperationalIntervention(input: Omit<OperationalInterventionRecord, "interventionId" | "createdAt" | "updatedAt" | "freshnessScore" | "outcomeStatus"> & Partial<Pick<OperationalInterventionRecord, "outcomeStatus">>): Promise<{ status: "created" | "duplicate" | "degraded"; record?: OperationalInterventionRecord; reason?: string; }> {
  const now = new Date().toISOString();
  const normalized = {
    ...input,
    interventionText: normalizeText(input.interventionText ?? "", MAX_INTERVENTION_TEXT),
    targetStakeholders: uniq(input.targetStakeholders ?? [], MAX_STAKEHOLDERS),
    relatedPatterns: uniq(input.relatedPatterns ?? [], MAX_PATTERNS),
    relatedNutrients: uniq(input.relatedNutrients ?? [], MAX_NUTRIENTS),
    outcomeStatus: input.outcomeStatus ?? "pending",
    lineage: input.lineage ?? {},
  };
  const interventionId = fingerprint(normalized);
  const fresh = calculateInterventionFreshness({ createdAt: now, severity: normalized.severity, outcomeStatus: normalized.outcomeStatus });
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data: existing } = await supabase.from("intervention_memory").select("*").eq("intervention_id", interventionId).maybeSingle();
    if (existing) return { status: "duplicate", record: mapRow(existing as InterventionRow) };
    const { data, error } = await supabase.from("intervention_memory").insert({ intervention_id: interventionId, company_id: normalized.companyId, workspace_id: normalized.workspaceId, project_id: normalized.projectId, created_at: now, updated_at: now, source: normalized.source, intervention_type: normalized.interventionType, operational_domain: normalized.operationalDomain, severity: normalized.severity, intervention_text: normalized.interventionText, target_stakeholders: normalized.targetStakeholders, related_patterns: normalized.relatedPatterns, related_nutrients: normalized.relatedNutrients, runtime_decision_id: normalized.runtimeDecisionId ?? null, lineage: normalized.lineage, outcome_status: normalized.outcomeStatus, outcome_summary: null, outcome_updated_at: null, freshness_score: fresh }).select("*").single();
    if (error || !data) return { status: "degraded", reason: error?.message ?? "persist_failed" };
    return { status: "created", record: mapRow(data as InterventionRow) };
  } catch (error) {
    return { status: "degraded", reason: error instanceof Error ? error.message : "persist_failed" };
  }
}

export async function retrieveInterventionHistory(request: { workspaceId: string; projectId?: string | null; operationalDomain?: OperationalInterventionRecord["operationalDomain"][]; severity?: OperationalInterventionRecord["severity"][]; unresolvedOnly?: boolean; stakeholder?: string; recentOnlyDays?: number; limit?: number; }): Promise<OperationalInterventionRecord[]> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("intervention_memory").select("*").eq("workspace_id", request.workspaceId).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(request.limit ?? 20, 60)));
    if (request.projectId) query = query.eq("project_id", request.projectId);
    if (request.operationalDomain?.length) query = query.in("operational_domain", request.operationalDomain);
    if (request.severity?.length) query = query.in("severity", request.severity);
    if (request.unresolvedOnly) query = query.in("outcome_status", ["pending", "accepted", "escalated", "partially_resolved"]);
    if (request.recentOnlyDays) query = query.gte("created_at", new Date(Date.now() - Math.max(1, request.recentOnlyDays) * 86_400_000).toISOString());
    if (request.stakeholder?.trim()) query = query.contains("target_stakeholders", [request.stakeholder.trim().toLowerCase()]);
    const { data, error } = await query;
    if (error || !data) return [];
    return (data as InterventionRow[]).map(mapRow);
  } catch { return []; }
}

export async function updateInterventionOutcome(input: { workspaceId: string; interventionId: string; nextStatus: OperationalInterventionRecord["outcomeStatus"]; outcomeSummary?: string | null; }): Promise<{ status: "updated" | "invalid_transition" | "not_found" | "degraded"; record?: OperationalInterventionRecord; reason?: string; }> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase.from("intervention_memory").select("*").eq("workspace_id", input.workspaceId).eq("intervention_id", input.interventionId).maybeSingle();
    if (!current) return { status: "not_found" };
    const currentStatus = current.outcome_status as OperationalInterventionRecord["outcomeStatus"];
    if (!transitions[currentStatus]?.includes(input.nextStatus)) return { status: "invalid_transition", reason: `${currentStatus}->${input.nextStatus}` };
    const outcomeUpdatedAt = new Date().toISOString();
    const freshnessScore = calculateInterventionFreshness({ createdAt: current.created_at, severity: current.severity, outcomeStatus: input.nextStatus });
    const { data, error } = await supabase.from("intervention_memory").update({ outcome_status: input.nextStatus, outcome_summary: normalizeText(input.outcomeSummary ?? "", MAX_OUTCOME_SUMMARY) || null, outcome_updated_at: outcomeUpdatedAt, updated_at: outcomeUpdatedAt, freshness_score: freshnessScore }).eq("workspace_id", input.workspaceId).eq("intervention_id", input.interventionId).select("*").single();
    if (error || !data) return { status: "degraded", reason: error?.message ?? "update_failed" };
    return { status: "updated", record: mapRow(data as InterventionRow) };
  } catch (error) { return { status: "degraded", reason: error instanceof Error ? error.message : "update_failed" }; }
}

export function buildInterventionMemorySummary(records: OperationalInterventionRecord[]): string[] {
  const summaries: string[] = [];
  if (records.filter((r) => r.interventionType === "escalation" && ["pending", "ignored", "escalated"].includes(r.outcomeStatus)).length >= 2) summaries.push("Repeated escalation recommendations remain unresolved.");
  if (records.some((r) => r.interventionType === "dependency_resolution" && r.outcomeStatus === "partially_resolved")) summaries.push("Dependency mitigation interventions show partial recovery.");
  if (records.filter((r) => r.interventionType === "stakeholder_alignment" && r.outcomeStatus === "ignored").length >= 1) summaries.push("Stakeholder alignment interventions repeatedly ignored.");
  if (records.some((r) => r.interventionType === "timeline_recovery" && r.outcomeStatus === "resolved")) summaries.push("Timeline recovery interventions improved delivery stability.");
  return summaries.slice(0, MAX_SUMMARY_LINES);
}

export function extractOperationalInterventions(answer: string): Array<Pick<OperationalInterventionRecord, "interventionType" | "operationalDomain" | "severity" | "interventionText" | "targetStakeholders">> {
  const lines = answer.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 40);
  return lines.filter((line) => /\b(escalate|mitigate|coordinate|align|unblock|resolve dependency|contain risk)\b/i.test(line) && !/\b(hello|thanks|summary|context|because|explain)\b/i.test(line)).map((line): Pick<OperationalInterventionRecord, "interventionType" | "operationalDomain" | "severity" | "interventionText" | "targetStakeholders"> => ({ interventionType: /escalat/i.test(line) ? "escalation" : /dependenc|unblock/i.test(line) ? "dependency_resolution" : /align|coordinate/i.test(line) ? "stakeholder_alignment" : /timeline|recovery/i.test(line) ? "timeline_recovery" : /contain risk/i.test(line) ? "risk_containment" : "mitigation", operationalDomain: /governance|approval|steerco/i.test(line) ? "governance" : /stakeholder|sponsor|vendor/i.test(line) ? "stakeholder" : /timeline|delivery|sprint/i.test(line) ? "timeline" : /risk/i.test(line) ? "risk" : "delivery", severity: /critical|immediate|today|now/i.test(line) ? "high" : "medium", interventionText: normalizeText(line, MAX_INTERVENTION_TEXT), targetStakeholders: uniq((line.match(/\b(pm|sponsor|owner|cto|vp|vendor|finance|qa|engineering)\b/gi) ?? []).map((x) => x.toLowerCase()), MAX_STAKEHOLDERS) })).slice(0, 6);
}
