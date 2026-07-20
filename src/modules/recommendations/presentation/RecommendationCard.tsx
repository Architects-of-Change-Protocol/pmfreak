import type { ReactNode } from "react";
import { ConfidenceScore } from "@/platform/components";
import type { RecommendationSummary } from "../contracts/recommendations.contract";

function evidenceList(evidenceSummary: Record<string, unknown> | null): string[] {
  if (!evidenceSummary) return [];
  const sources = evidenceSummary.sources ?? evidenceSummary.evidence ?? evidenceSummary.basedOn;
  if (Array.isArray(sources)) return sources.map(String);
  return Object.entries(evidenceSummary).map(([key, value]) => `${key}: ${String(value)}`);
}

/**
 * The mandatory 5-part Recommendation disclosure shape
 * (08-ai-interaction-patterns.md §2) — Why / Evidence / Confidence /
 * Expected Impact / Approval, always in this order, every time. Never a
 * bare directive. `approvalActions` is Feature-wired (ApprovalFlow), this
 * component never dispatches a Command itself.
 */
export function RecommendationCard({ recommendation, approvalActions }: { recommendation: RecommendationSummary; approvalActions?: ReactNode }) {
  const evidence = evidenceList(recommendation.evidence_summary);
  return (
    <article aria-label={recommendation.title} className="flex flex-col gap-3 rounded-lg border border-slate-500/30 p-4">
      <span className="w-fit rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: "var(--pmf-ai-accent)", backgroundColor: "var(--pmf-ai-accent-bg)" }}>
        AI-generated
      </span>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why</h3>
        <p className="text-sm text-slate-100">{recommendation.description || recommendation.title}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</h3>
        {evidence.length > 0 ? (
          <ul className="mt-1 list-inside list-disc text-sm text-slate-300">
            {evidence.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No evidence summary recorded for this recommendation.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confidence</h3>
        <ConfidenceScore confidence={recommendation.confidence_score} basis={`Based on ${recommendation.recommended_action_type.replace(/_/g, " ")} analysis`} />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected Impact</h3>
        <p className="text-sm text-slate-100">
          {recommendation.impact_level} impact
          {recommendation.recommended_due_window ? ` · ${recommendation.recommended_due_window}` : ""}
        </p>
      </div>

      <div>{approvalActions}</div>
    </article>
  );
}
