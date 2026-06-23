import type {
  ConsequenceAnalysis,
  ConsequenceResult,
  ExplainConsequenceInput,
} from "./types";
import {
  dbFindConsequenceById,
  dbListConsequenceImpacts,
  dbListConsequencePaths,
  dbListConsequenceScenarios,
} from "./consequence-repository";
import { generateDecisionSupport } from "./decision-support-engine";

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

// ─── explainOperationalConsequences ──────────────────────────────────────────

export async function explainOperationalConsequences(
  input: ExplainConsequenceInput
): Promise<ConsequenceResult<ConsequenceAnalysis & { explanation: string }>> {
  if (!validUuid(input.workspaceId))    return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
  if (!validUuid(input.consequenceId))  return { ok: false, error: "consequenceId must be a UUID.", failureClass: "validation_failed" };

  const [cResult, impactsResult, pathsResult, scenariosResult] = await Promise.all([
    dbFindConsequenceById(input.consequenceId, input.workspaceId),
    dbListConsequenceImpacts(input.consequenceId, input.workspaceId),
    dbListConsequencePaths(input.consequenceId, input.workspaceId),
    dbListConsequenceScenarios(input.consequenceId, input.workspaceId),
  ]);

  if (!cResult.ok)        return cResult;
  if (!impactsResult.ok)  return impactsResult;
  if (!pathsResult.ok)    return pathsResult;
  if (!scenariosResult.ok) return scenariosResult;

  const consequence = cResult.data;
  const impacts     = impactsResult.data;
  const paths       = pathsResult.data;
  const scenarios   = scenariosResult.data;

  const totalAffected = impacts.reduce((s, i) => s + i.affected_entity_count, 0);

  const decisionSupport = generateDecisionSupport({
    focusItemId:           consequence.focus_item_id,
    focusType:             impacts[0]?.impact_type ?? "governance",
    recommendedActionType: null,
    blockedEntityCount:    totalAffected,
    escalationProbability: consequence.escalation_probability,
    severity:              consequence.severity,
    impactHorizon:         consequence.impact_horizon,
    impactScore:           consequence.impact_score,
  });

  const lines: string[] = [
    `## Operational Consequence Analysis`,
    ``,
    `**Consequence ID**: ${consequence.id}`,
    `**Focus Item ID**: ${consequence.focus_item_id}`,
    `**Severity**: ${consequence.severity}`,
    `**Impact Score**: ${consequence.impact_score}/100`,
    `**Escalation Probability**: ${Math.round(consequence.escalation_probability * 100)}%`,
    `**Impact Horizon**: ${consequence.impact_horizon}`,
    `**Analysis Status**: ${consequence.analysis_status}`,
    ``,
    `### Impact Score`,
    `The impact score of ${consequence.impact_score} reflects the combined weight of focus score, operational ` +
    `priority, dependency count, governance impact, execution impact, and historical similarity. ` +
    `A score above 70 indicates critical operational risk.`,
    ``,
    `### Cascade Analysis`,
  ];

  if (paths.length > 0) {
    const maxDepth = Math.max(...paths.map((p) => p.cascade_depth));
    lines.push(`The cascade chain has ${paths.length} steps with a maximum depth of ${maxDepth}.`);
    lines.push(`Cascade path: ${paths.map((p) => `${p.source_entity_type} → ${p.target_entity_type}`).join(", ")}.`);
  } else {
    lines.push(`No cascade paths recorded for this consequence.`);
  }

  lines.push(
    ``,
    `### Escalation Probability`,
    `Escalation probability of ${Math.round(consequence.escalation_probability * 100)}% is derived from severity, ` +
    `dependency density, open commitments, active violations, and historical escalation rates.`,
    ``,
    `### Impact Horizon`,
    `At ${consequence.severity} severity, the expected materialisation window is ${consequence.impact_horizon}.`,
    ``,
    `### Scenario Generation`,
  );

  for (const s of scenarios) {
    lines.push(`**${s.scenario_name.replace(/_/g, " ")}** (probability ${s.probability}): ${s.scenario_description}`);
  }

  lines.push(
    ``,
    `### Decision Support`,
    decisionSupport.rationale,
    ``,
    `### Lineage`,
    `This consequence analysis is traceable through: Constitution → Memory → Learning → Recommendation → ` +
    `Signal → Action → Commitment → Projection → Reality → Project OS Snapshot → Command Center → ` +
    `Focus Item → Consequence Analysis.`,
  );

  return {
    ok: true,
    data: {
      consequence,
      impacts,
      paths,
      scenarios,
      decisionSupport,
      explanation: lines.join("\n"),
    },
  };
}
