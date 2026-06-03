import type { DashboardApiRequest, DashboardSourceData } from './types'

export function resolveDashboardSourceData(
  _request: DashboardApiRequest,
  preloadedSourceData?: DashboardSourceData,
): { sourceData: DashboardSourceData; warnings: string[] } {
  const warnings: string[] = []
  const raw = preloadedSourceData ?? {}

  if (!raw.executiveDashboardReport) {
    warnings.push('Executive dashboard report unavailable; returning fallback dashboard DTO.')
  }

  if (!raw.interventionReport) {
    warnings.push('PMO intervention report unavailable.')
  }

  if (!raw.decisionSimulationReports || (raw.decisionSimulationReports as unknown[]).length === 0) {
    warnings.push('Decision simulation reports unavailable.')
  }

  if (!raw.conflictReport) {
    warnings.push('Conflict report unavailable.')
  }

  const sourceData: DashboardSourceData = {
    executiveDashboardReport: raw.executiveDashboardReport,
    interventionReport: raw.interventionReport,
    decisionSimulationReports: raw.decisionSimulationReports,
    conflictReport: raw.conflictReport,
  }

  return { sourceData, warnings }
}
