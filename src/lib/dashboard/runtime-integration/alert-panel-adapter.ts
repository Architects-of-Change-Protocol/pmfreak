import type { AlertPanelItemDTO } from './types'

const MAX_ALERTS = 12

export function adaptAlertPanel(
  executiveDashboardReport: Record<string, unknown>,
  interventionReport?: Record<string, unknown>,
  decisionSimulationReports?: Record<string, unknown>[],
  conflictReport?: Record<string, unknown>,
): AlertPanelItemDTO[] {
  const alerts: AlertPanelItemDTO[] = []

  // A) Critical conflicts
  const conflicts = (conflictReport?.conflicts as Record<string, unknown>[] | undefined) ?? []
  for (const conflict of conflicts) {
    if (conflict.severity === 'critical') {
      alerts.push({
        id: `conflict-${conflict.id as string}`,
        title: `Critical Conflict: ${(conflict.type as string | undefined) ?? 'Unknown'}`,
        type: 'conflict',
        severity: 'critical',
        description: (conflict.description as string | undefined) ??
          (conflict.executiveRecommendation as string | undefined) ??
          'Critical portfolio conflict detected',
      })
    }
  }

  // B) Critical interventions
  const interventions = (interventionReport?.interventions as Record<string, unknown>[] | undefined) ?? []
  for (const intervention of interventions) {
    if (intervention.urgency === 'critical') {
      alerts.push({
        id: `intervention-${intervention.id as string}`,
        title: `Critical Intervention: ${(intervention.title as string | undefined) ?? ''}`,
        type: 'intervention',
        severity: 'critical',
        description: (intervention.rationale as string | undefined) ?? 'Critical PMO intervention required',
      })
    }
  }

  // C) Escalated or rejected decision simulations
  const decisions: Record<string, unknown>[] = decisionSimulationReports ?? []
  for (const decision of decisions) {
    if (decision.recommendation === 'escalate' || decision.recommendation === 'reject') {
      alerts.push({
        id: `decision-${decision.decisionId as string}`,
        title: `Decision Escalation: ${(decision.executiveSummary as string | undefined) ?? (decision.decisionType as string | undefined) ?? ''}`,
        type: 'decision',
        severity: 'critical',
        description: (decision.recommendationRationale as string | undefined) ?? 'Decision requires executive escalation',
      })
    }
  }

  // D) Portfolio health critical state
  const healthSummary = executiveDashboardReport?.healthSummary as Record<string, unknown> | undefined
  const healthScore: number = (healthSummary?.portfolioHealthScore as number | undefined) ?? 100
  if (healthScore < 65) {
    alerts.push({
      id: 'portfolio-health-critical',
      title: 'Portfolio Health Critical',
      type: 'health',
      severity: 'critical',
      description:
        (healthSummary?.summary as string | undefined) ??
        'Portfolio health has reached critical threshold',
    })
  }

  return alerts.slice(0, MAX_ALERTS)
}
