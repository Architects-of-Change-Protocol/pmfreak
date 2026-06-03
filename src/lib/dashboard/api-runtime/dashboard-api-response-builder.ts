import { runDashboardRuntimeIntegration } from '../runtime-integration/dashboard-runtime-integration'
import type {
  DashboardApiRequest,
  DashboardApiResponse,
  DashboardApiMetadata,
  DashboardSourceData,
} from './types'

const RUNTIME_VERSION = '8.2.0'

export function buildFallbackDTO() {
  return {
    portfolioHealthPanel: {
      score: 0,
      status: 'critical',
      label: 'Portfolio Health Unavailable',
      trend: 'Dashboard source data unavailable',
    },
    executiveSummaryCard: {
      title: 'Portfolio Executive Summary',
      summary: 'Portfolio executive dashboard data is not available yet.',
      status: 'critical',
      recommendation:
        'Connect portfolio runtime source data before using executive dashboard decisions.',
    },
    topRisksTable: [],
    decisionsWidget: [],
    interventionsQueue: [],
    alertPanel: [
      {
        id: 'alert-dashboard-source-unavailable',
        title: 'Dashboard source data unavailable',
        type: 'source_data',
        severity: 'critical',
        description:
          'Executive dashboard aggregation output is required to hydrate the PMO dashboard.',
      },
    ],
  }
}

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

  if (!sourceData.executiveDashboardReport) {
    return {
      status: 'empty',
      data: buildFallbackDTO(),
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
