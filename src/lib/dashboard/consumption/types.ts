export type DashboardConsumptionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'partial'
  | 'empty'
  | 'error'

export interface DashboardConsumptionError {
  code: string
  message: string
  recoverable: boolean
}

export interface DashboardViewModel {
  status: DashboardConsumptionStatus
  healthScore: number
  healthLabel: string
  executiveSummary: string
  portfolioRecommendation: string
  risksCount: number
  criticalRisksCount: number
  decisionsCount: number
  interventionsCount: number
  alertsCount: number
  hasCriticalAttention: boolean
  sections: {
    healthPanel: Record<string, unknown> | null
    executiveSummaryCard: Record<string, unknown> | null
    topRisksTable: Record<string, unknown>[]
    decisionsWidget: Record<string, unknown>[]
    interventionsQueue: Record<string, unknown>[]
    alertPanel: Record<string, unknown>[]
  }
  warnings: string[]
  error?: DashboardConsumptionError
}

export interface DashboardConsumptionInput {
  apiResponse?: unknown
  fetchError?: DashboardConsumptionError
  loading?: boolean
}

export interface DashboardFetchOptions {
  baseUrl?: string
  includeMetadata?: boolean
  signal?: AbortSignal
}
