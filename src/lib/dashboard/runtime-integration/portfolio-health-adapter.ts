import type { DashboardCardStatus, PortfolioHealthPanelDTO } from './types'

function resolveHealthStatus(score: number): DashboardCardStatus {
  if (score >= 80) return 'healthy'
  if (score >= 65) return 'attention'
  return 'critical'
}

function resolveHealthTrend(status: DashboardCardStatus): string {
  if (status === 'healthy') return 'Stable governance posture'
  if (status === 'attention') return 'Emerging portfolio pressure'
  return 'Immediate executive intervention required'
}

export function adaptPortfolioHealthPanel(executiveDashboardReport: Record<string, unknown>): PortfolioHealthPanelDTO {
  const healthSummary = executiveDashboardReport?.healthSummary as Record<string, unknown> | undefined
  const score: number = (healthSummary?.portfolioHealthScore as number | undefined) ?? 0
  const status = resolveHealthStatus(score)

  return {
    score,
    status,
    label: (healthSummary?.summary as string | undefined) ?? 'Portfolio health data unavailable',
    trend: resolveHealthTrend(status),
  }
}
