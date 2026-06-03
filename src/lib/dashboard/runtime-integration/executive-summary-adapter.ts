import type { DashboardCardStatus, ExecutiveSummaryCardDTO } from './types'

function resolveStatusFromScore(score: number): DashboardCardStatus {
  if (score >= 80) return 'healthy'
  if (score >= 65) return 'attention'
  return 'critical'
}

export function adaptExecutiveSummaryCard(executiveDashboardReport: Record<string, unknown>): ExecutiveSummaryCardDTO {
  const healthSummary = executiveDashboardReport?.healthSummary as Record<string, unknown> | undefined
  const score: number = (healthSummary?.portfolioHealthScore as number | undefined) ?? 0

  return {
    title: 'Portfolio Executive Summary',
    summary: (executiveDashboardReport?.executiveSummary as string | undefined) ?? '',
    status: resolveStatusFromScore(score),
    recommendation: (executiveDashboardReport?.portfolioRecommendation as string | undefined) ?? '',
  }
}
