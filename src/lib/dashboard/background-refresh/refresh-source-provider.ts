import type { DashboardSourceKind } from '../source-hydration/index'
import type { DashboardSourceRefreshProvider } from './types'

export function createStaticDashboardSourceProvider(input: {
  sourceKind: DashboardSourceKind
  payload: unknown
  schemaVersion?: string
  runtimeVersion?: string
  ttlMinutes?: number
}): DashboardSourceRefreshProvider {
  return {
    sourceKind: input.sourceKind,
    async refresh({ now }) {
      const expiresAt =
        input.ttlMinutes != null
          ? new Date(Date.parse(now) + input.ttlMinutes * 60000).toISOString()
          : undefined
      return {
        payload: input.payload,
        schemaVersion: input.schemaVersion ?? '1',
        runtimeVersion: input.runtimeVersion ?? '1',
        expiresAt,
      }
    },
  }
}

export function createDefaultDashboardSourceProviders(payloads?: {
  executiveDashboardReport?: unknown
  interventionReport?: unknown
  decisionSimulationReports?: unknown[]
  conflictReport?: unknown
}): Partial<Record<DashboardSourceKind, DashboardSourceRefreshProvider>> {
  const result: Partial<Record<DashboardSourceKind, DashboardSourceRefreshProvider>> = {}
  if (!payloads) return result

  if (payloads.executiveDashboardReport !== undefined) {
    result['executive_dashboard_report'] = createStaticDashboardSourceProvider({
      sourceKind: 'executive_dashboard_report',
      payload: payloads.executiveDashboardReport,
    })
  }
  if (payloads.interventionReport !== undefined) {
    result['intervention_report'] = createStaticDashboardSourceProvider({
      sourceKind: 'intervention_report',
      payload: payloads.interventionReport,
    })
  }
  if (payloads.decisionSimulationReports !== undefined) {
    result['decision_simulation_reports'] = createStaticDashboardSourceProvider({
      sourceKind: 'decision_simulation_reports',
      payload: payloads.decisionSimulationReports,
    })
  }
  if (payloads.conflictReport !== undefined) {
    result['conflict_report'] = createStaticDashboardSourceProvider({
      sourceKind: 'conflict_report',
      payload: payloads.conflictReport,
    })
  }

  return result
}
