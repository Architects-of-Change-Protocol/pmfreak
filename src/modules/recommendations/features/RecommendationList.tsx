"use client";

import { ApprovalFlow, ZoneFrame } from "@/platform/components";
import { decideRecommendation, useRecommendations, type RecommendationStatus } from "../contracts/recommendations.contract";
import { RecommendationCard } from "../presentation/RecommendationCard";

/**
 * The Feature layer for Recommendation review — the smallest unit that
 * owns the Command dispatch (07-frontend-module-boundaries.md §8). Reused
 * by both the Project Command Center's AI Recommendations zone and the full
 * Recommendation Register screen. Wrapped in ZoneFrame so both call sites
 * get the same Loading/Empty/Error handling
 * (08-command-center-experience.md §5).
 */
export function RecommendationList({
  projectId,
  status = "proposed",
  canApprove,
  approvalDeniedReason,
  title = "AI Recommendations",
}: {
  projectId: string;
  status?: RecommendationStatus;
  canApprove: boolean;
  approvalDeniedReason?: string;
  title?: string;
}) {
  const { recommendations, error, isLoading, mutate } = useRecommendations(projectId, status);

  return (
    <ZoneFrame
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={recommendations.length === 0}
      emptyMessage="No Agent has produced an unreviewed Recommendation for this project yet."
      onRetry={() => mutate()}
    >
      <div className="flex flex-col gap-3">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            approvalActions={
              <ApprovalFlow
                itemLabel={recommendation.title}
                disabled={!canApprove}
                disabledReason={approvalDeniedReason}
                onApprove={async () => {
                  const result = await decideRecommendation({ actionId: recommendation.id, decision: "accepted" });
                  if (!result.ok) throw new Error(result.error);
                  await mutate();
                }}
                onReject={async () => {
                  const result = await decideRecommendation({ actionId: recommendation.id, decision: "rejected" });
                  if (!result.ok) throw new Error(result.error);
                  await mutate();
                }}
              />
            }
          />
        ))}
      </div>
    </ZoneFrame>
  );
}
