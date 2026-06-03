import type {
  DashboardConsumptionInput,
  DashboardConsumptionError,
  DashboardViewModel,
} from './types'

function makeBaseViewModel(): DashboardViewModel {
  return {
    status: 'idle',
    healthScore: 0,
    healthLabel: '',
    executiveSummary: '',
    portfolioRecommendation: '',
    risksCount: 0,
    criticalRisksCount: 0,
    decisionsCount: 0,
    interventionsCount: 0,
    alertsCount: 0,
    hasCriticalAttention: false,
    sections: {
      healthPanel: null,
      executiveSummaryCard: null,
      topRisksTable: [],
      decisionsWidget: [],
      interventionsQueue: [],
      alertPanel: [],
    },
    warnings: [],
  }
}

export function adaptDashboardViewModel(input: DashboardConsumptionInput): DashboardViewModel {
  const base = makeBaseViewModel()

  if (input.loading) {
    return {
      ...base,
      status: 'loading',
      executiveSummary: 'Loading portfolio dashboard...',
    }
  }

  if (input.fetchError) {
    return {
      ...base,
      status: 'error',
      executiveSummary: input.fetchError.message,
      error: input.fetchError,
    }
  }

  const apiResponse = input.apiResponse as { status?: string; data?: unknown; warnings?: unknown[] } | null | undefined
  if (!apiResponse) {
    return base
  }

  const data = ((apiResponse.data ?? {}) as Record<string, unknown>)
  const warnings: string[] = Array.isArray(apiResponse.warnings) ? apiResponse.warnings as string[] : []

  if (apiResponse.status === 'error') {
    const firstWarning = warnings[0] ?? 'Dashboard data unavailable'
    const error: DashboardConsumptionError = {
      code: 'dashboard_api_http_error',
      message: firstWarning,
      recoverable: true,
    }
    return {
      ...base,
      status: 'error',
      executiveSummary: firstWarning,
      warnings,
      error,
    }
  }

  const topRisksTable: Record<string, unknown>[] = Array.isArray(data.topRisksTable) ? data.topRisksTable as Record<string, unknown>[] : []
  const decisionsWidget: Record<string, unknown>[] = Array.isArray(data.decisionsWidget) ? data.decisionsWidget as Record<string, unknown>[] : []
  const interventionsQueue: Record<string, unknown>[] = Array.isArray(data.interventionsQueue) ? data.interventionsQueue as Record<string, unknown>[] : []
  const alertPanel: Record<string, unknown>[] = Array.isArray(data.alertPanel) ? data.alertPanel as Record<string, unknown>[] : []
  const healthPanel = (data.portfolioHealthPanel ?? {}) as Record<string, unknown>
  const summaryCard = (data.executiveSummaryCard ?? {}) as Record<string, unknown>

  const healthScore: number = typeof healthPanel.score === 'number' ? healthPanel.score : 0
  const healthLabel: string = typeof healthPanel.label === 'string' ? healthPanel.label : ''
  const criticalRisksCount = topRisksTable.filter((r) => r.severity === 'critical').length
  const hasCriticalAttention =
    criticalRisksCount > 0 ||
    alertPanel.some((a) => a.severity === 'critical') ||
    healthPanel.status === 'critical'

  let status: DashboardViewModel['status']
  switch (apiResponse.status as string | undefined) {
    case 'empty':
      status = 'empty'
      break
    case 'partial':
      status = 'partial'
      break
    case 'ok':
      status = 'ready'
      break
    default:
      status = 'error'
  }

  return {
    status,
    healthScore,
    healthLabel,
    executiveSummary: typeof summaryCard.summary === 'string' ? summaryCard.summary : '',
    portfolioRecommendation: typeof summaryCard.recommendation === 'string' ? summaryCard.recommendation : '',
    risksCount: topRisksTable.length,
    criticalRisksCount,
    decisionsCount: decisionsWidget.length,
    interventionsCount: interventionsQueue.length,
    alertsCount: alertPanel.length,
    hasCriticalAttention,
    sections: {
      healthPanel,
      executiveSummaryCard: summaryCard,
      topRisksTable,
      decisionsWidget,
      interventionsQueue,
      alertPanel,
    },
    warnings,
  }
}
