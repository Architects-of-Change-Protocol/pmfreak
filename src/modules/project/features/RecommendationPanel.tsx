"use client";

import { RecommendationList } from "@/modules/recommendations";

/** AI Recommendations zone (08-command-center-experience.md §1) — depends on recommendations' public entry point only. */
export function RecommendationPanel({ projectId, canApprove, approvalDeniedReason }: { projectId: string; canApprove: boolean; approvalDeniedReason?: string }) {
  return <RecommendationList projectId={projectId} status="proposed" canApprove={canApprove} approvalDeniedReason={approvalDeniedReason} title="AI Recommendations" />;
}
