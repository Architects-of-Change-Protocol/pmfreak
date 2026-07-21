import { runDashboardRuntimeIntegration } from '../runtime-integration/dashboard-runtime-integration'
import type {
  DashboardApiRequest,
  DashboardApiResponse,
  DashboardApiMetadata,
  DashboardSourceData,
} from './types'

const RUNTIME_VERSION = '8.2.0'

export function buildDashboardApiResponse({
  request,
  sourceData,
  warnings,
}: {
  request: DashboardApiRequest
  sourceData: DashboardSourceData
  warnings: string[]
}): DashboardApiResponse {
  const generatedAt = new Date().toISOString()
  const shouldIncludeMetadata = request.includeMetadata !== false

  const sourceSignals = {
    executiveDashboardReport: !!sourceData.executiveDashboardReport,
    interventionReport: !!sourceData.interventionReport,
    decisionSimulationReports: !!(
      sourceData.decisionSimulationReports &&
      (sourceData.decisionSimulationReports as unknown[]).length > 0
    ),
    conflictReport: !!sourceData.conflictReport,
  }

  const metadata: DashboardApiMetadata = {
    generatedAt,
    tenantId: request.tenantId,
    ...(request.workspaceId !== undefined && { workspaceId: request.workspaceId }),
    ...(request.portfolioId !== undefined && { portfolioId: request.portfolioId }),
    sourceSignals,
    runtimeVersion: RUNTIME_VERSION,
  }

  // Absence of workspace data is a first-class empty state: data stays null
  // so no layer downstream can mistake fabricated placeholders for metrics.
  if (!sourceData.executiveDashboardReport) {
    return {
      status: 'empty',
      data: null,
      ...(shouldIncludeMetadata && { metadata }),
      warnings,
    }
  }

  const data = runDashboardRuntimeIntegration({
    executiveDashboardReport: sourceData.executiveDashboardReport as Record<string, unknown>,
    interventionReport: sourceData.interventionReport as Record<string, unknown> | undefined,
    decisionSimulationReports: sourceData.decisionSimulationReports as Record<string, unknown>[] | undefined,
    conflictReport: sourceData.conflictReport as Record<string, unknown> | undefined,
  })

  const status = warnings.length > 0 ? 'partial' : 'ok'

  return {
    status,
    data,
    ...(shouldIncludeMetadata && { metadata }),
    warnings,
  }
}
