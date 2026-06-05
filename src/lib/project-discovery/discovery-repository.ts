import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";
import { generateProjectDiscovery, type DiscoveryEvidenceContent, type ProjectDiscoveryModel } from "@/lib/project-discovery/discovery-agent";

type DiscoveryRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  version: number;
  stakeholders_json: ProjectDiscoveryModel["stakeholders"];
  dependencies_json: ProjectDiscoveryModel["dependencies"];
  risks_json: ProjectDiscoveryModel["risks"];
  milestones_json: ProjectDiscoveryModel["milestones"];
  deliverables_json: ProjectDiscoveryModel["deliverables"];
  assumptions_json: ProjectDiscoveryModel["assumptions"];
  unknowns_json: ProjectDiscoveryModel["unknowns"];
  confidence_score: number;
  evidence_count: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

const countFindings = (discovery: ProjectDiscoveryModel) =>
  discovery.stakeholders.length + discovery.dependencies.length + discovery.risks.length + discovery.milestones.length + discovery.deliverables.length + discovery.assumptions.length + discovery.unknowns.length;

export async function regenerateProjectDiscovery(input: { projectId: string; requestId?: string }) {
  const startedAt = Date.now();
  const supabase = createPrivilegedSupabaseClient({
    routeId: "ProjectDiscoveryAgent.regenerateProjectDiscovery",
    operation: "project_discovery.regenerate",
    reason: "Create versioned project discovery from canonical evidence",
    systemActor: "background_job",
  });

  console.info("[project_discovery] Discovery Started", { requestId: input.requestId, projectId: input.projectId });

  try {
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("project_evidence_content")
      .select("id,evidence_id,project_id,workspace_id,source_file_name,extracted_text,created_at")
      .eq("project_id", input.projectId)
      .order("created_at", { ascending: true });

    if (evidenceError) throw new Error(`Unable to load canonical evidence: ${evidenceError.message}`);
    const typedEvidence = (evidenceRows ?? []) as DiscoveryEvidenceContent[];

    if (typedEvidence.length === 0) {
      console.info("[project_discovery] Discovery Completed", { requestId: input.requestId, projectId: input.projectId, evidenceCount: 0, findingsCount: 0, confidenceScore: 0, durationMs: Date.now() - startedAt });
      return null;
    }

    const workspaceId = typedEvidence[0].workspace_id;
    const discovery = generateProjectDiscovery(typedEvidence);

    const { data: latestRows, error: versionError } = await supabase
      .from("project_discovery")
      .select("version")
      .eq("project_id", input.projectId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError) throw new Error(`Unable to resolve discovery version: ${versionError.message}`);
    const latestVersion = Number(((latestRows ?? [])[0] as { version?: number } | undefined)?.version ?? 0);
    const nextVersion = latestVersion + 1;
    const generatedAt = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from("project_discovery")
      .insert({
        project_id: input.projectId,
        workspace_id: workspaceId,
        version: nextVersion,
        stakeholders_json: discovery.stakeholders,
        dependencies_json: discovery.dependencies,
        risks_json: discovery.risks,
        milestones_json: discovery.milestones,
        deliverables_json: discovery.deliverables,
        assumptions_json: discovery.assumptions,
        unknowns_json: discovery.unknowns,
        confidence_score: discovery.confidence_score,
        evidence_count: discovery.evidence_count,
        generated_at: generatedAt,
      })
      .select("id,project_id,workspace_id,version,stakeholders_json,dependencies_json,risks_json,milestones_json,deliverables_json,assumptions_json,unknowns_json,confidence_score,evidence_count,generated_at,created_at,updated_at")
      .single();

    if (insertError) throw new Error(`Unable to persist discovery: ${insertError.message}`);

    console.info("[project_discovery] Discovery Completed", { requestId: input.requestId, projectId: input.projectId, evidenceCount: discovery.evidence_count, findingsCount: countFindings(discovery), confidenceScore: discovery.confidence_score, version: nextVersion, durationMs: Date.now() - startedAt });
    return inserted as DiscoveryRow;
  } catch (error) {
    console.error("[project_discovery] Discovery Failed", { requestId: input.requestId, projectId: input.projectId, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export const regenerateProjectDiscoveryInBackground = (input: { projectId: string; requestId?: string }) => {
  setTimeout(() => {
    void regenerateProjectDiscovery(input).catch(() => undefined);
  }, 0);
};
