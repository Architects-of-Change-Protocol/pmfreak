import type { DashboardHydrationResult } from './types'

export function buildDashboardHydrationRecoveryPlan(result: DashboardHydrationResult): {
  recoveryRequired: boolean
  actions: string[]
  fallbackMode: 'none' | 'partial' | 'empty'
} {
  const actions: string[] = []

  if (!result.sourceData.executiveDashboardReport) {
    actions.push('Regenerate executive dashboard aggregation snapshot.')
  }
  if (!result.sourceData.interventionReport) actions.push('Refresh PMO intervention report snapshot.')
  if (!(result.sourceData.decisionSimulationReports as unknown[] | undefined)?.length) actions.push('Refresh decision simulation snapshots.')
  if (!result.sourceData.conflictReport) actions.push('Refresh conflict arbitration snapshot.')

  let fallbackMode: 'none' | 'partial' | 'empty' = 'none'
  if (result.riskLevel === 'low' && result.completeness.requiredSourcesPresent) {
    fallbackMode = 'none'
  } else if (
    (result.riskLevel === 'moderate' || result.riskLevel === 'high') &&
    result.completeness.presentSources.length > 0
  ) {
    fallbackMode = 'partial'
  } else if (result.riskLevel === 'critical' && !result.sourceData.executiveDashboardReport) {
    fallbackMode = 'empty'
  }

  if (fallbackMode !== 'none') actions.push('Use fallback dashboard DTO until required source is available.')

  return { recoveryRequired: actions.length > 0, actions, fallbackMode }
}
