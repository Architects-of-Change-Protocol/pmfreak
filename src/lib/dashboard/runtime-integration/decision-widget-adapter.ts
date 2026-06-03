import type { DashboardSeverity, DecisionWidgetItemDTO } from './types'

const MAX_DECISION_ITEMS = 8

function resolveDecisionSeverity(recommendation: string, confidenceScore: number): DashboardSeverity {
  if (recommendation === 'reject' || recommendation === 'escalate') return 'critical'
  if (
    confidenceScore >= 80 &&
    (recommendation === 'approve' || recommendation === 'approve_with_conditions')
  ) {
    return 'info'
  }
  return 'warning'
}

export function adaptDecisionWidget(decisionSimulationReports: Record<string, unknown>[]): DecisionWidgetItemDTO[] {
  if (!decisionSimulationReports?.length) return []

  return decisionSimulationReports.slice(0, MAX_DECISION_ITEMS).map((report: Record<string, unknown>): DecisionWidgetItemDTO => {
    const recommendation = (report.recommendation as string | undefined) ?? ''
    const confidenceScore = (report.confidenceScore as number | undefined) ?? 0
    return {
      id: (report.decisionId as string | undefined) ?? '',
      title: (report.executiveSummary as string | undefined) ?? (report.decisionType as string | undefined) ?? '',
      recommendation,
      confidenceScore,
      severity: resolveDecisionSeverity(recommendation, confidenceScore),
    }
  })
}
