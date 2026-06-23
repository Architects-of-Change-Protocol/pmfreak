import type {
  DecisionResult,
  OperationalDecisionAnalysis,
  ExplainDecisionInput,
} from "./types";
import { getOperationalDecisionAnalysis } from "./decision-registry";

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

// ─── explainOperationalDecisions ──────────────────────────────────────────────

export async function explainOperationalDecisions(
  input: ExplainDecisionInput
): Promise<DecisionResult<OperationalDecisionAnalysis & { explanation: string }>> {
  if (!validUuid(input.workspaceId)) return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
  if (!validUuid(input.decisionId))  return { ok: false, error: "decisionId must be a UUID.", failureClass: "validation_failed" };

  const analysis = await getOperationalDecisionAnalysis({
    workspaceId: input.workspaceId,
    decisionId:  input.decisionId,
  });
  if (!analysis.ok) return analysis;

  const { decision, options, evaluations, tradeoffs, recommendation, comparative, support } = analysis.data;

  const lines: string[] = [
    `## Operational Decision Analysis`,
    ``,
    `**Decision ID**: ${decision.id}`,
    `**Consequence ID**: ${decision.consequence_id}`,
    `**Category**: ${decision.decision_category}`,
    `**Status**: ${decision.decision_status}`,
    `**Decision Score**: ${decision.decision_score}/100`,
    `**Decision Confidence**: ${Math.round(decision.decision_confidence * 100)}%`,
    ``,
    `### Alternatives`,
  ];

  for (const opt of options) {
    lines.push(`**${opt.option_name}** (${opt.option_type}, effort: ${opt.estimated_effort}, risk: ${opt.estimated_risk})`);
    lines.push(`  ${opt.option_description}`);
  }

  lines.push(``, `### Evaluation`);

  for (const ev of evaluations) {
    const opt = options.find((o) => o.id === ev.option_id);
    const name = opt?.option_name ?? ev.option_id;
    lines.push(
      `**${name}**: governance=${ev.governance_score} execution=${ev.execution_score} ` +
      `risk=${ev.risk_score} health=${ev.health_score} overall=${ev.overall_score}`
    );
  }

  lines.push(``, `### Scoring`);
  lines.push(
    `Decision quality score of ${decision.decision_score}/100 reflects the best available ` +
    `alternative's overall evaluation across governance, execution, risk, and health dimensions.`
  );

  lines.push(``, `### Confidence`);
  lines.push(
    `Decision confidence of ${Math.round(decision.decision_confidence * 100)}% is derived from ` +
    `evaluation spread, escalation probability, impact score, and number of alternatives evaluated.`
  );

  lines.push(``, `### Tradeoffs`);
  for (const tr of tradeoffs) {
    const opt = options.find((o) => o.id === tr.option_id);
    const name = opt?.option_name ?? tr.option_id;
    lines.push(`**[${tr.tradeoff_type.toUpperCase()}]** ${name}: ${tr.description} (impact: ${tr.impact_score})`);
  }

  lines.push(``, `### Recommendation`);
  lines.push(`**Recommended**: ${recommendation.optionName}`);
  lines.push(`**Score**: ${recommendation.score}/100`);
  lines.push(`**Confidence**: ${Math.round(recommendation.confidence * 100)}%`);
  lines.push(recommendation.rationale);

  lines.push(``, `### Decision Support`);
  lines.push(`Recommended: **${support.recommendedOption}**`);
  for (const b of support.because) {
    lines.push(`- ${b}`);
  }

  lines.push(``, `### Comparative Analysis`);
  for (const comp of comparative.ranked) {
    lines.push(
      `${comp.rank}. **${comp.optionName}** — score ${comp.score}/100` +
      (comp.scoreDifferenceFromTop > 0 ? ` (−${comp.scoreDifferenceFromTop} vs top)` : " (top)")
    );
  }
  lines.push(`Score spread across alternatives: ${comparative.spread} points.`);

  lines.push(
    ``, `### Lineage`,
    `This decision is traceable through: Constitution → Memory → Learning → Recommendation → ` +
    `Signal → Action → Commitment → Projection → Reality → Project OS Snapshot → Command Center → ` +
    `Focus Item → Consequence Analysis → Decision.`,
  );

  return {
    ok:   true,
    data: { ...analysis.data, explanation: lines.join("\n") },
  };
}
